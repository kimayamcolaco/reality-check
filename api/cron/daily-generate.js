// api/cron/daily-generate.js
// Using Groq for fast, free AI generation

import { createClient } from '@supabase/supabase-js';
import Groq from 'groq-sdk';

const SOURCES = [
  { name: "TechCrunch", url: 'https://techcrunch.com/feed/' },
  { name: "Reuters", url: 'https://feeds.reuters.com/reuters/topNews' },
  { name: "BBC World News", url: 'https://feeds.bbci.co.uk/news/world/rss.xml' }
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
        articles.push({ title, source: sourceName, published_date: new Date().toISOString().split('T')[0] });
      }
    }
    
    console.log(`  ✅ ${sourceName}: ${articles.length} articles`);
    return articles;
  } catch (error) {
    console.error(`  ❌ ${sourceName}: ${error.message}`);
    return [];
  }
}

async function generateClaim(title, source, groq) {
  const prompt = `Based on this headline: "${title}"

Create a realistic true/false claim pair. Change ONE specific detail (number, name, or date).

JSON only:
{"true_claim": "...", "false_claim": "...", "explanation": "..."}`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 400
    });

    const text = completion.choices[0]?.message?.content || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      ...parsed,
      source,
      date: new Date().toISOString().split('T')[0]
    };
  } catch (error) {
    console.error(`  ❌ Groq failed:`, error.message);
    return null;
  }
}

export default async function handler(req, res) {
  console.log('🤖 Starting daily generation with Groq...');
  
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    );
    
    const groq = new Groq({
      apiKey: process.env.VITE_GROQ_API_KEY
    });

    const allArticles = [];
    for (const source of SOURCES) {
      const articles = await fetchRSS(source.url, source.name);
      allArticles.push(...articles);
      await new Promise(r => setTimeout(r, 500));
    }

    console.log(`📊 Total: ${allArticles.length} articles`);

    if (allArticles.length === 0) {
      return res.status(200).json({ success: false, message: 'No articles fetched' });
    }

    const claims = [];
    for (let i = 0; i < Math.min(15, allArticles.length); i++) {
      const article = allArticles[i];
      console.log(`🤖 Claim ${i+1}: "${article.title.substring(0, 50)}..."`);
      
      const claim = await generateClaim(article.title, article.source, groq);
      if (claim && !claims.some(c => c.true_claim === claim.true_claim)) {
        claims.push(claim);
      }
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
      claims: claims.length
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
