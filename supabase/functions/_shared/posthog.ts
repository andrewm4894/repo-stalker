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
