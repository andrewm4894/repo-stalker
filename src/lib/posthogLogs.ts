// Forward selected browser logs to PostHog Logs via OTLP/HTTP JSON.
// Docs: https://posthog.com/docs/logs
//
// We don't depend on the PostHog JS SDK for logging — a tiny buffered POSTer
// keeps payloads small and avoids vendor SDK coupling. The same project token
// used by `posthog.init` authenticates the OTLP endpoint.

const POSTHOG_LOGS_ENDPOINT = "https://us.i.posthog.com/i/v1/logs";
const POSTHOG_TOKEN = "phc_kJw12LPrvTZ8INN6KYHtaVzL0jrh0qD7AXi2qSmBC2p";

type Level = "info" | "warn" | "error";
const SEVERITY: Record<Level, { num: number; text: string }> = {
  info: { num: 9, text: "INFO" },
  warn: { num: 13, text: "WARN" },
  error: { num: 17, text: "ERROR" },
};

type Record_ = {
  level: Level;
  message: string;
  attributes?: Record<string, unknown>;
  timeNs: string;
};

let queue: Record_[] = [];
let flushTimer: number | null = null;
const FLUSH_INTERVAL_MS = 3_000;
const MAX_QUEUE = 50;

function toAttrValue(v: unknown): { key: string; value: any } | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "string") return { key: "", value: { stringValue: v } };
  if (typeof v === "number")
    return Number.isInteger(v)
      ? { key: "", value: { intValue: v } }
      : { key: "", value: { doubleValue: v } };
  if (typeof v === "boolean") return { key: "", value: { boolValue: v } };
  return { key: "", value: { stringValue: JSON.stringify(v).slice(0, 2000) } };
}

function buildPayload(records: Record_[]) {
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
    resourceLogs: [
      {
        resource: { attributes: resourceAttrs },
        scopeLogs: [
          {
            scope: { name: "repo-stalker-web" },
            logRecords: records.map((r) => {
              const attrs: Array<{ key: string; value: any }> = [
                { key: "url", value: { stringValue: window.location.href } },
                { key: "user_agent", value: { stringValue: navigator.userAgent } },
              ];
              for (const [k, v] of Object.entries(r.attributes ?? {})) {
                const av = toAttrValue(v);
                if (av) attrs.push({ key: k, value: av.value });
              }
              return {
                timeUnixNano: r.timeNs,
                observedTimeUnixNano: r.timeNs,
                severityNumber: SEVERITY[r.level].num,
                severityText: SEVERITY[r.level].text,
                body: { stringValue: r.message },
                attributes: attrs,
              };
            }),
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
      // sendBeacon does not allow custom headers, so use a token query param.
      navigator.sendBeacon(`${POSTHOG_LOGS_ENDPOINT}?token=${POSTHOG_TOKEN}`, blob);
      return;
    }
    await fetch(POSTHOG_LOGS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${POSTHOG_TOKEN}`,
      },
      body,
      keepalive: true,
    });
  } catch {
    // Swallow — never let logging break the app.
  }
}

function enqueue(level: Level, message: string, attributes?: Record<string, unknown>) {
  queue.push({
    level,
    message: message.slice(0, 4000),
    attributes,
    timeNs: (BigInt(Date.now()) * 1_000_000n).toString(),
  });
  if (queue.length >= MAX_QUEUE) {
    void flush();
    return;
  }
  if (flushTimer === null) {
    flushTimer = window.setTimeout(() => void flush(), FLUSH_INTERVAL_MS);
  }
}

function stringifyArg(a: unknown): string {
  if (typeof a === "string") return a;
  if (a instanceof Error) return `${a.name}: ${a.message}`;
  try {
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
}

export function initPostHogLogs() {
  if (typeof window === "undefined") return;
  if ((window as any).__phLogsInitialized) return;
  (window as any).__phLogsInitialized = true;

  const origWarn = console.warn.bind(console);
  const origError = console.error.bind(console);

  console.warn = (...args: unknown[]) => {
    origWarn(...args);
    enqueue("warn", args.map(stringifyArg).join(" "));
  };
  console.error = (...args: unknown[]) => {
    origError(...args);
    enqueue("error", args.map(stringifyArg).join(" "));
  };

  window.addEventListener("error", (e) => {
    enqueue("error", e.message || "Uncaught error", {
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
      stack: e.error?.stack,
      source: "window.onerror",
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason instanceof Error ? e.reason : new Error(String(e.reason));
    enqueue("error", reason.message, { stack: reason.stack, source: "unhandledrejection" });
  });

  window.addEventListener("pagehide", () => void flush());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush();
  });
}

export function logInfo(message: string, attributes?: Record<string, unknown>) {
  enqueue("info", message, attributes);
}
export function logWarn(message: string, attributes?: Record<string, unknown>) {
  enqueue("warn", message, attributes);
}
export function logError(message: string, attributes?: Record<string, unknown>) {
  enqueue("error", message, attributes);
}