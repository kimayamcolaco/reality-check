import { useState, useEffect } from 'react';
import { 
  getApprovedClaimsCount,
  getReportedClaims,
  deleteClaimPermanently,
  clearReports,
  deleteOldManualClaims
} from '../lib/supabase';

export default function Admin() {
  const [reportedClaims, setReportedClaims] = useState([]);
  const [approvedCount, setApprovedCount] = useState(0);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-gray-600 mt-1">
              {approvedCount} claims live | {reportedClaims.length} reported
            </p>
            <p className="text-sm text-gray-500 mt-2">
              ✨ New claims auto-generate daily at 6am from your news sources
            </p>
          </div>
          <a
            href="/"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            ← Back to Game
          </a>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <h2 className="text-2xl font-bold mb-4">🤖 Fully Automated System</h2>
          <div className="space-y-3 text-gray-700">
            <p><strong>Daily Generation:</strong> Every day at 6am, AI automatically fetches latest news from 8 sources and generates new claims.</p>
            <p><strong>Self-Improving ML:</strong> When you report bad claims, AI learns to avoid those patterns in future generations.</p>
            <p><strong>Zero Manual Work:</strong> New claims appear automatically. Just play and report ones you don't like below.</p>
          </div>
          
          <div className="mt-6 bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Sources:</strong> Lenny's Newsletter, Pivot Podcast, Morning Brew Daily, BBC World News, NPR Up First, Reuters, New York Times, TechCrunch
            </p>
          </div>
          
          <div className="mt-6">
            <button
              onClick={async () => {
                if (confirm('Delete all old manually-added claims? This will only keep AI-generated claims.')) {
                  try {
                    await deleteOldManualClaims();
                    alert('✅ Old claims deleted! Only AI-generated claims remain.');
                    await loadData();
                  } catch (error) {
                    alert('Error: ' + error.message);
                  }
                }
              }}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 text-sm"
            >
              🗑️ Clear Old Manual Claims
            </button>
          </div>
        </div>

        {/* Reported Claims */}
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">Reported Claims</h2>
            <span className="text-sm text-gray-500">
              AI learns from these to generate better claims
            </span>
          </div>
          
          {reportedClaims.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
              <p className="text-gray-500 text-lg">
                No reported claims yet. When you play and report bad claims with 👎, they'll appear here for review.
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
                      setStatus('✅ Claim deleted. AI will learn to avoid similar patterns.');
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
          
          {status && (
            <div className={`p-4 rounded-lg ${
              status.includes('✅') ? 'bg-green-50 text-green-800' :
              'bg-blue-50 text-blue-800'
            }`}>
              {status}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
