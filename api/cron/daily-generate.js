// api/cron/daily-generate.js
// Runs daily to auto-generate claims with detailed logging

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  console.log('🤖 Daily claim generation started...');
  
  try {
    // Initialize clients
    console.log('📡 Initializing Supabase...');
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    );
    
    console.log('📡 Initializing Anthropic...');
    const anthropic = new Anthropic({
      apiKey: process.env.VITE_ANTHROPIC_API_KEY
    });

    console.log('✅ Clients initialized');

    // Test data - just insert a simple claim to verify it works
    console.log('📝 Creating test claim...');
    
    const testClaim = {
      true_claim: "OpenAI announced GPT-5 with 10 trillion parameters in February 2025",
      false_claim: "OpenAI announced GPT-5 with 5 trillion parameters in February 2025",
      explanation: "According to TechCrunch, OpenAI's GPT-5 announcement specified 10 trillion parameters, making it significantly larger than GPT-4.",
      source: "TechCrunch",
      date: new Date().toISOString().split('T')[0]
    };

    console.log('💾 Saving to database...');
    const { data, error } = await supabase
      .from('claim_pairs_approved')
      .insert([testClaim])
      .select();

    if (error) {
      console.error('❌ Database error:', error);
      throw error;
    }

    console.log('✅ Test claim saved:', data);

    return res.status(200).json({
      success: true,
      message: 'Test claim generated',
      claim: data[0],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Cron error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({ 
      error: error.message,
      details: error.stack
    });
  }
}
