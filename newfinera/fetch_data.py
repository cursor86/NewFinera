"""
NewFinera Market Data Fetcher
Runs daily via GitHub Actions. Writes data/market.json and data/news.json.
Free APIs only — no API keys required.
"""
import requests
import feedparser
import json
import os
import time
from datetime import datetime, timezone

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; NewFinera/1.0; +https://newfinera.com)"
}


# ─── CRYPTO ──────────────────────────────────────────────────────────────────

def fetch_crypto():
    """CoinGecko free API — no key needed, reliable CORS support."""
    try:
        r = requests.get(
            "https://api.coingecko.com/api/v3/simple/price",
            params={
                "ids": "bitcoin,ethereum",
                "vs_currencies": "usd",
                "include_24hr_change": "true"
            },
            headers=HEADERS, timeout=12
        )
        r.raise_for_status()
        d = r.json()
        return {
            "BTC": {
                "price": round(d["bitcoin"]["usd"], 0),
                "change": round(d["bitcoin"].get("usd_24h_change", 0), 2)
            },
            "ETH": {
                "price": round(d["ethereum"]["usd"], 0),
                "change": round(d["ethereum"].get("usd_24h_change", 0), 2)
            }
        }
    except Exception as e:
        print(f"[WARN] Crypto fetch failed: {e}")
        return {}


# ─── FX RATES ─────────────────────────────────────────────────────────────────

def fetch_fx():
    """Open Exchange Rates free endpoint — no API key needed."""
    try:
        r = requests.get(
            "https://open.er-api.com/v6/latest/USD",
            headers=HEADERS, timeout=12
        )
        r.raise_for_status()
        rates = r.json().get("rates", {})
        # AUD/USD, GBP/USD, AED/USD: expressed as "how many USD per 1 unit"
        # USD/PKR: expressed as "how many PKR per 1 USD" (conventional display)
        return {
            "AUD_USD": round(1 / rates["AUD"], 4) if "AUD" in rates else None,
            "GBP_USD": round(1 / rates["GBP"], 4) if "GBP" in rates else None,
            "AED_USD": round(1 / rates["AED"], 4) if "AED" in rates else None,
            "USD_PKR": round(rates["PKR"], 2) if "PKR" in rates else None,
        }
    except Exception as e:
        print(f"[WARN] FX fetch failed: {e}")
        return {}


# ─── STOCK INDICES & COMMODITIES ─────────────────────────────────────────────

def fetch_yahoo(symbol):
    """Yahoo Finance unofficial endpoint — works server-side (no CORS needed here)."""
    try:
        r = requests.get(
            f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}",
            params={"interval": "1d", "range": "5d"},
            headers=HEADERS, timeout=12
        )
        r.raise_for_status()
        meta = r.json()["chart"]["result"][0]["meta"]
        price = meta.get("regularMarketPrice", 0)
        prev  = meta.get("previousClose") or meta.get("chartPreviousClose", price)
        change = ((price - prev) / prev * 100) if prev else 0
        return {"price": round(price, 2), "change": round(change, 2)}
    except Exception as e:
        print(f"[WARN] Yahoo {symbol} failed: {e}")
        return None


def fetch_indices():
    symbols = {
        "^GSPC":  "SP500",
        "^IXIC":  "NASDAQ",
        "^DJI":   "DOW",
        "^AXJO":  "ASX200",
        "^FTSE":  "FTSE100",
        "GC=F":   "Gold",
        "^TNX":   "US10Y",
    }
    results = {}
    for sym, name in symbols.items():
        data = fetch_yahoo(sym)
        if data:
            results[name] = data
        time.sleep(0.6)  # polite pacing
    return results


# ─── CENTRAL BANK RATES ───────────────────────────────────────────────────────

