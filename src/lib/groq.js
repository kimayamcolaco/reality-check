// Free AI using Groq instead of Anthropic
// Get free API key at: https://console.groq.com

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

async function callGroq(prompt) {
  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', // Fast, free, good quality
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Groq API error:', error);
    throw error;
  }
}

// Extract interesting facts from article content
export async function extractFactsFromArticle(article) {
  const prompt = `You are analyzing news content to find the HEADLINE FACTS - the main story that someone would remember from consuming this content.

CONTENT:
Title: ${article.title}
Source: ${article.source}
Content: ${article.content || article.title}

Extract 1-2 facts that represent THE MAIN STORY:
- What is the PRIMARY headline or announcement?
- What is the MOST IMPORTANT number, event, or development?
- What would someone mention if asked "what was that episode/article about?"

Focus on:
- Major announcements (funding rounds, product launches, partnerships)
- Significant statistics (market share, growth rates, user numbers)
- Key events (acquisitions, executive changes, policy decisions)
- Important trends (industry shifts, consumer behavior changes)

AVOID:
- Minor background details
- Tangential facts mentioned in passing
- Generic context or setup information
- Small numbers that don't matter

Respond ONLY with valid JSON array:
[
  {
    "fact": "the main headline fact with specific details",
    "context": "why this is the primary story"
  }
]`;

  try {
    const responseText = await callGroq(prompt);
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) throw new Error('No JSON array found');
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Error extracting facts:', error);
    return [];
  }
}

// Generate a claim pair from a fact
export async function generateClaimPairFromFact(fact, article, learningGuidance = '') {
  const prompt = `Create a true/false claim pair that tests knowledge of this news story.

ORIGINAL FACT: ${fact.fact}
CONTEXT: ${fact.context}
SOURCE: ${article.source}

${learningGuidance}

The false claim should be MEANINGFULLY different but still plausible.

SWEET SPOT EXAMPLES:

✅ GOOD - Significant but believable difference:
- TRUE: "OpenAI raised $6.6 billion in Series C funding"
  FALSE: "OpenAI raised $4.2 billion in Series C funding"
  Why: 50% difference is significant, both sound like real funding rounds
  
- TRUE: "Meta announced 18,000 job cuts in early 2025"
  FALSE: "Meta announced 11,000 job cuts in early 2025"
  Why: Meaningfully different impact, both plausible numbers

❌ TOO OBVIOUS - Easy to spot as wrong:
- TRUE: "Raised $100 million"
  FALSE: "Raised $10 million" ← 10x difference is too obvious

❌ TOO SUBTLE - Difference doesn't matter:
- TRUE: "Stock price hit $127.40"
  FALSE: "Stock price hit $127.20" ← 20 cents doesn't matter

RULES FOR CHANGES:
Numbers: Change by 30-60% (big enough to matter, small enough to be plausible)
Companies: Swap with realistic competitor (not random different company)
People: Swap with someone in similar role/industry
Dates: Change by quarters/months (not days or years)
Percentages: Change by 10-25 percentage points

Generate:
1. TRUE_CLAIM: The main fact stated clearly (1-2 sentences)
2. FALSE_CLAIM: Meaningfully different but still sounds real
3. EXPLANATION: What actually happened and why it matters (2-3 sentences)

Respond ONLY with valid JSON:
{
  "true_claim": "...",
  "false_claim": "...",
  "explanation": "..."
}`;

  try {
    const responseText = await callGroq(prompt);
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) throw new Error('No JSON found');
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      true_claim: parsed.true_claim,
      false_claim: parsed.false_claim,
      explanation: parsed.explanation,
      source: article.source,
      date: article.published_date || new Date().toISOString().split('T')[0],
      article_id: article.id
    };
  } catch (error) {
    console.error('Error generating claim pair:', error);
    throw error;
  }
}

// Process multiple articles and generate claims
export async function processArticlesIntoClaims(articles) {
  const allClaims = [];
  
  // Note: Learning guidance removed for Groq (requires Claude)
  // You can still report bad claims, just won't auto-improve
  
  for (const article of articles) {
    try {
      console.log(`Processing: ${article.title}`);
      
      // Extract facts
      const facts = await extractFactsFromArticle(article);
      
      if (facts.length === 0) {
        console.log('No facts extracted, skipping');
        continue;
      }
      
      // Generate claim pairs from ALL extracted facts
      for (const fact of facts) {
        try {
          const claimPair = await generateClaimPairFromFact(fact, article);
          allClaims.push(claimPair);
          
          // Small delay between generations
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Failed to generate claim from fact:`, error);
        }
      }
      
    } catch (error) {
      console.error(`Failed to process article: ${article.title}`, error);
    }
  }
  
  return allClaims;
}
