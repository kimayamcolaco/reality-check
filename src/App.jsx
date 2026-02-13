import { useState } from 'react';

// Demo claims - you'll replace with real data from database later
const DEMO_CLAIMS = [
  {
    id: 1,
    true_claim: "Lenny Rachitsky's newsletter covers product management and growth strategies for tech companies.",
    false_claim: "Lenny Rachitsky's newsletter focuses primarily on venture capital fundraising and startup exits.",
    explanation: "Lenny's Newsletter is known for in-depth product management insights, growth frameworks, and interviews with top PMs at companies like Airbnb and Stripe. It focuses on helping product teams build better products, not on VC fundraising or exit strategies.",
    source: "Lenny's Newsletter"
  },
  {
    id: 2,
    true_claim: "The Pivot podcast hosts Kara Swisher and Scott Galloway discuss tech news and business trends weekly.",
    false_claim: "The Pivot podcast features daily episodes analyzing cryptocurrency markets and NFT trends.",
    explanation: "Pivot is a weekly podcast where tech journalist Kara Swisher and NYU professor Scott Galloway cover major tech industry news, business strategy, and cultural trends. While they discuss crypto occasionally, it's a general tech/business show, not a daily crypto-focused podcast.",
    source: "Pivot Podcast"
  },
  {
    id: 3,
    true_claim: "Morning Brew delivers daily business news in a conversational, easy-to-digest email format.",
    false_claim: "Morning Brew is a weekly print magazine focused on Wall Street trading strategies.",
    explanation: "Morning Brew is a daily email newsletter (and podcast) that delivers business, finance, and tech news in an accessible, millennial-friendly format. It's known for making complex business topics easy to understand, not for being a traditional print magazine or focusing solely on trading.",
    source: "Morning Brew"
  }
];

export default function App() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [score, setScore] = useState(0);

  const currentClaim = DEMO_CLAIMS[currentIndex];
  const isCorrect = selectedClaim === 'true';
  const isComplete = currentIndex >= DEMO_CLAIMS.length - 1 && showFeedback;

  function handleSelectClaim(claimType) {
    const correct = claimType === 'true';
    setSelectedClaim(claimType);
    setShowFeedback(true);
    if (correct) setScore(prev => prev + 1);
  }

  function nextClaim() {
    if (currentIndex < DEMO_CLAIMS.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedClaim(null);
      setShowFeedback(false);
    }
  }

  function resetGame() {
    setCurrentIndex(0);
    setSelectedClaim(null);
    setShowFeedback(false);
    setScore(0);
  }

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
              <span className="font-semibold">According to {currentClaim.source}:</span>{' '}
              {currentClaim.explanation}
            </p>
          </div>

          {!isComplete ? (
            <button
              onClick={nextClaim}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors shadow-lg"
            >
              Next Question →
            </button>
          ) : (
            <div className="text-center">
              <p className="text-xl mb-4">
                Final Score: <span className="font-bold text-blue-600">{score}/{DEMO_CLAIMS.length}</span>
              </p>
              <button
                onClick={resetGame}
                className="bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors shadow-lg"
              >
                Play Again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
