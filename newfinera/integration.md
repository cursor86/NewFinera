# NewFinera Live Data — Integration Guide

## How it works

```
GitHub Actions (daily 8 AM AEST)
  └── runs fetch_data.py
      ├── CoinGecko API     → BTC, ETH prices
      ├── Open Exchange Rates → AUD/USD, GBP/USD, PKR, AED
      ├── Yahoo Finance      → S&P 500, NASDAQ, DOW, ASX 200, FTSE, Gold, US10Y
      └── Reuters/CNBC/BBC RSS → 10 live news articles
          ↓
      data/market.json  (committed to repo → served by GitHub Pages)
      data/news.json
          ↓
      js/live-data.js reads files at page load → updates ticker + news
```

No API keys. No paid services. No CORS issues. Data is always on your own domain.

---

## Step 1 — Add these files to your repo

Copy into the root of your Pay-check-AU repo:

```
.github/
  workflows/
    update-data.yml     ← GitHub Actions schedule
data/
  market.json           ← initial fallback values (will be overwritten daily)
  news.json             ← initial empty file
js/
  live-data.js          ← frontend code
fetch_data.py           ← data fetcher (run by Actions)
```

---

## Step 2 — Add script tag to index.html

Add ONE line just before the closing `</body>` tag:

```html
<script src="/js/live-data.js"></script>
```

---

## Step 3 — Add a data timestamp (optional but nice for credibility)

Add this anywhere you want to show "Data updated: 22 Jun 2026 22:00 UTC":

```html
<span id="nf-data-updated" style="color:#888;font-size:.75rem;"></span>
```

Good places: near the ticker, or in the footer.

---

## Step 4 — Fix ALL http:// → https:// links

Run this command in the root of your repo (Mac/Linux):

```bash
# Mac (BSD sed)
find . -name "*.html" ! -path "./.git/*" \
  -exec sed -i '' 's|http://newfinera\.com|https://newfinera.com|g' {} \;

# Linux
find . -name "*.html" ! -path "./.git/*" \
  -exec sed -i 's|http://newfinera\.com|https://newfinera.com|g' {} \;
```

Or do a Find & Replace in your editor:
- Find:    `http://newfinera.com`
- Replace: `https://newfinera.com`

---

## Step 5 — Enable GitHub Actions write permission

1. Go to your repo on GitHub
2. Settings → Actions → General
3. Scroll to "Workflow permissions"
4. Select **"Read and write permissions"**
5. Save

---

## Step 6 — Run the action manually to test

1. GitHub → Actions tab
2. Click "Update Market Data & News"
3. Click "Run workflow" → Run
4. Watch the logs — should see prices printed and files committed
5. Visit newfinera.com — ticker and news should update within ~30 seconds of the action completing

---

## Updating central bank rates (when they change)

Edit `fetch_data.py`, find the `get_central_bank_rates()` function, and update:

```python
return {
    "Fed": {"rate": "4.50–4.75%", "action": "Cut"},  # ← update here
    "RBA": {"rate": "3.85%",      "action": "Cut"},   # ← update here
}
```

Then commit and push. The next daily run will pick up the new values.

---

## The ticker element — what to check if it doesn't update

The JS looks for these CSS classes on your ticker element:
`.ticker-content`, `.ticker-track`, `.ticker-text`, `.marquee-content`

If your ticker div has a different class, either:
- Add one of the above classes to it, OR
- Edit `js/live-data.js` line ~80, add your class to the `candidates` selector

---

## The news section — what to check if it doesn't update

The JS looks for:
1. An element with class/id: `news-grid`, `news-articles`, `news-container`
2. OR: a heading containing "MOVING MARKETS" and injects after it

If neither matches, add `id="news-grid"` to the `<div>` wrapping your news articles.

---

## Free API limits (you won't hit them)

| API | Limit | Usage |
|-----|-------|-------|
| CoinGecko | 30 req/min | 1 req/day |
| Open Exchange Rates | 1,500 req/month | 1 req/day |
| Yahoo Finance | Unofficial, generous | 7 req/day |
| RSS feeds | Unlimited | ~5 req/day |

Total: ~14 API calls per day. Far under any limit.
