import { useState } from "react";
import { RepoSearch } from "@/components/RepoSearch";
import { PRList } from "@/components/PRList";
import { ChatInterface } from "@/components/ChatInterface";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

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

  const handleSearch = async (repo: string) => {
    setIsLoading(true);
    setPRs([]);
    setIssues([]);
    setSelectedPR(null);
    setSelectedIssue(null);

    try {
      // Fetch PRs
      const prResponse = await fetch(
        `https://api.github.com/repos/${repo}/pulls?state=all&sort=updated&per_page=20`
      );
      if (!prResponse.ok) throw new Error("Failed to fetch PRs");
      const prData = await prResponse.json();
      
      // Filter out dependabot PRs
      const filteredPRs = prData.filter(
        (pr: PR) => !pr.user.login.toLowerCase().includes("dependabot")
      );
      setPRs(filteredPRs);

      // Fetch Issues
      const issueResponse = await fetch(
        `https://api.github.com/repos/${repo}/issues?state=all&sort=updated&per_page=20`
      );
      if (!issueResponse.ok) throw new Error("Failed to fetch issues");
      const issueData = await issueResponse.json();
      
      // Filter out pull requests from issues and dependabot issues
      const actualIssues = issueData.filter(
        (item: any) => !item.pull_request && !item.user.login.toLowerCase().includes("dependabot")
      );
      setIssues(actualIssues);

      toast.success(`Loaded ${filteredPRs.length} PRs and ${actualIssues.length} issues`);
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
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-5xl font-bold text-gradient">RepoStalker</h1>
          <p className="text-muted-foreground">
            Catch up on recent PRs and issues with AI-powered insights
          </p>
        </div>

        {/* Search */}
        <RepoSearch onSearch={handleSearch} isLoading={isLoading} />

        {/* Main Content */}
        {currentItems.length > 0 && (
          <div className="grid md:grid-cols-2 gap-4 h-[600px]">
            {/* Left Panel - PR/Issue List */}
            <div className="h-full">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "prs" | "issues")} className="h-full flex flex-col">
                <TabsList className="glass mb-4">
                  <TabsTrigger value="prs">Pull Requests</TabsTrigger>
                  <TabsTrigger value="issues">Issues</TabsTrigger>
                </TabsList>
                <TabsContent value="prs" className="flex-1 mt-0">
                  <PRList
                    items={prs}
                    selectedId={selectedPR?.number || null}
                    onSelect={setSelectedPR}
                    type="pr"
                  />
                </TabsContent>
                <TabsContent value="issues" className="flex-1 mt-0">
                  <PRList
                    items={issues}
                    selectedId={selectedIssue?.number || null}
                    onSelect={setSelectedIssue}
                    type="issue"
                  />
                </TabsContent>
              </Tabs>
            </div>

            {/* Right Panel - Chat */}
            <div className="h-full">
              {currentSelected ? (
                <ChatInterface
                  context={currentSelected.body || "No description provided"}
                  title={`${activeTab === "prs" ? "Pull Request" : "Issue"} #${currentSelected.number}: ${currentSelected.title}`}
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
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
