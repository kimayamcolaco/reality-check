# Deploy AI-Powered Reality Check

## Quick Deploy Steps

### 1. Push to GitHub

```bash
cd reality-check-ai
git init
git add .
git commit -m "AI-powered version"
git branch -M main
git remote add origin https://github.com/kimayamcolaco/reality-check.git
git push -u origin main --force
```

(Use `--force` since we're replacing the old version)

### 2. Redeploy on Vercel

Your site will auto-deploy! Wait ~2 minutes.

### 3. Test It Works

1. Visit your site - should still work (pulls from database now)
2. Visit `/admin` - you'll see the admin panel
3. Click "Add Article Manually"
4. Paste any article content
5. Click "Generate Claims with AI"
6. Review and approve the generated claim
7. Go back to main site - your claim is live!

## First Time Usage

### Add Your First Claims:

1. **Go to /admin**

2. **Click "Add Article Manually"** and paste this:
   ```
   Title: Meta Announces $65B AI Investment
   Content: Meta CEO Mark Zuckerberg announced the company will invest $65 billion in AI infrastructure throughout 2025, marking one of the largest capital expenditures in tech history.
   Source: Pivot Podcast
   ```

3. **Click "Generate Claims from Articles"**
   - AI will extract facts
   - AI will create true/false pairs
   - Takes ~10 seconds

4. **Go to "Review Claims" tab**
   - You'll see the AI-generated claim
   - Click "Approve" or "Edit & Approve"

5. **Go back to main site**
   - Your claim is now live!
   - Repeat to build up a library

## Tips

- **Start with 5-10 approved claims** before sharing widely
- **Review all AI claims** - they're good but not perfect
- **Add variety** - mix different sources and topics
- **Weekly maintenance** - add 3-5 new claims from latest episodes

## Troubleshooting

**"No claims to review"**
→ Click "Add Article Manually" first

**AI generation fails**
→ Check your VITE_ANTHROPIC_API_KEY in Vercel

**Database errors**
→ Verify you ran the SQL schema in Supabase

**Claims don't appear**
→ Make sure you clicked "Approve" in admin

## What's Next?

Once this works, we can add:
- RSS feed auto-fetching
- Daily cron job (auto-generate claims)
- Better admin UI
- Analytics dashboard
