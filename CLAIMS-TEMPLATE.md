# How to Add Your Own Claims

## Template

Copy this template and fill it in with facts from your podcasts/newsletters:

```javascript
{
  id: 4, // Increment this number
  true_claim: "ACTUAL FACT HERE",
  false_claim: "SAME FACT BUT WITH ONE THING CHANGED",
  source: "Pivot Podcast", // or "Lenny's Newsletter", "Morning Brew", etc.
  date: "Feb 13, 2025",
  explanation: "CONTEXT: What was being discussed, why this matters, additional details from the source."
}
```

## Examples of Good Claims

### Example 1: Numbers
```javascript
{
  id: 4,
  true_claim: "Apple's Vision Pro sold 180,000 units in its first quarter.",
  false_claim: "Apple's Vision Pro sold 280,000 units in its first quarter.",
  source: "Pivot Podcast",
  date: "Feb 11, 2025",
  explanation: "Scott Galloway cited data showing Vision Pro's underwhelming debut with only 180K units sold, far below analyst expectations of 400K+. He argued this validates his prediction that spatial computing isn't ready for mainstream adoption."
}
```

### Example 2: Company/Person Names
```javascript
{
  id: 5,
  true_claim: "Satya Nadella announced Microsoft will phase out traditional Windows licenses by 2027.",
  false_claim: "Tim Cook announced Microsoft will phase out traditional Windows licenses by 2027.",
  source: "Morning Brew Daily",
  date: "Feb 9, 2025",
  explanation: "Morning Brew covered Microsoft CEO Satya Nadella's announcement of a major shift toward subscription-only Windows, marking the end of perpetual licenses and pushing users toward Microsoft 365 bundles."
}
```

### Example 3: Dates/Timing
```javascript
{
  id: 6,
  true_claim: "Stripe's new instant payouts feature launched in beta on February 1st.",
  false_claim: "Stripe's new instant payouts feature launched in beta on January 1st.",
  source: "Lenny's Newsletter",
  date: "Feb 8, 2025",
  explanation: "Lenny highlighted how Stripe's February 1st beta launch of instant payouts could transform marketplace economics, allowing creators and gig workers to access funds within seconds rather than days."
}
```

## Tips for Creating Good False Claims

**Change ONE thing only:**
- ❌ Wrong: Change multiple facts
- ✅ Right: Change a number, date, person, or company name

**Keep it plausible:**
- ❌ Wrong: "Apple acquired Tesla for $1 trillion"
- ✅ Right: "Apple's market cap reached $3.2 trillion" (vs actual $3.5 trillion)

**Maintain similar structure:**
- ❌ Wrong: Completely rewrite the sentence
- ✅ Right: Keep same wording, swap one detail

## How to Add to Your Site

1. Open `src/App.jsx`
2. Find the `DEMO_CLAIMS` array at the top
3. Add your new claim object to the array
4. Save the file
5. Push to GitHub: `git add . && git commit -m "Add new claims" && git push`
6. Vercel will auto-deploy in ~1 minute!

## Your Workflow

1. **Listen to your podcasts** (Pivot, Morning Brew Daily, Up First)
2. **Read your newsletters** (Lenny's Newsletter, Morning Brew)
3. **Note interesting facts** as you go
4. **Once a week**: Create 5-7 claim pairs
5. **Test locally**: `npm run dev` to preview
6. **Push to GitHub**: Auto-deploys to your live site

## Need Help?

Can't think of a good false claim? Try these patterns:
- Double or halve a number
- Swap two similar companies
- Move a date by a week/month
- Change "increased" to "decreased"
- Swap "will" and "won't"
