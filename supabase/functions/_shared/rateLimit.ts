// Postgres-backed rate limiter for AI edge functions.
// Calls public.check_rate_limit(ip, fn, minute_limit, hour_limit).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const DEFAULT_LIMITS = {
  perMinute: 20,
  perHour: 200,
} as const;

export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export type RateLimitResult =
  | { allowed: true; minuteCount: number; hourCount: number }
  | {
      allowed: false;
      retryAfter: number;
      window: "minute" | "hour";
      limit: number;
    };

export async function checkRateLimit(
  ip: string,
  fn: string,
  perMinute: number = DEFAULT_LIMITS.perMinute,
  perHour: number = DEFAULT_LIMITS.perHour,
): Promise<RateLimitResult> {
  const { data, error } = await admin.rpc("check_rate_limit", {
    p_ip: ip,
    p_fn: fn,
    p_minute_limit: perMinute,
    p_hour_limit: perHour,
  });

  if (error) {
    // Fail-open on infra errors so a DB hiccup doesn't break the app,
    // but log loudly so we notice.
    console.error("rate limit RPC failed, allowing request:", error);
    return { allowed: true, minuteCount: 0, hourCount: 0 };
  }

  const r = data as {
    allowed: boolean;
    retry_after?: number;
    window?: "minute" | "hour";
    limit?: number;
    minute_count: number;
    hour_count: number;
  };

  if (r.allowed) {
    return {
      allowed: true,
      minuteCount: r.minute_count,
      hourCount: r.hour_count,
    };
  }

  return {
    allowed: false,
    retryAfter: r.retry_after ?? 60,
    window: r.window ?? "minute",
    limit: r.limit ?? perMinute,
  };
}

export function rateLimited(
  result: Extract<RateLimitResult, { allowed: false }>,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({
      error: `Rate limit exceeded (${result.limit}/${result.window}). Try again in ${result.retryAfter}s.`,
      retry_after: result.retryAfter,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(result.retryAfter),
      },
    },
  );
}