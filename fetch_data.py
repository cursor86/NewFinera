"""
NewFinera Market Data Fetcher
Run daily by GitHub Actions. Writes data/market.json and data/news.json.
Free APIs only — no API keys required.
"""
import requests, feedparser, json, os, time
from datetime import datetime, timezone

HDR = {"User-Agent": "Mozilla/5.0 (compatible; NewFinera/1.0; +https://newfinera.com)"}

def fetch_crypto():
    try:
        r = requests.get("https://api.coingecko.com/api/v3/simple/price",
            params={"ids":"bitcoin,ethereum","vs_currencies":"usd","include_24hr_change":"true"},
            headers=HDR, timeout=12)
        r.raise_for_status()
        d = r.json()
        return {
            "BTC": {"price": round(d["bitcoin"]["usd"], 0),  "change": round(d["bitcoin"].get("usd_24h_change", 0), 2)},
            "ETH": {"price": round(d["ethereum"]["usd"], 0), "change": round(d["ethereum"].get("usd_24h_change", 0), 2)},
        }
    except Exception as e:
        print(f"[WARN] Crypto: {e}"); return {}

def fetch_fx():
    try:
        r = requests.get("https://open.er-api.com/v6/latest/USD", headers=HDR, timeout=12)
        r.raise_for_status()
        rates = r.json().get("rates", {})
        return {
            "AUD_USD": round(1 / rates["AUD"], 4) if "AUD" in rates else None,
            "GBP_USD": round(1 / rates["GBP"], 4) if "GBP" in rates else None,
            "AED_USD": round(1 / rates["AED"], 4) if "AED" in rates else None,
            "USD_PKR": round(rates["PKR"], 2)      if "PKR" in rates else None,
        }
    except Exception as e:
        print(f"[WARN] FX: {e}"); return {}

def fetch_yahoo(symbol):
    try:
        r = requests.get(f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}",
            params={"interval":"1d","range":"5d"}, headers=HDR, timeout=12)
        r.raise_for_status()
        meta  = r.json()["chart"]["result"][0]["meta"]
        price = meta.get("regularMarketPrice", 0)
        prev  = meta.get("previousClose") or meta.get("chartPreviousClose", price)
        change = ((price - prev) / prev * 100) if prev else 0
        return {"price": round(price, 2), "change": round(change, 2)}
    except Exception as e:
        print(f"[WARN] Yahoo {symbol}: {e}"); return None

def fetch_indices():
    symbols = {"^GSPC":"SP500","^IXIC":"NASDAQ","^DJI":"DOW",
               "^AXJO":"ASX200","^FTSE":"FTSE100","GC=F":"Gold","^TNX":"US10Y"}
    out = {}
    for sym, name in symbols.items():
        d = fetch_yahoo(sym)
        if d: out[name] = d
        time.sleep(0.6)
    return out

def central_banks():
    # Update these manually when the Fed or RBA makes a rate decision.
    # Fed:  https://www.federalreserve.gov/monetarypolicy/openmarket.htm
    # RBA:  https://www.rba.gov.au/monetary-policy/
    return {
        "Fed": {"rate": "4.25\u20134.50%", "action": "Held"},
        "RBA": {"rate": "4.10%",           "action": "Held"},
    }

RSS_FEEDS = [
    {"url":"https://feeds.reuters.com/reuters/businessNews",       "source":"Reuters",      "category":"Business"},
    {"url":"https://feeds.bbci.co.uk/news/business/rss.xml",       "source":"BBC Business", "category":"Business"},
    {"url":"https://www.cnbc.com/id/10001147/device/rss/rss.html", "source":"CNBC",         "category":"Markets"},
    {"url":"https://finance.yahoo.com/news/rssindex",              "source":"Yahoo Finance", "category":"Finance"},
]

def clean(text):
    import re
    text = re.sub(r"<[^>]+>", " ", text or "")
    for a, b in [("&amp;","&"),("&lt;","<"),("&gt;",">"),("&quot;",'"'),("&#39;","'"),("&nbsp;"," ")]:
        text = text.replace(a, b)
    return " ".join(text.split())[:300]

def fetch_news():
    articles, seen = [], set()
    for feed in RSS_FEEDS:
        try:
            f = feedparser.parse(feed["url"])
            for e in f.entries[:4]:
                title = (e.get("title") or "").strip()
                if not title or title in seen: continue
                seen.add(title)
                articles.append({
                    "title":    title,
                    "summary":  clean(e.get("summary") or e.get("description") or ""),
                    "link":     e.get("link", "#"),
                    "source":   feed["source"],
                    "category": feed["category"],
                    "published": e.get("published") or e.get("updated") or datetime.now(timezone.utc).isoformat(),
                })
        except Exception as ex:
            print(f"[WARN] RSS {feed['source']}: {ex}")
    return articles[:10]

def main():
    now = datetime.now(timezone.utc)
    print("Fetching crypto..."); crypto = fetch_crypto()
    print("Fetching FX...");     fx     = fetch_fx()
    print("Fetching indices..."); idx   = fetch_indices()
    print("Fetching news...");   news   = fetch_news()

    os.makedirs("data", exist_ok=True)

    with open("data/market.json", "w") as f:
        json.dump({
            "updated_at":    now.isoformat(),
            "updated_date":  now.strftime("%-d %b %Y %H:%M UTC"),
            "crypto":        crypto,
            "fx":            fx,
            "indices":       idx,
            "central_banks": central_banks(),
        }, f, indent=2)
    print(f"✓ data/market.json — {len(idx)} indices, {len(crypto)} crypto, {len(fx)} FX")

    with open("data/news.json", "w") as f:
        json.dump({"updated_at": now.isoformat(), "articles": news}, f, indent=2)
    print(f"✓ data/news.json — {len(news)} articles")

if __name__ == "__main__":
    main()
