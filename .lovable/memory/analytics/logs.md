---
name: PostHog Logs
description: OTLP/HTTP logs ingestion for edge functions and browser, endpoint and auth shape
type: feature
---
PostHog Logs are sent via raw OTLP/HTTP JSON (no OTel SDK) to keep payloads small.

- Endpoint: `https://us.i.posthog.com/i/v1/logs`
- Auth: `Authorization: Bearer <project_token>` (phc_...) or `?token=` query param. Project token is public.
- Severity numbers: trace=1, debug=5, info=9, warn=13, error=17, fatal=21.
- Edge functions: `createEdgeLogger(fn, { distinctId, sessionId })` + `capturePostHogLog(level, msg, ctx)` in `supabase/functions/_shared/posthog.ts`. Wired into `chat-with-pr`, `chat-with-repo`, `summarize-items`, `fetch-trending-repos` for request start/finish, AI errors, rate-limit hits, and outer catch.
- Frontend: `src/lib/posthogLogs.ts` (`initPostHogLogs()` in `src/main.tsx`) patches `console.warn`/`console.error`, captures `window.onerror`/`unhandledrejection`, batches with 3s flush + `sendBeacon` on pagehide/visibility-hidden. Token query param used for beacon (no custom headers allowed).
- Records carry `service.name` (`edge:<fn>` or `repo-stalker-web`) and link to session replay via `posthogDistinctId` + `$session_id` resource attributes.