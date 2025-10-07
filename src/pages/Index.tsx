import { useState } from "react";
import { RepoSearch, TimeFilter } from "@/components/RepoSearch";
import { PRList } from "@/components/PRList";
import { ChatInterface } from "@/components/ChatInterface";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { SavedRepos } from "@/components/SavedRepos";
import { SaveRepoButton } from "@/components/SaveRepoButton";
import { SummaryBox } from "@/components/SummaryBox";
import { TrendingRepos } from "@/components/TrendingRepos";

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

const Index = () => {
  const [prs, setPRs] = useState<PR[]>([]);
  const [issues, setIssues] = useState<PR[]>([]);
  const [selectedPR, setSelectedPR] = useState<PR | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<PR | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"prs" | "issues">("prs");
  const [currentRepo, setCurrentRepo] = useState<string>("");

  const filterByDate = (items: PR[], filter: TimeFilter): PR[] => {
    if (filter === "all") return items;
    
    const now = new Date();
    const daysMap = { "7d": 7, "14d": 14, "30d": 30, "90d": 90 };
    const days = daysMap[filter];
    const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    // Filter by created_at instead of updated_at to show recently created items
    return items.filter(item => new Date(item.created_at) >= cutoffDate);
  };

  const filterBySearchTerm = (items: PR[], searchTerm: string): PR[] => {
    if (!searchTerm) return items;
    
    const lowerSearch = searchTerm.toLowerCase();
    return items.filter(item => 
      item.title.toLowerCase().includes(lowerSearch) ||
      (item.body && item.body.toLowerCase().includes(lowerSearch))
    );
  };

  const handleSearch = async (repo: string, filter: TimeFilter, searchTerm: string) => {
    setIsLoading(true);
    setPRs([]);
    setIssues([]);
    setSelectedPR(null);
    setSelectedIssue(null);
    setCurrentRepo(repo);

    try {
      // Fetch PRs (get more to ensure we have enough after filtering)
      const prResponse = await fetch(
        `https://api.github.com/repos/${repo}/pulls?state=all&sort=created&direction=desc&per_page=100`
      );
      if (!prResponse.ok) throw new Error("Failed to fetch PRs");
      const prData = await prResponse.json();
      
      console.log(`Fetched ${prData.length} total PRs from GitHub`);
      
      // Filter out dependabot PRs and apply date filter
      let filteredPRs = prData.filter(
        (pr: PR) => !pr.user.login.toLowerCase().includes("dependabot")
      );
      console.log(`After removing dependabot: ${filteredPRs.length} PRs`);
      
      filteredPRs = filterByDate(filteredPRs, filter);
      console.log(`After date filter (${filter}): ${filteredPRs.length} PRs`);
      
      filteredPRs = filterBySearchTerm(filteredPRs, searchTerm);
      console.log(`After keyword filter: ${filteredPRs.length} PRs`);
      setPRs(filteredPRs);

      // Fetch Issues
      const issueResponse = await fetch(
        `https://api.github.com/repos/${repo}/issues?state=all&sort=created&direction=desc&per_page=100`
      );
      if (!issueResponse.ok) throw new Error("Failed to fetch issues");
      const issueData = await issueResponse.json();
      
      console.log(`Fetched ${issueData.length} total issues from GitHub`);
      
      // Filter out pull requests from issues, dependabot issues, and apply date filter
      let actualIssues = issueData.filter(
        (item: any) => !item.pull_request && !item.user.login.toLowerCase().includes("dependabot")
      );
      console.log(`After filtering: ${actualIssues.length} issues`);
      
      actualIssues = filterByDate(actualIssues, filter);
      console.log(`After date filter (${filter}): ${actualIssues.length} issues`);
      
      actualIssues = filterBySearchTerm(actualIssues, searchTerm);
      console.log(`After keyword filter: ${actualIssues.length} issues`);
      setIssues(actualIssues);

      const filterLabel = filter === "all" ? "all time" : `last ${filter.replace("d", " days")}`;
      toast.success(`Loaded ${filteredPRs.length} PRs and ${actualIssues.length} issues from ${filterLabel}`);
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Failed to fetch repository data. Please check the repo name.");
    } finally {
      setIsLoading(false);
    }
  };

  const currentSelected = activeTab === "prs" ? selectedPR : selectedIssue;
  const currentItems = activeTab === "prs" ? prs : issues;

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Logo />

        {/* Search and Save Button */}
        <div className="flex gap-2 items-start">
          <div className="flex-1">
            <RepoSearch onSearch={handleSearch} isLoading={isLoading} currentRepo={currentRepo} />
          </div>
          {currentRepo && (
            <div className="pt-1">
              <SaveRepoButton repo={currentRepo} />
            </div>
          )}
        </div>
        
        {/* Saved Repos */}
        <SavedRepos 
          onSelectRepo={(repo) => {
            handleSearch(repo, "14d", "");
          }}
          currentRepo={currentRepo}
        />

        {/* Trending Repos - Only show when no repo is loaded */}
        {!currentRepo && (
          <TrendingRepos 
            onSelectRepo={(repo) => {
              handleSearch(repo, "14d", "");
            }}
          />
        )}

        {/* Main Content */}
        {currentItems.length > 0 && (
          <div className="space-y-4">
            {/* Chat Panel - Top */}
            <div className="h-[400px]">
              {currentSelected ? (
                <ChatInterface
                  context={currentSelected.body || "No description provided"}
                  title={`${activeTab === "prs" ? "Pull Request" : "Issue"} #${currentSelected.number}: ${currentSelected.title}`}
                  prUrl={currentSelected.html_url}
                  prNumber={currentSelected.number}
                  repoFullName={currentRepo}
                  key={`${activeTab}-${currentSelected.number}`}
                />
              ) : (
                <div className="glass rounded-2xl p-8 h-full flex items-center justify-center">
                  <p className="text-muted-foreground text-center">
                    Select a {activeTab === "prs" ? "pull request" : "issue"} to start chatting
                  </p>
                </div>
              )}
            </div>

            {/* PR/Issue List - Bottom */}
            <div className="h-[500px]">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "prs" | "issues")} className="h-full flex flex-col">
                <TabsList className="glass mb-4">
                  <TabsTrigger value="prs">Pull Requests</TabsTrigger>
                  <TabsTrigger value="issues">Issues</TabsTrigger>
                </TabsList>
                <TabsContent value="prs" className="flex-1 mt-0 space-y-4">
                  <SummaryBox items={prs} type="pr" />
                  <PRList
                    items={prs}
                    selectedId={selectedPR?.number || null}
                    onSelect={setSelectedPR}
                    type="pr"
                  />
                </TabsContent>
                <TabsContent value="issues" className="flex-1 mt-0 space-y-4">
                  <SummaryBox items={issues} type="issue" />
                  <PRList
                    items={issues}
                    selectedId={selectedIssue?.number || null}
                    onSelect={setSelectedIssue}
                    type="issue"
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
