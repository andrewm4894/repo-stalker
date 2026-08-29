import { useState, useEffect } from "react";
import { Search, Github, Calendar, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type TimeFilter = "7d" | "14d" | "30d" | "90d" | "all";

// Accept the GitHub "owner/repo" shape: two non-empty segments and a single slash.
const REPO_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\/[a-zA-Z0-9._-]+$/;

interface RepoSearchProps {
  onSearch: (repo: string, filter: TimeFilter, searchTerm: string) => void;
  isLoading: boolean;
  currentRepo?: string;
}

export const RepoSearch = ({ onSearch, isLoading, currentRepo }: RepoSearchProps) => {
  const [repo, setRepo] = useState("");
  const [repoError, setRepoError] = useState("");
  const [filter, setFilter] = useState<TimeFilter>("14d");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  // Debounce search term input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Auto-refresh when filter or debouncedSearchTerm changes if we have a repo loaded
  useEffect(() => {
    if (currentRepo && !isLoading) {
      onSearch(currentRepo, filter, debouncedSearchTerm.trim());
    }
  }, [filter, debouncedSearchTerm]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedRepo = repo.trim();
    if (!REPO_PATTERN.test(trimmedRepo)) {
      setRepoError("Enter a repository as owner/repo, for example facebook/react.");
      return;
    }
    setRepoError("");
    onSearch(trimmedRepo, filter, searchTerm.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="glass rounded-2xl p-3 sm:p-4 md:p-6 glow">
        <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
          <Github className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          <h2 className="text-base md:text-xl font-semibold">Stalk a Repository</h2>
        </div>
        
        <div className="space-y-2 md:space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="owner/repo (e.g., facebook/react)"
                value={repo}
                onChange={(e) => {
                  setRepo(e.target.value);
                  if (repoError) setRepoError("");
                }}
                aria-invalid={!!repoError}
                aria-describedby={repoError ? "repo-error" : undefined}
                className="pl-10 bg-secondary border-border terminal-text text-sm"
                disabled={isLoading}
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading || !repo.trim()}
              className="gradient-primary hover:opacity-90 transition-opacity w-full sm:w-auto"
            >
              {isLoading ? "Loading..." : "Search"}
            </Button>
          </div>

          {repoError && (
            <p id="repo-error" role="alert" className="text-sm text-destructive">
              {repoError}
            </p>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <Select value={filter} onValueChange={(v) => setFilter(v as TimeFilter)}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="14d">Last 14 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <Input
                type="text"
                placeholder="Filter by keywords..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-secondary border-border terminal-text"
                disabled={isLoading}
              />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};
