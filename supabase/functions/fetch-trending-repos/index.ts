import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { language, since } = await req.json();
    
    // Calculate date for "since" parameter (default to weekly)
    const daysAgo = since === 'daily' ? 1 : since === 'monthly' ? 30 : 7;
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const dateStr = date.toISOString().split('T')[0];
    
    // Build GitHub search query for trending repos
    let query = `created:>${dateStr} stars:>10`;
    if (language && language !== 'all') {
      query += ` language:${language}`;
    }
    
    console.log('Fetching trending repos with query:', query);
    
    // Fetch from GitHub API
    const response = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=10`,
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
    
    // Transform the data to a simpler format
    const repos = data.items.map((repo: any) => ({
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