def get_central_bank_rates():
    """
    Central bank rates change infrequently. Update the values below manually
    when a rate decision is announced, or extend with scraping if desired.
    Fed: https://www.federalreserve.gov/monetarypolicy/openmarket.htm
    RBA: https://www.rba.gov.au/monetary-policy/rba-board-minutes/
    """
    return {
        "Fed": {"rate": "4.25–4.50%", "action": "Held"},
        "RBA": {"rate": "4.10%",      "action": "Held"},
    }


# ─── NEWS FROM RSS FEEDS ──────────────────────────────────────────────────────

RSS_FEEDS = [
    {"url": "https://feeds.reuters.com/reuters/businessNews",       "source": "Reuters",     "category": "Business"},
    {"url": "https://feeds.bbci.co.uk/news/business/rss.xml",       "source": "BBC Business","category": "Business"},
    {"url": "https://www.cnbc.com/id/10001147/device/rss/rss.html", "source": "CNBC",        "category": "Markets"},
    {"url": "https://finance.yahoo.com/news/rssindex",              "source": "Yahoo Finance","category": "Finance"},
    {"url": "https://www.cnbc.com/id/10000664/device/rss/rss.html", "source": "CNBC",        "category": "Investing"},
]


def clean_html(text):
    """Strip HTML tags and decode basic entities."""
    import re
    text = re.sub(r"<[^>]+>", " ", text or "")
    for ent, ch in [("&amp;","&"),("&lt;","<"),("&gt;",">"),("&quot;",'"'),("&#39;","'"),("&nbsp;"," ")]:
        text = text.replace(ent, ch)
    return " ".join(text.split())[:300]


def fetch_news():
    articles = []
    seen_titles = set()

    for feed_cfg in RSS_FEEDS:
        try:
            feed = feedparser.parse(feed_cfg["url"])
            for entry in feed.entries[:4]:
                title = (entry.get("title") or "").strip()
                if not title or title in seen_titles:
                    continue
                seen_titles.add(title)

                summary = clean_html(
                    entry.get("summary") or entry.get("description") or ""
                )
                pub = entry.get("published") or entry.get("updated") or \
                      datetime.now(timezone.utc).isoformat()

                articles.append({
                    "title":     title,
                    "summary":   summary,
                    "link":      entry.get("link", "#"),
                    "source":    feed_cfg["source"],
                    "category":  feed_cfg["category"],
                    "published": pub,
                })
        except Exception as e:
            print(f"[WARN] RSS {feed_cfg['source']} failed: {e}")

    return articles[:10]


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    now_iso  = datetime.now(timezone.utc).isoformat()
    now_disp = datetime.now(timezone.utc).strftime("%-d %b %Y %H:%M UTC")

    print("Fetching crypto prices...")
    crypto = fetch_crypto()
    print(f"  BTC: {crypto.get('BTC',{}).get('price','—')} | ETH: {crypto.get('ETH',{}).get('price','—')}")

    print("Fetching FX rates...")
    fx = fetch_fx()
    print(f"  AUD/USD: {fx.get('AUD_USD','—')} | GBP/USD: {fx.get('GBP_USD','—')}")

    print("Fetching stock indices & commodities...")
    indices = fetch_indices()
    for k, v in indices.items():
        print(f"  {k}: {v['price']} ({v['change']:+.2f}%)")

    print("Fetching news...")
    articles = fetch_news()
    print(f"  {len(articles)} articles collected")

    os.makedirs("data", exist_ok=True)

    market = {
        "updated_at":   now_iso,
        "updated_date": now_disp,
        "crypto":        crypto,
        "fx":            fx,
        "indices":       indices,
        "central_banks": get_central_bank_rates(),
    }

    news = {
        "updated_at": now_iso,
        "articles":   articles,
    }

    with open("data/market.json", "w") as f:
        json.dump(market, f, indent=2)
    print("✓ data/market.json written")

    with open("data/news.json", "w") as f:
        json.dump(news, f, indent=2)
    print("✓ data/news.json written")


if __name__ == "__main__":
    main()
