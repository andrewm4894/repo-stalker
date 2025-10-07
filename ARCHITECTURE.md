# RepoStalker Architecture

This document provides a comprehensive overview of the RepoStalker architecture, including system design, component structure, and data flows.

## System Overview

RepoStalker is a full-stack web application built with React on the frontend and Lovable Cloud (Supabase) on the backend, featuring AI-powered analysis of GitHub repositories, pull requests, and issues.

<lov-mermaid>
graph TB
    subgraph "Client Layer"
        UI[React Frontend]
        Router[React Router]
        Query[React Query]
    end
    
    subgraph "Backend Layer - Lovable Cloud"
        EF1[chat-with-repo]
        EF2[chat-with-pr]
        EF3[summarize-items]
        EF4[fetch-trending-repos]
    end
    
    subgraph "External Services"
        AI[Lovable AI Gateway]
        GH[GitHub API]
        PH[PostHog Analytics]
    end
    
    UI --> Router
    UI --> Query
    Query --> EF1
    Query --> EF2
    Query --> EF3
    Query --> EF4
    
    EF1 --> AI
    EF2 --> AI
    EF3 --> AI
    EF4 --> GH
    
    EF1 -.-> PH
    EF2 -.-> PH
    EF3 -.-> PH
</lov-mermaid>

## Frontend Architecture

### Component Hierarchy

<lov-mermaid>
graph TD
    App[App.tsx] --> Index[Index Page]
    
    Index --> Logo[Logo]
    Index --> RepoSearch[RepoSearch]
    Index --> SavedRepos[SavedRepos]
    Index --> TrendingRepos[TrendingRepos]
    
    RepoSearch --> SaveRepoButton[SaveRepoButton]
    SavedRepos --> RepoChatDialog[RepoChatDialog]
    SavedRepos --> PRList[PRList]
    
    RepoChatDialog --> ChatInterface[ChatInterface]
    PRList --> SummaryBox[SummaryBox]
    PRList --> ChatInterface2[ChatInterface]
    
    style App fill:#e1f5ff
    style Index fill:#fff3e0
    style ChatInterface fill:#f3e5f5
    style ChatInterface2 fill:#f3e5f5
</lov-mermaid>

### Tech Stack

- **Framework**: React 18 with TypeScript
- **Bundler**: Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **Routing**: React Router v6
- **State Management**: React Query for server state
- **HTTP Client**: Native Fetch via Supabase client

## Backend Architecture

### Edge Functions Overview

All backend logic runs as serverless edge functions on Lovable Cloud:

<lov-mermaid>
graph LR
    subgraph "Edge Functions"
        direction TB
        CF[chat-with-repo]
        CP[chat-with-pr]
        SI[summarize-items]
        FT[fetch-trending-repos]
    end
    
    subgraph "Shared Utilities"
        CORS[cors.ts]
        PH[posthog.ts]
    end
    
    CF -.-> CORS
    CF -.-> PH
    CP -.-> CORS
    CP -.-> PH
    SI -.-> CORS
    SI -.-> PH
    FT -.-> CORS
    
    style CF fill:#bbdefb
    style CP fill:#c5cae9
    style SI fill:#d1c4e9
    style FT fill:#f8bbd0
</lov-mermaid>

## Feature Flows

### 1. Chat with Repository

<lov-mermaid>
sequenceDiagram
    participant User
    participant UI as RepoChatDialog
    participant EF as chat-with-repo
    participant AI as Lovable AI Gateway
    participant PH as PostHog

    User->>UI: Opens chat for repository
    User->>UI: Sends message
    UI->>EF: POST /chat-with-repo
    Note over EF: Adds system prompt<br/>with repo context
    EF->>AI: Stream chat request
    EF->>PH: Track with $ai_span_name: "repo_chat"
    AI-->>EF: Stream response
    EF-->>UI: SSE stream
    UI->>UI: Display tokens as received
</lov-mermaid>

### 2. Chat with Pull Request

<lov-mermaid>
sequenceDiagram
    participant User
    participant UI as ChatInterface
    participant EF as chat-with-pr
    participant AI as Lovable AI Gateway
    participant PH as PostHog

    User->>UI: Clicks chat on PR
    User->>UI: Asks about changes
    UI->>EF: POST /chat-with-pr<br/>{repo, prNumber, message}
    Note over EF: Fetches PR details<br/>from GitHub
    EF->>AI: Chat completion request
    EF->>PH: Track with $ai_span_name: "pr_chat"
    AI-->>EF: Response
    EF-->>UI: JSON response
    UI->>UI: Display AI analysis
</lov-mermaid>

### 3. Generate Summaries

