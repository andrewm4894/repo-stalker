import { History, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RepoHistoryItem {
  repo: string;
  timestamp: number;
}

interface RepoHistoryProps {
  onSelectRepo: (repo: string) => void;
  currentRepo?: string;
}

const STORAGE_KEY = "repo-history";
const MAX_HISTORY = 10;

export const getRepoHistory = (): RepoHistoryItem[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const addRepoToHistory = (repo: string) => {
  const history = getRepoHistory();
  
  // Remove if already exists
  const filtered = history.filter(item => item.repo !== repo);
  
  // Add to the beginning
  const updated = [{ repo, timestamp: Date.now() }, ...filtered].slice(0, MAX_HISTORY);
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Failed to save to localStorage:", error);
  }
};

export const clearRepoHistory = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear localStorage:", error);
  }
};

export const RepoHistory = ({ onSelectRepo, currentRepo }: RepoHistoryProps) => {
  const history = getRepoHistory();

  if (history.length === 0) {
    return null;
  }

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Recent Repositories</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            clearRepoHistory();
            window.location.reload();
          }}
          className="h-6 px-2 text-xs"
        >
          Clear
        </Button>
      </div>
      
      <ScrollArea className="h-[120px]">
        <div className="space-y-1">
          {history.map((item) => (
            <button
              key={item.repo}
              onClick={() => onSelectRepo(item.repo)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                currentRepo === item.repo
                  ? "bg-primary/20 text-primary"
                  : "hover:bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.repo}
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
