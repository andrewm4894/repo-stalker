// Supported sensible models for RepoStalker
export const SUPPORTED_MODELS = [
  // Google Gemini Models
  { value: 'google/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Latest)' },
  { value: 'google/gemini-3.5-flash', label: 'Gemini 3.5 Flash (High Efficiency)' },
  { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash (Recommended)' },
  { value: 'google/gemini-3-pro-preview', label: 'Gemini 3 Pro (Next-Gen)' },
  { value: 'google/gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite (Fastest)' },
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro (Premium)' },
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (Balanced)' },
  { value: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (Fastest)' },
  // OpenAI GPT Models
  { value: 'openai/gpt-5.5-pro', label: 'GPT-5.5 Pro (Extended Reasoning)' },
  { value: 'openai/gpt-5.5', label: 'GPT-5.5 (Most Capable)' },
  { value: 'openai/gpt-5.4-pro', label: 'GPT-5.4 Pro (Premium)' },
  { value: 'openai/gpt-5.4', label: 'GPT-5.4 (Advanced Reasoning)' },
  { value: 'openai/gpt-5.2', label: 'GPT-5.2 (Latest)' },
  { value: 'openai/gpt-5', label: 'GPT-5 (Powerful)' },
  { value: 'openai/gpt-5.4-mini', label: 'GPT-5.4 Mini (Fast)' },
  { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini (Fast)' },
  { value: 'openai/gpt-5.4-nano', label: 'GPT-5.4 Nano (Fastest)' },
  { value: 'openai/gpt-5-nano', label: 'GPT-5 Nano (Fastest)' },
] as const;

export const DEFAULT_MODEL = 'google/gemini-3.5-flash';

export const getRandomModel = (): string => {
  const randomIndex = Math.floor(Math.random() * SUPPORTED_MODELS.length);
  return SUPPORTED_MODELS[randomIndex].value;
};
