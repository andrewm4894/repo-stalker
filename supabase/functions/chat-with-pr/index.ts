import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { capturePostHogEvent } from "../_shared/posthog.ts";
import { checkRateLimit, getClientIP } from "../_shared/rateLimiter.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check rate limits before processing
    const clientIP = getClientIP(req);
    const rateLimitCheck = await checkRateLimit(clientIP);
    
    if (!rateLimitCheck.allowed) {
      console.log(`Rate limit exceeded for IP ${clientIP}: ${rateLimitCheck.reason}`);
      return new Response(
        JSON.stringify({ error: rateLimitCheck.reason }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { message, context, title, prUrl, prNumber, repoFullName, history, distinctId, chatId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Use chatId as trace ID to group the entire conversation
    const traceId = chatId || crypto.randomUUID();
    const generationId = crypto.randomUUID();
    const startTime = Date.now();

    // Build conversation history with tools
    const tools = [
      {
        type: "function",
        function: {
          name: "get_pr_files",
          description: "Fetch the list of files changed in this pull request, including additions, deletions, and changes",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_pr_commits",
          description: "Fetch the list of commits in this pull request",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_pr_comments",
          description: "Fetch all comments and reviews on this pull request",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_file_content",
          description: "Fetch the content of a specific file from the pull request",
          parameters: {
            type: "object",
            properties: {
              filename: {
                type: "string",
                description: "The path of the file to fetch"
              }
            },
            required: ["filename"]
          }
        }
      }
    ];

    const messages = [
      {
        role: "system",
        content: `You are an expert code reviewer and GitHub assistant. You're helping a developer understand a GitHub pull request or issue.

Title: ${title}
PR URL: ${prUrl}
Repository: ${repoFullName}

Initial Context/Description:
${context || "No description provided"}

You have access to tools to fetch additional information:
- get_pr_files: See all files changed in the PR
- get_pr_commits: See all commits in the PR
- get_pr_comments: See all comments and reviews
- get_file_content: Fetch specific file contents

Your job is to:
- Answer questions about the PR/issue clearly and concisely
- Use the available tools to gather more information when needed
- Explain technical concepts in an accessible way
- Provide insights about potential impacts, risks, or benefits
- Help the developer quickly understand what's happening

Keep responses focused and practical. Use tools proactively when they would help answer the user's question.`
      },
      ...history.map((msg: { role: string; content: string }) => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: "user",
        content: message
      }
    ];

    console.log('Calling Lovable AI with message:', message);

    // Handle potential tool calls in a loop
    let currentMessages = [...messages];
    let finalResponse = '';
    let maxIterations = 5;
    
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: currentMessages,
          tools,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Lovable AI error:', response.status, errorText);
        
        await capturePostHogEvent('$ai_generation', {
          $ai_trace_id: traceId,
          $ai_generation_id: generationId,
          $ai_model: 'google/gemini-2.5-flash',
          $ai_input: message,
          $ai_error: errorText,
          $ai_latency_ms: Date.now() - startTime,
          pr_title: title,
        }, distinctId || 'anonymous', 'pr_chat');
        
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      const choice = data.choices[0];
      const aiMessage = choice.message;

      // If no tool calls, we're done
      if (!aiMessage.tool_calls || aiMessage.tool_calls.length === 0) {
        finalResponse = aiMessage.content;
        const usage = data.usage;
        const endTime = Date.now();

        console.log('AI response received');

        await capturePostHogEvent('$ai_generation', {
          $ai_trace_id: traceId,
          $ai_generation_id: generationId,
          $ai_model: 'google/gemini-2.5-flash',
          $ai_input: message,
          $ai_output: finalResponse,
          $ai_input_tokens: usage?.prompt_tokens || 0,
          $ai_output_tokens: usage?.completion_tokens || 0,
          $ai_total_tokens: usage?.total_tokens || 0,
          $ai_latency_ms: endTime - startTime,
          pr_title: title,
          conversation_length: history.length + 1,
          tool_calls_made: iteration,
        }, distinctId || 'anonymous', 'pr_chat');

        break;
      }

      // Add assistant message with tool calls
      currentMessages.push(aiMessage);

      // Process each tool call
      for (const toolCall of aiMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments || '{}');
        
        console.log(`Executing tool: ${functionName}`, functionArgs);

        let toolResult = '';

        try {
          if (functionName === 'get_pr_files') {
            const filesResponse = await fetch(`https://api.github.com/repos/${repoFullName}/pulls/${prNumber}/files`, {
              headers: { 'Accept': 'application/vnd.github.v3+json' }
            });
            const files = await filesResponse.json();
            toolResult = JSON.stringify(files.map((f: any) => ({
              filename: f.filename,
              status: f.status,
              additions: f.additions,
              deletions: f.deletions,
              changes: f.changes,
              patch: f.patch?.substring(0, 500) // Limit patch size
            })));
          } else if (functionName === 'get_pr_commits') {
            const commitsResponse = await fetch(`https://api.github.com/repos/${repoFullName}/pulls/${prNumber}/commits`, {
              headers: { 'Accept': 'application/vnd.github.v3+json' }
            });
            const commits = await commitsResponse.json();
            toolResult = JSON.stringify(commits.map((c: any) => ({
              sha: c.sha,
              message: c.commit.message,
              author: c.commit.author.name,
              date: c.commit.author.date
            })));
          } else if (functionName === 'get_pr_comments') {
            const [reviewsResponse, commentsResponse] = await Promise.all([
              fetch(`https://api.github.com/repos/${repoFullName}/pulls/${prNumber}/reviews`, {
                headers: { 'Accept': 'application/vnd.github.v3+json' }
              }),
              fetch(`https://api.github.com/repos/${repoFullName}/pulls/${prNumber}/comments`, {
                headers: { 'Accept': 'application/vnd.github.v3+json' }
              })
            ]);
            const reviews = await reviewsResponse.json();
            const comments = await commentsResponse.json();
            toolResult = JSON.stringify({
              reviews: reviews.map((r: any) => ({
                user: r.user.login,
                state: r.state,
                body: r.body,
                submitted_at: r.submitted_at
              })),
              comments: comments.map((c: any) => ({
                user: c.user.login,
                body: c.body,
                path: c.path,
                line: c.line,
                created_at: c.created_at
              }))
            });
          } else if (functionName === 'get_file_content') {
            const fileResponse = await fetch(`https://api.github.com/repos/${repoFullName}/pulls/${prNumber}/files`, {
              headers: { 'Accept': 'application/vnd.github.v3+json' }
            });
            const files = await fileResponse.json();
            const file = files.find((f: any) => f.filename === functionArgs.filename);
            toolResult = file ? JSON.stringify({ patch: file.patch }) : 'File not found in this PR';
          }
        } catch (error) {
          toolResult = `Error fetching data: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }

        // Add tool result to messages
        currentMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolResult
        });
      }
    }

    return new Response(
      JSON.stringify({ response: finalResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in chat-with-pr function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
