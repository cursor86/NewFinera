/**
 * NewFinera Live Data Module
 * Reads /data/market.json and /data/news.json (committed daily by GitHub Actions)
 * and updates the market ticker + news section on the page.
 *
 * Add to index.html just before </body>:
 *   <script src="/js/live-data.js"></script>
 */
(function () {
  "use strict";

  /* ── helpers ── */

  function fmtNum(n, dec) {
    if (n == null) return "—";
    return Number(n).toLocaleString("en-US", {
      minimumFractionDigits: dec ?? 0,
      maximumFractionDigits: dec ?? 0,
    });
  }

  function arrow(change) {
    return change >= 0 ? "▲" : "▼";
  }

  function fmtChange(change, unit) {
    if (change == null) return "";
    const sign = change >= 0 ? "+" : "";
    return `${sign}${Number(change).toFixed(2)}${unit ?? "%"}`;
  }

  async function loadJSON(path) {
    try {
      const res = await fetch(path + "?v=" + Date.now());
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } catch (e) {
      console.warn("[NewFinera] Could not load", path, e.message);
      return null;
    }
  }

  /* ── ticker ── */

  function buildTickerText(m) {
    if (!m) return null;
    const { crypto: c, fx, indices: idx, central_banks: cb, updated_date } = m;

    const seg = (label, val, change, isPrice) => {
      if (!val && val !== 0) return null;
      const ch = change != null ? ` ${fmtChange(change)}` : "";
      return `${arrow(change ?? 0)} ${label} ${val}${ch}`;
    };

    const parts = [
      idx.SP500   && `${arrow(idx.SP500.change)} S&P 500 ${fmtNum(idx.SP500.price)} ${fmtChange(idx.SP500.change)}`,
      idx.NASDAQ  && `${arrow(idx.NASDAQ.change)} NASDAQ ${fmtNum(idx.NASDAQ.price)} ${fmtChange(idx.NASDAQ.change)}`,
      idx.DOW     && `${arrow(idx.DOW.change)} DOW ${fmtNum(idx.DOW.price)} ${fmtChange(idx.DOW.change)}`,
      fx.AUD_USD  && `▶ AUD/USD ${fx.AUD_USD.toFixed(4)}`,
      idx.ASX200  && `${arrow(idx.ASX200.change)} ASX 200 ${fmtNum(idx.ASX200.price)} ${fmtChange(idx.ASX200.change)}`,
      fx.GBP_USD  && `▶ GBP/USD ${fx.GBP_USD.toFixed(4)}`,
      idx.FTSE100 && `${arrow(idx.FTSE100.change)} FTSE 100 ${fmtNum(idx.FTSE100.price)} ${fmtChange(idx.FTSE100.change)}`,
      c.BTC       && `${arrow(c.BTC.change)} BTC/USD ${fmtNum(c.BTC.price)} ${fmtChange(c.BTC.change)}`,
      c.ETH       && `${arrow(c.ETH.change)} ETH/USD ${fmtNum(c.ETH.price)} ${fmtChange(c.ETH.change)}`,
      fx.USD_PKR  && `▶ PKR/USD ${fmtNum(fx.USD_PKR, 2)}`,
      idx.Gold    && `${arrow(idx.Gold.change)} Gold $${fmtNum(idx.Gold.price, 0)}/oz ${fmtChange(idx.Gold.change)}`,
      idx.US10Y   && `▶ US 10Y ${idx.US10Y.price.toFixed(2)}%`,
      cb?.Fed     && `▶ Fed Rate ${cb.Fed.rate} ${cb.Fed.action}`,
      cb?.RBA     && `▶ RBA Rate ${cb.RBA.rate} ${cb.RBA.action}`,
      fx.AED_USD  && `▶ AED/USD ${fx.AED_USD.toFixed(4)} Pegged`,
    ]
      .filter(Boolean)
      .join(" ◆ ");

    // Duplicate for seamless CSS marquee loop
    return parts + " ◆ " + parts;
  }

  function applyTicker(text) {
    // Try known class/id patterns first, then sniff by content
    const candidates = [
      ...document.querySelectorAll(
        ".ticker-content, .ticker-track, .ticker-text, .marquee-content, #ticker, #live-ticker, [class*='ticker']"
      ),
    ];

    // Fallback: find element whose text has S&P 500 AND NASDAQ
    if (!candidates.length) {
      document.querySelectorAll("div, p, span").forEach((el) => {
        if (
          el.children.length === 0 &&
          el.textContent.includes("S&P 500") &&
          el.textContent.includes("NASDAQ")
        ) {
          candidates.push(el);
        }
      });
    }

    candidates.forEach((el) => {
      el.textContent = text;
    });

    if (!candidates.length) {
      console.warn("[NewFinera] Ticker element not found — check class names in index.html");
    }
  }

  /* ── news ── */

  const CAT_EMOJI = {
    Business:  "📊",
    Markets:   "📈",
    Finance:   "💰",
    Crypto:    "₿",
    Investing: "🧠",
    Default:   "📰",
  };

  function fmtDate(str) {
    try {
      return new Date(str).toLocaleDateString("en-AU", {
        day: "numeric", month: "short", year: "numeric",
      });
    } catch {
      return "";
    }
  }

  function buildNewsHTML(newsData) {
    const articles = newsData?.articles;
    if (!articles || articles.length === 0) return null;

    const [top, ...rest] = articles;
    const restSlice = rest.slice(0, 3);

    // Inline styles that complement the existing dark theme
    const cardBase =
      "background:var(--card-bg,rgba(255,255,255,.04));border:1px solid var(--border-color,rgba(255,255,255,.1));border-radius:12px;padding:1.5rem;";

    const topCard = /* html */ `
      <div style="${cardBase}grid-column:1/-1;margin-bottom:.5rem;">
        <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.9rem;flex-wrap:wrap;">
          <span style="background:#e74c3c;color:#fff;font-size:.65rem;font-weight:700;padding:.25rem .65rem;border-radius:4px;text-transform:uppercase;letter-spacing:.06em;">
            🔥 Top Story
          </span>
          <span style="color:#888;font-size:.75rem;">
            ${top.source} · ${fmtDate(top.published)} · General education only
          </span>
        </div>
        <h3 style="font-size:1.2rem;font-weight:700;margin:0 0 .75rem;line-height:1.4;">
          <a href="${top.link}" target="_blank" rel="noopener noreferrer"
             style="color:inherit;text-decoration:none;"
             onmouseover="this.style.opacity='.8'" onmouseout="this.style.opacity='1'">
            ${top.title}
          </a>
        </h3>
        <p style="color:#aaa;font-size:.88rem;line-height:1.65;margin:0;">${top.summary}</p>
      </div>`;

    const smallCards = restSlice
      .map(
        (a) => /* html */ `
      <div style="${cardBase}">
        <div style="color:#888;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;margin-bottom:.5rem;">
          ${CAT_EMOJI[a.category] || CAT_EMOJI.Default} ${a.source}
        </div>
        <h4 style="font-size:.92rem;font-weight:600;margin:0 0 .6rem;line-height:1.4;">
          <a href="${a.link}" target="_blank" rel="noopener noreferrer"
             style="color:inherit;text-decoration:none;"
             onmouseover="this.style.opacity='.8'" onmouseout="this.style.opacity='1'">
            ${a.title}
          </a>
        </h4>
        <p style="color:#777;font-size:.78rem;margin:0;">${fmtDate(a.published)} · Education only</p>
      </div>`
      )
      .join("");

    return /* html */ `
      <div id="nf-live-news-grid"
           style="display:grid;gap:1rem;grid-template-columns:repeat(3,1fr);">
        ${topCard}
        ${smallCards}
      </div>`;
  }

  function applyNews(html) {
    // Look for the existing news articles container in the WHAT'S MOVING MARKETS section
    // Strategy 1 — find a known wrapper id/class
    const knownContainers = document.querySelectorAll(
      "#news-grid, .news-grid, #news-articles, .news-articles, [class*='news-grid'], [class*='news-container']"
    );

    for (const el of knownContainers) {
      el.innerHTML = html;
      return true;
    }

    // Strategy 2 — find the section heading "WHAT'S MOVING MARKETS" and inject after it
    const headings = document.querySelectorAll("h2, h3, .section-heading, [class*='section-title']");
    for (const h of headings) {
      if (/MOVING MARKETS/i.test(h.textContent)) {
        // Find the next sibling div that holds the article cards
        let sibling = h.nextElementSibling;
        while (sibling) {
          if (
            sibling.querySelector("h3, h4, article") ||
            sibling.children.length > 1
          ) {
            sibling.innerHTML = html;
            return true;
          }
          sibling = sibling.nextElementSibling;
        }
        // Nothing found — create a fresh container
        const wrapper = document.createElement("div");
        wrapper.innerHTML = html;
        h.parentNode.insertBefore(wrapper, h.nextSibling);
        return true;
      }
    }

    console.warn("[NewFinera] News container not found — check section structure");
    return false;
  }

  /* ── data timestamp badge ── */

  function showTimestamp(updatedDate) {
    const badge = document.getElementById("nf-data-updated");
    if (badge && updatedDate) badge.textContent = "Data updated: " + updatedDate;
  }

  /* ── init ── */

  async function init() {
    const [market, news] = await Promise.all([
      loadJSON("/data/market.json"),
      loadJSON("/data/news.json"),
    ]);

    if (market) {
      const tickerText = buildTickerText(market);
      if (tickerText) applyTicker(tickerText);
      showTimestamp(market.updated_date);
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
