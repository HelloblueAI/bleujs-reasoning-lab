/**
 * BleuJS Reasoning Lab — production worker (dashboard + API)
 */

import { RealLLMIntegration } from "@/routing/RealLLMIntegration";
import { runBenchmarkSuite } from "@/evals/benchmarks/runner";
import { getOfflineBenchmarkSummary } from "@/metrics/benchmarkSummary";
import { buildCapabilitiesEndpointPayload } from "@/metrics/endpointResponses";
import {
  buildLabMetricsPayload,
  buildLabStatusPayload,
  GITHUB_REPO,
  LAB_NAME,
  LAB_VERSION,
} from "@/metrics/labStatus";
import {
  buildHonestReasonResponse,
  MODEL_NOT_CONFIGURED,
  toPublicReasonError,
  type ReasonError,
} from "@/routing/reasonResponse";
import { hasBearerToken, isWithinRateLimit, type RateLimiter } from "./access";
import {
  stripMarkdownEmphasis,
  tryArithmeticReason,
} from "@/routing/arithmeticReason";
import {
  getReasonMaxTokens,
  getReasonSystemPrompt,
  isSimpleFactualQuestion,
} from "@/routing/reasonPrompt";
import {
  buildLlmRoutingPayload,
  readLlmRoutingFromKv,
  recordLlmRoutingInKv,
} from "@/routing/llmRoutingMetrics";
import {
  getLatencySummary,
  getLlmProviderCounters,
  getRequestCounters,
  incrementEval,
  incrementReasoning,
  recordLatency,
  recordReasonProvider,
  type ReasonProvider,
} from "@/metrics/requestCounters";

/** Structured log for Workers Observability (JSON parseable). */
function logEvent(
  level: "info" | "warn" | "error",
  message: string,
  extra?: Record<string, unknown>,
): void {
  const payload = { level, message, ts: Date.now(), ...extra };
  const out = JSON.stringify(payload);
  if (level === "error") console.error(out);
  else if (level === "warn") console.warn(out);
  else console.log(out);
}

// Process-scoped provider client (no request data stored here)
let llmIntegration: RealLLMIntegration | null = null;
let llmConfigFingerprint: string | null = null;

/** Env: secrets via wrangler secret put; optional AGI_CACHE KV binding for response cache. Run `wrangler types` to sync with config. */
interface Env {
  BLEUJS_API_KEY?: string;
  /** Override the BleuJS chat endpoint. */
  BLEUJS_CHAT_URL?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  NVIDIA_API_KEY?: string;
  /** Override NVIDIA NIM chat endpoint (defaults to integrate.api.nvidia.com). */
  NVIDIA_CHAT_URL?: string;
  NVIDIA_CHAT_MODEL?: string;
  ENVIRONMENT?: string;
  ALLOW_LLM_FALLBACK?: string;
  AGI_CACHE?: KVNamespace;
  /** Bearer token for GET /metrics. Unset = /metrics is not served. */
  METRICS_TOKEN?: string;
  /** Optional Workers Rate Limiting binding applied to POST /reason. */
  REASON_RATE_LIMITER?: RateLimiter;
}

/** The offline suite is deterministic, so one run per isolate serves every caller. */
let offlineEvalRun: ReturnType<typeof runBenchmarkSuite> | null = null;

function recordReasonProviderForMetrics(
  env: Env,
  ctx: ExecutionContext,
  provider: ReasonProvider,
): void {
  recordReasonProvider(provider);
  if (env.AGI_CACHE) {
    ctx.waitUntil(recordLlmRoutingInKv(env.AGI_CACHE, provider));
  }
}

async function getLlmRoutingForMetrics(env: Env) {
  if (env.AGI_CACHE) {
    const counts = await readLlmRoutingFromKv(env.AGI_CACHE);
    return buildLlmRoutingPayload(counts, "global");
  }
  return getLlmProviderCounters();
}

// Helper function to validate and sanitize input
function validateInput(
  input: string,
  maxLength: number = 10000,
): { valid: boolean; sanitized?: string; error?: string } {
  if (!input || typeof input !== "string") {
    return { valid: false, error: "Input must be a non-empty string" };
  }

  if (input.length > maxLength) {
    return {
      valid: false,
      error: `Input exceeds maximum length of ${maxLength} characters`,
    };
  }

  // Basic sanitization - remove potentially dangerous characters
  const sanitized = input.trim().slice(0, maxLength);

  return { valid: true, sanitized };
}