<lov-mermaid>
sequenceDiagram
    participant User
    participant UI as PRList/SummaryBox
    participant EF as summarize-items
    participant AI as Lovable AI Gateway
    participant PH as PostHog

    User->>UI: Views PR/Issue
    UI->>EF: POST /summarize-items<br/>{items, type}
    
    alt type === "pr"
        EF->>PH: Track with $ai_span_name: "repo_pr_summary"
    else type === "issue"
        EF->>PH: Track with $ai_span_name: "repo_issue_summary"
    end
    
    EF->>AI: Generate summary
    AI-->>EF: Summary text
    EF-->>UI: Return summary
    UI->>UI: Display summary
</lov-mermaid>

### 4. Fetch Trending Repositories

<lov-mermaid>
sequenceDiagram
    participant User
    participant UI as TrendingRepos
    participant EF as fetch-trending-repos
    participant GH as GitHub.com

    User->>UI: Lands on homepage
    UI->>EF: GET /fetch-trending-repos
    EF->>GH: Scrape trending page
    Note over EF: Parses HTML for<br/>repo data
    GH-->>EF: HTML response
    EF->>EF: Extract repo metadata
    EF-->>UI: Array of trending repos
    UI->>UI: Display carousel
</lov-mermaid>

## AI Integration Architecture

### Lovable AI Gateway Flow

<lov-mermaid>
graph TB
    subgraph "Edge Function"
        Request[Incoming Request]
        System[Add System Prompt]
        Auth[Add LOVABLE_API_KEY]
        Call[Call AI Gateway]
    end
    
    subgraph "Lovable AI Gateway"
        Route[Route to Model]
        Gemini[Google Gemini 2.5]
        GPT[OpenAI GPT-5]
    end
    
    subgraph "Response Handling"
        Stream[Stream Response]
        Parse[Parse SSE]
        Return[Return to Client]
    end
    
    Request --> System
    System --> Auth
    Auth --> Call
    Call --> Route
    
    Route --> Gemini
    Route --> GPT
    
    Gemini --> Stream
    GPT --> Stream
    Stream --> Parse
    Parse --> Return
    
    style Request fill:#e3f2fd
    style Call fill:#f3e5f5
    style Stream fill:#fff9c4
    style Return fill:#c8e6c9
</lov-mermaid>

### Supported AI Models

The application leverages Lovable AI which provides access to:

- **google/gemini-2.5-pro**: Complex reasoning, multimodal
- **google/gemini-2.5-flash**: Balanced performance (default)
- **google/gemini-2.5-flash-lite**: Fast, cost-effective
- **openai/gpt-5**: Advanced reasoning
- **openai/gpt-5-mini**: Cost-efficient alternative
- **openai/gpt-5-nano**: High-speed processing

## Analytics Architecture

### PostHog Integration

<lov-mermaid>
graph LR
    subgraph "Edge Functions"
        CF[chat-with-repo]
        CP[chat-with-pr]
        SI[summarize-items]
    end
    
    subgraph "PostHog Tracking"
        direction TB
        Init[Initialize Client]
        Track[Track AI Event]
        Span[Set $ai_span_name]
    end
    
    subgraph "Span Names"
        RC[repo_chat]
        PC[pr_chat]
        IC[issue_chat]
        PRS[repo_pr_summary]
        IS[repo_issue_summary]
    end
    
    CF --> Init
    CP --> Init
    SI --> Init
    
    Init --> Track
    Track --> Span
    
    CF -.-> RC
    CP -.-> PC
    SI -.-> PRS
    SI -.-> IS
    
    style Init fill:#e1bee7
    style Track fill:#f48fb1
    style Span fill:#ce93d8
</lov-mermaid>

### Analytics Events

Each AI interaction is tracked with a distinct span name:

| Feature | Span Name | Purpose |
|---------|-----------|---------|
| Repository Chat | `repo_chat` | Track conversations about entire repos |
| PR Chat | `pr_chat` | Track PR-specific discussions |
| Issue Chat | `issue_chat` | Track issue-specific discussions |
| PR Summary | `repo_pr_summary` | Track PR summarization requests |
| Issue Summary | `repo_issue_summary` | Track issue summarization requests |

## Data Flow

### Repository Search & Save Flow

<lov-mermaid>
stateDiagram-v2
    [*] --> Searching
    Searching --> ResultsDisplayed: User searches
    ResultsDisplayed --> Saved: Click save
    Saved --> LocalStorage: Store in localStorage
    LocalStorage --> DisplaySaved: Load saved repos
    DisplaySaved --> ViewingDetails: Click repository
    ViewingDetails --> ChatOpen: Open chat
    ViewingDetails --> ViewingPRs: View PRs/Issues
    ViewingPRs --> GeneratingSummary: Request summary
    GeneratingSummary --> SummaryDisplayed: AI generates
    ChatOpen --> Chatting: Exchange messages
    Chatting --> [*]
    SummaryDisplayed --> [*]
</lov-mermaid>

## Storage & State Management

### Client-Side State

