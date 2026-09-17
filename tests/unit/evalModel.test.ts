import { afterEach, describe, expect, it, vi } from "vitest";
import {
  askEvalModel,
  extractFinalAnswer,
} from "@/evals/model/evalModelClient";
import {
  DEFAULT_EVAL_MAX_TOKENS,
  DEFAULT_EVAL_TIMEOUT_MS,
  EVAL_ENV_API_KEY,
  NVIDIA_REASONING_TEMPERATURE,
  NVIDIA_REASONING_TOP_P,
  resolveEvalModel,
} from "@/evals/model/evalModelConfig";
import { numbersMatch } from "@/evals/benchmarks/modelRunner";
import { RealLLMIntegration } from "@/routing/RealLLMIntegration";

const EVAL_ENV = {
  [EVAL_ENV_API_KEY]: "nvapi_eval_test",
  NVIDIA_EVAL_CHAT_MODEL: "nvidia/nemotron-3-super-120b-a12b",
};

function nvidiaResponse(
  message: { content?: string; reasoning_content?: string },
  finishReason = "stop",
) {
  return Response.json({
    choices: [{ finish_reason: finishReason, message }],
    usage: { prompt_tokens: 20, completion_tokens: 5 },
  });
}

describe("eval model config", () => {
  it("applies NVIDIA's documented reasoning settings by default", () => {
    const { apiKey, config } = resolveEvalModel(EVAL_ENV);

    expect(apiKey).toBe("nvapi_eval_test");
    expect(config.model).toBe("nvidia/nemotron-3-super-120b-a12b");
    expect(config.temperature).toBe(NVIDIA_REASONING_TEMPERATURE);
    expect(config.topP).toBe(NVIDIA_REASONING_TOP_P);
    expect(config.maxTokens).toBe(DEFAULT_EVAL_MAX_TOKENS);
    expect(config.reasoning).toBe("on");
  });

  it("never borrows the production NVIDIA credential", () => {
    expect(() =>
      resolveEvalModel({
        NVIDIA_API_KEY: "nvapi_production",
        NVIDIA_CHAT_MODEL: "nvidia/nemotron-3.5-lightning-30b-a3b",
      }),
    ).toThrow(/NVIDIA_EVAL_API_KEY is not set/);
  });

  it("bounds every request with a timeout", async () => {
    const fetchMock = vi.fn(async () =>
      nvidiaResponse({ content: "FINAL: 4" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const model = resolveEvalModel(EVAL_ENV);
    expect(model.config.timeoutMs).toBe(DEFAULT_EVAL_TIMEOUT_MS);

    await askEvalModel(model, { system: "grade me", user: "2 + 2" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("records an exhausted timeout as inconclusive", async () => {
    const fetchMock = vi.fn(async () => {
      const error = new Error("The operation was aborted due to timeout");
      error.name = "TimeoutError";
      throw error;
    });
    vi.stubGlobal("fetch", fetchMock);

    const attempt = await askEvalModel(
      resolveEvalModel(EVAL_ENV, { timeoutMs: 10 }),
      { system: "grade me", user: "2 + 2" },
    );

    expect(attempt.inconclusive).toBe(true);
    expect(attempt.error).toMatch(/timed out/);
  });

  it("rejects a non-positive run count", () => {
    expect(() => resolveEvalModel(EVAL_ENV, { runs: 0 })).toThrow(
      /positive integer/,
    );
  });
});

describe("production routing isolation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the eval model out of the /reason fallback chain", async () => {
    const fetchMock = vi.fn(async () => nvidiaResponse({ content: "ok" }));
    vi.stubGlobal("fetch", fetchMock);

    // Production is configured exactly as the Worker configures it: from
    // NVIDIA_API_KEY / NVIDIA_CHAT_MODEL, which the eval config never sets.
    const llm = RealLLMIntegration.create({ nvidiaKey: "nvapi_production" });
    await llm.answerQuestion("where is tehran");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      model: string;
      chat_template_kwargs: { enable_thinking: boolean };
    };

    expect(body.model).toBe("nvidia/nemotron-3.5-lightning-30b-a3b");
    expect(body.model).not.toContain("super");
    expect(body.chat_template_kwargs.enable_thinking).toBe(false);
    expect(llm.getAvailableModels()).not.toContain(
      "nvidia/nemotron-3-super-120b-a12b",
    );
  });
});

describe("arithmetic grading", () => {
  it("requires exact equality for integers regardless of magnitude", () => {
    expect(numbersMatch(49696562936559, 49696562936559)).toBe(true);
    // A near miss on a 14-digit product must not pass as an exact match.
    expect(numbersMatch(49696562936560, 49696562936559)).toBe(false);
    expect(numbersMatch(49696512936559, 49696562936559)).toBe(false);
    expect(numbersMatch(-18914003885551, -18914003885552)).toBe(false);
  });

  it("absorbs only floating-point rounding on decimal items", () => {
    expect(numbersMatch(10004511.184645, 10004511.184645)).toBe(true);
    expect(numbersMatch(0.1 + 0.2, 0.3)).toBe(true);
    expect(numbersMatch(90.0000009, 90.0000081)).toBe(false);
  });
});

describe("final answer extraction", () => {
  it("reads the text after the last FINAL marker", () => {
    expect(extractFinalAnswer("Some working.\nFINAL: 124")).toBe("124");
    expect(extractFinalAnswer("FINAL: 1\nrestated\nFINAL: 437")).toBe("437");
  });

  it("strips markdown emphasis and falls back to the last line", () => {
    expect(extractFinalAnswer("FINAL: **calculator**")).toBe("calculator");
    expect(extractFinalAnswer("thinking out loud\ncalculator")).toBe(
      "calculator",
    );
  });

  it("returns null for empty content", () => {
    expect(extractFinalAnswer("   \n  ")).toBeNull();
  });
});

describe("askEvalModel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends NVIDIA's reasoning parameters and enables thinking", async () => {
    const fetchMock = vi.fn(async () =>
      nvidiaResponse({ content: "FINAL: 124", reasoning_content: "48+76" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const attempt = await askEvalModel(resolveEvalModel(EVAL_ENV), {
      system: "grade me",
      user: "48 + 76",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://integrate.api.nvidia.com/v1/chat/completions");
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "nvidia/nemotron-3-super-120b-a12b",
      temperature: 1,
      top_p: 0.95,
      max_tokens: DEFAULT_EVAL_MAX_TOKENS,
      chat_template_kwargs: { enable_thinking: true },
    });
    expect(attempt.answer).toBe("124");
    expect(attempt.reasoningChars).toBeGreaterThan(0);
  });

  it("disables thinking when the variant asks for it", async () => {
    const fetchMock = vi.fn(async () =>
      nvidiaResponse({ content: "FINAL: 4" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await askEvalModel(resolveEvalModel(EVAL_ENV, { reasoning: "off" }), {
      system: "grade me",
      user: "2 + 2",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      chat_template_kwargs: { enable_thinking: false },
    });
  });

  it("keeps reasoning enabled and adds low_effort for the low variant", async () => {
    const fetchMock = vi.fn(async () =>
      nvidiaResponse({ content: "FINAL: 4" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await askEvalModel(resolveEvalModel(EVAL_ENV, { reasoning: "low" }), {
      system: "grade me",
      user: "2 + 2",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    // low_effort is a nudge on top of reasoning, not a way to disable it.
    expect(JSON.parse(String(init.body))).toMatchObject({
      chat_template_kwargs: { enable_thinking: true, low_effort: true },
    });
  });

  it("omits low_effort outside the low variant", async () => {
    const fetchMock = vi.fn(async () =>
      nvidiaResponse({ content: "FINAL: 4" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await askEvalModel(resolveEvalModel(EVAL_ENV), {
      system: "grade me",
      user: "2 + 2",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      chat_template_kwargs: Record<string, unknown>;
    };
    expect(body.chat_template_kwargs).not.toHaveProperty("low_effort");
  });

  it("keeps the reasoning trace out of the graded answer", async () => {
    const fetchMock = vi.fn(async () =>
      nvidiaResponse({
        content: "<think>maybe 130? no, 124</think>FINAL: 124",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const attempt = await askEvalModel(resolveEvalModel(EVAL_ENV), {
      system: "grade me",
      user: "48 + 76",
    });

    expect(attempt.answer).toBe("124");
    expect(attempt.content).not.toContain("maybe 130");
  });

  it("reports a truncated thinking trace as an error, not an answer", async () => {
    const fetchMock = vi.fn(async () =>
      nvidiaResponse(
        { content: "", reasoning_content: "let me start by adding" },
        "length",
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const attempt = await askEvalModel(resolveEvalModel(EVAL_ENV), {
      system: "grade me",
      user: "48 + 76",
    });

    expect(attempt.answer).toBeNull();
    expect(attempt.truncated).toBe(true);
    expect(attempt.error).toMatch(/truncated after 16000 tokens/);
  });

  it("retries a rate-limited request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("slow down", {
          status: 429,
          headers: { "retry-after": "0" },
        }),
      )
      .mockResolvedValueOnce(nvidiaResponse({ content: "FINAL: 124" }));
    vi.stubGlobal("fetch", fetchMock);

    const attempt = await askEvalModel(resolveEvalModel(EVAL_ENV), {
      system: "grade me",
      user: "48 + 76",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(attempt.answer).toBe("124");
    expect(attempt.error).toBeNull();
    expect(attempt.inconclusive).toBe(false);
  });

  it("marks an exhausted rate limit inconclusive rather than wrong", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response('{"status":429}', {
          status: 429,
          headers: { "retry-after": "0" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const attempt = await askEvalModel(resolveEvalModel(EVAL_ENV), {
      system: "grade me",
      user: "48 + 76",
    });

    expect(attempt.inconclusive).toBe(true);
    expect(attempt.answer).toBeNull();
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  });

  it("treats a model-side 400 as a real failure, not a retryable one", async () => {
    const fetchMock = vi.fn(
      async () => new Response("bad request", { status: 400 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const attempt = await askEvalModel(resolveEvalModel(EVAL_ENV), {
      system: "grade me",
      user: "48 + 76",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(attempt.inconclusive).toBe(false);
    expect(attempt.error).toMatch(/400/);
  });
});
