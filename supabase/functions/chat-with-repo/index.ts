import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { capturePostHogEvent } from "../_shared/posthog.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, items, type, history, distinctId } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const itemType = type === 'pr' ? 'Pull Requests' : 'Issues';
    
    // Define tools the agent can use
    const tools = [
      {
        type: "function",
        function: {
          name: "search_items",
          description: `Search through the ${itemType} by keyword in title or body`,
          parameters: {
            type: "object",
            properties: {
              keyword: {
                type: "string",
                description: "Keyword to search for in titles and descriptions"
              }
            },
            required: ["keyword"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "filter_by_state",
          description: `Filter ${itemType} by state (open/closed)`,
          parameters: {
            type: "object",
            properties: {
              state: {
                type: "string",
                enum: ["open", "closed", "all"],
                description: "State to filter by"
              }
            },
            required: ["state"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_item_details",
          description: `Get full details of a specific ${type === 'pr' ? 'PR' : 'Issue'} by number`,
          parameters: {
            type: "object",
            properties: {
              number: {
                type: "number",
                description: `The ${type === 'pr' ? 'PR' : 'Issue'} number`
              }
            },
            required: ["number"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "analyze_activity",
          description: `Get statistics about ${itemType} activity (most commented, most recent, etc)`,
          parameters: {
            type: "object",
            properties: {
              metric: {
                type: "string",
                enum: ["most_commented", "most_recent", "oldest", "by_author"],
                description: "What metric to analyze"
              }
            },
            required: ["metric"]
          }
        }
      }
    ];

    const systemPrompt = `You are a helpful assistant that helps developers understand and analyze GitHub ${itemType}.

You have access to ${items.length} ${itemType} and can use tools to:
- Search items by keyword
- Filter by state (open/closed)
- Get detailed information about specific items
- Analyze activity patterns

When responding:
- Be concise and relevant
- ALWAYS include GitHub URLs when discussing specific ${type === 'pr' ? 'PRs' : 'issues'} - the tools provide these URLs
- Reference specific ${type === 'pr' ? 'PR' : 'Issue'} numbers with their links (e.g., "#123: Title - https://github.com/...")
- Use tools to provide accurate information
- Summarize findings clearly
- When users ask for links, provide the full GitHub URLs from the tool data

IMPORTANT: You HAVE access to GitHub URLs through the tools - always share them when relevant!

Available ${itemType}:
${items.slice(0, 50).map((item: any) => 
  `#${item.number}: ${item.title} (${item.state}) - ${item.comments} comments`
).join('\n')}

${items.length > 50 ? `... and ${items.length - 50} more` : ''}`;

    // Build messages array
    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: message }
    ];

    console.log(`Processing repo chat for ${items.length} ${itemType}`);

    let currentMessages = [...messages];
    const maxIterations = 5;
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;
      
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: currentMessages,
          tools: tools,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage = data.choices[0].message;

      // If no tool calls, return the response
      if (!assistantMessage.tool_calls) {
        console.log('Final response generated');
        
        if (distinctId) {
          await capturePostHogEvent('repo_chat_completed', {
            item_type: type,
            item_count: items.length,
            tool_calls_made: iteration - 1,
          }, distinctId);
        }

        return new Response(
          JSON.stringify({ response: assistantMessage.content }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Process tool calls
      console.log(`Processing ${assistantMessage.tool_calls.length} tool calls`);
      currentMessages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);
        
        console.log(`Executing tool: ${functionName}`, args);
        
        let result;
        
        switch (functionName) {
          case 'search_items':
            const keyword = args.keyword.toLowerCase();
            result = items.filter((item: any) => 
              item.title.toLowerCase().includes(keyword) ||
              (item.body && item.body.toLowerCase().includes(keyword))
            ).slice(0, 10).map((item: any) => ({
              number: item.number,
              title: item.title,
              state: item.state,
              author: item.user?.login,
              comments: item.comments
            }));
            break;
            
          case 'filter_by_state':
            result = items.filter((item: any) => 
              args.state === 'all' || item.state === args.state
            ).map((item: any) => ({
              number: item.number,
              title: item.title,
              state: item.state,
              comments: item.comments
            }));
            break;
            
          case 'get_item_details':
            const item = items.find((i: any) => i.number === args.number);
            result = item ? {
              number: item.number,
              title: item.title,
              state: item.state,
              body: item.body,
              author: item.user?.login,
              created_at: item.created_at,
              updated_at: item.updated_at,
              comments: item.comments,
              url: item.html_url
            } : null;
            break;
            
          case 'analyze_activity':
            if (args.metric === 'most_commented') {
              result = items
                .sort((a: any, b: any) => b.comments - a.comments)
                .slice(0, 5)
                .map((item: any) => ({
                  number: item.number,
                  title: item.title,
                  comments: item.comments
                }));
            } else if (args.metric === 'most_recent') {
              result = items
                .sort((a: any, b: any) => 
                  new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                )
                .slice(0, 5)
                .map((item: any) => ({
                  number: item.number,
                  title: item.title,
                  created_at: item.created_at
                }));
            } else if (args.metric === 'oldest') {
              result = items
                .sort((a: any, b: any) => 
                  new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                )
                .slice(0, 5)
                .map((item: any) => ({
                  number: item.number,
                  title: item.title,
                  created_at: item.created_at
                }));
            } else if (args.metric === 'by_author') {
              const authorCounts = items.reduce((acc: any, item: any) => {
                const author = item.user?.login || 'unknown';
                acc[author] = (acc[author] || 0) + 1;
                return acc;
              }, {});
              result = Object.entries(authorCounts)
                .sort(([,a]: any, [,b]: any) => b - a)
                .slice(0, 10)
                .map(([author, count]) => ({ author, count }));
            }
            break;
            
          default:
            result = { error: `Unknown function: ${functionName}` };
        }

        currentMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }
    }

    // Max iterations reached
    throw new Error('Max iterations reached without final response');

  } catch (error) {
    console.error('Error in chat-with-repo:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
