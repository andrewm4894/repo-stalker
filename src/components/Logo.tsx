import { Eye, Github } from "lucide-react";

export const Logo = () => {
  return (
    <div className="flex items-center justify-center gap-3 mb-8">
      <div className="relative">
        <Github className="w-12 h-12 text-primary" />
        <Eye className="w-5 h-5 text-accent absolute -bottom-1 -right-1 animate-pulse" />
      </div>
      <div className="flex flex-col">
        <h1 className="text-5xl font-bold terminal-text tracking-wider">
          <span className="text-primary">Repo</span>
          <span className="text-accent">Stalker</span>
        </h1>
        <div className="flex items-center gap-2 text-muted-foreground text-sm font-mono">
          <span className="text-primary">$</span>
          <span className="animate-[fade-in_0.5s_ease-out]">tracking repository activity...</span>
          <span className="animate-pulse">_</span>
        </div>
      </div>
    </div>
  );
};
