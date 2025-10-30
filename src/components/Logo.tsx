import stalkerLogo from "@/assets/repo-stalker-logo.svg";

export const Logo = () => {
  return (
    <div className="flex items-center justify-center gap-2 md:gap-3 mb-4 md:mb-8">
      <div className="relative">
        <img 
          src={stalkerLogo} 
          alt="RepoStalker Logo - GitHub Octocat with spy stalker" 
          className="w-12 h-12 md:w-20 md:h-20 lg:w-28 lg:h-28 animate-pulse"
        />
      </div>
      <div className="flex flex-col">
        <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold terminal-text tracking-wider">
          <span className="text-primary">Repo</span>
          <span className="text-accent">Stalker</span>
        </h1>
        <div className="hidden md:flex items-center gap-2 text-muted-foreground text-xs md:text-sm font-mono">
          <span className="text-primary">$</span>
          <span className="animate-[fade-in_0.5s_ease-out]">stalking, but its fine as its just code...</span>
          <span className="animate-pulse">_</span>
        </div>
      </div>
    </div>
  );
};
