import { afterEach, describe, expect, it, vi } from "vitest";
import { RealLLMIntegration } from "@/routing/RealLLMIntegration";

function requestHostname(url: string): string {
  return new URL(url).hostname;
}

describe("RealLLMIntegration BleuJS", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls BleuJS chat API first when key is set", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        choices: [{ message: { content: "Tehran is in Iran." } }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const llm = new RealLLMIntegration(
      undefined,
      undefined,
      undefined,
      undefined,
      "bleujs_sk_test",
    );
    const result = await llm.answerQuestion("where is tehran", {
      systemPrompt: "Be concise.",
      maxTokens: 256,
    });

    expect(result.answer).toBe("Tehran is in Iran.");
    expect(result.provider).toBe("bleujs");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.bleujs.org/api/v1/chat");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer bleujs_sk_test",
    });
  });

  it("uses a custom BleuJS chat URL when provided", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        choices: [{ message: { content: "ok" } }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const llm = new RealLLMIntegration(
      undefined,
      undefined,
      undefined,
      undefined,
      "bleujs_sk_test",
      "https://bleujs.example.com/api/v1/chat",
    );
    await llm.answerQuestion("hi");

    expect(requestHostname((fetchMock.mock.calls[0] as [string])[0])).toBe(
      "bleujs.example.com",
    );
  });

  it("is available when only BleuJS key is configured", () => {
    const llm = new RealLLMIntegration(
      undefined,
      undefined,
      undefined,
      undefined,
      "bleujs_sk_test",
    );
    expect(llm.isAvailable()).toBe(true);
    expect(llm.getAvailableModels()).toContain("bleujs-chat");
  });

  it("does not fall back to Anthropic when fallback is disabled", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (requestHostname(url) === "api.anthropic.com") {
        return Response.json({ content: [{ text: "Claude answer" }] });
      }
      return Response.json({ error: "service unavailable" }, { status: 503 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const llm = new RealLLMIntegration(
      "anthropic_sk_test",
      undefined,
      undefined,
      undefined,
      "bleujs_sk_test",
      undefined,
      false,
    );

    await expect(llm.answerQuestion("hi")).rejects.toThrow(
      /BleuJS API error: 503/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(requestHostname((fetchMock.mock.calls[0] as [string])[0])).toBe(
      "api.bleujs.org",
    );
  });

  it("falls back to Anthropic when fallback is enabled", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (requestHostname(url) === "api.anthropic.com") {
        return Response.json({ content: [{ text: "Claude answer" }] });
      }
      return Response.json({ error: "service unavailable" }, { status: 503 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const llm = new RealLLMIntegration(
      "anthropic_sk_test",
      undefined,
      undefined,
      undefined,
      "bleujs_sk_test",
      undefined,
      true,
    );

    const result = await llm.answerQuestion("hi");
    expect(result.provider).toBe("anthropic");
    expect(result.answer).toBe("Claude answer");
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it("does not retry BleuJS on non-retryable HTTP errors", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ error: "invalid key" }, { status: 401 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const llm = new RealLLMIntegration(
      undefined,
      undefined,
      undefined,
      undefined,
      "bleujs_sk_test",
    );

    await expect(llm.answerQuestion("hi")).rejects.toThrow(
      /BleuJS API error: 401/,
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("is available when only NVIDIA key is configured", () => {
    const llm = RealLLMIntegration.create({ nvidiaKey: "nvapi_test" });
    expect(llm.isAvailable()).toBe(true);
    expect(llm.getAvailableModels()).toContain(
      "nvidia/nemotron-3.5-lightning-30b-a3b",
    );
  });

  it("falls back to NVIDIA Lightning before Anthropic when fallback is enabled", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (requestHostname(url) === "integrate.api.nvidia.com") {
        return Response.json({
          choices: [{ message: { content: "Nemotron answer" } }],
        });
      }
      if (requestHostname(url) === "api.anthropic.com") {
        return Response.json({ content: [{ text: "Claude answer" }] });
      }
      return Response.json({ error: "service unavailable" }, { status: 503 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const llm = RealLLMIntegration.create({
      bleujsKey: "bleujs_sk_test",
      nvidiaKey: "nvapi_test",
      anthropicKey: "anthropic_sk_test",
      allowFallback: true,
    });

    const result = await llm.answerQuestion("hi");
    expect(result.provider).toBe("nvidia");
    expect(result.answer).toBe("Nemotron answer");
    expect(result.model).toBe("nvidia/nemotron-3.5-lightning-30b-a3b");
    expect(
      fetchMock.mock.calls.some(
        ([url]) => requestHostname(String(url)) === "integrate.api.nvidia.com",
      ),
    ).toBe(true);
    expect(
      fetchMock.mock.calls.some(
        ([url]) => requestHostname(String(url)) === "api.anthropic.com",
      ),
    ).toBe(false);
  });

  it("does not call NVIDIA when BleuJS fails and fallback is disabled", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (requestHostname(url) === "integrate.api.nvidia.com") {
        return Response.json({
          choices: [{ message: { content: "Nemotron answer" } }],
        });
      }
      return Response.json({ error: "service unavailable" }, { status: 503 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const llm = RealLLMIntegration.create({
      bleujsKey: "bleujs_sk_test",
      nvidiaKey: "nvapi_test",
      allowFallback: false,
    });

    await expect(llm.answerQuestion("hi")).rejects.toThrow(
      /BleuJS API error: 503/,
    );
    expect(
      fetchMock.mock.calls.some(
        ([url]) => requestHostname(String(url)) === "integrate.api.nvidia.com",
      ),
    ).toBe(false);
  });
});
