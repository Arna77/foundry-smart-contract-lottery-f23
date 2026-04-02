/**
 * Express API server for Malaysian Real Estate News
 *
 * Endpoints:
 *   GET /api/news                - All articles (with optional ?category= and ?source= filters)
 *   GET /api/news/latest         - Last 5 articles
 *   GET /api/news/categories     - List of unique categories
 *   GET /api/news/sources        - List of sources
 *   GET /api/market-stats        - Key Malaysia property market stats for 2026
 *   GET /                        - Serves the frontend dashboard
 *
 * Auto-refresh: Uses node-cron to re-fetch news every 6 hours.
 */

const express = require("express");
const path = require("path");
const fs = require("fs");
const cron = require("node-cron");
const { scrapeAllSources, SOURCES } = require("./newsScraper");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "..", "data");
const NEWS_FILE = path.join(DATA_DIR, "news.json");

// ── Serve static frontend ───────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "..")));

// ── Helper: load news data ──────────────────────────────────────────────────
function loadNews() {
  if (!fs.existsSync(NEWS_FILE)) return { articles: [], lastUpdated: null, totalArticles: 0 };
  return JSON.parse(fs.readFileSync(NEWS_FILE, "utf-8"));
}

// ── API Routes ──────────────────────────────────────────────────────────────

app.get("/api/news", (req, res) => {
  const data = loadNews();
  let articles = data.articles;

  if (req.query.category) {
    articles = articles.filter((a) => a.category.toLowerCase().includes(req.query.category.toLowerCase()));
  }
  if (req.query.source) {
    articles = articles.filter((a) => a.source.toLowerCase().includes(req.query.source.toLowerCase()));
  }
  if (req.query.tag) {
    articles = articles.filter((a) => a.tags && a.tags.some((t) => t.toLowerCase().includes(req.query.tag.toLowerCase())));
  }

  res.json({ lastUpdated: data.lastUpdated, total: articles.length, articles });
});

app.get("/api/news/latest", (req, res) => {
  const data = loadNews();
  const latest = data.articles
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, 5);
  res.json({ lastUpdated: data.lastUpdated, articles: latest });
});

app.get("/api/news/categories", (req, res) => {
  const data = loadNews();
  const categories = [...new Set(data.articles.map((a) => a.category))].sort();
  res.json({ categories });
});

app.get("/api/news/sources", (req, res) => {
  res.json({ sources: SOURCES });
});

app.get("/api/market-stats", (req, res) => {
  res.json({
    lastUpdated: "2026-04-01",
    stats: {
      gdpGrowth: "4.5%",
      opr: "2.75%",
      residentialTransactionGrowthYoY: "7.8%",
      klAveragePriceGrowth: "4.2%",
      totalListings: 189157,
      unsolvedUnitsGrowth: "31.6%",
      foreignStampDuty: "8%",
      affordableHousingTarget: "1 million homes (2026-2035)",
      ringgitPerUsd: "4.09",
      ringgitAppreciation: "14% (2024-2025)",
    },
  });
});

// ── Auto-refresh: every 6 hours ─────────────────────────────────────────────
cron.schedule("0 */6 * * *", async () => {
  console.log("[cron] Refreshing news data...");
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const articles = await scrapeAllSources();
    const output = {
      lastUpdated: new Date().toISOString(),
      totalArticles: articles.length,
      sources: SOURCES.map((s) => s.name),
      articles,
    };
    fs.writeFileSync(NEWS_FILE, JSON.stringify(output, null, 2));
    console.log(`[cron] Refreshed: ${articles.length} articles`);
  } catch (err) {
    console.error("[cron] Error:", err.message);
  }
});

// ── Start server ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  PropertyOwnershipNFT News Dashboard`);
  console.log(`  ────────────────────────────────────`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  API:     http://localhost:${PORT}/api/news`);
  console.log(`  Stats:   http://localhost:${PORT}/api/market-stats\n`);

  // Initial fetch if no data exists
  if (!fs.existsSync(NEWS_FILE)) {
    console.log("  No cached data found. Running initial news fetch...\n");
    scrapeAllSources().then((articles) => {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      const output = {
        lastUpdated: new Date().toISOString(),
        totalArticles: articles.length,
        sources: SOURCES.map((s) => s.name),
        articles,
      };
      fs.writeFileSync(NEWS_FILE, JSON.stringify(output, null, 2));
      console.log(`  Initial fetch complete: ${articles.length} articles\n`);
    });
  }
});
