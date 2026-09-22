/**
 * Guards what anonymous callers can learn from the deployed Worker: public
 * endpoints carry research results, never operational telemetry, routing
 * details, or upstream error text.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "@/worker/index";
import { toPublicReasonError } from "@/routing/reasonResponse";

const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

type TestEnv = Parameters<typeof worker.fetch>[1];

function call(
  path: string,
  init: RequestInit = {},
  env: TestEnv = {},
): Promise<Response> {
  return worker.fetch(new Request(`https://lab.test${path}`, init), env, ctx);
}

function postReason(input: string, env: TestEnv = {}, headers = {}) {
  return call(
    "/reason",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ input }),
    },
    env,
  );
}

const OPERATIONAL_KEYS = [
  "requests",
  "latency",
  "llmRouting",
  "fallbackRate",
  "llmProvider",
  "llmError",
  "confidence",
];

function keysOf(value: unknown, found: string[] = []): string[] {
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      found.push(key);
      keysOf(nested, found);
    }
  }
  return found;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /metrics is operator-only", () => {
  it("is indistinguishable from an unknown path without a token", async () => {
    const unconfigured = await call("/metrics");
    const unknown = await call("/does-not-exist");
    expect(unconfigured.status).toBe(404);
    expect(await unconfigured.json()).toEqual(await unknown.json());
  });

  it("rejects a wrong token", async () => {
    const res = await call(
      "/metrics",
      { headers: { Authorization: "Bearer wrong" } },
      { METRICS_TOKEN: "right-token" },
    );
    expect(res.status).toBe(404);
  });

  it("serves telemetry with the configured bearer token", async () => {
    const res = await call(
      "/metrics",
      { headers: { Authorization: "Bearer right-token" } },
      { METRICS_TOKEN: "right-token" },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(body.data).toHaveProperty("llmRouting");
  });

  it("is not advertised in the 404 endpoint list", async () => {
    const body = (await (await call("/nope")).json()) as {
      availableEndpoints: string[];
    };
    expect(body.availableEndpoints).not.toContain("/metrics");
  });
});

describe("public endpoints carry no operational telemetry", () => {
  for (const path of ["/status", "/capabilities", "/health"]) {
    it(`${path}`, async () => {
      const res = await call(path);
      expect(res.status).toBe(200);
      const keys = keysOf(await res.json());
      for (const banned of OPERATIONAL_KEYS) {
        expect(keys).not.toContain(banned);
      }
    });
  }

  it("the dashboard does not render or fetch traffic counters", async () => {
    const html = await (await call("/")).text();
    expect(html).not.toContain("/metrics");
    expect(html).not.toMatch(/Request Activity/);
  });
});

describe("POST /reason", () => {
  it("does not reveal which provider answered", async () => {
    const res = await postReason("144 / 12");
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(body.data.answerSource).toBe("local-arithmetic");
    for (const banned of OPERATIONAL_KEYS) {
      expect(keysOf(body)).not.toContain(banned);
    }
  });

  it("never returns upstream error bodies", async () => {
    const upstreamSecret = "origin=internal-backend.example quota-remaining=3";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(upstreamSecret, { status: 401 })),
    );
    const res = await postReason("What is the capital of Japan?", {
      BLEUJS_API_KEY: "bleujs_sk_test",
    });
    const text = await res.text();
    expect(text).not.toContain("internal-backend");
    expect(text).not.toContain("quota");
    expect(text).not.toContain("BleuJS API error");
    const body = JSON.parse(text) as { data: { error: { code: string } } };
    expect(body.data.error.code).toBe("model_unavailable");
  });

  it("reports an unconfigured model without naming env vars", async () => {
    const text = await (await postReason("Why is the sky blue?")).text();
    expect(text).not.toMatch(/API_KEY|secret/i);
    expect(JSON.parse(text).data.error.code).toBe("model_not_configured");
  });

  it("returns 429 when the rate limiter denies the client", async () => {
    const limiter = { limit: vi.fn(async () => ({ success: false })) };
    const res = await postReason(
      "2 + 2",
      { REASON_RATE_LIMITER: limiter },
      { "CF-Connecting-IP": "203.0.113.7" },
    );
    expect(res.status).toBe(429);
    expect(limiter.limit).toHaveBeenCalledWith({ key: "203.0.113.7" });
  });
});

describe("toPublicReasonError", () => {
  it("maps upstream statuses to fixed codes", () => {
    expect(toPublicReasonError(new Error("BleuJS API error: 429 - x"))).toEqual(
      { code: "model_rate_limited", retryable: true },
    );
    expect(
      toPublicReasonError(new Error("NVIDIA query failed: API error: 522 - x")),
    ).toEqual({ code: "model_temporarily_unavailable", retryable: true });
    expect(toPublicReasonError("anything else")).toEqual({
      code: "model_unavailable",
      retryable: false,
    });
  });
});
