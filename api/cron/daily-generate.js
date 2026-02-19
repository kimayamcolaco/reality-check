// api/cron/daily-generate.js
// Using Groq with fetch API (no SDK needed)

import { createClient } from '@supabase/supabase-js';

const GROQ_API_KEY = process.env.VITE_GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

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

async function callGroq(prompt) {
  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 400
      })
    });

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Groq API error:', error);
    throw error;
  }
}

async function generateClaim(title, source, learningGuidance = '') {
  const prompt = `You are creating a NEWS TRIVIA GAME claim from this headline: "${title}"

A CLAIM is a factual statement about something that happened in the news. It must be a complete sentence about a specific event, announcement, or development.

EXAMPLES OF GOOD CLAIMS:
✅ "Apple announced a new iPhone model with a 48-megapixel camera at their September event"
✅ "The Federal Reserve raised interest rates by 0.25% to combat inflation"
✅ "Seven skiers were found dead after an avalanche in the Sierra Nevada mountains"
✅ "Tesla's stock price increased by 15% following their quarterly earnings report"

EXAMPLES OF BAD CLAIMS (NEVER create these):
❌ "NPR Topics: Entertainment" (this is just a category, not news)
❌ "TechCrunch reports on technology" (too vague, not specific)
❌ "Breaking news from Reuters" (no actual information)
❌ "15 years of FP32 segmentation" (confusing jargon)

Your claim must:
- Be a COMPLETE SENTENCE about a SPECIFIC event
- Include WHO, WHAT, or WHERE details
- Be something someone could fact-check
- Sound like something you'd read in a news article
${learningGuidance}

IMPORTANT RULES:
1. Write as a complete, clear sentence (not a headline fragment)
2. Make it informative - tell the reader what happened
3. Change THE KEY PART - the most newsworthy detail
4. Both true and false versions should sound like real news

CRITICAL - EXPLANATION FORMAT:
You are a NEWS REPORTER, not an AI explaining your process.

Write ONLY what a journalist would write to give context about the story. Pretend you're writing for a news website.

Format: 2-3 sentences about WHAT HAPPENED, WHO was involved, WHEN/WHERE it occurred, and WHY it matters.

PERFECT explanation examples (copy this style exactly):
✅ "The match took place at the Olympic Stadium in front of 15,000 spectators. The winning team will advance to face defending champions Brazil in the gold medal match on Saturday. This marks the first time the country has reached an Olympic final in this sport."

✅ "The company's stock jumped 23% in after-hours trading following the announcement. CEO John Smith said the new product would launch in Q3 and target enterprise customers. Analysts estimate it could generate $500 million in annual revenue."

✅ "Rescue operations began at 6am and continued for eight hours in treacherous conditions. Local authorities have closed the ski area indefinitely while they investigate the cause. This is the deadliest avalanche in California in over a decade."

ABSOLUTELY FORBIDDEN (if you write any of these phrases, you FAILED):
❌ "The key part"
❌ "false claim"  
❌ "I changed"
❌ "makes it plausible"
❌ "meaningful change"
❌ "opposite outcome"
❌ "this creates"
❌ ANY mention of how you created the false version

THINK: What would CNN write? What would a reporter say? Write THAT.

GOOD claim examples:
✅ "Seven skiers were found dead after an avalanche in California"
✅ "OpenAI announced a new partnership with Microsoft for AI development"
✅ "Tesla's stock price rose by 15% following strong earnings"
✅ "The CEO of the company resigned after a financial scandal"

BAD claim examples (don't do this):
❌ "15 years of FP32 segmentation, and why Blackwell breaks the pattern" (too technical/confusing)
❌ "Company announces thing" (too vague)
❌ "7 vs 8 skiers" (just a number change)

Change examples:
- Location: "California" → "Colorado"
- Company: "OpenAI" → "Google"
- Direction: "rose" → "fell"
- Person/Role: "CEO" → "CFO"
- Country: "France" → "Germany"

Respond with ONLY valid JSON:
{"true_claim": "...", "false_claim": "...", "explanation": "..."}`;

  try {
    const text = await callGroq(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // VALIDATION: Reject garbage claims
    const trueClaim = parsed.true_claim || '';
    const falseClaim = parsed.false_claim || '';
    const explanation = parsed.explanation || '';
    
    // Reject if explanation mentions AI reasoning (very strict check)
    const badExplanationPhrases = [
      'key part',
      'false claim',
      'i changed',
      'changing this',
      'alters the',
      'making it plausible',
      'plausible but incorrect',
      'plausible but wrong',
      'meaningful change',
      'meaningful part',
      'this creates',
      'this makes',
      'opposite outcome'
    ];
    
    const hasBadExplanation = badExplanationPhrases.some(phrase => 
      explanation.toLowerCase().includes(phrase)
    );
    
    if (hasBadExplanation) {
      console.log('  ⚠️ Bad explanation detected (mentions AI reasoning), skipping');
      return null;
    }
    
    // Reject if claim is just categories/tags
    const badPatterns = [
      /topics:/i,
      /breaking news/i,
      /reports on/i,
      /announces that/i,
      /years of.*segmentation/i,
      /^[A-Z\s]+:/, // "NPR Topics:" format
    ];
    
    const isBadClaim = badPatterns.some(pattern => 
      pattern.test(trueClaim) || pattern.test(falseClaim)
    );
    
    // Reject if too short (less than 50 chars)
    if (trueClaim.length < 50 || falseClaim.length < 50) {
      console.log('  ⚠️ Claim too short, skipping');
      return null;
    }
    
    // Reject if contains bad patterns
    if (isBadClaim) {
      console.log('  ⚠️ Bad claim pattern detected, skipping');
      return null;
    }
    
    return {
      true_claim: parsed.true_claim,
      false_claim: parsed.false_claim,
      explanation: parsed.explanation,
      source,
      date: new Date().toISOString().split('T')[0]
    };
  } catch (error) {
    console.error(`  ❌ Claim generation failed:`, error.message);
    return null;
  }
}

export default async function handler(req, res) {
  console.log('🤖 Starting daily generation with Groq (fetch API)...');
  
  try {
    if (!GROQ_API_KEY) {
      throw new Error('VITE_GROQ_API_KEY not found in environment variables');
    }

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    );

    // Get reported claims for ML learning
    console.log('🧠 Checking for reported claims to learn from...');
    const { data: reportedClaims } = await supabase
      .from('claim_pairs_approved')
      .select('true_claim, false_claim, times_reported')
      .gt('times_reported', 0)
      .order('times_reported', { ascending: false })
      .limit(5);

    let learningGuidance = '';
    if (reportedClaims && reportedClaims.length > 0) {
      console.log(`📚 Learning from ${reportedClaims.length} reported claims`);
      learningGuidance = `

⚠️ IMPORTANT - Users reported these claims as BAD. DO NOT generate similar claims:

${reportedClaims.map((c, i) => `
BAD EXAMPLE ${i + 1} (Reported ${c.times_reported}x):
TRUE: "${c.true_claim}"
FALSE: "${c.false_claim}"
Problem: Too confusing, boring, or obvious. Avoid this pattern.
`).join('\n')}

Learn from these mistakes and generate BETTER claims.`;
    } else {
      console.log('✨ No reported claims - generating fresh');
    }

    // Fetch articles sequentially
    const allArticles = [];
    for (const source of SOURCES) {
      const articles = await fetchRSS(source.url, source.name);
      allArticles.push(...articles);
      await new Promise(r => setTimeout(r, 500));
    }

    console.log(`📊 Total: ${allArticles.length} articles`);

    if (allArticles.length === 0) {
      return res.status(200).json({ 
        success: false, 
        message: 'No articles fetched from RSS feeds' 
      });
    }

    // Generate claims
    const claims = [];
    const processedTitles = new Set();
    
    for (let i = 0; i < Math.min(25, allArticles.length); i++) {
      const article = allArticles[i];
      
      // Skip duplicates
      if (processedTitles.has(article.title)) continue;
      processedTitles.add(article.title);
      
      console.log(`🤖 Claim ${claims.length + 1}: "${article.title.substring(0, 50)}..."`);
      
      const claim = await generateClaim(article.title, article.source, learningGuidance);
      
      if (claim) {
        // Check for duplicate claims
        const isDuplicate = claims.some(c => 
          c.true_claim === claim.true_claim || 
          c.false_claim === claim.false_claim
        );
        
        if (!isDuplicate) {
          claims.push(claim);
          console.log(`  ✅ Unique claim generated`);
        }
      }
      
      // Small delay between AI calls
      await new Promise(r => setTimeout(r, 300));
    }

    console.log(`✨ Generated ${claims.length} unique claims with Groq`);

    if (claims.length > 0) {
      const { error } = await supabase
        .from('claim_pairs_approved')
        .insert(claims);

      if (error) throw error;
      console.log('✅ Saved to database');
    }

    return res.status(200).json({
      success: true,
      articles: allArticles.length,
      claims: claims.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
}
