import { useState, useEffect } from 'react';
import { 
  saveArticles, 
  getUnprocessedArticles,
  markArticleProcessed,
  getDraftClaims,
  saveDraftClaims,
  approveClaim,
  getApprovedClaimsCount 
} from '../lib/supabase';
import { processArticlesIntoClaims } from '../lib/claude';

export default function Admin() {
  const [articles, setArticles] = useState([]);
  const [draftClaims, setDraftClaims] = useState([]);
  const [approvedCount, setApprovedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('generate'); // generate, review

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const drafts = await getDraftClaims();
      const count = await getApprovedClaimsCount();
      setDraftClaims(drafts);
      setApprovedCount(count);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  async function handleAddManualArticle() {
    const title = prompt('Paste article title or headline:');
    if (!title) return;
    
    const content = prompt('Paste article content or key facts:');
    if (!content) return;
    
    const source = prompt('Source name (e.g., "Pivot Podcast", "Morning Brew"):');
    if (!source) return;

    try {
      setLoading(true);
      await saveArticles([{
        title,
        content,
        source,
        published_date: new Date().toISOString().split('T')[0],
        processed: false
      }]);
      alert('Article added! Click "Generate Claims" to process it.');
      const unprocessed = await getUnprocessedArticles();
      setArticles(unprocessed);
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateClaims() {
    try {
      setLoading(true);
      
      // Get unprocessed articles
      const unprocessed = await getUnprocessedArticles();
      
      if (unprocessed.length === 0) {
        alert('No articles to process. Add some first!');
        return;
      }

      // Process with AI
      const claims = await processArticlesIntoClaims(unprocessed);
      
      if (claims.length === 0) {
        alert('No claims generated. Try different content.');
        return;
      }

      // Save to draft
      await saveDraftClaims(claims);
      
      // Mark articles as processed
      for (const article of unprocessed) {
        await markArticleProcessed(article.id);
      }

      alert(`Generated ${claims.length} claims! Review them in the "Review Claims" tab.`);
      await loadData();
      setActiveTab('review');
      
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleApproveClaim(claim) {
    try {
      await approveClaim(claim);
      alert('Claim approved! It will appear in the game.');
      await loadData();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  }

  async function handleEditAndApprove(claim) {
    const trueClaim = prompt('True claim:', claim.true_claim);
    if (!trueClaim) return;
    
    const falseClaim = prompt('False claim:', claim.false_claim);
    if (!falseClaim) return;
    
    const explanation = prompt('Explanation:', claim.explanation);
    if (!explanation) return;

    try {
      await approveClaim({
        ...claim,
        true_claim: trueClaim,
        false_claim: falseClaim,
        explanation
      });
      alert('Edited and approved!');
      await loadData();
    } catch (error) {
      alert('Error: ' + error.message);
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
              {approvedCount} claims live | {draftClaims.length} pending review
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
            Generate Claims
          </button>
          <button
            onClick={() => setActiveTab('review')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'review'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Review Claims ({draftClaims.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto">
        {activeTab === 'generate' && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-4">Generate New Claims</h2>
            <p className="text-gray-600 mb-6">
              Add articles from your sources, then let AI extract facts and generate claim pairs.
            </p>

            <div className="space-y-4 mb-8">
              <button
                onClick={handleAddManualArticle}
                disabled={loading}
                className="w-full bg-green-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
              >
                + Add Article Manually
              </button>

              <button
                onClick={handleGenerateClaims}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
              >
                {loading ? 'Generating Claims with AI...' : '🤖 Generate Claims from Articles'}
              </button>
            </div>

            <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">How it works:</h3>
              <ol className="list-decimal list-inside space-y-2 text-blue-800">
                <li>Add articles by pasting content from your podcasts/newsletters</li>
                <li>AI extracts interesting facts from each article</li>
                <li>AI generates true/false claim pairs</li>
                <li>Review and approve in the "Review Claims" tab</li>
                <li>Approved claims appear in the game automatically</li>
              </ol>
            </div>
          </div>
        )}

        {activeTab === 'review' && (
          <div className="space-y-6">
            {draftClaims.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                <p className="text-gray-500 text-lg">
                  No claims to review yet. Generate some in the "Generate Claims" tab!
                </p>
              </div>
            ) : (
              draftClaims.map(claim => (
                <div key={claim.id} className="bg-white rounded-2xl shadow-lg p-8">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full">
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
                      onClick={() => handleApproveClaim(claim)}
                      className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700"
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => handleEditAndApprove(claim)}
                      className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700"
                    >
                      ✏️ Edit & Approve
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
