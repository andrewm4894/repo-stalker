export const POSTHOG_API_KEY = 'phc_ABOAagCSNfMOUWin6A6Tda0WuhzWLFSXjSgSiq9KKBs';
export const POSTHOG_HOST = 'https://us.i.posthog.com';

export async function capturePostHogEvent(
  eventName: string,
  properties: any,
  distinctId: string,
  spanName?: string
) {
  try {
    await fetch(`${POSTHOG_HOST}/capture/`, {
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
        },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error('PostHog capture error:', error);
  }
}
