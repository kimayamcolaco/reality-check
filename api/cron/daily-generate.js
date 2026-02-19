// api/cron/daily-generate.js
// Full version with RSS + AI claim generation

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const SOURCES = [
  { name: "TechCrunch", url: 'https://techcrunch.com/feed/' },
  { name: "Reuters", url: 'https://feeds.reuters.com/reuters/topNews' },
  { name: "BBC World News", url: 'https://feeds.bbci.co.uk/news/world/rss.xml' }
];

async function fetchRSS(url, sourceName) {
  try {
    console.log(`📰 Fetching ${sourceName}...`);
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 sec timeout
    
    const response = await fetch(proxyUrl, { signal: controller.signal });
    clearTimeout(timeout);
    
    const text = await response.text();
    const titleMatches = text.match(/<title>(.*?)<\/title>/g) || [];
    
    const articles = [];
    for (let i = 1; i < Math.min(3, titleMatches.length); i++) { // Get 2 per source
      const title = titleMatches[i]?.replace(/<\/?title>/g, '').replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
      if (title && title.length > 20) { // Skip empty/short titles
        articles.push({
          title,
          content: title, // Use title as content for simplicity
          source: sourceName,
          published_date: new Date().toISOString().split('T')[0]
        });
      }
    }
    
    console.log(`  ✅ Got ${articles.length} articles from ${sourceName}`);
    return articles;
  } catch (error) {
    console.error(`  ❌ ${sourceName} failed:`, error.message);
    return [];
  }
}

async function generateClaimFromTitle(title, source, anthropic) {
  try {
    const prompt = `Create a true/false claim pair from this headline: "${title}"

Generate a plausible fact-based claim and a slightly modified false version.

Respond ONLY with JSON:
{"true_claim": "...", "false_claim": "...", "explanation": "..."}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = message.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      true_claim: parsed.true_claim,
      false_claim: parsed.false_claim,
      explanation: parsed.explanation,
      source,
      date: new Date().toISOString().split('T')[0]
    };
  } catch (error) {
    console.error(`  ❌ AI generation failed:`, error.message);
    return null;
  }
}

export default async function handler(req, res) {
  console.log('🤖 Daily claim generation started...');
  
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    );
    
    const anthropic = new Anthropic({
      apiKey: process.env.VITE_ANTHROPIC_API_KEY
    });

    console.log('✅ Clients initialized');

    // Fetch articles from all sources
    const allArticles = [];
    for (const source of SOURCES) {
      const articles = await fetchRSS(source.url, source.name);
      allArticles.push(...articles);
    }

    console.log(`📊 Total articles fetched: ${allArticles.length}`);

    if (allArticles.length === 0) {
      console.log('⚠️ No articles found, using fallback');
      // Fallback: create one test claim
      const { data, error } = await supabase
        .from('claim_pairs_approved')
        .insert([{
          true_claim: "No new articles available - test claim for " + new Date().toLocaleTimeString(),
          false_claim: "New articles were found - test claim for " + new Date().toLocaleTimeString(),
          explanation: "RSS feeds returned no content. This is a fallback test claim.",
          source: "System",
          date: new Date().toISOString().split('T')[0]
        }]);
      
      return res.status(200).json({ 
        success: true, 
        message: 'Fallback claim created',
        articlesFound: 0
      });
    }

    // Generate claims with AI
    const claims = [];
    for (const article of allArticles.slice(0, 5)) { // Limit to 5 to avoid timeout
      console.log(`🤖 Generating claim from: "${article.title.substring(0, 50)}..."`);
      const claim = await generateClaimFromTitle(article.title, article.source, anthropic);
      if (claim) {
        claims.push(claim);
      }
    }

    console.log(`✨ Generated ${claims.length} claims`);

    if (claims.length > 0) {
      const { data, error } = await supabase
        .from('claim_pairs_approved')
        .insert(claims);

      if (error) throw error;
      console.log('✅ Claims saved to database');
    }

    return res.status(200).json({
      success: true,
      articlesProcessed: allArticles.length,
      claimsGenerated: claims.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
