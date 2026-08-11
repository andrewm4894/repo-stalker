import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SUPPORTED_MODELS } from "@/lib/modelUtils";
import { useFeatureFlagEnabled } from "@/lib/featureFlags";
import { Sparkles } from "lucide-react";

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const ModelSelector = ({ value, onChange, disabled }: ModelSelectorProps) => {
  const hidePreviewModels = useFeatureFlagEnabled("hide_preview_models");

  const models = hidePreviewModels
    ? SUPPORTED_MODELS.filter((m) => !m.label.toLowerCase().includes("preview"))
    : SUPPORTED_MODELS;

  return (
    <div className="flex items-center gap-2 w-full md:w-auto">
      <Sparkles className="w-4 h-4 text-muted-foreground" />
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full md:w-[200px] h-8 text-xs bg-secondary/50 border-border">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {models.map((model) => (
            <SelectItem key={model.value} value={model.value} className="text-xs">
              {model.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
