import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SurveyProvider } from "./components/SurveyProvider";
import { initPostHogLogs } from "./lib/posthogLogs";
import { initPostHogTracing } from "./lib/posthogTracing";

initPostHogLogs();
initPostHogTracing();

// Report uncaught errors and unhandled promise rejections to PostHog.
// PostHog's `capture_exceptions: true` covers most cases, but we add an
// explicit listener so the report includes our own context tag.
if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    window.posthog?.captureException?.(event.error ?? new Error(event.message), {
      source: "window.onerror",
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    window.posthog?.captureException?.(reason, { source: "unhandledrejection" });
  });
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <SurveyProvider>
      <App />
    </SurveyProvider>
  </ErrorBoundary>
);
