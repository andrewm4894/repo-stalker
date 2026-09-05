// Theme definitions for the theme picker.
//
// Each theme maps to a `[data-theme="..."]` block in `index.css` that overrides
// the design-system CSS variables. Picker swatches read those same variables via
// a scoped `data-theme`, so there is no second copy of the colors here.

export type ThemeId = "matrix" | "cyberpunk" | "ocean" | "sunset" | "dracula" | "paper";

export interface ThemeOption {
  id: ThemeId;
  label: string;
}

export const THEMES: ThemeOption[] = [
  { id: "matrix", label: "Matrix" },
  { id: "cyberpunk", label: "Cyberpunk" },
  { id: "ocean", label: "Ocean" },
  { id: "sunset", label: "Sunset" },
  { id: "dracula", label: "Dracula" },
  { id: "paper", label: "Paper" },
];

export const DEFAULT_THEME: ThemeId = "matrix";

// Keep this key in sync with the inline pre-paint script in index.html.
const STORAGE_KEY = "repo-stalker-theme";

const isThemeId = (value: string | null): value is ThemeId =>
  value !== null && THEMES.some((theme) => theme.id === value);

export const getStoredTheme = (): ThemeId => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isThemeId(stored)) return stored;
  } catch {
    // localStorage can be unavailable (private mode, blocked cookies).
  }
  return DEFAULT_THEME;
};

export const setStoredTheme = (theme: ThemeId): void => {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Ignore write failures; the theme still applies for this session.
  }
  document.documentElement.setAttribute("data-theme", theme);
};
