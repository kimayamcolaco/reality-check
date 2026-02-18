import { supabase } from './supabase';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true
});

// Analyze reported claims to find patterns
export async function analyzeReportedClaims() {
  const { data: reported } = await supabase
    .from('claim_pairs_approved')
    .select('true_claim, false_claim, explanation, source, times_reported')
    .gt('times_reported', 0)
    .order('times_reported', { ascending: false })
    .limit(20);

  if (!reported || reported.length === 0) {
    return null;
  }

  const prompt = `Analyze these reported bad claims from a news game and identify patterns:

REPORTED CLAIMS:
${reported.map((c, i) => `
${i + 1}. (Reported ${c.times_reported}x)
   TRUE: ${c.true_claim}
   FALSE: ${c.false_claim}
   EXPLANATION: ${c.explanation}
`).join('\n')}

Identify:
1. What makes these claims BAD? (Common patterns)
2. What should we AVOID when generating future claims?

Respond with specific, actionable rules to improve claim generation.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });

    return message.content[0].text;
  } catch (error) {
    console.error('Error analyzing reports:', error);
    return null;
  }
}

// Get improvement suggestions to add to generation prompt
export async function getImprovementGuidance() {
  const analysis = await analyzeReportedClaims();
  
  if (!analysis) {
    return '';
  }

  return `
LEARNED FROM USER FEEDBACK:
Based on reported claims, AVOID these patterns:
${analysis}
`;
}
