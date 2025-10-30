import { GitPullRequest, MessageSquare, Calendar, User, ChevronDown, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface PR {
  number: number;
  title: string;
  state: string;
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  body: string;
  html_url: string;
  comments: number;
}

interface PRListProps {
  items: PR[];
  selectedId: number | null;
  onSelect: (item: PR) => void;
  type: "pr" | "issue";
}

export const PRList = ({ items, selectedId, onSelect, type }: PRListProps) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="glass rounded-2xl p-3 md:p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3 md:mb-4">
        <GitPullRequest className="w-4 h-4 md:w-5 md:h-5 text-primary" />
        <h3 className="font-semibold text-sm md:text-base">Recent {type === "pr" ? "Pull Requests" : "Issues"}</h3>
        <Badge variant="secondary" className="ml-auto text-xs">{items.length}</Badge>
      </div>
      
      <ScrollArea className="flex-1 -mr-4 pr-4">
        <div className="space-y-2">
          {items.map((item) => {
            const isSelected = selectedId === item.number;
            
            return (
              <Card 
                key={item.number}
                className={`cursor-pointer transition-all hover:border-primary/50 ${
                  isSelected ? 'border-primary bg-primary/5' : ''
                }`}
              >
                <CardHeader 
                  className="p-3 md:p-4 pb-2 md:pb-3"
                  onClick={() => onSelect(item)}
                >
                  <div className="flex items-start gap-2 md:gap-3">
                    <img 
                      src={item.user.avatar_url} 
                      alt={item.user.login}
                      className="w-6 h-6 md:w-8 md:h-8 rounded-full flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-xs md:text-sm line-clamp-2 mb-1">
                        {item.title}
                      </CardTitle>
                      <div className="flex flex-wrap items-center gap-2 md:gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <span className="truncate max-w-[80px] md:max-w-none">{item.user.login}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(item.created_at)}</span>
                        </div>
                        {item.comments > 0 && (
                          <div className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            <span>{item.comments}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronDown 
                      className={`w-4 h-4 text-muted-foreground transition-transform flex-shrink-0 ${
                        isSelected ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </CardHeader>
                
                {isSelected && (
                  <CardContent 
                    className="px-3 md:px-4 pb-3 md:pb-4 pt-0 space-y-2 md:space-y-3 animate-accordion-down"
                  >
                    {item.body && (
                      <div className="text-xs md:text-sm text-muted-foreground bg-secondary/50 rounded-lg p-2 md:p-3">
                        <p className="line-clamp-4 md:line-clamp-6 whitespace-pre-wrap">
                          {item.body}
                        </p>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={item.state === "open" ? "default" : "secondary"} className="text-xs">
                        {item.state}
                      </Badge>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto text-xs h-8"
                        asChild
                      >
                        <a 
                          href={item.html_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span className="hidden sm:inline">View on GitHub</span>
                          <span className="sm:hidden">GitHub</span>
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
