export const POSTHOG_TRACES_ENDPOINT = `${POSTHOG_HOST}/i/v1/traces`;

// ---------------------------------------------------------------------------
// Distributed tracing (OTLP/HTTP JSON, alpha)
// https://posthog.com/docs/distributed-tracing
//
// We avoid the full OTel SDK to keep cold-starts fast — raw fetch with
// OTLP/HTTP JSON works against PostHog's receiver.
// ---------------------------------------------------------------------------

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function newTraceId(): string {
  return randomHex(16);
}
export function newSpanId(): string {
  return randomHex(8);
}

/** Parse a W3C traceparent header: `00-<traceId>-<spanId>-<flags>`. */
export function parseTraceparent(header: string | null | undefined):
  | { traceId: string; spanId: string; flags: string }
  | null {
  if (!header) return null;
  const m = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i.exec(header.trim());
  if (!m) return null;
  return { traceId: m[1].toLowerCase(), spanId: m[2].toLowerCase(), flags: m[3].toLowerCase() };
}

type SpanAttrValue = string | number | boolean | null | undefined;

function attrPair(key: string, value: SpanAttrValue): { key: string; value: any } | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return { key, value: { stringValue: value } };
  if (typeof value === "number")
    return Number.isInteger(value)
      ? { key, value: { intValue: value } }
      : { key, value: { doubleValue: value } };
  if (typeof value === "boolean") return { key, value: { boolValue: value } };
  return { key, value: { stringValue: String(value) } };
}

function toAttrList(attrs?: Record<string, SpanAttrValue>): Array<{ key: string; value: any }> {
  if (!attrs) return [];
  const out: Array<{ key: string; value: any }> = [];
  for (const [k, v] of Object.entries(attrs)) {
    const a = attrPair(k, v);
    if (a) out.push(a);
  }
  return out;
}

export type FinishedSpan = {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number; // 1 INTERNAL, 2 SERVER, 3 CLIENT
  startNs: string;
  endNs: string;
  status: { code?: number; message?: string };
  attributes: Record<string, SpanAttrValue>;
};

export interface ActiveSpan {
  spanId: string;
  traceId: string;
  setAttribute(key: string, value: SpanAttrValue): void;
  end(opts?: { status?: "ok" | "error"; error?: unknown; attributes?: Record<string, SpanAttrValue> }): void;
}

/** Edge-function tracer: buffers spans for one request and flushes once. */
export class EdgeTracer {
  readonly traceId: string;
  readonly rootSpanId: string;
  private parentForChildren: string;
  private spans: FinishedSpan[] = [];
  private fn: string;
  private distinctId?: string;
  private sessionId?: string;
  private rootStartNs: string;
  private rootName: string;
  private rootAttrs: Record<string, SpanAttrValue>;

  constructor(opts: {
    fn: string;
    rootName: string;
    parentTraceId?: string;
    parentSpanId?: string;
    distinctId?: string;
    sessionId?: string;
    rootAttributes?: Record<string, SpanAttrValue>;
  }) {
    this.fn = opts.fn;
    this.traceId = opts.parentTraceId || newTraceId();
    this.rootSpanId = newSpanId();
    this.parentForChildren = this.rootSpanId;
    this.rootName = opts.rootName;
    this.rootStartNs = (BigInt(Date.now()) * 1_000_000n).toString();
    this.rootAttrs = {
      "http.route": opts.rootName,
      "service.name": `edge:${opts.fn}`,
      ...(opts.rootAttributes || {}),
      ...(opts.parentSpanId ? { "parent.span_id": opts.parentSpanId } : {}),
    };
    this.distinctId = opts.distinctId;
    this.sessionId = opts.sessionId;
    // Stash the inbound parent on the root span itself by recording it as
    // parentSpanId when we finish the root.
    (this as any)._inboundParent = opts.parentSpanId;
  }

