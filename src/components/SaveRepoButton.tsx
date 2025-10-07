import { useState, useEffect } from "react";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleSaveRepo, isRepoSaved } from "./SavedRepos";
import { toast } from "sonner";

interface SaveRepoButtonProps {
  repo: string;
}

export const SaveRepoButton = ({ repo }: SaveRepoButtonProps) => {
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setIsSaved(isRepoSaved(repo));
    
    const handleChange = () => {
      setIsSaved(isRepoSaved(repo));
    };
    
    window.addEventListener('savedReposChanged', handleChange);
    return () => window.removeEventListener('savedReposChanged', handleChange);
  }, [repo]);

  const handleToggle = () => {
    const newState = toggleSaveRepo(repo);
    setIsSaved(newState);
    window.dispatchEvent(new Event('savedReposChanged'));
    
    toast.success(newState ? "Repository saved" : "Repository removed");
  };

  return (
    <Button
      variant={isSaved ? "default" : "outline"}
      size="sm"
      onClick={handleToggle}
      className="gap-2"
    >
      <Bookmark className={`w-4 h-4 ${isSaved ? "fill-current" : ""}`} />
      {isSaved ? "Saved" : "Save"}
    </Button>
  );
};
