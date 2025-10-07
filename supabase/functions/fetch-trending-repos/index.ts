import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { language, since } = await req.json();
    
    // Use GitHub trending API scraper service
    // This provides data that matches github.com/trending
    const period = since === 'daily' ? 'daily' : since === 'monthly' ? 'monthly' : 'weekly';
    const langParam = language && language !== 'all' ? `/${language}` : '';
    
    console.log(`Fetching trending repos for period: ${period}, language: ${langParam || 'all'}`);
    
    // Fetch from trending API
    const response = await fetch(
      `https://gh-trending-api.herokuapp.com/repositories${langParam}?since=${period}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Trending API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Transform the data to our format
    const repos = data.slice(0, 10).map((repo: any) => ({
      name: repo.author + '/' + repo.name,
      description: repo.description,
      stars: repo.stars,
      starsThisWeek: repo.currentPeriodStars,
      language: repo.language,
      url: repo.url,
    }));

    console.log(`Found ${repos.length} trending repos`);

    return new Response(
      JSON.stringify({ repos }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching trending repos:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
