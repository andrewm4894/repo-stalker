// Frontend distributed tracing via OTLP/HTTP JSON to PostHog.
// Docs: https://posthog.com/docs/distributed-tracing
//
// We monkey-patch window.fetch so every outbound request becomes a CLIENT
// span. For calls to our own Supabase Edge Functions we also inject a W3C
// `traceparent` header, allowing the backend tracer to attach its SERVER
// span (and any AI/GitHub child spans) under the same trace.

const POSTHOG_TRACES_ENDPOINT = "https://us.i.posthog.com/i/v1/traces";
const POSTHOG_TOKEN = "phc_kJw12LPrvTZ8INN6KYHtaVzL0jrh0qD7AXi2qSmBC2p";

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}
const newTraceId = () => randomHex(16);
const newSpanId = () => randomHex(8);

type Span = {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startNs: string;
  endNs: string;
  attributes: Record<string, string | number | boolean>;
  status: { code?: number; message?: string };
};

let queue: Span[] = [];
let flushTimer: number | null = null;
const FLUSH_INTERVAL_MS = 4_000;
const MAX_QUEUE = 30;

function attrList(attrs: Record<string, string | number | boolean>) {
  return Object.entries(attrs).map(([k, v]) => {
    if (typeof v === "string") return { key: k, value: { stringValue: v } };
    if (typeof v === "boolean") return { key: k, value: { boolValue: v } };
    if (Number.isInteger(v)) return { key: k, value: { intValue: v as number } };
    return { key: k, value: { doubleValue: v as number } };
  });
}

function buildPayload(spans: Span[]) {
  const distinctId =
    (typeof window !== "undefined" && (window as any).posthog?.get_distinct_id?.()) || undefined;
  const sessionId =
    (typeof window !== "undefined" && (window as any).posthog?.get_session_id?.()) || undefined;

  const resourceAttrs: Array<{ key: string; value: any }> = [
    { key: "service.name", value: { stringValue: "repo-stalker-web" } },
    { key: "service.namespace", value: { stringValue: "frontend" } },
  ];
  if (distinctId) resourceAttrs.push({ key: "posthogDistinctId", value: { stringValue: distinctId } });
  if (sessionId) resourceAttrs.push({ key: "$session_id", value: { stringValue: sessionId } });

  return {
    resourceSpans: [
      {
        resource: { attributes: resourceAttrs },
        scopeSpans: [
          {
            scope: { name: "repo-stalker-web" },
            spans: spans.map((s) => ({
              traceId: s.traceId,
              spanId: s.spanId,
              ...(s.parentSpanId ? { parentSpanId: s.parentSpanId } : {}),
              name: s.name,
              kind: s.kind,
              startTimeUnixNano: s.startNs,
              endTimeUnixNano: s.endNs,
              attributes: attrList(s.attributes),
              status: s.status,
            })),
          },
        ],
      },
    ],
  };
}

async function flush() {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];
  try {
    const body = JSON.stringify(buildPayload(batch));
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(`${POSTHOG_TRACES_ENDPOINT}?token=${POSTHOG_TOKEN}`, blob);
      return;
    }
    await fetch(POSTHOG_TRACES_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${POSTHOG_TOKEN}` },
      body,
      keepalive: true,
    });
  } catch {
    // Swallow.
  }
}

function enqueue(span: Span) {
  queue.push(span);
  if (queue.length >= MAX_QUEUE) {
    void flush();
    return;
  }
  if (flushTimer === null) {
    flushTimer = window.setTimeout(() => void flush(), FLUSH_INTERVAL_MS);
  }
}

function shouldTrace(url: string): boolean {
  // Skip PostHog itself (avoid feedback loops) and obvious telemetry beacons.
  if (url.includes("i.posthog.com")) return false;
  if (url.startsWith("blob:") || url.startsWith("data:")) return false;
  return true;
}

function isOwnSupabaseEdgeFunction(url: string): boolean {
  // Only inject traceparent on our own edge function calls.
  const supabaseProjectId = (import.meta as any).env?.VITE_SUPABASE_PROJECT_ID;
  if (supabaseProjectId && url.includes(`${supabaseProjectId}.supabase.co/functions/`)) return true;
  return /\.supabase\.co\/functions\/v1\//.test(url);
}

function nowNs(): string {
  return (BigInt(Date.now()) * 1_000_000n).toString();
}

export function initPostHogTracing() {
  if (typeof window === "undefined") return;
  if ((window as any).__phTracingInitialized) return;
  (window as any).__phTracingInitialized = true;

  const origFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;
    const method = (init?.method || (typeof input !== "string" && !(input instanceof URL) ? input.method : "GET") || "GET").toUpperCase();

    if (!shouldTrace(url)) return origFetch(input as any, init);

    const traceId = newTraceId();
    const spanId = newSpanId();
    const startNs = nowNs();

    let nextInit: RequestInit | undefined = init;
    if (isOwnSupabaseEdgeFunction(url)) {
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      if (!headers.has("traceparent")) {
        headers.set("traceparent", `00-${traceId}-${spanId}-01`);
      }
      nextInit = { ...(init || {}), headers };
    }

    let response: Response | undefined;
    let error: unknown;
    try {
      response = await origFetch(input as any, nextInit);
      return response;
    } catch (e) {
      error = e;
      throw e;
    } finally {
      const endNs = nowNs();
      const attrs: Record<string, string | number | boolean> = {
        "http.method": method,
        "http.url": url.slice(0, 500),
      };
      if (response) attrs["http.status_code"] = response.status;
      enqueue({
        traceId,
        spanId,
        name: `${method} ${new URL(url, window.location.href).pathname}`.slice(0, 200),
        kind: 3, // CLIENT
        startNs,
        endNs,
        attributes: attrs,
        status: error
          ? { code: 2, message: error instanceof Error ? error.message : String(error) }
          : response && response.ok
          ? { code: 1 }
          : { code: 2, message: response ? `HTTP ${response.status}` : "unknown" },
      });
    }
  };

  window.addEventListener("pagehide", () => void flush());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush();
  });
}