export const POSTHOG_API_KEY = 'phc_kJw12LPrvTZ8INN6KYHtaVzL0jrh0qD7AXi2qSmBC2p';
export const POSTHOG_HOST = 'https://us.i.posthog.com';

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
