import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { capturePostHogEvent } from "../_shared/posthog.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { items, type, distinctId, sessionId } = await req.json();
    
    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No items to summarize' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const itemType = type === 'pr' ? 'Pull Requests' : 'Issues';
    
    // Extract repo name from items for trace naming
    let repoName = 'unknown';
    if (items && items.length > 0 && items[0].html_url) {
      const urlMatch = items[0].html_url.match(/github\.com\/([^\/]+\/[^\/]+)/);
      if (urlMatch) {
        repoName = urlMatch[1].replace('/', '_');
      }
    }
    
    const itemsText = items.map((item: any, idx: number) => 
      `${idx + 1}. [${item.state.toUpperCase()}] ${item.title}\n   Author: ${item.user?.login || 'Unknown'}\n   Created: ${item.created_at}\n   Comments: ${item.comments || 0}`
    ).join('\n\n');

    const systemPrompt = `You are an AI assistant that creates concise, insightful summaries of GitHub ${itemType.toLowerCase()}. 
Focus on:
- Overall status distribution (open/closed)
- Key themes or patterns
- Notable items that need attention
- Any trends in activity

Keep the summary brief (3-5 sentences) and actionable.`;

    const userPrompt = `Please summarize these ${items.length} ${itemType.toLowerCase()}:\n\n${itemsText}`;

    console.log(`Generating summary for ${items.length} ${itemType.toLowerCase()}`);

    const startTime = Date.now();
    const traceId = crypto.randomUUID();
    const generationId = crypto.randomUUID();

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content;

    if (!summary) {
      throw new Error('No summary generated');
    }

    const endTime = Date.now();
    const latency = (endTime - startTime) / 1000;

    console.log('Summary generated successfully');

    // Track AI generation in PostHog
    if (distinctId) {
      const spanName = type === 'pr' ? `repo_pr_summary_${repoName}` : `repo_issue_summary_${repoName}`;
      await capturePostHogEvent('$ai_generation', {
        $ai_trace_id: traceId,
        $ai_generation_id: generationId,
        $ai_model: 'google/gemini-2.5-flash',
        $ai_input_tokens: data.usage?.prompt_tokens || 0,
        $ai_output_tokens: data.usage?.completion_tokens || 0,
        $ai_total_tokens: data.usage?.total_tokens || 0,
        $ai_latency: latency,
        $ai_input: userPrompt,
        $ai_output: summary,
        item_count: items.length,
        item_type: itemType,
        success: true,
      }, distinctId, spanName, sessionId);
    }

    return new Response(
      JSON.stringify({ summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in summarize-items function:', error);
    
    // Track failed AI generation in PostHog
    const { distinctId, type, items: errorItems, sessionId } = await req.json().catch(() => ({}));
    if (distinctId) {
      // Try to extract repo name even in error case
      let repoName = 'unknown';
      if (errorItems && errorItems.length > 0 && errorItems[0].html_url) {
        const urlMatch = errorItems[0].html_url.match(/github\.com\/([^\/]+\/[^\/]+)/);
        if (urlMatch) {
          repoName = urlMatch[1].replace('/', '_');
        }
      }
      const spanName = type === 'pr' ? `repo_pr_summary_${repoName}` : `repo_issue_summary_${repoName}`;
      await capturePostHogEvent('$ai_generation', {
        $ai_trace_id: crypto.randomUUID(),
        $ai_generation_id: crypto.randomUUID(),
        $ai_model: 'google/gemini-2.5-flash',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, distinctId, spanName, sessionId);
    }
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