function hashForFingerprint(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function llmEnvFingerprint(env: Env): string {
  return [
    hashForFingerprint(env.BLEUJS_API_KEY ?? ""),
    hashForFingerprint(env.BLEUJS_CHAT_URL?.trim() ?? ""),
    hashForFingerprint(env.ANTHROPIC_API_KEY ?? ""),
    hashForFingerprint(env.OPENAI_API_KEY ?? ""),
    hashForFingerprint(env.NVIDIA_API_KEY ?? ""),
    hashForFingerprint(env.NVIDIA_CHAT_URL?.trim() ?? ""),
    hashForFingerprint(env.NVIDIA_CHAT_MODEL?.trim() ?? ""),
    env.ALLOW_LLM_FALLBACK ?? "",
  ].join("|");
}

function hasAnyLlmKey(env: Env): boolean {
  return !!(
    env.BLEUJS_API_KEY ||
    env.NVIDIA_API_KEY ||
    env.ANTHROPIC_API_KEY ||
    env.OPENAI_API_KEY
  );
}

function ensureLlmIntegration(env: Env): RealLLMIntegration | null {
  if (!hasAnyLlmKey(env)) {
    llmIntegration = null;
    llmConfigFingerprint = null;
    return null;
  }

  const fingerprint = llmEnvFingerprint(env);
  if (!llmIntegration || llmConfigFingerprint !== fingerprint) {
    llmIntegration = RealLLMIntegration.create({
      anthropicKey: env.ANTHROPIC_API_KEY,
      openaiKey: env.OPENAI_API_KEY,
      bleujsKey: env.BLEUJS_API_KEY,
      bleujsChatUrl: env.BLEUJS_CHAT_URL?.trim() || undefined,
      allowFallback: env.ALLOW_LLM_FALLBACK === "true",
      nvidiaKey: env.NVIDIA_API_KEY,
      nvidiaChatUrl: env.NVIDIA_CHAT_URL?.trim() || undefined,
      nvidiaModel: env.NVIDIA_CHAT_MODEL?.trim() || undefined,
    });
    llmConfigFingerprint = fingerprint;
    console.log(
      "✓ Real LLM Integration initialized (BleuJS" +
        (env.NVIDIA_API_KEY ? " + NVIDIA" : "") +
        (env.ALLOW_LLM_FALLBACK === "true" ? " + fallback" : " only") +
        ")",
    );
  }

  return llmIntegration;
}

/** Resolves the provider client. The lab has no other request-time state. */
function safeInitializeSystems(env: Env): { errors: string[] } {
  const errors: string[] = [];

  try {
    ensureLlmIntegration(env);
  } catch (error) {
    errors.push(
      `LLM integration initialization failed: ${(error as Error).message}`,
    );
    console.warn("LLM integration unavailable:", error);
  }

  if (!hasAnyLlmKey(env)) {
    console.warn("⚠ LLM integration disabled: API keys not configured");
  }

  return { errors };
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Enhanced headers with security and performance
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    };

    const htmlHeaders = {
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check endpoint (lightweight, no initialization required)
    if (path === "/health" && request.method === "GET") {
      return new Response(
        JSON.stringify({
          status: "healthy",
          system: LAB_NAME,
          timestamp: Date.now(),
          version: LAB_VERSION,
        }),
        { headers: corsHeaders },
      );
    }

    try {
      // Initialize systems with error handling
      const initResult = await safeInitializeSystems(env);

      if (initResult.errors.length > 0) {
        logEvent("warn", "init_partial", { errors: initResult.errors, path });
      }

      const llmAvailable = llmIntegration
        ? llmIntegration.isAvailable()
        : false;
      const benchmarks = getOfflineBenchmarkSummary();

      if (path === "/status" && request.method === "GET") {
        const cacheKey = "lab:status:v2";
        const cached = env.AGI_CACHE ? await env.AGI_CACHE.get(cacheKey) : null;
        if (cached) {
          logEvent("info", "cache_hit", { path: "/status" });
          return new Response(cached, { headers: corsHeaders });
        }
        const statusBody = JSON.stringify({
          success: true,
          data: buildLabStatusPayload({ llmAvailable, benchmarks }),
        });
        if (env.AGI_CACHE) {
          ctx.waitUntil(
            env.AGI_CACHE.put(cacheKey, statusBody, { expirationTtl: 60 }),
          );
        }
        return new Response(statusBody, { headers: corsHeaders });
      }

      if (path === "/capabilities" && request.method === "GET") {
        const cacheKey = "agi:capabilities";
        const cached = env.AGI_CACHE ? await env.AGI_CACHE.get(cacheKey) : null;
        if (cached) {
          logEvent("info", "cache_hit", { path: "/capabilities" });
          return new Response(cached, { headers: corsHeaders });
        }
        const body = JSON.stringify({
          success: true,
          data: buildCapabilitiesEndpointPayload(benchmarks, llmAvailable),
        });
        if (env.AGI_CACHE) {
          ctx.waitUntil(
            env.AGI_CACHE.put(cacheKey, body, { expirationTtl: 60 }),
          );
        }
        return new Response(body, { headers: corsHeaders });
      }

      // Operational telemetry: operators only. Unauthorized callers get the
      // same 404 as an unknown path so the endpoint cannot be discovered.
      if (
        path === "/metrics" &&
        request.method === "GET" &&
        (await hasBearerToken(request, env.METRICS_TOKEN))
      ) {
        const metricsBody = JSON.stringify({
          success: true,
          data: buildLabMetricsPayload({
            llmAvailable,
            counters: getRequestCounters(),
            latency: getLatencySummary(),
            benchmarks,
            llmRouting: await getLlmRoutingForMetrics(env),
          }),
        });
        return new Response(metricsBody, {
          headers: { ...corsHeaders, "Cache-Control": "no-store" },
        });
      }

      // Runs the offline suite live. The Worker cannot know which commit it was
      // built from, so `gitSha` is null rather than borrowing the SHA from the
      // committed results — a deploy that did not refresh that file would
      // otherwise attribute live scores to the wrong commit. Cite
      // GET /capabilities, which reports a run that does have a SHA.
      if (path === "/eval" && request.method === "GET") {
        incrementEval();
        offlineEvalRun ??= runBenchmarkSuite(null).catch((error: unknown) => {
          offlineEvalRun = null;
          throw error;
        });
        const evalResult = await offlineEvalRun;
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              ...evalResult,
              note: "Run on the deployed Worker (once per isolate — the suite is deterministic); not attributed to a commit. For a citable result see GET /capabilities.",
            },
          }),
          { headers: corsHeaders },
        );
      }

      if (path === "/reason" && request.method === "POST") {
        if (!(await isWithinRateLimit(request, env.REASON_RATE_LIMITER))) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Too many requests. Please retry shortly.",
            }),
            {
              status: 429,
              headers: { ...corsHeaders, "Retry-After": "60" },
            },
          );
        }

        // Validate request size (limit to 1MB)
        const contentLength = request.headers.get("content-length");
        if (contentLength && parseInt(contentLength) > 1024 * 1024) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Request body too large. Maximum size is 1MB.",
            }),
            {
              status: 413,
              headers: corsHeaders,
            },
          );
        }

        let body: any;
        try {
          body = await request.json();
        } catch (error) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Invalid JSON in request body",
            }),
            {
              status: 400,
              headers: corsHeaders,
            },
          );
        }

        const rawInput = body.input || "";
        const inputValidation = validateInput(rawInput, 10000);

        if (!inputValidation.valid) {
          return new Response(
            JSON.stringify({
              success: false,
              error: inputValidation.error || "Invalid input",
            }),
            {
              status: 400,
              headers: corsHeaders,
            },
          );
        }

        const input = inputValidation.sanitized!;
        const startTime = Date.now();

        const localArithmetic = tryArithmeticReason(input);

        let answer: string | null = null;
        let provider: ReasonProvider | null = null;
        let reasonError: ReasonError | null = null;
        let llmAnswered = false;

        if (localArithmetic) {
          answer = localArithmetic.answer;
          provider = "local";
        } else {
          const llm = ensureLlmIntegration(env);
          if (llm && llm.isAvailable()) {
            try {
              const simpleFactual = isSimpleFactualQuestion(input);
              const llmResponse = await llm.answerQuestion(input, {
                systemPrompt: getReasonSystemPrompt(simpleFactual),
                maxTokens: getReasonMaxTokens(simpleFactual),
              });
              answer = stripMarkdownEmphasis(llmResponse.answer);
              provider = llmResponse.provider ?? null;
              llmAnswered = true;
            } catch (error) {
              reasonError = toPublicReasonError(error);
              logEvent("error", "reason_llm_failed", {
                code: reasonError.code,
                detail: error instanceof Error ? error.message : String(error),
              });
            }
          } else {
            reasonError = MODEL_NOT_CONFIGURED;
          }
        }

        const processingTimeMs = Date.now() - startTime;
        recordLatency(processingTimeMs);
        incrementReasoning();
        recordReasonProviderForMetrics(env, ctx, provider ?? "none");

        const honestData = buildHonestReasonResponse({
          input,
          answer,
          llmUsed: llmAnswered,
          llmProvider: provider,
          error: reasonError,
          processingTimeMs,
        });

        return new Response(
          JSON.stringify({ success: true, data: honestData }),
          {
            headers: corsHeaders,
          },
        );
      }

      // Root endpoint — dashboard with server-rendered live metrics
      if (path === "/" && request.method === "GET") {
        const benchPassPct = benchmarks
          ? (benchmarks.passRate * 100).toFixed(1)
          : "—";
        const benchDetail = benchmarks
          ? `${benchmarks.passed}/${benchmarks.total} benchmarks at ${benchmarks.gitSha ?? "unknown commit"}`
          : "run pnpm run eval to generate";
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BleuJS Reasoning Lab</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        :root {
            --bg-primary: #0a0a0a;
            --bg-secondary: #111111;
            --bg-tertiary: #1a1a1a;
            --accent: #00d4ff;
            --text-primary: #ffffff;
            --text-secondary: #cccccc;
            --text-muted: #888888;
            --border: #333333;
            --success: #00ff88;
            --warning: #ffaa00;
            --error: #ff4444;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            min-height: 100vh;
            line-height: 1.6;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 40px 20px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 60px;
            position: relative;
        }
        
        .header h1 {
            font-size: 1.8rem;
            font-weight: 600;
            margin-bottom: 15px;
            color: var(--accent);
            letter-spacing: 1px;
            text-shadow: 0 0 15px rgba(0, 212, 255, 0.3);
        }
        
        .header p {
            font-size: 1rem;
            color: var(--text-secondary);
            margin-bottom: 20px;
            line-height: 1.4;
        }
        
        .status-indicator {
            background: var(--success);
            color: var(--bg-primary);
            padding: 4px 12px;
            border-radius: 12px;
            font-weight: 400;
            font-size: 0.7rem;
            letter-spacing: 0.3px;
            display: inline-block;
        }

        .hero-tagline {
            font-size: 1.05rem;
            color: var(--text-secondary);
            max-width: 720px;
            margin: 0 auto 24px;
            line-height: 1.6;
        }

        .hero-disclaimer {
            font-size: 0.85rem;
            color: var(--text-muted);
            margin-bottom: 16px;
        }

        .live-cards {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 24px;
            margin-bottom: 48px;
        }

        .live-card {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 15px;
            padding: 28px 24px;
            text-align: center;
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .live-card:hover {
            border-color: var(--accent);
            box-shadow: 0 8px 24px rgba(0, 212, 255, 0.08);
        }

        .live-card h3 {
            color: var(--accent);
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 16px;
            font-weight: 600;
        }

        .live-card .live-value {
            font-size: 2.2rem;
            font-weight: 600;
            color: var(--success);
            line-height: 1.2;
        }

        .live-card .live-detail {
            color: var(--text-muted);
            font-size: 0.82rem;
            margin-top: 10px;
            line-height: 1.4;
        }

        .live-card .live-endpoint {
            display: inline-block;
            margin-top: 12px;
            font-size: 0.75rem;
            color: var(--text-secondary);
            font-family: ui-monospace, monospace;
        }

        .live-card.loading .live-value {
            color: var(--text-muted);
            font-size: 1rem;
        }

        .header-links {
            position: absolute;
            top: 0;
            right: 0;
            display: flex;
            gap: 10px;
            align-items: center;
        }

        .github-link {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: var(--text-secondary);
            text-decoration: none;
            padding: 8px;
            border: 1px solid var(--border);
            border-radius: 8px;
            transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;
        }

        .github-link:hover {
            color: var(--text-primary);
            border-color: var(--accent);
            background: rgba(0, 212, 255, 0.08);
        }

        .github-link svg {
            width: 22px;
            height: 22px;
            fill: currentColor;
        }
        
        .dashboard {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 40px;
        }
        
        .capability-panel {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 15px;
            padding: 30px;
        }
        
        .capability-panel h2 {
            margin-bottom: 25px;
            color: var(--accent);
            font-size: 1.5em;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .capability-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
        }
        
        .capability-item {
            text-align: center;
            padding: 20px;
            background: var(--bg-tertiary);
            border-radius: 10px;
            border: 1px solid var(--border);
            transition: all 0.3s ease;
        }
        
        .capability-item:hover {
            transform: translateY(-5px);
            border-color: var(--accent);
            box-shadow: 0 10px 25px rgba(0, 212, 255, 0.1);
        }
        
        .capability-item h3 {
            font-size: 0.9em;
            color: var(--text-secondary);
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .capability-value {
            font-size: 2.2em;
            font-weight: bold;
            color: var(--accent);
            margin-bottom: 5px;
            text-shadow: 0 0 10px rgba(0, 212, 255, 0.3);
        }
        
        .capability-label {
            font-size: 0.8em;
            color: var(--text-muted);
            font-style: italic;
        }
        
        .interaction-panel {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 15px;
            padding: 30px;
        }
        
        .interaction-panel h2 {
            margin-bottom: 25px;
            color: var(--accent);
            font-size: 1.5em;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 8px;
            color: var(--text-secondary);
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .form-group select,
        .form-group textarea {
            width: 100%;
            padding: 15px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 8px;
            color: var(--text-primary);
            font-size: 16px;
            transition: all 0.3s ease;
        }
        
        .form-group select:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: var(--accent);
            box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.2);
        }
        
        .form-group textarea {
            resize: vertical;
            min-height: 120px;
        }
        
        .button-group {
            display: flex;
            gap: 15px;
            margin-top: 25px;
        }
        
        .btn-primary {
            background: var(--accent);
            color: var(--bg-primary);
            border: 1px solid var(--accent);
            padding: 15px 30px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .btn-primary:hover {
            background: var(--bg-tertiary);
            color: var(--accent);
            transform: translateY(-1px);
            box-shadow: 0 3px 8px rgba(0, 212, 255, 0.15);
        }
        
        .btn-secondary {
            background: var(--bg-tertiary);
            color: var(--text-primary);
            border: 1px solid var(--border);
            padding: 15px 30px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .btn-secondary:hover {
            background: var(--bg-secondary);
            border-color: var(--accent);
            transform: translateY(-1px);
        }
        
        .result-panel {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 15px;
            padding: 30px;
            margin-top: 30px;
        }
        
        .result-panel h3 {
            margin-bottom: 20px;
            color: var(--accent);
            font-size: 1.3em;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .result-content {
            background: var(--bg-tertiary);
            padding: 20px;
            border-radius: 8px;
            border: 1px solid var(--border);
            max-height: 600px;
            overflow-y: auto;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 14px;
            white-space: pre-wrap;
            color: var(--text-primary);
            line-height: 1.6;
        }

        .lab-answer {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 1.05rem;
            line-height: 1.7;
            white-space: normal;
            margin-bottom: 1rem;
            padding: 1rem 1.25rem;
            background: rgba(99, 102, 241, 0.08);
            border-left: 4px solid var(--accent);
            border-radius: 0 8px 8px 0;
        }

        .lab-answer h2 { font-size: 1.35rem; margin: 1rem 0 0.5rem; color: var(--accent); }
        .lab-answer h3 { font-size: 1.15rem; margin: 1rem 0 0.5rem; color: var(--text-primary); }
        .lab-answer h4 { font-size: 1rem; margin: 0.75rem 0 0.35rem; color: var(--text-secondary); }
        .lab-answer p { margin: 0.5rem 0; }
        .lab-answer ul { margin: 0.5rem 0 0.5rem 1.25rem; }
        .lab-answer li { margin: 0.25rem 0; }
        .lab-answer blockquote {
            margin: 0.75rem 0;
            padding: 0.5rem 1rem;
            border-left: 3px solid var(--accent);
            color: var(--text-secondary);
            font-style: italic;
        }
        .lab-answer hr { border: none; border-top: 1px solid var(--border); margin: 1rem 0; }
        .lab-answer code {
            background: var(--bg-primary);
            padding: 0.1rem 0.35rem;
            border-radius: 4px;
            font-size: 0.9em;
        }
        .lab-answer table {
            width: 100%;
            border-collapse: collapse;
            margin: 0.75rem 0;
            font-size: 0.9rem;
        }
        .lab-answer th, .lab-answer td {
            border: 1px solid var(--border);
            padding: 0.4rem 0.6rem;
            text-align: left;
        }
        .lab-answer th { background: var(--bg-primary); color: var(--accent); }

        .lab-meta {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 0.85rem;
            color: var(--text-secondary);
            margin-bottom: 0.75rem;
        }

        .lab-details summary {
            cursor: pointer;
            color: var(--accent);
            margin-top: 0.5rem;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .metrics-panel {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 15px;
            padding: 30px;
            margin-top: 30px;
        }
        
        .metrics-panel h2 {
            margin-bottom: 25px;
            color: var(--accent);
            font-size: 1.5em;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
        }
        
        .metric-item {
            text-align: center;
            padding: 20px;
            background: var(--bg-tertiary);
            border-radius: 10px;
            border: 1px solid var(--border);
            transition: all 0.3s ease;
        }
        
        .metric-item:hover {
            transform: translateY(-3px);
            border-color: var(--accent);
            box-shadow: 0 8px 20px rgba(0, 212, 255, 0.1);
        }
        
        .metric-value {
            font-size: 2.0em;
            font-weight: bold;
            color: var(--success);
            margin-bottom: 5px;
        }
        
        .metric-label {
            font-size: 0.8em;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .metric-status {
            background: var(--success);
            color: var(--bg-primary);
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.7em;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-top: 8px;
            display: inline-block;
            animation: pulse 2s infinite;
        }
        
        /* Advanced Metrics */
        .advanced-metrics {
            margin-top: 30px;
        }
        
        .metrics-row {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 25px;
            margin-bottom: 25px;
        }
        
        .metric-category {
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 20px;
        }
        
        .metric-category h3 {
            color: var(--accent);
            margin-bottom: 15px;
            font-size: 1.1em;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .metric-details {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        
        .metric-detail-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid var(--border);
        }
        
        .metric-detail-item:last-child {
            border-bottom: none;
        }
        
        .metric-detail-item .metric-label {
            color: var(--text-secondary);
            font-size: 0.85em;
            font-weight: 500;
        }
        
        .metric-detail-item .metric-value {
            color: var(--accent);
            font-weight: bold;
            font-size: 0.9em;
        }
        
        .metric-detail-item .metric-status {
            background: var(--success);
            color: var(--bg-primary);
            padding: 2px 6px;
            border-radius: 8px;
            font-size: 0.65em;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            animation: pulse 2s infinite;
        }
        
        .documentation-section {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 15px;
            padding: 30px;
            margin-top: 30px;
        }
        
        .documentation-section h2 {
            margin-bottom: 25px;
            color: var(--accent);
            font-size: 1.5em;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .documentation-tabs {
            display: flex;
            gap: 8px;
            margin-bottom: 25px;
            justify-content: center;
            flex-wrap: wrap;
        }
        
        .documentation-tab {
            background: var(--bg-tertiary);
            color: var(--text-secondary);
            border: 1px solid var(--border);
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }
        
        .documentation-tab:hover,
        .documentation-tab.active {
            background: var(--accent);
            color: var(--bg-primary);
            border-color: var(--accent);
            transform: translateY(-1px);
        }
        
        .documentation-content {
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 30px;
            min-height: 400px;
        }
        
        .documentation-tab-content {
            display: none;
        }
        
        .documentation-tab-content.active {
            display: block;
        }
        
        .documentation-tab-content h3 {
            color: var(--accent);
            margin-bottom: 20px;
            font-size: 1.4em;
            text-align: center;
        }
        
        .documentation-tab-content h4 {
            color: var(--text-primary);
            margin: 25px 0 15px 0;
            font-size: 1.2em;
        }
        
        .documentation-tab-content p {
            color: var(--text-secondary);
            margin-bottom: 20px;
            line-height: 1.6;
        }
        
        .documentation-tab-content ul {
            color: var(--text-secondary);
            margin-bottom: 20px;
            padding-left: 20px;
        }
        
        .documentation-tab-content li {
            margin-bottom: 10px;
            line-height: 1.5;
        }
        
        .documentation-tab-content strong {
            color: var(--accent);
        }
        
        /* API Endpoints */
        .endpoints {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 15px;
            padding: 30px;
            margin-top: 30px;
        }
        
        .endpoints h2 {
            margin-bottom: 25px;
            color: var(--accent);
            font-size: 1.5em;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .endpoints > p {
            text-align: center;
            margin-bottom: 25px;
            color: var(--text-secondary);
            font-size: 1.1rem;
        }
        
        .endpoint-list {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .endpoint-item {
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 20px;
            transition: all 0.3s ease;
        }
        
        .endpoint-item:hover {
            border-color: var(--accent);
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0, 212, 255, 0.1);
        }
        
        .endpoint-item .method {
            background: var(--accent);
            color: var(--bg-primary);
            padding: 4px 12px;
            border-radius: 6px;
            font-size: 0.8em;
            font-weight: bold;
            display: inline-block;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .endpoint-item .path {
            color: var(--text-primary);
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 1.1em;
            margin-bottom: 8px;
            font-weight: bold;
        }
        
        .endpoint-item .description {
            color: var(--text-secondary);
            font-size: 0.9em;
            line-height: 1.4;
        }
        
        .api-details {
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 20px;
        }
        
        .api-details h3 {
            color: var(--accent);
            margin-bottom: 15px;
            font-size: 1.2em;
            text-align: center;
        }
        
        .api-details ul {
            list-style: none;
            padding: 0;
        }
        
        .api-details li {
            color: var(--text-secondary);
            margin-bottom: 10px;
            padding-left: 20px;
            position: relative;
            line-height: 1.5;
        }
        
        .api-details li:before {
            content: "→";
            color: var(--accent);
            position: absolute;
            left: 0;
            font-weight: bold;
        }
        
        .loading {
            text-align: center;
            color: var(--accent);
            font-style: italic;
            margin: 20px 0;
        }
        
        .spinner {
            border: 2px solid var(--bg-tertiary);
            border-top: 2px solid var(--accent);
            border-radius: 50%;
            width: 20px;
            height: 20px;
            animation: spin 1s linear infinite;
            margin: 0 auto 10px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        /* Enhanced Mobile Responsiveness */
        @media (max-width: 768px) {
            .live-cards {
                grid-template-columns: 1fr;
                gap: 16px;
                margin-bottom: 32px;
            }

            .header-links {
                position: static;
                justify-content: center;
                margin-bottom: 12px;
            }

            .header h1 {
                font-size: 1.4rem;
                line-height: 1.2;
                margin-bottom: 12px;
                letter-spacing: 0.5px;
            }
            
            .header p {
                font-size: 0.9rem;
                line-height: 1.3;
                margin-bottom: 15px;
            }
            
            .container {
                padding: 12px 8px;
                max-width: 100%;
            }
            
            .header {
                margin-bottom: 30px;
                padding: 20px 15px;
            }
            
            .dashboard {
                grid-template-columns: 1fr;
                gap: 20px;
                margin-bottom: 25px;
            }
            
            .capability-panel,
            .interaction-panel {
                padding: 20px 15px;
            }
            
            .capability-panel h2,
            .interaction-panel h2 {
                font-size: 1.3rem;
                margin-bottom: 20px;
            }
            
            .capability-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 15px;
            }
            
            .capability-item {
                padding: 15px;
            }
            
            .capability-item h3 {
                font-size: 0.85rem;
                margin-bottom: 8px;
            }
            
            .capability-value {
                font-size: 1.8rem;
                margin-bottom: 8px;
            }
            
            .capability-label {
                font-size: 0.75rem;
            }
            
            .form-group {
                margin-bottom: 15px;
            }
            
            .form-group label {
                font-size: 0.9rem;
                margin-bottom: 6px;
            }
            
            .form-group select,
            .form-group textarea {
                padding: 15px;
                font-size: 16px; /* Prevents zoom on iOS */
                border-radius: 8px;
            }
            
            .form-group textarea {
                min-height: 100px;
            }
            
            .button-group {
                flex-direction: column;
                gap: 10px;
            }
            
            .btn-primary,
            .btn-secondary {
                width: 100%;
                padding: 15px 20px;
                font-size: 16px;
                border-radius: 8px;
                touch-action: manipulation;
            }
            
            .btn-primary:active,
            .btn-secondary:active {
                transform: scale(0.98);
            }
            
            .result-panel {
                padding: 20px 15px;
                margin-top: 20px;
            }
            
            .result-panel h3 {
                font-size: 1.2rem;
                margin-bottom: 15px;
            }
            
            .result-content {
                padding: 15px;
                max-height: 500px;
                font-size: 0.85rem;
                border-radius: 8px;
            }
            
            .metrics-panel {
                padding: 20px 15px;
                margin-top: 20px;
            }
            
            .metrics-panel h2 {
                font-size: 1.3rem;
                margin-bottom: 20px;
            }
            
            .metrics-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 12px;
            }
            
            .metric-item {
                padding: 12px;
            }
            
            .metric-value {
                font-size: 1.4rem;
            }
            
            .metric-label {
                font-size: 0.7rem;
            }
            
            /* Advanced metrics mobile optimization */
            .advanced-metrics {
                margin-top: 20px;
            }
            
            .metrics-row {
                grid-template-columns: 1fr;
                gap: 15px;
                margin-bottom: 20px;
            }
            
            .metric-category {
                padding: 15px;
            }
            
            .metric-category h3 {
                font-size: 1rem;
                margin-bottom: 12px;
            }
            
            .metric-detail-item {
                padding: 6px 0;
            }
            
            .metric-detail-item .metric-label {
                font-size: 0.75rem;
            }
            
            .metric-detail-item .metric-value {
                font-size: 0.8rem;
            }
            
            .metric-detail-item .metric-status {
                font-size: 0.6rem;
                padding: 1px 4px;
            }
            
            .documentation-section {
                padding: 20px 15px;
                margin-top: 20px;
            }
            
            .documentation-section h2 {
                font-size: 1.3rem;
                margin-bottom: 20px;
            }
            
            .documentation-tabs {
                gap: 8px;
                margin-bottom: 20px;
            }
            
            .documentation-tab {
                padding: 10px 16px;
                font-size: 0.8rem;
            }
            
            .documentation-content {
                padding: 20px 15px;
                min-height: 300px;
            }
            
            .documentation-tab-content h3 {
                font-size: 1.2rem;
                margin-bottom: 15px;
            }
            
            .documentation-tab-content h4 {
                font-size: 1.1rem;
                margin: 20px 0 12px 0;
            }
            
            .documentation-tab-content p {
                font-size: 0.9rem;
                margin-bottom: 15px;
            }
            
            .documentation-tab-content ul {
                padding-left: 15px;
            }
            
            .documentation-tab-content li {
                margin-bottom: 8px;
                font-size: 0.9rem;
            }
            
            /* API endpoints mobile optimization */
            .endpoints {
                padding: 20px 15px;
                margin-top: 20px;
            }
            
            .endpoints h2 {
                font-size: 1.3rem;
                margin-bottom: 20px;
            }
            
            .endpoints > p {
                font-size: 1rem;
                margin-bottom: 20px;
            }
            
            .endpoint-list {
                grid-template-columns: 1fr;
                gap: 15px;
                margin-bottom: 25px;
            }
            
            .endpoint-item {
                padding: 15px;
            }
            
            .endpoint-item .method {
                font-size: 0.7rem;
                padding: 3px 10px;
            }
            
            .endpoint-item .path {
                font-size: 1rem;
            }
            
            .endpoint-item .description {
                font-size: 0.8rem;
            }
            
            .api-details {
                padding: 15px;
            }
            
            .api-details h3 {
                font-size: 1.1rem;
                margin-bottom: 12px;
            }
            
            .api-details li {
                font-size: 0.8rem;
                margin-bottom: 8px;
            }
        }

        /* Small Mobile Devices */
        @media (max-width: 480px) {
            .header h1 {
                font-size: 1.2rem;
                letter-spacing: 0.3px;
            }
            
            .header p {
                font-size: 0.8rem;
                line-height: 1.2;
            }
            
            .container {
                padding: 10px 8px;
            }
            
            .capability-panel,
            .interaction-panel,
            .result-panel,
            .metrics-panel,
            .documentation-section {
                padding: 15px 12px;
            }
            
            .capability-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 10px;
            }
            
            .capability-item {
                padding: 10px 8px;
            }
            
            .capability-value {
                font-size: 1.3rem;
            }
            
            .form-group select,
            .form-group textarea {
                padding: 12px;
                font-size: 16px;
            }
            
            .btn-primary,
            .btn-secondary {
                padding: 12px 16px;
                font-size: 15px;
            }
            
            .metrics-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 10px;
            }
            
            .metric-item {
                padding: 10px 8px;
            }
            
            .metric-value {
                font-size: 1.2rem;
            }
            
            .metric-label {
                font-size: 0.65rem;
            }
            
            .documentation-tabs {
                flex-direction: column;
                align-items: center;
            }
            
            .documentation-tab {
                width: 100%;
                max-width: 200px;
            }
        }

        /* Touch Device Optimizations */
        @media (hover: none) and (pointer: coarse) {
            .btn-primary,
            .btn-secondary {
                min-height: 44px; /* iOS recommended touch target size */
            }
            
            .form-group select,
            .form-group textarea {
                min-height: 44px;
            }
            
            .capability-item,
            .metric-item,
            .documentation-tab {
                cursor: pointer;
            }
            
            .capability-item:active,
            .metric-item:active,
            .documentation-tab:active {
                transform: scale(0.98);
            }
        }

        /* Landscape Mobile */
        @media (max-width: 768px) and (orientation: landscape) {
            .header {
                margin-bottom: 30px;
            }
            
            .header h1 {
                font-size: 1.5rem;
            }
            
            .dashboard {
                grid-template-columns: repeat(2, 1fr);
                gap: 15px;
            }
            
            .capability-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 8px;
            }
            
            .capability-item {
                padding: 8px 6px;
            }
            
            .capability-value {
                font-size: 1.2rem;
            }
            
            .capability-label {
                font-size: 0.7rem;
            }
            
            .container {
                padding: 10px 15px;
            }
            
            .metrics-grid {
                grid-template-columns: repeat(4, 1fr);
                gap: 10px;
            }
            
            .documentation-tabs {
                flex-direction: row;
                justify-content: center;
            }
        }

        /* High DPI Mobile Devices */
        @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
            .btn-primary,
            .btn-secondary {
                border-width: 0.5px;
            }
            
            .capability-panel,
            .interaction-panel,
            .result-panel,
            .metrics-panel,
            .documentation-section {
                border-width: 0.5px;
            }
        }

        /* Mobile Navigation Improvements */
        @media (max-width: 768px) {
            /* Smooth scrolling for mobile */
            html {
                scroll-behavior: smooth;
            }
            
            /* Better focus states for mobile */
            .btn-primary:focus,
            .btn-secondary:focus,
            .form-group select:focus,
            .form-group textarea:focus,
            .documentation-tab:focus {
                outline: 2px solid var(--accent);
                outline-offset: 2px;
            }
            
            /* Prevent horizontal scroll */
            body {
                overflow-x: hidden;
                width: 100%;
            }
            
            /* Better text selection */
            ::selection {
                background: var(--accent);
                color: var(--bg-primary);
            }
            
            /* Improved scrollbar for mobile */
            ::-webkit-scrollbar {
                width: 8px;
            }
            
            ::-webkit-scrollbar-track {
                background: var(--bg-tertiary);
                border-radius: 4px;
            }
            
            ::-webkit-scrollbar-thumb {
                background: var(--border);
                border-radius: 4px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-links">
                <a class="github-link" href="${GITHUB_REPO}" target="_blank" rel="noopener noreferrer" aria-label="GitHub repository" title="View on GitHub">
                    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
                </a>
            </div>
            <h1>BleuJS Reasoning Lab</h1>
            <p class="hero-tagline">Reproducible reasoning benchmarks over fixed datasets, with provider routing and per-variant cost.</p>
            <div class="status-indicator">Online · v${LAB_VERSION}</div>
        </div>

        <div class="live-cards">
            <div class="live-card loading" id="evalCard">
                <h3>Eval Pass Rate</h3>
                <div class="live-value" id="evalPassRate">Running eval suite…</div>
                <div class="live-detail" id="evalDetail">Benchmark tasks run on demand</div>
                <div class="live-endpoint">GET /eval</div>
            </div>
            <div class="live-card" id="capabilitiesCard">
                <h3>Benchmark Pass Rate</h3>
                <div class="live-value" id="capabilitiesValue">${benchPassPct}%</div>
                <div class="live-detail" id="capabilitiesDetail">${benchDetail}</div>
                <div class="live-endpoint">GET /capabilities</div>
            </div>
        </div>
        
        <div class="dashboard">
            <div class="interaction-panel" style="grid-column: 1 / -1;">
                <h2>Reasoning Interaction</h2>
                <div class="form-group">
                    <label for="hrsEndpoint">Function:</label>
                    <select id="hrsEndpoint">
                        <option value="reason">Reason</option>
                        <option value="status">Status</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="hrsInput">Input:</label>
                    <textarea id="hrsInput" placeholder="Ask a question..."></textarea>
                </div>
                <div class="button-group">
                    <button class="btn btn-primary" onclick="interactWithSystem()">Process Request</button>
                    <button class="btn btn-secondary" onclick="clearResult()">Clear</button>
                </div>
            </div>
        </div>
        
        <div class="result-panel" id="resultPanel" style="display: none;">
            <h3 id="resultPanelTitle">Answer</h3>
            <div class="result-content" id="hrsResult"></div>
        </div>
        
        <div class="documentation-section">
            <h2>System Documentation</h2>
            <div class="documentation-tabs">
                <button class="documentation-tab active" onclick="showDocumentationTab('overview')">Overview</button>
                <button class="documentation-tab" onclick="showDocumentationTab('architecture')">Architecture</button>
                <button class="documentation-tab" onclick="showDocumentationTab('tech')">Tech Stack</button>
            </div>
            
            <div class="documentation-content">
                <div id="overview" class="documentation-tab-content active">
                    <h3>BleuJS Reasoning Lab v${LAB_VERSION}</h3>
                    <p>An evaluation harness for LLM reasoning on Cloudflare Workers: fixed datasets, exact graders, and provider routing you can audit.</p>
                    
                    <h4>What it does</h4>
                    <ul>
                        <li><strong>POST /reason:</strong> Answer-first responses from a hosted model; simple arithmetic is answered locally</li>
                        <li><strong>GET /eval:</strong> Runs the offline benchmark suite live — deterministic, so it matches the committed run at the same commit</li>
                        <li><strong>GET /capabilities:</strong> Benchmark scores from the last committed eval run, with the dataset and git SHA</li>
                    </ul>

                    <h4>What it does not do</h4>
                    <ul>
                        <li>It does not train models. Reasoning quality is the hosted model's, measured here — not produced here.</li>
                        <li>It does not score its own "understanding" or "adaptability". Earlier versions published such numbers; they were formulas over request counters and have been removed.</li>
                        <li>Datasets are small (tens of items per benchmark), so one- or two-item differences are not significant.</li>
                    </ul>
                </div>
                
                <div id="architecture" class="documentation-tab-content">
                    <h3>Architecture</h3>
                    <p>Single Cloudflare Worker (<code>src/worker/index.ts</code>). The only request-time state is the provider client and in-isolate counters.</p>
                    
                    <h4>Components</h4>
                    <ul>
                        <li><strong>RealLLMIntegration:</strong> provider client for <code>/reason</code> — see <code>src/routing/</code></li>
                        <li><strong>Offline benchmarks:</strong> <code>src/evals/benchmarks/</code> — fixed datasets scored against deterministic baselines</li>
                        <li><strong>Model-in-the-loop benchmarks:</strong> <code>pnpm run eval:model</code> — same datasets sent to a hosted model, majority vote over repeated sampled runs</li>
                        <li><strong>ToolSystem:</strong> keyword baseline for the tool-selection benchmark — the floor a model should beat</li>
                    </ul>
                </div>
                
                <div id="tech" class="documentation-tab-content">
                    <h3>Technology Stack</h3>
                    <p>TypeScript on Cloudflare Workers. Note that reasoning <em>research</em> is a Python ecosystem; this project is an evaluation and routing layer, which is where TypeScript belongs.</p>
                    
                    <h4>Runtime</h4>
                    <ul>
                        <li><strong>Cloudflare Workers:</strong> Production deployment</li>
                        <li><strong>TypeScript:</strong> Worker and eval harness</li>
                        <li><strong>Wrangler:</strong> Deploy via <code>pnpm run deploy:worker:prod</code></li>
                    </ul>
                </div>
            </div>
        </div>
        
        <div class="endpoints">
            <h2>API Endpoints</h2>
            <p>REST API for BleuJS Reasoning Lab:</p>
            
            <div class="endpoint-list">
                <div class="endpoint-item">
                    <div class="method">GET</div>
                    <div class="path">/capabilities</div>
                    <div class="description">Benchmark scores from the last committed eval run, with dataset and git SHA</div>
                </div>
                
                <div class="endpoint-item">
                    <div class="method">GET</div>
                    <div class="path">/status</div>
                    <div class="description">Version, feature flags, and the committed benchmark summary</div>
                </div>
                
                <div class="endpoint-item">
                    <div class="method">GET</div>
                    <div class="path">/eval</div>
                    <div class="description">Run the offline benchmark suite and return per-benchmark scores</div>
                </div>
                
                <div class="endpoint-item">
                    <div class="method">POST</div>
                    <div class="path">/reason</div>
                    <div class="description">Answer-first reasoning; <code>answerSource</code> is <code>local-arithmetic</code> or <code>model</code></div>
                </div>
            </div>
            
            <div class="api-details">
                <h3>API Notes</h3>
                <ul>
                    <li><strong>Every number is traceable:</strong> benchmark scores come from a committed run at a recorded git SHA. Nothing is simulated or heuristically scored.</li>
                    <li><strong>Removed in v6:</strong> <code>POST /learn</code>, <code>POST /create</code>, and <code>GET /goals</code>. Nothing behind them affected an answer.</li>
                    <li><strong>CORS:</strong> Open for GET and POST from any origin</li>
                </ul>
            </div>
        </div>
    </div>
    
    <script>
        document.addEventListener('DOMContentLoaded', loadEvalCard);

        async function loadEvalCard() {
            const card = document.getElementById('evalCard');
            const valueEl = document.getElementById('evalPassRate');
            const detailEl = document.getElementById('evalDetail');
            if (!card || !valueEl || !detailEl) return;

            try {
                const response = await fetch('/eval');
                if (!response.ok) throw new Error('HTTP ' + response.status);
                const json = await response.json();
                const data = json.data;
                if (!json.success || !data) throw new Error('Invalid eval response');

                const rate = (data.passRate * 100).toFixed(1);
                valueEl.textContent = rate + '%';
                detailEl.textContent = data.passed + ' / ' + data.total + ' benchmarks passed in ' +
                    data.durationMs + 'ms';
                card.classList.remove('loading');
            } catch (error) {
                console.error('Failed to load eval:', error);
                valueEl.textContent = 'Unavailable';
                detailEl.textContent = 'Could not run benchmarks — try GET /eval directly';
                card.classList.remove('loading');
            }
        }
        
        function escapeHtml(text) {
            return String(text)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        function renderMarkdown(text) {
            const lines = String(text).split('\\n');
            const out = [];
            let inList = false;
            let tableRows = [];

            function flushTable() {
                if (tableRows.length === 0) return;
                const rows = tableRows.filter(r => !/^\\|[\\s\\-:|]+\\|$/.test(r.trim()));
                if (rows.length === 0) { tableRows = []; return; }
                let t = '<table><tbody>';
                rows.forEach((row, i) => {
                    const cells = row.split('|').map(c => c.trim()).filter(Boolean);
                    const tag = i === 0 ? 'th' : 'td';
                    t += '<tr>' + cells.map(c => '<' + tag + '>' + c + '</' + tag + '>').join('') + '</tr>';
                });
                t += '</tbody></table>';
                out.push(t);
                tableRows = [];
            }

            for (const raw of lines) {
                const line = raw
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
                const bold = (s) => s.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
                const code = (s) => s.replace(/\`([^\`]+)\`/g, '<code>$1</code>');

                if (line.trim().startsWith('|')) {
                    if (inList) { out.push('</ul>'); inList = false; }
                    tableRows.push(line);
                    continue;
                }
                flushTable();

                if (/^### (.+)/.test(line)) { if (inList) { out.push('</ul>'); inList = false; } out.push('<h4>' + bold(code(line.replace(/^### /, ''))) + '</h4>'); continue; }
                if (/^## (.+)/.test(line)) { if (inList) { out.push('</ul>'); inList = false; } out.push('<h3>' + bold(code(line.replace(/^## /, ''))) + '</h3>'); continue; }
                if (/^# (.+)/.test(line)) { if (inList) { out.push('</ul>'); inList = false; } out.push('<h2>' + bold(code(line.replace(/^# /, ''))) + '</h2>'); continue; }
                if (/^---+$/.test(line.trim())) { if (inList) { out.push('</ul>'); inList = false; } out.push('<hr>'); continue; }
                if (/^&gt; (.+)/.test(line)) { if (inList) { out.push('</ul>'); inList = false; } out.push('<blockquote>' + bold(code(line.replace(/^&gt; /, ''))) + '</blockquote>'); continue; }
                if (/^- (.+)/.test(line)) {
                    if (!inList) { out.push('<ul>'); inList = true; }
                    out.push('<li>' + bold(code(line.slice(2))) + '</li>');
                    continue;
                }
                if (line.trim() === '') {
                    if (inList) { out.push('</ul>'); inList = false; }
                    continue;
                }
                if (inList) { out.push('</ul>'); inList = false; }
                out.push('<p>' + bold(code(line)) + '</p>');
            }
            flushTable();
            if (inList) out.push('</ul>');
            return out.join('');
        }

        function formatReasonError(error) {
            const code = error && error.code;
            if (code === 'model_not_configured') {
                return 'No model is configured on this deployment; only simple arithmetic is answered.';
            }
            if (code === 'model_rate_limited' || code === 'model_temporarily_unavailable') {
                return 'The model is temporarily unavailable. Please retry in a few seconds.';
            }
            return 'The model could not answer this request. Please try again later.';
        }

        function formatLabResponse(endpoint, payload) {
            const answer = payload.answer ?? payload.aiInsight ?? null;
            if (endpoint === 'reason' && answer != null) {
                document.getElementById('resultPanelTitle').textContent = 'Answer';
                const meta = [
                    payload.answerSource === 'local-arithmetic' ? 'Local math (no LLM call)' : 'Hosted model',
                    (payload.processingTimeMs ?? '—') + 'ms'
                ].join(' · ');
                let html = '<div class="lab-meta">' + escapeHtml(meta) + '</div>';
                html += '<div class="lab-answer">' + renderMarkdown(answer) + '</div>';
                html += '<details class="lab-details"><summary>Raw JSON</summary><pre>' +
                    escapeHtml(JSON.stringify(payload, null, 2)) + '</pre></details>';
                return html;
            }
            if (endpoint === 'reason' && !answer) {
                document.getElementById('resultPanelTitle').textContent = 'Response';
                const errorText = formatReasonError(payload.error);
                return '<div class="lab-meta">' + escapeHtml(errorText) + '</div><pre>' +
                    escapeHtml(JSON.stringify(payload, null, 2)) + '</pre>';
            }
            document.getElementById('resultPanelTitle').textContent = 'Response';
            return '<pre>' + escapeHtml(JSON.stringify(payload, null, 2)) + '</pre>';
        }

        function isRetryableHttpStatus(status) {
            return status >= 500;
        }

        async function interactWithSystem() {
            const endpoint = document.getElementById('hrsEndpoint').value;
            const input = document.getElementById('hrsInput').value;
            const resultPanel = document.getElementById('resultPanel');
            const resultDiv = document.getElementById('hrsResult');
            
            if (!input.trim()) {
                alert('Please enter some input!');
                return;
            }
            
            // Show loading
            resultPanel.style.display = 'block';
            resultDiv.innerHTML = '<div class="loading"><div class="spinner"></div>Processing request...</div>';
            
            try {
                if (endpoint === 'reason') {
                    const maxClientAttempts = 3;
                    for (let clientAttempt = 0; clientAttempt < maxClientAttempts; clientAttempt++) {
                        if (clientAttempt > 0) {
                            resultDiv.innerHTML = '<div class="loading"><div class="spinner"></div>Model unavailable — retrying (' +
                                (clientAttempt + 1) + '/' + maxClientAttempts + ')...</div>';
                            await new Promise(function(resolve) { setTimeout(resolve, 1500 * clientAttempt); });
                        }
                        let data;
                        try {
                            const response = await fetch('/reason', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ input })
                            });
                            if (!response.ok) {
                                if (clientAttempt < maxClientAttempts - 1 && isRetryableHttpStatus(response.status)) {
                                    continue;
                                }
                                resultDiv.innerHTML = 'Failed to process request: HTTP ' + response.status + ': ' + response.statusText;
                                return;
                            }
                            data = await response.json();
                        } catch (fetchError) {
                            if (clientAttempt < maxClientAttempts - 1) {
                                continue;
                            }
                            resultDiv.innerHTML = 'Failed to process request: ' + fetchError.message;
                            console.error('Reasoning interaction error:', fetchError);
                            return;
                        }
                        if (data.success && data.data && data.data.answer) {
                            resultDiv.innerHTML = formatLabResponse(endpoint, data.data);
                            return;
                        }
                        const retryable = data.success && data.data && data.data.error && data.data.error.retryable;
                        if (!retryable || clientAttempt === maxClientAttempts - 1) {
                            resultDiv.innerHTML = data.success
                                ? formatLabResponse(endpoint, data.data)
                                : ('Error: ' + (data.error || 'Unknown error occurred'));
                            return;
                        }
                    }
                    return;
                }

                let response;
                switch (endpoint) {
                    case 'status':
                        response = await fetch('/status');
                        break;
                }
                
                if (!response.ok) {
                    throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
                }
                
                const data = await response.json();
                
                if (data.success) {
                    resultDiv.innerHTML = formatLabResponse(endpoint, data.data);
                } else {
                    resultDiv.innerHTML = 'Error: ' + (data.error || 'Unknown error occurred');
                }
            } catch (error) {
                resultDiv.innerHTML = 'Failed to process request: ' + error.message;
                console.error('Reasoning interaction error:', error);
            }
        }
        
        function clearResult() {
            document.getElementById('resultPanel').style.display = 'none';
            document.getElementById('hrsResult').innerHTML = '';
            document.getElementById('hrsInput').value = '';
        }
        
        function showDocumentationTab(tabName) {
            // Hide all tab contents
            const tabContents = document.querySelectorAll('.documentation-tab-content');
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Remove active class from all tabs
            const tabs = document.querySelectorAll('.documentation-tab');
            tabs.forEach(tab => tab.classList.remove('active'));
            
            // Show selected tab content
            document.getElementById(tabName).classList.add('active');
            
            // Add active class to clicked tab
            event.target.classList.add('active');
        }
    </script>
</body>
</html>
        `;

        return new Response(html, {
          headers: htmlHeaders,
        });
      }

      // 404 for unknown routes
      return new Response(
        JSON.stringify({
          success: false,
          error: "Endpoint not found",
          availableEndpoints: [
            "/health",
            "/eval",
            "/status",
            "/capabilities",
            "/reason",
            "/",
          ],
        }),
        {
          status: 404,
          headers: corsHeaders,
        },
      );
    } catch (error) {
      // Enhanced error handling with better user messages
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      const errorStack = error instanceof Error ? error.stack : undefined;

      // Log full error for debugging (server-side only)
      console.error("Worker error:", {
        message: errorMessage,
        stack: errorStack,
        path: path,
        method: request.method,
        timestamp: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Internal server error",
          message:
            "An error occurred while processing your request. Please try again later.",
          timestamp: Date.now(),
        }),
        {
          status: 500,
          headers: corsHeaders,
        },
      );
    }
  },
};
