// Supported sensible models for RepoStalker
export const SUPPORTED_MODELS = [
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (Balanced)' },
  { value: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (Fastest)' },
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro (Premium)' },
  { value: 'openai/gpt-5', label: 'GPT-5 (Most Powerful)' },
  { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini (Fast)' },
  { value: 'openai/gpt-5-nano', label: 'GPT-5 Nano (Fastest)' },
] as const;

export const getRandomModel = (): string => {
  const randomIndex = Math.floor(Math.random() * SUPPORTED_MODELS.length);
  return SUPPORTED_MODELS[randomIndex].value;
};
