import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Star, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface TrendingRepo {
  name: string;
  description: string;
  stars: number;
  starsThisWeek?: number;
  language: string;
  url: string;
}

interface TrendingReposProps {
  onSelectRepo: (repo: string) => void;
}

export const TrendingRepos = ({ onSelectRepo }: TrendingReposProps) => {
  const [repos, setRepos] = useState<TrendingRepo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTrendingRepos();
  }, []);

  const fetchTrendingRepos = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-trending-repos', {
        body: { language: 'all', since: 'weekly' }
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setRepos(data.repos || []);
    } catch (error) {
      console.error('Error fetching trending repos:', error);
      toast.error("Failed to load trending repositories");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Trending Repositories
          </CardTitle>
          <CardDescription>Popular repos from the past week</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (repos.length === 0) {
    return null;
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Trending Repositories
        </CardTitle>
        <CardDescription>Popular repos from the past week - click to explore</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {repos.slice(0, 5).map((repo) => (
          <div
            key={repo.name}
            className="p-3 rounded-lg border border-border/50 hover:border-border transition-colors cursor-pointer group"
            onClick={() => onSelectRepo(repo.name)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                    {repo.name}
                  </h4>
                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
                  </a>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {repo.description || "No description available"}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Star className="h-3 w-3" />
                    <span>{repo.stars.toLocaleString()}</span>
                    {repo.starsThisWeek && (
                      <span className="text-primary ml-1">
                        +{repo.starsThisWeek.toLocaleString()} this week
                      </span>
                    )}
                  </div>
                  {repo.language && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {repo.language}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
