import { useState } from "react";
import { Palette } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getStoredTheme, setStoredTheme, THEMES, type ThemeId } from "@/lib/themes";

export const ThemePicker = () => {
  const [theme, setTheme] = useState<ThemeId>(() => getStoredTheme());

  const handleChange = (next: ThemeId) => {
    setTheme(next);
    setStoredTheme(next);
    window.posthog?.capture?.("theme_selected", { theme: next });
  };

  return (
    <div className="flex items-center gap-2 w-full md:w-auto">
      <Palette className="w-4 h-4 text-muted-foreground" />
      <Select value={theme} onValueChange={(value) => handleChange(value as ThemeId)}>
        <SelectTrigger
          className="w-full md:w-[150px] h-8 text-xs bg-secondary/50 border-border"
          aria-label="Choose a theme"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {THEMES.map((option) => (
            <SelectItem key={option.id} value={option.id} className="text-xs">
              <span className="flex items-center gap-2">
                {/* Swatches read the option's own theme variables via data-theme. */}
                <span data-theme={option.id} className="flex items-center gap-1" aria-hidden="true">
                  <span className="w-3 h-3 rounded-full border border-border" style={{ background: "hsl(var(--background))" }} />
                  <span className="w-3 h-3 rounded-full border border-border" style={{ background: "hsl(var(--primary))" }} />
                  <span className="w-3 h-3 rounded-full border border-border" style={{ background: "hsl(var(--accent))" }} />
                </span>
                {option.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
