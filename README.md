<div align="center">
  <img src="./public/favicon.svg" alt="Repo Stalker Logo" width="200" />
</div>

# RepoStalker

**Your GitHub PR & Issue AI Assistant**

RepoStalker helps developers quickly catch up on repository activity using AI-powered insights. Chat with pull requests, issues, and entire repositories to understand what's happening without reading through everything manually.

## Features

- **Repository Search**: Search and save your favorite GitHub repositories
- **AI Chat with PRs**: Have natural conversations about pull requests to understand changes quickly
- **AI Chat with Issues**: Discuss issues and get context without reading full threads
- **Smart Summaries**: Get AI-generated summaries of PRs and issues
- **Trending Repos**: Discover what's popular on GitHub
- **Save Favorites**: Keep track of repositories you care about
- **PostHog Analytics**: Built-in LLM observability with span tracking for different AI interactions

## Architecture

### Frontend
- **React + TypeScript**: Type-safe component architecture
- **Vite**: Lightning-fast development and builds
- **Tailwind CSS + shadcn/ui**: Beautiful, accessible UI components
- **React Query**: Efficient data fetching and caching

### Backend (Lovable Cloud)
- **Edge Functions**: Serverless functions for AI chat and data fetching
  - `chat-with-repo`: Repository-level AI conversations
  - `chat-with-pr`: PR-specific AI analysis
  - `summarize-items`: Generate summaries for PRs and issues
  - `fetch-trending-repos`: Get trending GitHub repositories
- **PostHog Integration**: LLM analytics with distinct span names:
  - `repo_chat`: Repository conversations
  - `pr_chat`: PR discussions
  - `issue_chat`: Issue analysis
  - `repo_pr_summary`: PR summaries
  - `repo_issue_summary`: Issue summaries

### AI Models
Powered by Lovable AI with support for multiple models:
- Google Gemini 2.5 Pro/Flash/Flash-Lite
- OpenAI GPT-5/5-mini/5-nano

## Getting Started

### Prerequisites
- Node.js & npm ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))

### Installation

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to the project directory
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm i

# Start the development server
npm run dev
```

## Development

### Project Structure
```
src/
├── components/          # React components
│   ├── ChatInterface.tsx
│   ├── PRList.tsx
│   ├── RepoChatDialog.tsx
│   ├── RepoSearch.tsx
│   └── ui/             # shadcn/ui components
├── pages/              # Page components
├── integrations/       # Backend integrations
│   └── supabase/       # Lovable Cloud client
└── lib/                # Utilities

supabase/
└── functions/          # Edge functions
    ├── chat-with-repo/
    ├── chat-with-pr/
    ├── summarize-items/
    └── _shared/        # Shared utilities (PostHog, CORS)
```

### Editing the Code

**Lovable Project**: https://lovable.dev/projects/63423304-e9f8-4756-83be-b3d2375453d6

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/63423304-e9f8-4756-83be-b3d2375453d6) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable automatically (bidirectional sync).

**Edit directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Click on the "Code" button → "Codespaces" tab → "New codespace"
- Edit files directly within the Codespace and commit changes

## Deployment

**Via Lovable**

Simply open [Lovable](https://lovable.dev/projects/63423304-e9f8-4756-83be-b3d2375453d6) and click Share → Publish.

**Custom Domain**

Navigate to Project > Settings > Domains and click Connect Domain.

Read more: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

**Self-Hosting**

After connecting to GitHub, you can deploy the code to any hosting platform (Vercel, Netlify, etc.) while continuing to use Lovable for development.

## Learn More

- [Lovable Documentation](https://docs.lovable.dev/)
- [Lovable Cloud Features](https://docs.lovable.dev/features/cloud)
- [Lovable AI Features](https://docs.lovable.dev/features/ai)

## License

This project was built with [Lovable](https://lovable.dev).
