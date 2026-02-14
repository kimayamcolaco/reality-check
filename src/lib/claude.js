import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true // For demo - move to backend for production
});

// Extract interesting facts from article content
export async function extractFactsFromArticle(article) {
  const prompt = `You are analyzing news content to extract interesting, verifiable facts for a news literacy game.

CONTENT:
Title: ${article.title}
Source: ${article.source}
Content: ${article.content || article.title}

Extract 2-3 specific, factual claims from this content. Focus on:
- Numbers, statistics, amounts
- Specific dates or timeframes  
- Company names, people, places
- Concrete events or announcements

Respond ONLY with valid JSON array:
[
  {
    "fact": "specific factual statement here",
    "context": "why this fact matters or additional context"
  }
]`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = message.content[0].text;
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) throw new Error('No JSON array found');
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Error extracting facts:', error);
    return [];
  }
}

// Generate a claim pair from a fact
export async function generateClaimPairFromFact(fact, article) {
  const prompt = `Create a true/false claim pair for a news literacy game.

ORIGINAL FACT: ${fact.fact}
CONTEXT: ${fact.context}
SOURCE: ${article.source}
DATE: ${article.published_date || 'recent'}

Generate:
1. TRUE_CLAIM: The fact as stated (clear, concise, 1-2 sentences)
2. FALSE_CLAIM: Same claim but change ONE specific detail to make it false:
   - If there's a number, increase/decrease it by 20-50%
   - If there's a person/company, substitute a similar one
   - If there's a date, shift it by days/weeks
   - Keep the same structure and tone
3. EXPLANATION: Why the true claim is correct and how the false one misleads (2-3 sentences, includes original context)

The false claim must:
- Sound plausible
- Use similar language
- Change ONLY one key detail
- Not be obviously wrong

Respond ONLY with valid JSON:
{
  "true_claim": "...",
  "false_claim": "...",
  "explanation": "..."
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = message.content[0].text;
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
  
  for (const article of articles) {
    try {
      console.log(`Processing: ${article.title}`);
      
      // Extract facts
      const facts = await extractFactsFromArticle(article);
      
      if (facts.length === 0) {
        console.log('No facts extracted, skipping');
        continue;
      }
      
      // Generate claim pair from first fact
      const fact = facts[0];
      const claimPair = await generateClaimPairFromFact(fact, article);
      
      allClaims.push(claimPair);
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`Failed to process article: ${article.title}`, error);
    }
  }
  
  return allClaims;
}

// Quick test function
export async function testAIGeneration() {
  const testArticle = {
    id: 'test',
    title: 'Apple Announces Record Revenue',
    source: 'Tech News',
    content: 'Apple reported quarterly revenue of $119.6 billion, beating analyst expectations of $117.9 billion.',
    published_date: '2025-02-01'
  };
  
  const facts = await extractFactsFromArticle(testArticle);
  console.log('Extracted facts:', facts);
  
  if (facts.length > 0) {
    const claim = await generateClaimPairFromFact(facts[0], testArticle);
    console.log('Generated claim:', claim);
    return claim;
  }
  
  return null;
}