<lov-mermaid>
graph TD
    subgraph "Persistent Storage"
        LS[localStorage]
        LS --> SavedRepos[Saved Repositories]
    end
    
    subgraph "React Query Cache"
        QC[Query Cache]
        QC --> Trending[Trending Repos]
        QC --> Summaries[AI Summaries]
    end
    
    subgraph "Component State"
        CS[useState/useReducer]
        CS --> ChatHistory[Chat Messages]
        CS --> UIState[UI State]
    end
    
    style LS fill:#fff9c4
    style QC fill:#c5e1a5
    style CS fill:#b3e5fc
</lov-mermaid>

## Security Considerations

### API Key Management

<lov-mermaid>
graph LR
    subgraph "Secrets Storage"
        ENV[Supabase Secrets]
        ENV --> LOVABLE[LOVABLE_API_KEY]
    end
    
    subgraph "Edge Function Access"
        EF[Edge Function]
        EF --> GetEnv[Deno.env.get]
        GetEnv --> UseKey[Authorize AI Request]
    end
    
    subgraph "Client Layer"
        Client[React App]
        Client -.-> NoAccess[No Direct API Access]
    end
    
    LOVABLE --> GetEnv
    
    style ENV fill:#ffccbc
    style LOVABLE fill:#ffab91
    style NoAccess fill:#ef9a9a
</lov-mermaid>

### CORS Configuration

All edge functions implement CORS headers to enable secure cross-origin requests from the frontend:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

## Performance Optimizations

### Streaming Responses

AI responses use Server-Sent Events (SSE) for real-time streaming:

<lov-mermaid>
sequenceDiagram
    participant Client
    participant EdgeFunction
    participant AIGateway
    
    Client->>EdgeFunction: Request (stream: true)
    EdgeFunction->>AIGateway: POST with stream: true
    
    loop Token Stream
        AIGateway-->>EdgeFunction: data: {"delta": "token"}
        EdgeFunction-->>Client: SSE: data: {"delta": "token"}
        Client->>Client: Render token immediately
    end
    
    AIGateway-->>EdgeFunction: data: [DONE]
    EdgeFunction-->>Client: SSE: data: [DONE]
</lov-mermaid>

### Caching Strategy

- **React Query**: Caches API responses with configurable stale time
- **localStorage**: Persists saved repositories across sessions
- **Browser Cache**: Leverages HTTP caching headers where applicable

## Deployment Architecture

<lov-mermaid>
graph TB
    subgraph "Development"
        Dev[Local Development]
        Dev --> Vite[Vite Dev Server]
        Dev --> Local[Local Edge Functions]
    end
    
    subgraph "Version Control"
        GH[GitHub Repository]
    end
    
    subgraph "Production"
        Lovable[Lovable Cloud]
        Lovable --> CDN[CDN - Static Assets]
        Lovable --> Edge[Edge Functions Runtime]
    end
    
    Dev --> GH
    GH --> Lovable
    
    style Dev fill:#e3f2fd
    style Lovable fill:#c8e6c9
    style CDN fill:#fff9c4
</lov-mermaid>

## Technology Decisions

### Why Lovable Cloud?

- **No separate backend setup required**: Integrated Supabase project
- **Automatic edge function deployment**: Push to deploy
- **Built-in secrets management**: Secure API key storage
- **Lovable AI Gateway**: Pre-configured AI access without managing API keys

### Why React Query?

- **Automatic caching and revalidation**: Reduces unnecessary requests
- **Built-in loading/error states**: Simplifies UI logic
- **Optimistic updates**: Better UX for mutations
- **DevTools**: Excellent debugging experience

### Why shadcn/ui?

- **Customizable components**: Full control over styling
- **Accessible by default**: WCAG compliant
- **No runtime dependency**: Components copied to codebase
- **Tailwind integration**: Consistent design system

## Future Architecture Considerations

### Potential Enhancements

1. **Database Integration**: Add Supabase tables for:
   - User authentication
   - Persistent conversation history
   - Shared repository collections

2. **Real-time Collaboration**: 
   - WebSocket connections for live updates
   - Shared chat sessions

3. **Webhook Integration**:
   - GitHub webhook handlers
   - Automatic PR/Issue notifications

4. **Enhanced Analytics**:
   - Custom dashboards
   - Usage metrics
   - Cost tracking per feature

### Scalability Path

<lov-mermaid>
graph TD
    Current[Current: Stateless Functions] --> Auth[Add Authentication]
    Auth --> DB[Add Database Layer]
    DB --> Cache[Add Redis Cache]
    Cache --> Queue[Add Job Queue]
    Queue --> Scale[Horizontal Scaling]
    
    style Current fill:#c8e6c9
    style Auth fill:#a5d6a7
    style DB fill:#81c784
    style Cache fill:#66bb6a
    style Queue fill:#4caf50
    style Scale fill:#43a047
</lov-mermaid>

---

For more details on specific components or flows, refer to the inline code documentation or the [README.md](./README.md).
