import { useState, useEffect } from 'react';
import Admin from './pages/Admin';
import { 
  getRandomApprovedClaims, 
  incrementClaimShown,
  saveUserAnswer,
  reportClaim
} from './lib/supabase';

// Generate session ID
function getSessionId() {
  let sessionId = localStorage.getItem('reality_check_session');
  if (!sessionId) {
    sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('reality_check_session', sessionId);
  }
  return sessionId;
}

function Game() {
  const [claims, setClaims] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [score, setScore] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sessionId] = useState(getSessionId());
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [hasReported, setHasReported] = useState(false);

  // Load today's progress from localStorage
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const savedData = localStorage.getItem('reality_check_daily_progress');
    
    if (savedData) {
      const parsed = JSON.parse(savedData);
      if (parsed.date === today) {
        setScore(parsed.score || 0);
        setTotalAnswered(parsed.totalAnswered || 0);
      } else {
        localStorage.setItem('reality_check_daily_progress', JSON.stringify({
          date: today, score: 0, totalAnswered: 0
        }));
      }
    } else {
      localStorage.setItem('reality_check_daily_progress', JSON.stringify({
        date: today, score: 0, totalAnswered: 0
      }));
    }
  }, []);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('reality_check_daily_progress', JSON.stringify({
      date: today, score, totalAnswered
    }));
  }, [score, totalAnswered]);

  useEffect(() => {
    loadClaims();
  }, []);

  async function loadClaims() {
    try {
      const randomClaims = await getRandomApprovedClaims(50);
      
      if (randomClaims.length === 0) {
        setClaims([]);
      } else {
        const seenClaimsJSON = localStorage.getItem('reality_check_seen');
        const seenClaims = seenClaimsJSON ? JSON.parse(seenClaimsJSON) : [];
        const unseenClaims = randomClaims.filter(claim => !seenClaims.includes(claim.id));
        
        if (unseenClaims.length === 0) {
          localStorage.setItem('reality_check_seen', JSON.stringify([]));
          setClaims(randomClaims.slice(0, 10));
        } else {
          setClaims(unseenClaims.slice(0, 10));
        }
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading claims:', error);
      setClaims([]);
      setLoading(false);
    }
  }

  async function handleSelectClaim(claimType) {
    const isCorrect = claimType === 'true';
    setSelectedClaim(claimType);
    setShowFeedback(true);
    setTotalAnswered(prev => prev + 1);
    
    if (isCorrect) {
      setScore(prev => prev + 1);
    }

    const currentClaim = claims[currentIndex];
    await incrementClaimShown(currentClaim.id);
    await saveUserAnswer(sessionId, currentClaim.id, claimType, isCorrect);
    
    const seenClaimsJSON = localStorage.getItem('reality_check_seen');
    const seenClaims = seenClaimsJSON ? JSON.parse(seenClaimsJSON) : [];
    if (!seenClaims.includes(currentClaim.id)) {
      seenClaims.push(currentClaim.id);
      localStorage.setItem('reality_check_seen', JSON.stringify(seenClaims));
    }
  }

  async function handleSubmitReport() {
    if (!reportReason) {
      alert('Please select a reason for reporting');
      return;
    }

    try {
      const currentClaim = claims[currentIndex];
      console.log('🚨 Submitting report:', currentClaim.id, reportReason);
      
      await reportClaim(currentClaim.id, reportReason);
      
      console.log('✅ Report successful!');
      setHasReported(true);
      setShowReportModal(false);
      setReportReason('');
      
      // Auto-advance to next claim after 1 second
      setTimeout(() => {
        nextClaim();
      }, 1000);
    } catch (error) {
      console.error('❌ Report failed:', error);
      alert('Failed to report: ' + error.message);
    }
  }

  async function nextClaim() {
    if (currentIndex < claims.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedClaim(null);
      setShowFeedback(false);
      setHasReported(false);
      setReportReason('');
    } else {
      const moreClaims = await getRandomApprovedClaims(10);
      if (moreClaims.length > 0) {
        setClaims(moreClaims);
        setCurrentIndex(0);
        setSelectedClaim(null);
        setShowFeedback(false);
        setHasReported(false);
      }
    }
  }

  function getTitle(accuracy) {
    if (accuracy >= 90) return { title: 'Reality Expert', emoji: '🎯', color: 'text-green-600' };
    if (accuracy >= 75) return { title: 'Fake News Detective', emoji: '🕵️', color: 'text-green-600' };
    if (accuracy > 50) return { title: 'Truth Seeker', emoji: '🔍', color: 'text-blue-600' };
    if (accuracy === 50) return { title: '50/50 Guesser', emoji: '🎲', color: 'text-gray-600' };
    if (accuracy >= 25) return { title: 'Fake News Victim', emoji: '📰', color: 'text-orange-600' };
    return { title: 'Major Reality Check Needed', emoji: '⚠️', color: 'text-red-600' };
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  if (claims.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
        <div className="max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="text-6xl mb-4">🚀</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Reality Check</h1>
          <p className="text-gray-600 mb-6">
            New claims auto-generate daily at 6am. Check back soon!
          </p>
          <a href="/admin" className="inline-block bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors shadow-lg">
            Go to Admin Panel →
          </a>
        </div>
      </div>
    );
  }

  const currentClaim = claims[currentIndex];
  const isCorrect = selectedClaim === 'true';
  const accuracy = totalAnswered > 0 ? Math.round((score / totalAnswered) * 100) : 0;
  const titleInfo = getTitle(accuracy);
  const showTrueOnLeft = currentClaim.id ? 
    (parseInt(currentClaim.id.split('-')[0], 16) % 2 === 0) : 
    (currentIndex % 2 === 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="w-full max-w-3xl mb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">Reality Check</h1>
        <p className="text-lg text-gray-600 mb-2">Fact or fiction? Pick the real news!</p>
        <div className="text-3xl font-bold text-blue-600 mb-2">
          Real News Identified: {score}/{totalAnswered}
        </div>
        {totalAnswered > 0 && (
          <div className={`text-lg font-medium ${titleInfo.color}`}>
            {titleInfo.emoji} {titleInfo.title} ({accuracy}%)
          </div>
        )}
      </div>

      <a href="/admin" className="fixed top-4 right-4 text-sm text-gray-400 hover:text-gray-600 transition-colors">
        Admin
      </a>

      {/* Cards */}
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-6 mb-8">
        <button
          onClick={() => !showFeedback && handleSelectClaim(showTrueOnLeft ? 'true' : 'false')}
          disabled={showFeedback}
          className={`group relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 min-h-[200px] border-4 ${
            !showFeedback 
              ? 'border-transparent hover:scale-105 cursor-pointer' 
              : showTrueOnLeft
                ? 'cursor-default border-green-400 bg-green-50'
                : 'cursor-default border-red-400 bg-red-50'
          }`}
        >
          {showFeedback && (
            <div className="absolute top-4 right-4 text-3xl">{showTrueOnLeft ? '✓' : '✗'}</div>
          )}
          <div className="flex flex-col h-full justify-center items-center text-center">
            <p className="text-xl md:text-2xl font-medium text-gray-800 leading-relaxed">
              {showTrueOnLeft ? currentClaim.true_claim : currentClaim.false_claim}
            </p>
          </div>
        </button>

        <button
          onClick={() => !showFeedback && handleSelectClaim(showTrueOnLeft ? 'false' : 'true')}
          disabled={showFeedback}
          className={`group relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 min-h-[200px] border-4 ${
            !showFeedback 
              ? 'border-transparent hover:scale-105 cursor-pointer' 
              : showTrueOnLeft
                ? 'cursor-default border-red-400 bg-red-50'
                : 'cursor-default border-green-400 bg-green-50'
          }`}
        >
          {showFeedback && (
            <div className="absolute top-4 right-4 text-3xl">{showTrueOnLeft ? '✗' : '✓'}</div>
          )}
          <div className="flex flex-col h-full justify-center items-center text-center">
            <p className="text-xl md:text-2xl font-medium text-gray-800 leading-relaxed">
              {showTrueOnLeft ? currentClaim.false_claim : currentClaim.true_claim}
            </p>
          </div>
        </button>
      </div>

      {/* Feedback Popup */}
      {showFeedback && (
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-8 mb-6 animate-fade-in">
          <div className="text-center mb-6">
            {isCorrect ? (
              <>
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-3xl font-bold text-green-600 mb-2">You got it!</h2>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4">🤔</div>
                <h2 className="text-3xl font-bold text-orange-600 mb-2">Oops, you need a Reality Check!</h2>
              </>
            )}
          </div>

          <div className="bg-blue-50 rounded-xl p-6 mb-6">
            <p className="text-lg text-gray-800 leading-relaxed">
              <span className="font-semibold">According to {currentClaim.source} ({currentClaim.date}):</span>{' '}
              {currentClaim.explanation}
            </p>
          </div>

          <button
            onClick={nextClaim}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors shadow-lg mb-3"
          >
            Next Question →
          </button>
          
          <button
            onClick={() => setShowReportModal(true)}
            disabled={hasReported}
            className={`w-full py-3 rounded-xl font-medium transition-colors text-sm ${
              hasReported 
                ? 'bg-green-100 text-green-700 cursor-not-allowed' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {hasReported ? '✓ Reported - Moving to next...' : '👎 Report This Claim'}
          </button>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Why are you reporting this?</h3>
            <p className="text-gray-600 mb-6">Help us improve by telling us what's wrong:</p>
            
            <div className="space-y-3 mb-6">
              {[
                { value: 'too_similar', label: 'Claims are too similar', description: 'Hard to tell the difference' },
                { value: 'not_useful', label: 'Not a useful fact', description: 'Claim doesn\'t make sense or isn\'t meaningful' },
                { value: 'bad_explanation', label: 'Bad explanation', description: 'Explanation doesn\'t provide useful context' },
                { value: 'trivial_change', label: 'Trivial change', description: 'Only changed minor details like numbers' },
                { value: 'other', label: 'Other', description: 'Different issue' }
              ].map(reason => (
                <label
                  key={reason.value}
                  className={`block p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    reportReason === reason.value 
                      ? 'border-blue-600 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="reportReason"
                    value={reason.value}
                    checked={reportReason === reason.value}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="sr-only"
                  />
                  <div className="font-medium text-gray-900 mb-1">{reason.label}</div>
                  <div className="text-sm text-gray-600">{reason.description}</div>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportReason('');
                }}
                className="flex-1 py-3 rounded-xl font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReport}
                disabled={!reportReason}
                className="flex-1 py-3 rounded-xl font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const isAdmin = window.location.pathname === '/admin';
  if (isAdmin) return <Admin />;
  return <Game />;
}
