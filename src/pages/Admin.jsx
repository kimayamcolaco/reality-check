import { useState, useEffect } from 'react';
import { 
  saveArticles, 
  getUnprocessedArticles,
  markArticleProcessed,
  getApprovedClaimsCount,
  getReportedClaims,
  deleteClaimPermanently,
  clearReports,
  supabase
} from '../lib/supabase';
import { processArticlesIntoClaims } from '../lib/groq';
import { fetchAllSources } from '../lib/rss';

export default function Admin() {
  const [reportedClaims, setReportedClaims] = useState([]);
  const [approvedCount, setApprovedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('generate');
  const [status, setStatus] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const reported = await getReportedClaims();
      const count = await getApprovedClaimsCount();
      setReportedClaims(reported);
      setApprovedCount(count);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  async function handleAutoGenerate() {
    try {
      setLoading(true);
      setStatus('Fetching latest content from your sources...');
      
      // Fetch from RSS feeds
      const articles = await fetchAllSources();
      
      if (articles.length === 0) {
        setStatus('No articles found. Check RSS feeds.');
        setLoading(false);
        return;
      }

      setStatus(`Found ${articles.length} articles. Saving to database...`);
      
      // Save to database
      const savedArticles = await saveArticles(articles);
      
      setStatus(`Processing with AI... (this takes ~${articles.length * 3} seconds)`);
      
      // Get unprocessed articles
      const unprocessed = await getUnprocessedArticles();
      
      // Process with AI
      const claims = await processArticlesIntoClaims(unprocessed);
      
      if (claims.length === 0) {
        setStatus('AI could not generate claims from this content. Try again later.');
        setLoading(false);
        return;
      }

      setStatus('Auto-approving claims and publishing to game...');
      
      // Save directly to approved (skip draft review)
      const { data, error } = await supabase
        .from('claim_pairs_approved')
        .insert(claims.map(c => ({
          true_claim: c.true_claim,
          false_claim: c.false_claim,
          explanation: c.explanation,
          source: c.source,
          date: c.date
        })))
        .select();
      
      if (error) throw error;
      
      // Mark articles as processed
      for (const article of unprocessed) {
        await markArticleProcessed(article.id);
      }

      setStatus(`✅ Success! Generated and published ${claims.length} claims. They're live now - go play!`);
      await loadData();
      
    } catch (error) {
      setStatus('❌ Error: ' + error.message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-gray-600 mt-1">
              {approvedCount} claims live | {reportedClaims.length} reported
            </p>
          </div>
          <a
            href="/"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            ← Back to Game
          </a>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('generate')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'generate'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Auto-Generate
          </button>
          <button
            onClick={() => setActiveTab('reported')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'reported'
                ? 'border-b-2 border-red-600 text-red-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Reported ({reportedClaims.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto">
        {activeTab === 'generate' && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-4">Auto-Generate & Publish Claims</h2>
            <p className="text-gray-600 mb-6">
              Click below to automatically fetch latest content, generate claims with AI, and publish them live immediately. No review needed - just play and report bad ones!
            </p>

            <button
              onClick={handleAutoGenerate}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-6 rounded-xl font-bold text-xl hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 transition-all shadow-lg mb-6"
            >
              {loading ? '⏳ Processing...' : '🤖 Auto-Generate & Publish Now'}
            </button>

            {status && (
              <div className={`p-4 rounded-lg mb-6 ${
                status.includes('✅') ? 'bg-green-50 text-green-800' :
                status.includes('❌') ? 'bg-red-50 text-red-800' :
                'bg-blue-50 text-blue-800'
              }`}>
                {status}
              </div>
            )}

            <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">How it works:</h3>
              <ol className="list-decimal list-inside space-y-2 text-blue-800">
                <li>Fetches latest episodes/articles from all 8 sources</li>
                <li>AI extracts headline facts from each</li>
                <li>AI generates fact-based claim pairs</li>
                <li>Claims go live immediately - no review needed!</li>
                <li>You discover them by playing</li>
                <li>Report bad ones with 👎 button</li>
              </ol>
              <p className="mt-4 text-sm text-blue-700">
                Sources: Lenny's Newsletter, Pivot Podcast, Morning Brew Daily, BBC World News, NPR Up First, Reuters, New York Times, TechCrunch
              </p>
            </div>
          </div>
        )}

        {activeTab === 'reported' && (
          <div className="space-y-6">
            {reportedClaims.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                <p className="text-gray-500 text-lg">
                  No reported claims yet. Players can report bad claims while playing!
                </p>
              </div>
            ) : (
              reportedClaims.map(claim => (
                <div key={claim.id} className="bg-white rounded-2xl shadow-lg p-8 border-l-4 border-red-500">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="bg-red-100 text-red-800 text-sm px-3 py-1 rounded-full font-semibold">
                        👎 Reported {claim.times_reported}x
                      </span>
                      <span className="ml-2 bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full">
                        {claim.source}
                      </span>
                      <span className="ml-2 text-sm text-gray-500">{claim.date}</span>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 mb-6">
                    <div className="border-2 border-green-200 bg-green-50 rounded-xl p-4">
                      <div className="text-xs font-semibold text-green-700 mb-2">✓ TRUE</div>
                      <p className="text-gray-900">{claim.true_claim}</p>
                    </div>
                    <div className="border-2 border-red-200 bg-red-50 rounded-xl p-4">
                      <div className="text-xs font-semibold text-red-700 mb-2">✗ FALSE</div>
                      <p className="text-gray-900">{claim.false_claim}</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4 mb-6">
                    <div className="text-xs font-semibold text-gray-700 mb-2">EXPLANATION</div>
                    <p className="text-gray-800">{claim.explanation}</p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={async () => {
                        await deleteClaimPermanently(claim.id);
                        setStatus('✅ Claim deleted from game');
                        await loadData();
                      }}
                      className="flex-1 bg-red-600 text-white py-3 rounded-lg font-medium hover:bg-red-700"
                    >
                      🗑️ Delete Permanently
                    </button>
                    <button
                      onClick={async () => {
                        await clearReports(claim.id);
                        setStatus('✅ Reports cleared - claim stays in game');
                        await loadData();
                      }}
                      className="flex-1 bg-gray-600 text-white py-3 rounded-lg font-medium hover:bg-gray-700"
                    >
                      ✓ Keep & Clear Reports
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}


