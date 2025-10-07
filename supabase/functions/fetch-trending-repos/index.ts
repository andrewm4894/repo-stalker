import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { language, since } = await req.json();
    
    // Use a different trending API - this one is more reliable
    const period = since === 'daily' ? 'daily' : since === 'monthly' ? 'monthly' : 'weekly';
    const langParam = language && language !== 'all' ? language : '';
    
    console.log(`Fetching trending repos for period: ${period}, language: ${langParam || 'all'}`);
    
    // Use the GitHub API directly with a better approximation
    // Sort by stars gained in the time period (using creation date as proxy)
    const daysAgo = period === 'daily' ? 1 : period === 'monthly' ? 30 : 7;
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const dateStr = date.toISOString().split('T')[0];
    
    let query = `pushed:>${dateStr} stars:>50`;
    if (langParam) {
      query += ` language:${langParam}`;
    }
    
    console.log('GitHub API query:', query);
    
    const response = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=20`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Repo-Stalker-App',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Transform and filter to get most actively starred repos
    const repos = data.items
      .slice(0, 10)
      .map((repo: any) => ({
        name: repo.full_name,
        description: repo.description,
        stars: repo.stargazers_count,
        language: repo.language,
        url: repo.html_url,
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
