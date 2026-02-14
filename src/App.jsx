import { useState } from 'react';

// Demo claims - replace these with real news facts from your sources
const DEMO_CLAIMS = [
  {
    id: 1,
    true_claim: "Meta announced plans to invest over $65 billion in AI infrastructure in 2025.",
    false_claim: "Meta announced plans to invest over $45 billion in AI infrastructure in 2025.",
    source: "Pivot Podcast",
    date: "Feb 10, 2025",
    explanation: "Kara Swisher and Scott Galloway discussed Meta's massive AI spending spree, noting this $65 billion investment represents one of the largest capital expenditures in tech history. They highlighted how this reflects the intense competition in the AI race between Meta, Google, and Microsoft."
  },
  {
    id: 2,
    true_claim: "Research shows that 72% of successful product launches involve extensive user testing before release.",
    false_claim: "Research shows that 48% of successful product launches involve extensive user testing before release.",
    source: "Lenny's Newsletter",
    date: "Feb 8, 2025",
    explanation: "Lenny Rachitsky shared data from a study of 200+ product launches, revealing that companies doing extensive user testing had significantly higher success rates. The 72% figure came from analyzing top-performing consumer apps that achieved product-market fit within their first year."
  },
  {
    id: 3,
    true_claim: "The U.S. economy added 225,000 jobs in January 2025, exceeding economists' expectations.",
    false_claim: "The U.S. economy added 175,000 jobs in January 2025, falling short of economists' expectations.",
    source: "Morning Brew Daily",
    date: "Feb 7, 2025",
    explanation: "Morning Brew reported that January's jobs report showed stronger-than-expected growth, with 225,000 new positions added across sectors. This beat economist predictions of 180,000 jobs and signals continued labor market resilience despite higher interest rates."
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
              <span className="font-semibold">According to {currentClaim.source} ({currentClaim.date}):</span>{' '}
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
