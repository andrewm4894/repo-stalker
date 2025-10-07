import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronDown, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PR {
  number: number;
  title: string;
  state: string;
  user: {
    login: string;
  } | null;
  created_at: string;
  comments: number;
}

interface SummaryBoxProps {
  items: PR[];
  type: "pr" | "issue";
}

export const SummaryBox = ({ items, type }: SummaryBoxProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [summary, setSummary] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleExpand = async () => {
    const newState = !isOpen;
    setIsOpen(newState);
    
    // Only generate summary if expanding and we don't have one yet
    if (newState && !summary && items.length > 0) {
      await generateSummary();
    }
  };

  const generateSummary = async () => {
    setIsLoading(true);
    try {
      // Get PostHog distinct ID
      const distinctId = (window as any).posthog?.get_distinct_id?.() || 'anonymous';
      
      const { data, error } = await supabase.functions.invoke('summarize-items', {
        body: { items, type, distinctId }
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setSummary(data.summary);
    } catch (error) {
      console.error('Error generating summary:', error);
      toast({
        title: "Failed to generate summary",
        description: error instanceof Error ? error.message : "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (items.length === 0) {
    return null;
  }

  const itemType = type === "pr" ? "Pull Requests" : "Issues";

  return (
    <Card className="mb-4">
      <Collapsible open={isOpen} onOpenChange={handleExpand}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between p-4 h-auto hover:bg-accent/50"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-medium">AI Summary of {items.length} {itemType}</span>
            </div>
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-4 pb-4">
          <div className="pt-2 border-t">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating summary...</span>
              </div>
            ) : summary ? (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <p className="text-sm leading-relaxed whitespace-pre-line">{summary}</p>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4">
                Expand to generate AI summary
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
