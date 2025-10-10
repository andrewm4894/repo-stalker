// Rate limiter using Deno KV for global LLM API usage tracking
// Prevents abuse and controls API costs

interface RateLimitConfig {
  perIpPerMinute: number;
  globalPerHour: number;
  globalPerDay: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  perIpPerMinute: 10, // 10 requests per minute per IP
  globalPerHour: 50, // 50 total requests per hour
  globalPerDay: 2000, // 2000 total requests per day
};

export async function checkRateLimit(
  ip: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<{ allowed: boolean; reason?: string }> {
  const kv = await Deno.openKv();
  const now = Date.now();

  try {
    // 1. Check per-IP limit (per minute)
    const ipKey = ["rate_limit", "ip", ip, Math.floor(now / 60000)];
    const ipCount = await kv.get<number>(ipKey);
    const currentIpCount = (ipCount.value || 0) + 1;

    if (currentIpCount > config.perIpPerMinute) {
      console.log(`Rate limit exceeded for IP ${ip}: ${currentIpCount}/${config.perIpPerMinute} per minute`);
      return {
        allowed: false,
        reason: `Rate limit exceeded. Maximum ${config.perIpPerMinute} requests per minute allowed. Please try again later.`
      };
    }

    // 2. Check global hourly limit
    const hourKey = ["rate_limit", "global", "hour", Math.floor(now / 3600000)];
    const hourCount = await kv.get<number>(hourKey);
    const currentHourCount = (hourCount.value || 0) + 1;

    if (currentHourCount > config.globalPerHour) {
      console.log(`Global hourly rate limit exceeded: ${currentHourCount}/${config.globalPerHour}`);
      return {
        allowed: false,
        reason: `Global rate limit exceeded. The service has reached its hourly capacity of ${config.globalPerHour} requests. Please try again in a few minutes.`
      };
    }

    // 3. Check global daily limit
    const dayKey = ["rate_limit", "global", "day", Math.floor(now / 86400000)];
    const dayCount = await kv.get<number>(dayKey);
    const currentDayCount = (dayCount.value || 0) + 1;

    if (currentDayCount > config.globalPerDay) {
      console.log(`Global daily rate limit exceeded: ${currentDayCount}/${config.globalPerDay}`);
      return {
        allowed: false,
        reason: `Daily rate limit exceeded. The service has reached its daily capacity of ${config.globalPerDay} requests. Please try again tomorrow.`
      };
    }

    // All checks passed - increment counters
    await kv.set(ipKey, currentIpCount, { expireIn: 120000 }); // Expire after 2 minutes
    await kv.set(hourKey, currentHourCount, { expireIn: 7200000 }); // Expire after 2 hours
    await kv.set(dayKey, currentDayCount, { expireIn: 172800000 }); // Expire after 2 days

    console.log(`Rate limit check passed for IP ${ip}. IP: ${currentIpCount}/${config.perIpPerMinute}, Hour: ${currentHourCount}/${config.globalPerHour}, Day: ${currentDayCount}/${config.globalPerDay}`);
    
    return { allowed: true };
  } finally {
    kv.close();
  }
}

// Get current usage stats (for monitoring/debugging)
export async function getRateLimitStats(ip?: string): Promise<{
  ipUsage?: number;
  hourlyUsage: number;
  dailyUsage: number;
  limits: RateLimitConfig;
}> {
  const kv = await Deno.openKv();
  const now = Date.now();

  try {
    const stats: any = {
      limits: DEFAULT_CONFIG,
      hourlyUsage: 0,
      dailyUsage: 0,
    };

    if (ip) {
      const ipKey = ["rate_limit", "ip", ip, Math.floor(now / 60000)];
      const ipCount = await kv.get<number>(ipKey);
      stats.ipUsage = ipCount.value || 0;
    }

    const hourKey = ["rate_limit", "global", "hour", Math.floor(now / 3600000)];
    const hourCount = await kv.get<number>(hourKey);
    stats.hourlyUsage = hourCount.value || 0;

    const dayKey = ["rate_limit", "global", "day", Math.floor(now / 86400000)];
    const dayCount = await kv.get<number>(dayKey);
    stats.dailyUsage = dayCount.value || 0;

    return stats;
  } finally {
    kv.close();
  }
}

// Extract IP from request
export function getClientIP(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
         req.headers.get('x-real-ip') || 
         'unknown';
}
