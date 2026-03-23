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
    console.log('📝 Reporting claim ID:', claimId);
    
    // Method 1: Try using RPC function (if it exists)
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('increment_claim_reported', { 
        claim_id: claimId,
        new_reason: reason
      });
    
    if (!rpcError) {
      console.log('✅ Report saved via RPC:', rpcData);
      return rpcData;
    }
    
    console.log('⚠️ RPC not available, using fallback method');
    
    // Method 2: Fallback - fetch then update
    const { data: currentData, error: fetchError } = await supabase
      .from('claim_pairs_approved')
      .select('times_reported')
      .eq('id', claimId)
      .single();

    if (fetchError) {
      console.error('❌ Fetch error:', fetchError);
      throw new Error(`Failed to fetch claim: ${fetchError.message}`);
    }

    const newCount = (currentData?.times_reported || 0) + 1;
    
    const { data, error } = await supabase
      .from('claim_pairs_approved')
      .update({ 
        times_reported: newCount,
        last_reported_at: new Date().toISOString(),
        report_reason: reason
      })
      .eq('id', claimId)
      .select();
  
    if (error) {
      console.error('❌ Update error:', error);
      throw new Error(`Failed to update: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error('Claim not found in database');
    }

    console.log('✅ Report saved:', data);
    return data;
  } catch (error) {
    console.error('❌ Report claim failed:', error);
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

// Alias for backwards compatibility
export const deleteClaimPermanently = deleteClaim;

// Clear all reports for a claim
export async function clearReports(claimId) {
  const { error } = await supabase
    .from('claim_pairs_approved')
    .update({ 
      times_reported: 0,
      last_reported_at: null,
      report_reason: null
    })
    .eq('id', claimId);

  if (error) {
    console.error('Error clearing reports:', error);
    throw error;
  }
}

// Delete old manual claims (if you had a manual_claims table)
export async function deleteOldManualClaims() {
  // This function is a no-op now since we don't have manual claims
  // Keeping it for backwards compatibility
  console.log('deleteOldManualClaims: No manual claims to delete');
  return { deleted: 0 };
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

// Get count of approved claims
export async function getApprovedClaimsCount() {
  const { count, error } = await supabase
    .from('claim_pairs_approved')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('Error counting claims:', error);
    return 0;
  }

  return count || 0;
}

// Get claims by source
export async function getClaimsBySource() {
  const { data, error } = await supabase
    .from('claim_pairs_approved')
    .select('source');

  if (error) {
    console.error('Error fetching claims by source:', error);
    return {};
  }

  // Count by source
  const counts = {};
  data.forEach(claim => {
    counts[claim.source] = (counts[claim.source] || 0) + 1;
  });

  return counts;
}
