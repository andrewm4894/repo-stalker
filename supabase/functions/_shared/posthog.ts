export const POSTHOG_API_KEY = 'phc_ABOAagCSNfMOUWin6A6Tda0WuhzWLFSXjSgSiq9KKBs';
export const POSTHOG_HOST = 'https://us.i.posthog.com';

export async function capturePostHogEvent(
  eventName: string,
  properties: any,
  distinctId: string
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
        properties: {
          ...properties,
          distinct_id: distinctId,
        },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error('PostHog capture error:', error);
  }
}
