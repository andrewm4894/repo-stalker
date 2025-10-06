import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const POSTHOG_API_KEY = 'phc_ABOAagCSNfMOUWin6A6Tda0WuhzWLFSXjSgSiq9KKBs';
const POSTHOG_HOST = 'https://us.i.posthog.com';

async function capturePostHogEvent(eventName: string, properties: any, distinctId: string) {
  try {
    await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: POSTHOG_API_KEY,
        event: eventName,
        properties: {
          ...properties,
          distinct_id: distinctId,
        },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error('PostHog capture error:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, context, title, history, distinctId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Generate trace ID for tracking this conversation
    const traceId = crypto.randomUUID();
    const generationId = crypto.randomUUID();
    const startTime = Date.now();

    // Build conversation history
    const messages = [
      {
        role: "system",
        content: `You are an expert code reviewer and GitHub assistant. You're helping a developer understand a GitHub pull request or issue.

Title: ${title}

Context/Description:
${context || "No description provided"}

Your job is to:
- Answer questions about the PR/issue clearly and concisely
- Explain technical concepts in an accessible way
- Provide insights about potential impacts, risks, or benefits
- Help the developer quickly understand what's happening

Keep responses focused and practical.`
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

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      // Capture error event to PostHog
      await capturePostHogEvent('$ai_generation', {
        $ai_trace_id: traceId,
        $ai_generation_id: generationId,
        $ai_model: 'google/gemini-2.5-flash',
        $ai_input: message,
        $ai_error: errorText,
        $ai_latency_ms: Date.now() - startTime,
        pr_title: title,
      }, distinctId || 'anonymous');
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    const usage = data.usage;
    const endTime = Date.now();

    console.log('AI response received');

    // Capture successful generation to PostHog
    await capturePostHogEvent('$ai_generation', {
      $ai_trace_id: traceId,
      $ai_generation_id: generationId,
      $ai_model: 'google/gemini-2.5-flash',
      $ai_input: message,
      $ai_output: aiResponse,
      $ai_input_tokens: usage?.prompt_tokens || 0,
      $ai_output_tokens: usage?.completion_tokens || 0,
      $ai_total_tokens: usage?.total_tokens || 0,
      $ai_latency_ms: endTime - startTime,
      pr_title: title,
      conversation_length: history.length + 1,
    }, distinctId || 'anonymous');

    return new Response(
      JSON.stringify({ response: aiResponse }),
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
