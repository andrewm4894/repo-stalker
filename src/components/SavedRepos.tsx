import { Bookmark, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useEffect } from "react";

interface SavedRepoItem {
  repo: string;
  timestamp: number;
}

interface SavedReposProps {
  onSelectRepo: (repo: string) => void;
  currentRepo?: string;
}

const STORAGE_KEY = "saved-repos";

export const getSavedRepos = (): SavedRepoItem[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const isRepoSaved = (repo: string): boolean => {
  const saved = getSavedRepos();
  return saved.some(item => item.repo === repo);
};

export const toggleSaveRepo = (repo: string): boolean => {
  const saved = getSavedRepos();
  const exists = saved.some(item => item.repo === repo);
  
  let updated;
  if (exists) {
    // Remove it
    updated = saved.filter(item => item.repo !== repo);
  } else {
    // Add it
    updated = [{ repo, timestamp: Date.now() }, ...saved];
  }
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return !exists; // Return new state
  } catch (error) {
    console.error("Failed to save to localStorage:", error);
    return exists;
  }
};

export const removeRepo = (repo: string) => {
  const saved = getSavedRepos();
  const updated = saved.filter(item => item.repo !== repo);
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Failed to save to localStorage:", error);
  }
};

export const SavedRepos = ({ onSelectRepo, currentRepo }: SavedReposProps) => {
  const [savedRepos, setSavedRepos] = useState<SavedRepoItem[]>([]);

  useEffect(() => {
    setSavedRepos(getSavedRepos());
    
    // Listen for storage changes to update UI
    const handleStorageChange = () => {
      setSavedRepos(getSavedRepos());
    };
    
    window.addEventListener('storage', handleStorageChange);
    // Custom event for same-tab updates
    window.addEventListener('savedReposChanged', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('savedReposChanged', handleStorageChange);
    };
  }, []);

  if (savedRepos.length === 0) {
    return (
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Bookmark className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Saved Repositories</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Save repositories you want to track. Click the bookmark icon when viewing a repo.
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Bookmark className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Saved Repositories</h3>
        <span className="text-xs text-muted-foreground ml-auto">{savedRepos.length} saved</span>
      </div>
      
      <ScrollArea className="h-[120px]">
        <div className="space-y-1">
          {savedRepos.map((item) => (
            <div
              key={item.repo}
              className={`group flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm transition-colors ${
                currentRepo === item.repo
                  ? "bg-primary/20 text-primary"
                  : "hover:bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              <button
                onClick={() => onSelectRepo(item.repo)}
                className="flex-1 text-left"
              >
                {item.repo}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeRepo(item.repo);
                  setSavedRepos(getSavedRepos());
                  window.dispatchEvent(new Event('savedReposChanged'));
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/20 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
