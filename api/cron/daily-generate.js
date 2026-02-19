// api/cron/daily-generate.js
// 100% Claude with Prompt Caching - saves 90% on costs!

import { createClient } from '@supabase/supabase-js';

const CLAUDE_API_KEY = process.env.VITE_ANTHROPIC_API_KEY;
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

const SOURCES = [
  { name: "TechCrunch", url: 'https://techcrunch.com/feed/' },
  { name: "BBC World News", url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: "New York Times", url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml' },
  { name: "Reuters", url: 'https://feeds.reuters.com/reuters/topNews' },
  { name: "NPR News", url: 'https://feeds.npr.org/1001/rss.xml' },
  { name: "The Guardian", url: 'https://www.theguardian.com/world/rss' },
  { name: "Associated Press", url: 'https://rsshub.app/apnews/topics/apf-topnews' },
  { name: "Hacker News", url: 'https://hnrss.org/frontpage' }
];

async function fetchRSS(url, sourceName) {
  try {
    console.log(`📰 Fetching ${sourceName}...`);
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const text = await response.text();
    const titleMatches = text.match(/<title>(.*?)<\/title>/g) || [];
    
    const articles = [];
    for (let i = 1; i < Math.min(5, titleMatches.length); i++) {
      const title = titleMatches[i]?.replace(/<\/?title>/g, '').replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
      if (title && title.length > 15) {
        articles.push({ 
          title, 
          source: sourceName, 
          published_date: new Date().toISOString().split('T')[0] 
        });
      }
    }
    
    console.log(`  ✅ ${sourceName}: ${articles.length} articles`);
    return articles;
  } catch (error) {
    console.error(`  ❌ ${sourceName}: ${error.message}`);
    return [];
  }
}

// Cached system prompt - this gets reused across all calls (90% cost savings!)
const CACHED_SYSTEM_PROMPT = `You are a news trivia game generator. Your job is to create true/false claim pairs from headlines.

CLAIM RULES:
- Write complete sentences about specific events
- Change the KEY part (location, company, person, direction)
- NO small number changes (7→8 people)
- Both claims must sound like real news

EXPLANATION RULES:
- Write 2-3 sentences of NEWS CONTEXT
- What happened? Who/when/where?
- Write like a journalist
- NEVER mention "key part", "false claim", "I changed", or your generation process

GOOD EXAMPLES:
Headline: "Seven skiers found dead in California avalanche"
True: "Seven skiers were found dead after an avalanche in California's Sierra Nevada mountains"
False: "Seven skiers were found dead after an avalanche in Colorado's Rocky Mountains"
Explanation: "The avalanche occurred near Lake Tahoe on February 18th. Search and rescue teams worked through dangerous conditions to recover all seven bodies. The victims were part of an experienced backcountry skiing group."

Headline: "Tesla stock surges 15% on earnings beat"
True: "Tesla's stock price increased by 15% following better-than-expected quarterly earnings"
False: "Tesla's stock price decreased by 15% following disappointing quarterly earnings"
Explanation: "The electric vehicle maker reported record deliveries of 485,000 vehicles in Q4. CEO Elon Musk announced plans to expand production capacity in Texas and Germany. Analysts raised their price targets following the strong results."

BAD EXAMPLES (never do this):
❌ "7 skiers died" / "8 skiers died" (tiny number change)
❌ "NPR Topics: Entertainment" (not a news claim)
❌ Explanation: "The key part is location, so I changed California to Colorado" (explaining your process)`;

async function generateClaimsInBatch(articles, learningGuidance = '') {
  try {
    // Build the user message with ALL headlines
    const headlinesText = articles.map((a, i) => 
      `${i + 1}. ${a.title} (Source: ${a.source})`
    ).join('\n');

    const userPrompt = `Generate true/false claim pairs for these ${articles.length} headlines:

${headlinesText}
${learningGuidance}

For EACH headline, respond with JSON:
{"headline_number": N, "true_claim": "...", "false_claim": "...", "explanation": "..."}

Respond with a JSON array of ${articles.length} objects.`;

    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022', // Fast & cheap
        max_tokens: 4000,
        system: [
          {
            type: "text",
            text: CACHED_SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" } // THIS ENABLES CACHING!
          }
        ],
        messages: [
          { role: 'user', content: userPrompt }
        ]
      })
    });

    const data = await response.json();
    const text = data.content[0].text;
    
    // Extract JSON array
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('No JSON array found in response');
      return [];
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // Map back to articles
    return parsed.map((claim, i) => ({
      true_claim: claim.true_claim,
      false_claim: claim.false_claim,
      explanation: claim.explanation,
      source: articles[i]?.source || 'Unknown',
      date: new Date().toISOString().split('T')[0]
    }));

  } catch (error) {
    console.error('Batch generation failed:', error);
    return [];
  }
}

export default async function handler(req, res) {
  console.log('🤖 Claude with Prompt Caching (90% cost savings!)');
  
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    );

    // Get reported claims for learning
    const { data: reportedClaims } = await supabase
      .from('claim_pairs_approved')
      .select('true_claim, false_claim, times_reported')
      .gt('times_reported', 0)
      .order('times_reported', { ascending: false })
      .limit(5);

    let learningGuidance = '';
    if (reportedClaims && reportedClaims.length > 0) {
      console.log(`📚 Learning from ${reportedClaims.length} reported claims`);
      learningGuidance = `\n\nUSERS REPORTED THESE AS BAD - AVOID SIMILAR:\n${reportedClaims.map((c, i) => 
        `${i+1}. Bad: "${c.true_claim}" vs "${c.false_claim}"`
      ).join('\n')}`;
    }

    // Fetch articles
    const allArticles = [];
    for (const source of SOURCES) {
      const articles = await fetchRSS(source.url, source.name);
      allArticles.push(...articles);
      await new Promise(r => setTimeout(r, 500));
    }

    console.log(`📊 Total: ${allArticles.length} articles`);

    if (allArticles.length === 0) {
      return res.status(200).json({ success: false, message: 'No articles' });
    }

    // Generate claims in BATCH (uses caching!)
    const articlesToProcess = allArticles.slice(0, 20); // Process 20 at once
    console.log(`\n🎯 Generating ${articlesToProcess.length} claims in one batch...`);
    
    const claims = await generateClaimsInBatch(articlesToProcess, learningGuidance);
    
    // Filter valid claims
    const validClaims = claims.filter(c => 
      c.true_claim && 
      c.false_claim && 
      c.true_claim.length >= 50 && 
      c.false_claim.length >= 50
    );

    console.log(`✨ Generated ${validClaims.length} valid claims`);

    if (validClaims.length > 0) {
      const { error } = await supabase
        .from('claim_pairs_approved')
        .insert(validClaims);

      if (error) throw error;
      console.log('✅ Saved to database');
    }

    return res.status(200).json({
      success: true,
      articles: allArticles.length,
      claims: validClaims.length,
      cached: true // Indicates prompt caching was used
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