  startSpan(name: string, attributes?: Record<string, SpanAttrValue>, kind: number = 1): ActiveSpan {
    const spanId = newSpanId();
    const startNs = (BigInt(Date.now()) * 1_000_000n).toString();
    const parent = this.parentForChildren;
    const localAttrs: Record<string, SpanAttrValue> = { ...(attributes || {}) };
    const self = this;
    return {
      spanId,
      traceId: this.traceId,
      setAttribute(key, value) {
        localAttrs[key] = value;
      },
      end(opts) {
        const endNs = (BigInt(Date.now()) * 1_000_000n).toString();
        const extra = opts?.attributes || {};
        for (const [k, v] of Object.entries(extra)) localAttrs[k] = v;
        let status: { code?: number; message?: string } = {};
        if (opts?.status === "error" || opts?.error) {
          const msg = opts?.error instanceof Error ? opts.error.message : opts?.error ? String(opts.error) : "error";
          status = { code: 2, message: msg };
          localAttrs["error"] = true;
        } else if (opts?.status === "ok") {
          status = { code: 1 };
        }
        self.spans.push({
          traceId: self.traceId,
          spanId,
          parentSpanId: parent,
          name,
          kind,
          startNs,
          endNs,
          status,
          attributes: localAttrs,
        });
      },
    };
  }

  setRootAttribute(key: string, value: SpanAttrValue) {
    this.rootAttrs[key] = value;
  }

  /** Build a W3C traceparent for outbound HTTP propagation from child spans. */
  traceparentFor(spanId: string): string {
    return `00-${this.traceId}-${spanId}-01`;
  }

  async end(opts?: { status?: "ok" | "error"; error?: unknown }): Promise<void> {
    const endNs = (BigInt(Date.now()) * 1_000_000n).toString();
    let status: { code?: number; message?: string } = {};
    if (opts?.status === "error" || opts?.error) {
      const msg = opts?.error instanceof Error ? opts.error.message : opts?.error ? String(opts.error) : "error";
      status = { code: 2, message: msg };
      this.rootAttrs["error"] = true;
    } else {
      status = { code: 1 };
    }
    this.spans.push({
      traceId: this.traceId,
      spanId: this.rootSpanId,
      parentSpanId: (this as any)._inboundParent,
      name: this.rootName,
      kind: 2, // SERVER
      startNs: this.rootStartNs,
      endNs,
      status,
      attributes: this.rootAttrs,
    });
    await flushSpans(this.spans, { fn: this.fn, distinctId: this.distinctId, sessionId: this.sessionId });
  }
}

