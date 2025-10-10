// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'http://localhost:5173', // Local development
  'http://localhost:3000', // Alternative local dev
  /^https:\/\/.*\.lovableproject\.com$/, // Lovable preview domains
  /^https:\/\/.*\.lovable\.app$/, // Lovable production domains
];

// Check if origin is allowed
function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  
  return ALLOWED_ORIGINS.some(allowed => {
    if (typeof allowed === 'string') {
      return allowed === origin;
    }
    // RegExp
    return allowed.test(origin);
  });
}

// Get CORS headers based on request origin
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');
  
  if (isOriginAllowed(origin)) {
    return {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Max-Age': '86400', // 24 hours
    };
  }
  
  // Default headers for non-allowed origins (will fail but with proper headers)
  return {
    'Access-Control-Allow-Origin': 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

// Legacy export for backwards compatibility (uses wildcard)
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
