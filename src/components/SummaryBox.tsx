import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronDown, Loader2, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { RepoChatDialog } from "./RepoChatDialog";
import stalkerLogo from "@/assets/repo-stalker-logo.svg";
import { getSessionId } from "@/lib/sessionId";

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
  const [lastType, setLastType] = useState<string>(type);
  const [chatOpen, setChatOpen] = useState(false);
  const { toast } = useToast();

  // Reset summary when type changes
  if (type !== lastType) {
    setSummary("");
    setLastType(type);
    setIsOpen(false);
  }

  const handleExpand = async () => {
    const newState = !isOpen;
    setIsOpen(newState);
    
    // Generate summary if expanding and we don't have one yet
    if (newState && !summary && items.length > 0) {
      await generateSummary();
    }
  };

  const generateSummary = async () => {
    setIsLoading(true);
    try {
      // Get PostHog distinct ID
      const distinctId = (window as any).posthog?.get_distinct_id?.() || 'anonymous';
      const sessionId = getSessionId();
      
      const { data, error } = await supabase.functions.invoke('summarize-items', {
        body: { items, type, distinctId, sessionId }
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
      const errorMessage = error instanceof Error ? error.message : "Please try again later";
      
      // Check if it's a rate limit error
      if (errorMessage.includes("rate limit") || errorMessage.includes("Rate limit")) {
        toast({
          title: "Rate limit exceeded",
          description: errorMessage,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to generate summary",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (items.length === 0) {
    return null;
  }

  const itemType = type === "pr" ? "Pull Requests" : "Issues";

  return (
    <>
      <Card className="mb-4">
        <Collapsible open={isOpen} onOpenChange={handleExpand}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between p-4 h-auto hover:bg-accent/50"
            >
              <div className="flex items-center gap-2">
                <img src={stalkerLogo} alt="RepoStalker" className="h-4 w-4" />
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
            <div className="pt-2 border-t space-y-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Generating summary...</span>
                </div>
              ) : summary ? (
                <>
                  <div className="prose prose-sm max-w-none dark:prose-invert text-sm leading-relaxed">
                    <ReactMarkdown>
                      {summary}
                    </ReactMarkdown>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setChatOpen(true)}
                    className="w-full gap-2"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Chat about these {itemType}
                  </Button>
                </>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4">
                  Expand to generate AI summary
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <RepoChatDialog
        open={chatOpen}
        onOpenChange={setChatOpen}
        items={items}
        type={type}
        summary={summary}
      />
    </>
  );
};
