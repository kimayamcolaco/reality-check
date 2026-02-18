// api/cron/daily-generate.js
// Runs daily at 6am to auto-generate claims

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const anthropic = new Anthropic({
  apiKey: process.env.VITE_ANTHROPIC_API_KEY
});

// RSS sources
const SOURCES = [
  { name: "Lenny's Newsletter", url: 'https://www.lennysnewsletter.com/feed' },
  { name: 'Pivot Podcast', url: 'https://feeds.megaphone.fm/pivot' },
  { name: 'Morning Brew Daily', url: 'https://feeds.simplecast.com/76rUd4I6' },
  { name: 'BBC World News', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'Up First by NPR', url: 'https://feeds.npr.org/510318/podcast.xml' },
  { name: 'Reuters', url: 'https://feeds.reuters.com/reuters/topNews' },
  { name: 'New York Times', url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' }
];

async function fetchRSS(url) {
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    const text = await response.text();
    
    // Parse XML (simplified - you may want a proper XML parser)
    const titleMatches = text.match(/<title>(.*?)<\/title>/g) || [];
    const descMatches = text.match(/<description>(.*?)<\/description>/g) || [];
    
    const articles = [];
    for (let i = 1; i < Math.min(4, titleMatches.length); i++) { // Skip first (channel title), get 3
      const title = titleMatches[i]?.replace(/<\/?title>/g, '').trim();
      const desc = descMatches[i]?.replace(/<\/?description>/g, '').replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
      
      if (title) {
        articles.push({
          title,
          content: desc || title,
          published_date: new Date().toISOString().split('T')[0]
        });
      }
    }
    
    return articles;
  } catch (error) {
    console.error(`RSS fetch error for ${url}:`, error);
    return [];
  }
}

async function extractFacts(article) {
  const prompt = `Extract 1-2 HEADLINE FACTS from this news:

Title: ${article.title}
Content: ${article.content}

Focus on the MAIN STORY with specific numbers, events, or announcements.
Respond ONLY with JSON array:
[{"fact": "...", "context": "..."}]`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = message.content[0].text;
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch (error) {
    console.error('Fact extraction error:', error);
    return [];
  }
}

async function generateClaimPair(fact, article, learningGuidance) {
  const prompt = `Create a true/false claim pair testing knowledge of this story.

FACT: ${fact.fact}
SOURCE: ${article.source}

${learningGuidance}

The false claim should be MEANINGFULLY different (30-60% change in numbers, swap similar companies/people, change by quarters not days).

Respond ONLY with JSON:
{"true_claim": "...", "false_claim": "...", "explanation": "..."}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = message.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) throw new Error('No JSON found');
    
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      ...parsed,
      source: article.source,
      date: article.published_date
    };
  } catch (error) {
    console.error('Claim generation error:', error);
    return null;
  }
}

export default async function handler(req, res) {
  // Security: Verify cron secret
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('🤖 Daily claim generation started...');

    // 1. Fetch RSS feeds
    const allArticles = [];
    for (const source of SOURCES) {
      const articles = await fetchRSS(source.url);
      articles.forEach(a => allArticles.push({ ...a, source: source.name }));
      await new Promise(r => setTimeout(r, 1000)); // Rate limit
    }

    console.log(`📰 Fetched ${allArticles.length} articles`);

    // 2. Get reported claims for ML learning
    const { data: reported } = await supabase
      .from('claim_pairs_approved')
      .select('*')
      .gt('times_reported', 0)
      .order('times_reported', { ascending: false })
      .limit(5);

    let learningGuidance = '';
    if (reported && reported.length > 0) {
      learningGuidance = `
⚠️ LEARN FROM FEEDBACK - AVOID THESE PATTERNS:
${reported.map((r, i) => `
BAD EXAMPLE ${i + 1} (Reported ${r.times_reported}x):
TRUE: "${r.true_claim}"
FALSE: "${r.false_claim}"
`).join('\n')}`;
      console.log('🧠 Learning from reported claims');
    }

    // 3. Generate claims
    const generatedClaims = [];
    for (const article of allArticles) {
      const facts = await extractFacts(article);
      
      for (const fact of facts) {
        const claim = await generateClaimPair(fact, article, learningGuidance);
        if (claim) {
          generatedClaims.push(claim);
        }
        await new Promise(r => setTimeout(r, 1500)); // Rate limit
      }
    }

    console.log(`✨ Generated ${generatedClaims.length} claims`);

    // 4. Save directly to approved (auto-approve)
    if (generatedClaims.length > 0) {
      const { data, error } = await supabase
        .from('claim_pairs_approved')
        .insert(generatedClaims);

      if (error) throw error;
      console.log('✅ Claims published to game');
    }

    return res.status(200).json({
      success: true,
      articlesProcessed: allArticles.length,
      claimsGenerated: generatedClaims.length,
      learnedFromReports: reported?.length || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Cron error:', error);
    return res.status(500).json({ error: error.message });
  }
}
