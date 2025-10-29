// Supported sensible models for RepoStalker
export const SUPPORTED_MODELS = [
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (Balanced)' },
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro (Premium)' },
  { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini (Fast)' },
] as const;

export const getRandomModel = (): string => {
  const randomIndex = Math.floor(Math.random() * SUPPORTED_MODELS.length);
  return SUPPORTED_MODELS[randomIndex].value;
};