async function flushSpans(
  spans: FinishedSpan[],
  context: { fn: string; distinctId?: string; sessionId?: string }
): Promise<void> {
  if (spans.length === 0) return;
  try {
    const resourceAttrs: Array<{ key: string; value: any }> = [
      { key: "service.name", value: { stringValue: `edge:${context.fn}` } },
      { key: "service.namespace", value: { stringValue: "supabase-edge" } },
    ];
    if (context.distinctId)
      resourceAttrs.push({ key: "posthogDistinctId", value: { stringValue: context.distinctId } });
    if (context.sessionId)
      resourceAttrs.push({ key: "$session_id", value: { stringValue: context.sessionId } });

    const body = {
      resourceSpans: [
        {
          resource: { attributes: resourceAttrs },
          scopeSpans: [
            {
              scope: { name: "repo-stalker-edge" },
              spans: spans.map((s) => ({
                traceId: s.traceId,
                spanId: s.spanId,
                ...(s.parentSpanId ? { parentSpanId: s.parentSpanId } : {}),
                name: s.name,
                kind: s.kind,
                startTimeUnixNano: s.startNs,
                endTimeUnixNano: s.endNs,
                attributes: toAttrList(s.attributes),
                status: s.status,
              })),
            },
          ],
        },
      ],
    };

    await fetch(POSTHOG_TRACES_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${POSTHOG_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error("PostHog trace flush failed:", e);
  }
}
export const POSTHOG_API_KEY = 'phc_kJw12LPrvTZ8INN6KYHtaVzL0jrh0qD7AXi2qSmBC2p';
export const POSTHOG_HOST = 'https://us.i.posthog.com';
export const POSTHOG_LOGS_ENDPOINT = `${POSTHOG_HOST}/i/v1/logs`;

/**
 * Send a log record to PostHog Logs via the OTLP/HTTP JSON protocol.
 * https://posthog.com/docs/logs
 *
 * Fire-and-forget; failures are swallowed so logging never breaks the request.
 */
export type PostHogLogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

const SEVERITY_NUMBER: Record<PostHogLogLevel, number> = {
  trace: 1,
  debug: 5,
  info: 9,
  warn: 13,
  error: 17,
  fatal: 21,
};

export async function capturePostHogLog(
  level: PostHogLogLevel,
  message: string,
  context: {
    fn: string;
    distinctId?: string;
    sessionId?: string;
    attributes?: Record<string, unknown>;
  }
) {
  try {
    const timeUnixNano = (BigInt(Date.now()) * 1_000_000n).toString();
    const attrs: Array<{ key: string; value: any }> = [
      { key: "service.name", value: { stringValue: `edge:${context.fn}` } },
      { key: "service.namespace", value: { stringValue: "supabase-edge" } },
    ];
    if (context.distinctId) {
      attrs.push({ key: "posthogDistinctId", value: { stringValue: context.distinctId } });
    }
    if (context.sessionId) {
      attrs.push({ key: "$session_id", value: { stringValue: context.sessionId } });
    }
    const logAttrs: Array<{ key: string; value: any }> = [];
    for (const [k, v] of Object.entries(context.attributes ?? {})) {
      if (v === undefined || v === null) continue;
      if (typeof v === "string") logAttrs.push({ key: k, value: { stringValue: v } });
      else if (typeof v === "number") {
        if (Number.isInteger(v)) logAttrs.push({ key: k, value: { intValue: v } });
        else logAttrs.push({ key: k, value: { doubleValue: v } });
      } else if (typeof v === "boolean") logAttrs.push({ key: k, value: { boolValue: v } });
      else logAttrs.push({ key: k, value: { stringValue: JSON.stringify(v) } });
    }

    const body = {
      resourceLogs: [
        {
          resource: { attributes: attrs },
          scopeLogs: [
            {
              scope: { name: "repo-stalker-edge" },
              logRecords: [
                {
                  timeUnixNano,
                  observedTimeUnixNano: timeUnixNano,
                  severityNumber: SEVERITY_NUMBER[level],
                  severityText: level.toUpperCase(),
                  body: { stringValue: message },
                  attributes: logAttrs,
                },
              ],
            },
          ],
        },
      ],
    };

    await fetch(POSTHOG_LOGS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${POSTHOG_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error("PostHog log capture failed:", e);
  }
}

/** Convenience factory that scopes every log to one edge-function invocation. */
export function createEdgeLogger(fn: string, base?: { distinctId?: string; sessionId?: string }) {
  const ctx = { fn, ...base };
  const make = (level: PostHogLogLevel) =>
    (message: string, attributes?: Record<string, unknown>) =>
      capturePostHogLog(level, message, { ...ctx, attributes });
  return {
    info: make("info"),
    warn: make("warn"),
    error: make("error"),
    debug: make("debug"),
  };
}

export async function capturePostHogEvent(
  eventName: string,
  properties: any,
  distinctId: string,
  spanName?: string,
  sessionId?: string
) {
  try {
    await fetch(`${POSTHOG_HOST}/i/v0/e/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: POSTHOG_API_KEY,
        event: eventName,
        distinct_id: distinctId,
        properties: {
          ...properties,
          ...(spanName && { $ai_span_name: spanName }),
          ...(sessionId && { $ai_session_id: sessionId }),
        },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error('PostHog capture error:', error);
  }
}

/**
 * Report an exception to PostHog using its native error-tracking format.
 * Safe to call from any edge function — failures are swallowed so error
 * reporting never masks the original error.
 */
export async function capturePostHogException(
  error: unknown,
  context: {
    fn: string;
    distinctId?: string;
    sessionId?: string;
    extra?: Record<string, unknown>;
  }
) {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const distinctId = context.distinctId || 'edge-anonymous';
    const stack = err.stack || '';

    await fetch(`${POSTHOG_HOST}/i/v0/e/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: POSTHOG_API_KEY,
        event: '$exception',
        distinct_id: distinctId,
        properties: {
          $exception_list: [
            {
              type: err.name || 'Error',
              value: err.message,
              mechanism: { handled: true, type: 'generic' },
              stacktrace: { type: 'raw', frames: [] },
            },
          ],
          $exception_level: 'error',
          $exception_source: `edge:${context.fn}`,
          $exception_message: err.message,
          $exception_type: err.name || 'Error',
          $exception_stack_trace_raw: stack,
          runtime: 'deno-edge-function',
          fn: context.fn,
          ...(context.sessionId && { $session_id: context.sessionId }),
          ...(context.extra || {}),
        },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.error('PostHog exception capture failed:', e);
  }
}
