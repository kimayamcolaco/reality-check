import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Get random approved claims
export async function getRandomApprovedClaims(limit = 10) {
  const { data, error } = await supabase
    .from('claim_pairs_approved')
    .select('*')
    .order('id', { ascending: false })
    .limit(limit * 3); // Get more to randomize from

  if (error) {
    console.error('Error fetching claims:', error);
    return [];
  }

  // Shuffle and return limited amount
  const shuffled = data.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit);
}

// Increment times_shown for a claim
export async function incrementClaimShown(claimId) {
  const { error } = await supabase.rpc('increment_claim_shown', { 
    claim_id: claimId 
  });
  
  if (error) {
    console.error('Error incrementing claim shown:', error);
  }
}

// Save user's answer
export async function saveUserAnswer(sessionId, claimId, selectedClaim, isCorrect) {
  const { error } = await supabase
    .from('user_sessions')
    .insert({
      session_id: sessionId,
      claim_id: claimId,
      selected_claim: selectedClaim,
      is_correct: isCorrect
    });

  if (error) {
    console.error('Error saving answer:', error);
  }
}

// Report a claim as bad/incorrect
export async function reportClaim(claimId, reason = null) {
  try {
    // First, get the current times_reported value
    const { data: currentData, error: fetchError } = await supabase
      .from('claim_pairs_approved')
      .select('times_reported')
      .eq('id', claimId)
      .single();

    if (fetchError) {
      console.error('Error fetching current report count:', fetchError);
      throw fetchError;
    }

    const currentCount = currentData?.times_reported || 0;

    // Update with incremented value
    const { data, error } = await supabase
      .from('claim_pairs_approved')
      .update({ 
        times_reported: currentCount + 1,
        last_reported_at: new Date().toISOString(),
        report_reason: reason
      })
      .eq('id', claimId)
      .select();
  
    if (error) {
      console.error('Error reporting claim:', error);
      throw error;
    }

    console.log('✅ Claim reported successfully:', data);
    return data;
  } catch (error) {
    console.error('Report claim failed:', error);
    throw error;
  }
}

// Get all reported claims (for admin)
export async function getReportedClaims() {
  const { data, error } = await supabase
    .from('claim_pairs_approved')
    .select('*')
    .gt('times_reported', 0)
    .order('times_reported', { ascending: false });

  if (error) {
    console.error('Error fetching reported claims:', error);
    return [];
  }

  return data;
}

// Delete a claim
export async function deleteClaim(claimId) {
  const { error } = await supabase
    .from('claim_pairs_approved')
    .delete()
    .eq('id', claimId);

  if (error) {
    console.error('Error deleting claim:', error);
    throw error;
  }
}

// Get all claims (for admin)
export async function getAllClaims() {
  const { data, error } = await supabase
    .from('claim_pairs_approved')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching all claims:', error);
    return [];
  }

  return data;
}
