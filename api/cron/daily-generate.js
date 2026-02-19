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
  const prompt = `Based on this headline: "${title}"

Create a true/false claim pair that reads like a CLEAR NEWS STATEMENT someone would say out loud.
${learningGuidance}

IMPORTANT RULES:
1. Write as a complete, clear sentence (not a headline fragment)
2. Make it informative - tell the reader what happened
3. Change THE KEY PART - the most newsworthy detail
4. Both true and false versions should sound like real news

CRITICAL - EXPLANATION FORMAT:
Write 2-3 sentences providing NEWS CONTEXT about the actual story. DO NOT mention "key part", "false claim", "I changed", or anything about how you generated the claims.

Just tell the reader MORE ABOUT THE NEWS.

GOOD explanations (just news context):
✅ "The avalanche occurred in the Sierra Nevada mountains near Lake Tahoe on February 18th. Search and rescue teams worked through the night in dangerous conditions. All seven victims were part of a backcountry skiing group."

✅ "The partnership will integrate OpenAI's latest GPT models into Microsoft Azure cloud services. The deal is valued at over $10 billion and extends their existing collaboration. Microsoft will provide computing infrastructure for training future AI models."

✅ "Tesla reported record deliveries of 485,000 vehicles in Q4, beating analyst expectations by 12%. The strong performance was driven by increased production at their Shanghai factory. CEO Elon Musk said 2026 would be a 'breakthrough year' for the company."

BAD explanations (NEVER do this):
❌ "The key part of the story is the location (California), so the false claim changes it to Colorado."
❌ "I changed the technology from AI to renewable energy to make it plausible but wrong."
❌ "According to the source, the important detail is X, which I modified to Y."
❌ ANY mention of "key part", "false claim", "changed", "modified", or your generation process

Your explanation = MORE NEWS DETAILS. That's it.

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
