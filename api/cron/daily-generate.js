// Vercel Serverless Function - Runs daily at 6am
// This auto-generates claims from latest news

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const anthropic = new Anthropic({
  apiKey: process.env.VITE_ANTHROPIC_API_KEY
});

// Your news sources
const NEWS_SOURCES = [
  { name: "Lenny's Newsletter", url: 'https://www.lennysnewsletter.com/feed' },
  { name: 'Pivot Podcast', url: 'https://feeds.megaphone.fm/pivot' },
  { name: 'Morning Brew Daily', url: 'https://feeds.simplecast.com/76rUd4I6' },
  { name: 'BBC World News', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'Up First by NPR', url: 'https://feeds.npr.org/510318/podcast.xml' },
  { name: 'Reuters', url: 'https://feeds.reuters.com/reuters/topNews' },
  { name: 'New York Times', url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' }
];

async function fetchFeed(feedUrl) {
  try {
    const response = await fetch(feedUrl);
    const xmlText = await response.text();
    
    // Parse XML (simplified - in production use proper XML parser)
    const titleMatches = xmlText.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/g);
    const linkMatches = xmlText.match(/<link>(.*?)<\/link>/g);
    const descMatches = xmlText.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/g);
    
    if (!titleMatches) return [];
    
    const articles = [];
    for (let i = 1; i < Math.min(4, titleMatches.length); i++) { // Skip first (channel title), get 3
      const title = titleMatches[i]?.replace(/<!\[CDATA\[|\]\]>|<\/?title>/g, '').trim();
      const url = linkMatches?.[i]?.replace(/<\/?link>/g, '').trim();
      const description = descMatches?.[i]?.replace(/<!\[CDATA\[|\]\]>|<\/?description>|<[^>]*>/g, '').trim().substring(0, 1000);
      
      if (title) {
        articles.push({
          title,
          url: url || '',
          content: description || title,
          published_date: new Date().toISOString().split('T')[0]
        });
      }
    }
    
    return articles;
  } catch (error) {
    console.error(`Error fetching ${feedUrl}:`, error);
    return [];
  }
}

async function fetchAllSources() {
  const allArticles = [];
  
  for (const source of NEWS_SOURCES) {
    const articles = await fetchFeed(source.url);
    articles.forEach(article => {
      allArticles.push({ ...article, source: source.name });
    });
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return allArticles;
}

async function extractFactsFromArticle(article) {
  const prompt = `Extract 1-2 HEADLINE FACTS from this content:

Title: ${article.title}
Content: ${article.content}

Respond ONLY with JSON array:
[{"fact": "main fact", "context": "why it matters"}]`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = message.content[0].text;
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch (error) {
    console.error('Error extracting facts:', error);
    return [];
  }
}

async function generateClaimPair(fact, article) {
  const prompt = `Create a fact-based claim pair:

FACT: ${fact.fact}
SOURCE: ${article.source}

Generate JSON:
{"true_claim": "...", "false_claim": "...", "explanation": "..."}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = message.content[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      true_claim: parsed.true_claim,
      false_claim: parsed.false_claim,
      explanation: parsed.explanation,
      source: article.source,
      date: article.published_date
    };
  } catch (error) {
    console.error('Error generating claim:', error);
    return null;
  }
}

export default async function handler(req, res) {
  try {
    console.log('🤖 Starting daily claim generation...');
    
    // Fetch news
    const articles = await fetchAllSources();
    console.log(`📰 Fetched ${articles.length} articles`);
    
    if (articles.length === 0) {
      return res.status(200).json({ success: false, message: 'No articles found' });
    }
    
    // Save articles
    const { error: saveError } = await supabase.from('articles').insert(articles);
    if (saveError) throw saveError;
    
    // Process with AI
    const claims = [];
    for (const article of articles.slice(0, 15)) { // Process first 15
      const facts = await extractFactsFromArticle(article);
      
      for (const fact of facts.slice(0, 1)) { // 1 claim per article
        const claim = await generateClaimPair(fact, article);
        if (claim) claims.push(claim);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`✨ Generated ${claims.length} claims`);
    
    // Publish directly to live game
    const { error: insertError } = await supabase
      .from('claim_pairs_approved')
      .insert(claims);
    
    if (insertError) throw insertError;
    
    // Mark articles as processed
    await supabase
      .from('articles')
      .update({ processed: true })
      .in('title', articles.map(a => a.title));
    
    console.log('✅ Claims published successfully');
    
    return res.status(200).json({ 
      success: true, 
      articles: articles.length,
      claims: claims.length 
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
