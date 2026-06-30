/**
 * NewFinera — Live Data Module
 * Fetches /data/market.json and /data/news.json (committed daily by GitHub Actions)
 * and updates the market ticker + news section using the site's existing CSS classes.
 */
(function () {
  "use strict";

  /* ─── helpers ──────────────────────────────────────────────────────── */

  function n(val, decimals) {
    if (val == null) return "—";
    return Number(val).toLocaleString("en-US", {
      minimumFractionDigits: decimals ?? 0,
      maximumFractionDigits: decimals ?? 0,
    });
  }

  function pct(change) {
    if (change == null) return "";
    const sign = change >= 0 ? "+" : "";
    return sign + Number(change).toFixed(2) + "%";
  }

  async function load(url) {
    try {
      const r = await fetch(url + "?t=" + Date.now());
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } catch (e) {
      console.warn("[NewFinera] Could not load " + url, e.message);
      return null;
    }
  }

  function fmtDate(str) {
    try {
      return new Date(str).toLocaleDateString("en-AU", {
        day: "numeric", month: "short", year: "numeric",
      });
    } catch { return ""; }
  }

  /* ─── TICKER ────────────────────────────────────────────────────────── */
  /*
   * The ticker uses class="tk-track" id="ticker"
   * Each item:  <span class="tki"><span class="up|dn">▲|▼</span> LABEL VALUE <span style="opacity:.45;font-size:.65rem;">CHANGE</span></span><span class="tkd"></span>
   * Content is duplicated once for the seamless CSS marquee loop (translateX -50%).
   */

  function tkItem(updown, label, value, note) {
    const arrow = updown >= 0 ? "▲" : "▼";
    const cls   = updown >= 0 ? "up" : "dn";
    return `<span class="tki"><span class="${cls}">${arrow}</span> ${label} ${value} <span style="opacity:.45;font-size:.65rem;">${note}</span></span><span class="tkd"></span>`;
  }

  function buildTickerHTML(m) {
    if (!m) return null;
    const { crypto: c = {}, fx = {}, indices: idx = {}, central_banks: cb = {} } = m;

    const items = [];

    if (idx.SP500)   items.push(tkItem(idx.SP500.change,   "S&P 500",   n(idx.SP500.price),   pct(idx.SP500.change)));
    if (idx.NASDAQ)  items.push(tkItem(idx.NASDAQ.change,  "NASDAQ",    n(idx.NASDAQ.price),  pct(idx.NASDAQ.change)));
    if (idx.DOW)     items.push(tkItem(idx.DOW.change,     "DOW",       n(idx.DOW.price),     pct(idx.DOW.change)));
    if (fx.AUD_USD)  items.push(tkItem(0,                  "AUD/USD",   fx.AUD_USD.toFixed(4), ""));
    if (idx.ASX200)  items.push(tkItem(idx.ASX200.change,  "ASX 200",   n(idx.ASX200.price),  pct(idx.ASX200.change)));
    if (fx.GBP_USD)  items.push(tkItem(0,                  "GBP/USD",   fx.GBP_USD.toFixed(4), ""));
    if (idx.FTSE100) items.push(tkItem(idx.FTSE100.change, "FTSE 100",  n(idx.FTSE100.price), pct(idx.FTSE100.change)));
    if (c.BTC)       items.push(tkItem(c.BTC.change,       "BTC/USD",   n(c.BTC.price),       pct(c.BTC.change)));
    if (c.ETH)       items.push(tkItem(c.ETH.change,       "ETH/USD",   n(c.ETH.price),       pct(c.ETH.change)));
    if (fx.USD_PKR)  items.push(tkItem(-1,                 "PKR/USD",   n(fx.USD_PKR, 2),     ""));
    if (idx.Gold)    items.push(tkItem(idx.Gold.change,    "Gold",      "$" + n(idx.Gold.price) + "/oz", pct(idx.Gold.change)));
    if (idx.US10Y)   items.push(tkItem(0,                  "US 10Y",    idx.US10Y.price.toFixed(2) + "%", ""));
    if (cb.Fed)      items.push(tkItem(-1,                 "Fed Rate",  cb.Fed.rate,           cb.Fed.action));
    if (cb.RBA)      items.push(tkItem(-1,                 "RBA Rate",  cb.RBA.rate,           cb.RBA.action));
    if (fx.AED_USD)  items.push(tkItem(0,                  "AED/USD",   fx.AED_USD.toFixed(4), "Pegged"));

    if (!items.length) return null;

    const once = items.join("");
    return once + once; // duplicate for seamless CSS loop
  }

  function applyTicker(html) {
    const el = document.getElementById("ticker") || document.querySelector(".tk-track");
    if (el) {
      el.innerHTML = html;
    } else {
      console.warn("[NewFinera] Ticker element #ticker / .tk-track not found.");
    }
  }

  /* ─── NEWS ──────────────────────────────────────────────────────────── */
  /*
   * The news section uses id="news-grid" class="ng"
   * Structure: <div class="nf"> (featured left) + <div class="nstack"> (3 cards right)
   * We replace the innerHTML of #news-grid entirely.
   */

  const SOURCE_BADGE = {
    "Reuters":      "nb-uk",   // blue
    "BBC Business": "nb-uk",
    "CNBC":         "nb-us",   // red
    "Yahoo Finance":"nb-au",   // gold
    "Business":     "nb-au",
    "Markets":      "nb-us",
    "Investing":    "nb-ai",   // purple
    "Finance":      "nb-cr",   // amber
  };

  function badgeClass(source, category) {
    return SOURCE_BADGE[source] || SOURCE_BADGE[category] || "nb-au";
  }

  function stripHTML(str) {
    return (str || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ").trim()
      .substring(0, 260);
  }

  function buildNewsHTML(newsData) {
    const articles = newsData && newsData.articles;
    if (!articles || articles.length === 0) return null;

    const top  = articles[0];
    const side = articles.slice(1, 4);

    const featured = `
      <div class="nf">
        <span class="nbadge nb-hot">🔥 Top Story</span>
        <h3><a href="${top.link}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none;">${top.title}</a></h3>
        <p>${stripHTML(top.summary)}</p>
        <div class="nmeta">${top.source} · ${fmtDate(top.published)} · General education only, not financial advice</div>
      </div>`;

    const stack = `
      <div class="nstack">
        ${side.map(a => `
        <div class="nm2">
          <span class="nbadge ${badgeClass(a.source, a.category)}" style="display:inline-block;margin-bottom:9px;">📰 ${a.source}</span>
          <h4><a href="${a.link}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none;">${a.title}</a></h4>
          <p>${stripHTML(a.summary).substring(0, 120)}</p>
          <div class="nm2-m">${fmtDate(a.published)} · Education only</div>
        </div>`).join("")}
      </div>`;

    return featured + stack;
  }

  function applyNews(html) {
    const el = document.getElementById("news-grid");
    if (el) {
      el.innerHTML = html;
    } else {
      console.warn("[NewFinera] News container #news-grid not found.");
    }
  }

  /* ─── TIMESTAMP ─────────────────────────────────────────────────────── */

  function applyTimestamp(date) {
    const el = document.getElementById("nf-data-updated");
    if (el && date) el.textContent = "Market data: " + date;
  }

  /* ─── INIT ──────────────────────────────────────────────────────────── */

  async function init() {
    const [market, news] = await Promise.all([
      load("/data/market.json"),
      load("/data/news.json"),
    ]);

    if (market) {
      const tickerHTML = buildTickerHTML(market);
      if (tickerHTML) applyTicker(tickerHTML);
      applyTimestamp(market.updated_date);
    }

    if (news && news.articles && news.articles.length > 0) {
      const newsHTML = buildNewsHTML(news);
      if (newsHTML) applyNews(newsHTML);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
