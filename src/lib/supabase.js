import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// ===== ARTICLE FUNCTIONS =====

export async function saveArticles(articles) {
  const { data, error } = await supabase
    .from('articles')
    .insert(articles)
    .select();
  
  if (error) throw error;
  return data;
}

export async function getUnprocessedArticles() {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('processed', false)
    .order('published_date', { ascending: false })
    .limit(10);
  
  if (error) throw error;
  return data || [];
}

export async function markArticleProcessed(articleId) {
  const { error } = await supabase
    .from('articles')
    .update({ processed: true })
    .eq('id', articleId);
  
  if (error) throw error;
}

// ===== DRAFT CLAIM FUNCTIONS =====

export async function saveDraftClaims(claims) {
  const { data, error } = await supabase
    .from('claim_pairs_draft')
    .insert(claims)
    .select();
  
  if (error) throw error;
  return data;
}

export async function getDraftClaims() {
  const { data, error } = await supabase
    .from('claim_pairs_draft')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function deleteDraftClaim(claimId) {
  const { error } = await supabase
    .from('claim_pairs_draft')
    .delete()
    .eq('id', claimId);
  
  if (error) throw error;
}

// ===== APPROVED CLAIM FUNCTIONS =====

export async function approveClaim(draftClaim) {
  // Insert into approved table
  const { data, error } = await supabase
    .from('claim_pairs_approved')
    .insert({
      true_claim: draftClaim.true_claim,
      false_claim: draftClaim.false_claim,
      explanation: draftClaim.explanation,
      source: draftClaim.source,
      date: draftClaim.date
    })
    .select();
  
  if (error) throw error;
  
  // Delete from draft
  await deleteDraftClaim(draftClaim.id);
  
  return data;
}

export async function getRandomApprovedClaims(count = 10) {
  // Get total count
  const { count: total } = await supabase
    .from('claim_pairs_approved')
    .select('*', { count: 'exact', head: true });
  
  if (!total || total === 0) return [];
  
  // Get random claims (prioritize less-shown ones)
  const { data, error } = await supabase
    .from('claim_pairs_approved')
    .select('*')
    .order('times_shown', { ascending: true })
    .limit(count);
  
  if (error) throw error;
  return data || [];
}

export async function incrementClaimShown(claimId) {
  const { error } = await supabase
    .rpc('increment_times_shown', { claim_id: claimId });
  
  if (error) {
    // Fallback if RPC doesn't exist
    const { data } = await supabase
      .from('claim_pairs_approved')
      .select('times_shown')
      .eq('id', claimId)
      .single();
    
    if (data) {
      await supabase
        .from('claim_pairs_approved')
        .update({ times_shown: data.times_shown + 1 })
        .eq('id', claimId);
    }
  }
}

export async function getApprovedClaimsCount() {
  const { count, error } = await supabase
    .from('claim_pairs_approved')
    .select('*', { count: 'exact', head: true });
  
  if (error) return 0;
  return count || 0;
}

// ===== USER SESSION FUNCTIONS =====

export async function saveUserAnswer(sessionId, claimId, selectedClaim, isCorrect) {
  const { error } = await supabase
    .from('user_sessions')
    .insert({
      session_id: sessionId,
      claim_id: claimId,
      selected_claim: selectedClaim,
      is_correct: isCorrect
    });
  
  if (error) console.error('Error saving answer:', error);
}

export async function getSessionStats(sessionId) {
  const { data, error } = await supabase
    .from('user_sessions')
    .select('is_correct')
    .eq('session_id', sessionId);
  
  if (error || !data) return { correct: 0, total: 0 };
  
  return {
    correct: data.filter(a => a.is_correct).length,
    total: data.length
  };
}
