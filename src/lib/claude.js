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
  const prompt = `Create a true/false claim pair that ONLY someone who consumed this content could answer correctly.

ORIGINAL FACT: ${fact.fact}
CONTEXT: ${fact.context}
SOURCE: ${article.source}

CRITICAL RULE: The false claim must change a SPECIFIC FACTUAL DETAIL, not a logical inference.

✅ GOOD EXAMPLES (Fact-Based - Can't Guess):
- TRUE: "The study surveyed 1,247 product managers"
  FALSE: "The study surveyed 847 product managers"
  
- TRUE: "OpenAI's revenue reached $3.4 billion in 2024"
  FALSE: "OpenAI's revenue reached $4.1 billion in 2024"
  
- TRUE: "The partnership with Stripe was announced in September"
  FALSE: "The partnership with Square was announced in September"

❌ BAD EXAMPLES (Logic-Based - Can Guess):
- TRUE: "Secretary of State met with allies"
  FALSE: "Secretary of Defense met with allies" ← NO! People can guess which role handles diplomacy
  
- TRUE: "The company criticized the policy"
  FALSE: "The company supported the policy" ← NO! Sentiment is guessable
  
- TRUE: "Sales increased 20%"
  FALSE: "Sales decreased 20%" ← NO! Direction is logical inference

WHAT TO CHANGE (Pick ONE):
1. Specific number/percentage: 127 → 142, 68% → 73%
2. Exact name: "Stripe" → "Square", "Microsoft" → "Google"
3. Precise date/timeframe: "Q3" → "Q4", "September" → "October"
4. Actual quantity: "1,247 respondents" → "847 respondents"
5. Real data point: "grew 23%" → "grew 31%"

DO NOT CHANGE:
- Roles/positions (logic-based)
- Sentiment/tone (guessable)
- Increase/decrease direction (inference)
- Positive/negative framing (obvious)

Generate:
1. TRUE_CLAIM: Specific fact with exact numbers/names/dates (1-2 sentences)
2. FALSE_CLAIM: Same sentence, change ONLY one concrete factual detail
3. EXPLANATION: What the real fact was and why it matters (2-3 sentences)

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
      
      // Generate claim pairs from ALL extracted facts (not just first one)
      for (const fact of facts) {
        try {
          const claimPair = await generateClaimPairFromFact(fact, article);
          allClaims.push(claimPair);
          
          // Small delay between generations
          await new Promise(resolve => setTimeout(resolve, 1500));
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
