import { useEffect, useState } from "react";

export type FeatureFlagValue = string | boolean | undefined;

/**
 * Read a PostHog feature flag value. Returns `undefined` until PostHog has
 * loaded and evaluated flags for the current visitor.
 */
export function useFeatureFlag(flagKey: string): FeatureFlagValue {
  const [value, setValue] = useState<FeatureFlagValue>(undefined);

  useEffect(() => {
    const posthog = (window as unknown as { posthog?: PostHog }).posthog;
    if (!posthog) return;

    const update = () => {
      try {
        setValue(posthog.getFeatureFlag(flagKey));
      } catch {
        setValue(undefined);
      }
    };

    update();

    // onFeatureFlags fires when flags are initially loaded or reloaded.
    if (typeof posthog.onFeatureFlags === "function") {
      posthog.onFeatureFlags(update);
    }
  }, [flagKey]);

  return value;
}

/**
 * Convenience helper for boolean feature flags.
 */
export function useFeatureFlagEnabled(flagKey: string): boolean {
  const value = useFeatureFlag(flagKey);
  return value === true || value === "true";
}

/**
 * Evaluate a flag synchronously outside of React. Prefer the hooks; this is
 * useful for one-off checks in event handlers or utilities.
 */
export function getFeatureFlag(flagKey: string): FeatureFlagValue {
  const posthog = (window as unknown as { posthog?: PostHog }).posthog;
  if (!posthog) return undefined;
  try {
    return posthog.getFeatureFlag(flagKey);
  } catch {
    return undefined;
  }
}

type PostHog = {
  getFeatureFlag: (key: string) => FeatureFlagValue;
  onFeatureFlags: (callback: () => void) => void;
};
