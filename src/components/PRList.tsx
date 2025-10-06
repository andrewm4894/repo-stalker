import { GitPullRequest, MessageSquare, Calendar, User } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

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
    <div className="glass rounded-2xl p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <GitPullRequest className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Recent {type === "pr" ? "Pull Requests" : "Issues"}</h3>
        <Badge variant="secondary" className="ml-auto">{items.length}</Badge>
      </div>
      
      <ScrollArea className="flex-1 -mr-4 pr-4">
        <div className="space-y-2">
          {items.map((item) => (
            <Card 
              key={item.number}
              className={`cursor-pointer transition-all hover:border-primary/50 ${
                selectedId === item.number ? 'border-primary bg-primary/5' : ''
              }`}
              onClick={() => onSelect(item)}
            >
              <CardHeader className="p-4 pb-3">
                <div className="flex items-start gap-3">
                  <img 
                    src={item.user.avatar_url} 
                    alt={item.user.login}
                    className="w-8 h-8 rounded-full"
                  />
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm line-clamp-2 mb-1">
                      {item.title}
                    </CardTitle>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span>{item.user.login}</span>
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
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
