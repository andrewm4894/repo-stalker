import { useState, useRef, useEffect } from "react";
import { Send, User as UserIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import stalkerLogo from "@/assets/repo-stalker-logo.svg";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatInterfaceProps {
  context: string;
  title: string;
  prUrl: string;
  prNumber: number;
  repoFullName: string;
}

export const ChatInterface = ({ context, title, prUrl, prNumber, repoFullName }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [chatId] = useState(() => crypto.randomUUID());

  // Get PostHog distinct_id
  const getDistinctId = () => {
    if (typeof window !== 'undefined' && (window as any).posthog) {
      return (window as any).posthog.get_distinct_id();
    }
    return null;
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("chat-with-pr", {
        body: {
          message: userMessage,
          context,
          title,
          prUrl,
          prNumber,
          repoFullName,
          history: messages,
          distinctId: getDistinctId(),
          chatId,
        },
      });

      if (error) throw error;

      // Check for rate limit error in response
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response },
      ]);
    } catch (error) {
      console.error("Chat error:", error);
      // Check if it's a rate limit error (429)
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
        toast.error("Rate limit exceeded. Please wait a moment and try again.");
      } else {
        toast.error("Failed to get response. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <img src={stalkerLogo} alt="RepoStalker" className="w-5 h-5" />
        <h3 className="font-semibold">Chat</h3>
      </div>

      <ScrollArea className="flex-1 -mr-4 pr-4 mb-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <p>Ask me anything about this {title.includes("Pull Request") ? "PR" : "issue"}!</p>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <img src={stalkerLogo} alt="RepoStalker" className="w-5 h-5" />
                </div>
              )}
              <div
                className={`rounded-lg p-3 max-w-[80%] ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="text-sm prose prose-invert prose-sm max-w-none
                    prose-p:my-2 prose-p:leading-relaxed
                    prose-pre:bg-black/50 prose-pre:border prose-pre:border-border
                    prose-code:text-accent prose-code:bg-black/30 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                    prose-strong:text-foreground prose-strong:font-semibold
                    prose-ul:my-2 prose-ol:my-2
                    prose-li:my-1">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ node, ...props }) => (
                          <a
                            {...props}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent hover:underline"
                          />
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <UserIcon className="w-4 h-4 text-primary" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                <img src={stalkerLogo} alt="RepoStalker" className="w-5 h-5 animate-pulse" />
              </div>
              <div className="rounded-lg p-3 bg-secondary">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Ask about this PR or issue..."
          disabled={isLoading}
          className="bg-secondary border-border"
        />
        <Button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          size="icon"
          className="gradient-primary hover:opacity-90 transition-opacity"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
