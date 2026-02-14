import { useState, useEffect } from 'react';
import Admin from './pages/Admin';
import { 
  getRandomApprovedClaims, 
  incrementClaimShown,
  saveUserAnswer 
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
  const [loading, setLoading] = useState(true);
  const [sessionId] = useState(getSessionId());

  useEffect(() => {
    loadClaims();
  }, []);



  async function handleSelectClaim(claimType) {
    const correct = claimType === 'true';
    setSelectedClaim(claimType);
    setShowFeedback(true);
    
    if (correct) setScore(prev => prev + 1);

    // Track answer
    const currentClaim = claims[currentIndex];
    if (currentClaim.id !== 'demo') {
      await incrementClaimShown(currentClaim.id);
      await saveUserAnswer(sessionId, currentClaim.id, claimType, correct);
    }
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

  function resetGame() {
    setCurrentIndex(0);
    setSelectedClaim(null);
    setShowFeedback(false);
    setScore(0);
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
            No claims available yet. Visit the admin panel to generate your first batch from your news sources!
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="w-full max-w-3xl mb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">
          Reality Check
        </h1>
        <p className="text-lg text-gray-600 mb-4">
          Fact or fiction? Pick the one you believe is a fact!
        </p>
        <div className="text-2xl font-semibold text-blue-600">
          Points: {score}
        </div>
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
        {/* Card 1 - True Claim */}
        <button
          onClick={() => !showFeedback && handleSelectClaim('true')}
          disabled={showFeedback}
          className={`group relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 min-h-[200px] ${
            !showFeedback ? 'hover:scale-105 cursor-pointer' : 'cursor-default'
          } ${
            showFeedback && selectedClaim === 'true'
              ? isCorrect
                ? 'ring-4 ring-green-400'
                : 'opacity-50'
              : ''
          } ${
            showFeedback && selectedClaim === 'false' && 'ring-4 ring-red-400'
          }`}
        >
          <div className="flex flex-col h-full justify-center items-center text-center">
            <p className="text-xl md:text-2xl font-medium text-gray-800 leading-relaxed">
              {currentClaim.true_claim}
            </p>
          </div>
        </button>

        {/* Card 2 - False Claim */}
        <button
          onClick={() => !showFeedback && handleSelectClaim('false')}
          disabled={showFeedback}
          className={`group relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 min-h-[200px] ${
            !showFeedback ? 'hover:scale-105 cursor-pointer' : 'cursor-default'
          } ${
            showFeedback && selectedClaim === 'false'
              ? !isCorrect
                ? 'ring-4 ring-green-400'
                : 'opacity-50'
              : ''
          } ${
            showFeedback && selectedClaim === 'true' && 'ring-4 ring-red-400'
          }`}
        >
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
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors shadow-lg"
          >
            Next Question →
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

