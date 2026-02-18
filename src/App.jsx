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

  // Fun titles based on score
  const getFunTitle = () => {
    const percentage = totalAnswered > 0 ? (score / totalAnswered) * 100 : 0;
    
    if (totalAnswered === 0) return "News Rookie";
    if (percentage >= 90) return "Reality Expert";
    if (percentage >= 75) return "Fake News Detective";
    if (percentage > 50) return "Truth Seeker";
    if (percentage === 50) return "50/50 Guesser";
    if (percentage >= 25) return "Fake News Victim";
    return "Major Reality Check Needed";
  };

  useEffect(() => {
    loadClaims();
  }, []);

  async function loadClaims() {
    try {
      const randomClaims = await getRandomApprovedClaims(10);
      
      if (randomClaims.length === 0) {
        setClaims([]);
      } else {
        setClaims(randomClaims);
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

    // Track answer
    const currentClaim = claims[currentIndex];
    await incrementClaimShown(currentClaim.id);
    await saveUserAnswer(sessionId, currentClaim.id, claimType, isCorrect);
  }

  async function handleReportClaim(claimId) {
    await reportClaim(claimId);
    alert('Thanks! This claim has been reported and will be reviewed.');
  }

  async function nextClaim() {
    if (currentIndex < claims.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedClaim(null);
      setShowFeedback(false);
    } else {
      // Load more claims
      const moreClaims = await getRandomApprovedClaims(10);
      if (moreClaims.length > 0) {
        setClaims(moreClaims);
        setCurrentIndex(0);
        setSelectedClaim(null);
        setShowFeedback(false);
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

  function resetGame() {
    setCurrentIndex(0);
    setSelectedClaim(null);
    setShowFeedback(false);
    setScore(0);
    setTotalAnswered(0);
    loadClaims();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  // Empty state - no claims yet
  if (claims.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
        <div className="max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="text-6xl mb-4">🚀</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Reality Check
          </h1>
          <p className="text-gray-600 mb-6">
            New claims auto-generate daily at 6am. Check back soon or visit admin to see the schedule!
          </p>
          <a
            href="/admin"
            className="inline-block bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors shadow-lg"
          >
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="w-full max-w-3xl mb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">
          Reality Check
        </h1>
        <p className="text-lg text-gray-600 mb-2">
          Fact or fiction? Pick the one you believe is a fact!
        </p>
        <div className="text-3xl font-bold text-blue-600 mb-2">
          Real News Identified: {score}/{totalAnswered}
        </div>
        {totalAnswered > 0 && (
          <div className={`text-lg font-medium ${titleInfo.color}`}>
            {titleInfo.emoji} {titleInfo.title} ({accuracy}%)
          </div>
        )}
      </div>

      {/* Admin Link */}
      <a
        href="/admin"
        className="fixed top-4 right-4 text-sm text-gray-400 hover:text-gray-600 transition-colors"
      >
        Admin
      </a>

      {/* Cards Container */}
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-6 mb-8">
        {/* Card 1 - True Claim (ALWAYS GREEN) */}
        <button
          onClick={() => !showFeedback && handleSelectClaim('true')}
          disabled={showFeedback}
          className={`group relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 min-h-[200px] border-4 ${
            !showFeedback 
              ? 'border-transparent hover:scale-105 cursor-pointer' 
              : 'cursor-default border-green-400 bg-green-50'
          }`}
        >
          {showFeedback && (
            <div className="absolute top-4 right-4 text-3xl">
              ✓
            </div>
          )}
          <div className="flex flex-col h-full justify-center items-center text-center">
            <p className="text-xl md:text-2xl font-medium text-gray-800 leading-relaxed">
              {currentClaim.true_claim}
            </p>
          </div>
        </button>

        {/* Card 2 - False Claim (ALWAYS RED) */}
        <button
          onClick={() => !showFeedback && handleSelectClaim('false')}
          disabled={showFeedback}
          className={`group relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 min-h-[200px] border-4 ${
            !showFeedback 
              ? 'border-transparent hover:scale-105 cursor-pointer' 
              : 'cursor-default border-red-400 bg-red-50'
          }`}
        >
          {showFeedback && (
            <div className="absolute top-4 right-4 text-3xl">
              ✗
            </div>
          )}
          <div className="flex flex-col h-full justify-center items-center text-center">
            <p className="text-xl md:text-2xl font-medium text-gray-800 leading-relaxed">
              {currentClaim.false_claim}
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
                <h2 className="text-3xl font-bold text-green-600 mb-2">
                  You got it!
                </h2>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4">🤔</div>
                <h2 className="text-3xl font-bold text-orange-600 mb-2">
                  Oops, you need a Reality Check!
                </h2>
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
            onClick={() => handleReportClaim(currentClaim.id)}
            className="w-full bg-gray-100 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-200 transition-colors text-sm"
          >
            👎 Report This Claim
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  // Simple routing
  const isAdmin = window.location.pathname === '/admin';
  
  if (isAdmin) {
    return <Admin />;
  }
  
  return <Game />;
}
