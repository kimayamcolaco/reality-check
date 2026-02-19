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

async function generateClaim(title, source) {
  const prompt = `Based on this headline: "${title}"

Create a true/false claim pair where the FALSE version changes THE KEY PART - the most important detail.

RULE: Identify what makes this story newsworthy, then change THAT.

Examples:
- "Seven skiers dead in California avalanche" → Key part is LOCATION → "Seven skiers dead in Colorado avalanche"
- "OpenAI partners with Microsoft" → Key part is COMPANY → "OpenAI partners with Google"  
- "Tesla stock rises 15%" → Key part is DIRECTION → "Tesla stock falls 15%"
- "President visits France" → Key part is COUNTRY → "President visits Germany"
- "Company announces layoffs in Q3" → Key part is QUARTER → "Company announces layoffs in Q1"
- "CEO resigns after scandal" → Key part is PERSON → "CFO resigns after scandal"

DO NOT change trivial numbers (7→8 people, $100M→$110M). Change the MEANINGFUL part.

The false claim should be plausible but wrong about what actually happened.

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
      
      const claim = await generateClaim(article.title, article.source);
      
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
