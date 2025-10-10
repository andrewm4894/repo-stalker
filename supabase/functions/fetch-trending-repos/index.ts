import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { language, since } = await req.json();
    
    // Build GitHub trending URL
    const period = since === 'daily' ? 'daily' : since === 'monthly' ? 'monthly' : 'weekly';
    const langParam = language && language !== 'all' ? `/${language}` : '';
    const url = `https://github.com/trending${langParam}?since=${period}`;
    
    console.log(`Scraping GitHub trending page: ${url}`);
    
    // Fetch the trending page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub returned ${response.status}`);
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    if (!doc) {
      throw new Error('Failed to parse HTML');
    }

    // Parse repo articles
    const articles = doc.querySelectorAll('article.Box-row');
    const repos = [];
    
    for (const article of articles) {
      try {
        // Get repo name from h2 > a
        const nameLink = (article as any).querySelector('h2 a');
        const name = nameLink?.getAttribute('href')?.slice(1) || ''; // Remove leading /
        
        // Get description
        const descElement = (article as any).querySelector('p');
        const description = descElement?.textContent?.trim() || '';
        
        // Get language
        const langSpan = (article as any).querySelector('[itemprop="programmingLanguage"]');
        const language = langSpan?.textContent?.trim() || '';
        
        // Get stars - look for the star icon's parent
        const allLinks = (article as any).querySelectorAll('a');
        const starLink = Array.from(allLinks || []).find((a: any) => 
          a?.getAttribute?.('href')?.includes?.('/stargazers')
        );
        const starsText = (starLink as any)?.textContent?.trim()?.replace?.(/,/g, '') || '0';
        const stars = parseInt(starsText) || 0;
        
        // Get stars this period
        const starsSpan = (article as any).querySelector('span.d-inline-block.float-sm-right');
        const starsThisPeriod = starsSpan?.textContent?.trim()?.split(' ')[0]?.replace(/,/g, '') || '0';
        
        if (name) {
          repos.push({
            name,
            description,
            stars,
            starsThisWeek: parseInt(starsThisPeriod) || 0,
            language,
            url: `https://github.com/${name}`,
          });
        }
      } catch (e) {
        console.error('Error parsing repo:', e);
      }
    }

    console.log(`Successfully scraped ${repos.length} trending repos`);

    return new Response(
      JSON.stringify({ repos: repos.slice(0, 10) }),
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
