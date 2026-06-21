// Shared payload validation for AI edge functions.
// Caps per-request size to mitigate token-cost amplification.

export const ALLOWED_MODELS = new Set<string>([
  'google/gemini-3.1-pro-preview',
  'google/gemini-3.5-flash',
  'google/gemini-3-flash-preview',
  'google/gemini-3-pro-preview',
  'google/gemini-3.1-flash-lite',
  'google/gemini-2.5-pro',
  'google/gemini-2.5-flash',
  'google/gemini-2.5-flash-lite',
  'openai/gpt-5.5-pro',
  'openai/gpt-5.5',
  'openai/gpt-5.4-pro',
  'openai/gpt-5.4',
  'openai/gpt-5.2',
  'openai/gpt-5',
  'openai/gpt-5.4-mini',
  'openai/gpt-5-mini',
  'openai/gpt-5.4-nano',
  'openai/gpt-5-nano',
]);

export const LIMITS = {
  MESSAGE_MAX: 5_000,
  HISTORY_MAX_ENTRIES: 20,
  HISTORY_ENTRY_MAX: 5_000,
  ITEMS_MAX: 100,
  CONTEXT_MAX: 20_000,
} as const;

export type ValidationError = { error: string };

export function validateModel(model: unknown): ValidationError | null {
  if (model === undefined || model === null) return null;
  if (typeof model !== 'string' || !ALLOWED_MODELS.has(model)) {
    return { error: 'Invalid model' };
  }
  return null;
}

export function validateMessage(message: unknown): ValidationError | null {
  if (typeof message !== 'string' || message.length === 0) {
    return { error: 'message is required' };
  }
  if (message.length > LIMITS.MESSAGE_MAX) {
    return { error: `message exceeds ${LIMITS.MESSAGE_MAX} characters` };
  }
  return null;
}

export function validateHistory(history: unknown): ValidationError | null {
  if (history === undefined || history === null) return null;
  if (!Array.isArray(history)) return { error: 'history must be an array' };
  if (history.length > LIMITS.HISTORY_MAX_ENTRIES) {
    return { error: `history exceeds ${LIMITS.HISTORY_MAX_ENTRIES} entries` };
  }
  for (const entry of history) {
    if (!entry || typeof entry !== 'object') {
      return { error: 'history entry must be an object' };
    }
    const content = (entry as { content?: unknown }).content;
    if (typeof content === 'string' && content.length > LIMITS.HISTORY_ENTRY_MAX) {
      return { error: `history entry exceeds ${LIMITS.HISTORY_ENTRY_MAX} characters` };
    }
  }
  return null;
}

export function validateItems(items: unknown): ValidationError | null {
  if (!Array.isArray(items)) return { error: 'items must be an array' };
  if (items.length > LIMITS.ITEMS_MAX) {
    return { error: `items exceeds ${LIMITS.ITEMS_MAX} entries` };
  }
  return null;
}

export function validateContext(context: unknown): ValidationError | null {
  if (context === undefined || context === null) return null;
  if (typeof context !== 'string') return { error: 'context must be a string' };
  if (context.length > LIMITS.CONTEXT_MAX) {
    return { error: `context exceeds ${LIMITS.CONTEXT_MAX} characters` };
  }
  return null;
}

export function badRequest(err: ValidationError, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(err), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}