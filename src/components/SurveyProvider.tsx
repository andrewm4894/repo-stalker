import { useEffect } from "react";

/**
 * Ensures PostHog surveys are loaded for in-app popover/widget surveys.
 * Popover surveys render automatically once the SDK fetches them.
 */
export function SurveyProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const posthog = (window as typeof window & { posthog?: { onSurveysLoaded?: (cb: () => void) => void } }).posthog;
    if (posthog?.onSurveysLoaded) {
      posthog.onSurveysLoaded(() => {
        // Surveys loaded; the SDK will display any matching popover surveys.
      });
    }
  }, []);

  return <>{children}</>;
}
