import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true // For demo - move to backend for production
});

// Extract interesting facts from article content
export async function extractFactsFromArticle(article) {
  const prompt = `You are analyzing news content to find the MOST INTERESTING, SURPRISING, or COUNTERINTUITIVE facts for a challenging news literacy game.

CONTENT:
Title: ${article.title}
Source: ${article.source}
Content: ${article.content || article.title}

Extract 2-3 facts that are:
- SURPRISING or COUNTERINTUITIVE (not obvious)
- Contain specific numbers, percentages, or comparisons
- About bold predictions, unexpected trends, or contrarian views
- Include causation or correlations (not just descriptions)
- Show change over time or comparison between entities

AVOID:
- Boring descriptive facts
- Obvious information
- Generic statements
- Simple dates or locations

Respond ONLY with valid JSON array:
[
  {
    "fact": "specific surprising/counterintuitive statement with numbers or comparison",
    "context": "why this is interesting or unexpected"
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
  const prompt = `Create a CHALLENGING true/false claim pair that tests if someone actually consumed this content (not just logic).

ORIGINAL FACT: ${fact.fact}
CONTEXT: ${fact.context}
SOURCE: ${article.source}
DATE: ${article.published_date || 'recent'}

Generate:
1. TRUE_CLAIM: A specific, verifiable fact from the content (1-2 sentences)
2. FALSE_CLAIM: Change ONE CONCRETE DETAIL that you'd only know is wrong if you consumed the source

FOCUS ON CONCRETE FACTS:
✅ GOOD - Requires knowing the content:
   - Specific numbers: "raised $127 million" vs "$142 million"
   - Exact percentages: "68% of users" vs "74% of users"  
   - Precise names: "partnered with Stripe" vs "partnered with Square"
   - Specific timeframes: "Q3 2024" vs "Q4 2024"
   - Actual data points: "grew 23% year-over-year" vs "grew 31% year-over-year"
   - Direct attributions: "according to McKinsey" vs "according to BCG"
   - Exact quantities: "interviewed 200 founders" vs "interviewed 350 founders"

❌ BAD - Can guess with logic:
   - Sentiment: "criticizing" vs "supporting"
   - Obvious inferences: "increased" vs "decreased"  
   - General knowledge: "popular" vs "unpopular"
   - Common sense: "positive" vs "negative"

RULES:
- Both claims must sound equally plausible
- The difference must be a SPECIFIC FACTUAL DETAIL mentioned in the source
- Someone who didn't consume the content should have no way to know which is correct
- Change only ONE number, name, date, or specific detail
- Keep wording nearly identical

3. EXPLANATION: What the actual fact was and why the false version is subtly wrong (2-3 sentences)

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
