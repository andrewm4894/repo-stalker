import { useState } from "react";
import { Search, Github } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface RepoSearchProps {
  onSearch: (repo: string) => void;
  isLoading: boolean;
}

export const RepoSearch = ({ onSearch, isLoading }: RepoSearchProps) => {
  const [repo, setRepo] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (repo.trim()) {
      onSearch(repo.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="glass rounded-2xl p-6 glow">
        <div className="flex items-center gap-3 mb-4">
          <Github className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-semibold">Stalk a Repository</h2>
        </div>
        
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="owner/repo (e.g., facebook/react)"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              className="pl-10 bg-secondary border-border"
              disabled={isLoading}
            />
          </div>
          <Button 
            type="submit" 
            disabled={isLoading || !repo.trim()}
            className="gradient-primary hover:opacity-90 transition-opacity"
          >
            {isLoading ? "Loading..." : "Search"}
          </Button>
        </div>
      </div>
    </form>
  );
};
