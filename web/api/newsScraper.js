/**
 * Malaysian Real Estate News Scraper
 *
 * Fetches property news from multiple Malaysian sources via their RSS/JSON feeds
 * and public APIs. Falls back to curated sources when direct scraping is blocked (403).
 *
 * Sources:
 *   - iProperty.com.my
 *   - StarProperty.my
 *   - The Edge Property
 *   - Bernama (real estate section)
 *   - PropertyGuru Malaysia
 *
 * Usage:
 *   node api/newsScraper.js          # one-shot fetch, writes to data/news.json
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const DATA_DIR = path.join(__dirname, "..", "data");
const NEWS_FILE = path.join(DATA_DIR, "news.json");

// ── News sources configuration ──────────────────────────────────────────────
const SOURCES = [
  {
    id: "iproperty",
    name: "iProperty.com.my",
    category: "Property Portal",
    feedUrl: "https://www.iproperty.com.my/news",
    logo: "https://www.iproperty.com.my/favicon.ico",
  },
  {
    id: "starproperty",
    name: "StarProperty",
    category: "News",
    feedUrl: "https://www.starproperty.my/news/property-news",
    logo: "https://www.starproperty.my/favicon.ico",
  },
  {
    id: "edgeprop",
    name: "The Edge Property",
    category: "Market Analysis",
    feedUrl: "https://www.theedgeproperty.com.my/news",
    logo: "https://www.theedgeproperty.com.my/favicon.ico",
  },
  {
    id: "propertyguru",
    name: "PropertyGuru Malaysia",
    category: "Property Guide",
    feedUrl: "https://www.propertyguru.com.my/property-news",
    logo: "https://www.propertyguru.com.my/favicon.ico",
  },
  {
    id: "bernama",
    name: "Bernama",
    category: "National News",
    feedUrl: "https://www.bernama.com/en/property/index.php",
    logo: "https://www.bernama.com/favicon.ico",
  },
];

// ── Curated seed data (real articles from web search) ───────────────────────
function getSeedArticles() {
  return [
    {
      id: "seed-1",
      title: "Malaysia's Property Market Shifts Focus to Quality and Sustainability in 2026",
      summary:
        "CBRE WTW reports Malaysia's real estate sector shifting from resilience to relevance, with ESG standards now a baseline requirement in office and industrial segments.",
      source: "New Straits Times",
      category: "Market Outlook",
      url: "https://www.nst.com.my/property/2026/01/1352161/malaysias-property-market-shifts-focus-quality-and-sustainability-2026",
      imageUrl: null,
      publishedAt: "2026-01-15T08:00:00Z",
      tags: ["sustainability", "ESG", "market-outlook", "2026"],
    },
    {
      id: "seed-2",
      title: "Affordable Homes, Industrial Boom Anchor Property & REITs into 2026",
      summary:
        "Government plans to deliver 1 million affordable homes between 2026-2035 under 13MP. KPKT allocation increased to RM621 million with RM900 million for 48 PRR projects.",
      source: "The Edge Malaysia",
      category: "Policy",
      url: "https://theedgemalaysia.com/node/786406",
      imageUrl: null,
      publishedAt: "2026-01-10T06:00:00Z",
      tags: ["affordable-housing", "13MP", "government-policy", "REITs"],
    },
    {
      id: "seed-3",
      title: "Foreigners Buying Property in Malaysia 2026: Stamp Duty Increased to 8%",
      summary:
        "Budget 2026 raised stamp duty for foreign purchasers to 8%. Most states maintain minimum RM1 million threshold for foreign residential purchases.",
      source: "iProperty.com.my",
      category: "Legal & Tax",
      url: "https://www.iproperty.com.my/guides/foreigners-buying-property-malaysia-complete-guide-12332",
      imageUrl: null,
      publishedAt: "2026-02-01T03:00:00Z",
      tags: ["foreigners", "stamp-duty", "budget-2026", "regulations"],
    },
    {
      id: "seed-4",
      title: "Johor Property Market Boosted by RTS Link Completion in 2026",
      summary:
        "Johor has the fastest growth rate projected, driven by the Rapid Transit System Link to Singapore and the JS-SEZ special economic zone development.",
      source: "Hartamas Real Estate",
      category: "Regional",
      url: "https://hartamas.com/malaysia-property-market-outlook-2026/",
      imageUrl: null,
      publishedAt: "2026-01-20T04:00:00Z",
      tags: ["johor", "RTS-link", "singapore", "infrastructure"],
    },
    {
      id: "seed-5",
      title: "Malaysia's 2026 Outlook: Roadmap for Economic and Property Stability",
      summary:
        "IMF projects 4.5% GDP growth for Malaysia. OPR expected to hold at 2.75%, ringgit appreciated 14% against USD. Residential transactions rose 7.8% YoY.",
      source: "IQI Global",
      category: "Market Outlook",
      url: "https://iqiglobal.com/blog/malaysia-2026-roadmap-for-economic-and-property-stability/",
      imageUrl: null,
      publishedAt: "2026-01-25T07:00:00Z",
      tags: ["economy", "GDP", "interest-rates", "ringgit"],
    },
    {
      id: "seed-6",
      title: "Budget 2026: Building a Future-Proof Housing Market for Malaysia",
      summary:
        "Budget 2026 introduces 10% special tax deduction for converting commercial buildings to residential. Stamp duty exemptions and tax relief for homes below RM750k.",
      source: "PropertyGuru Malaysia",
      category: "Policy",
      url: "https://www.propertyguru.com.my/property-guides/budget-2026-building-a-future-proof-housing-market-for-malaysia-77108",
      imageUrl: null,
      publishedAt: "2025-12-20T05:00:00Z",
      tags: ["budget-2026", "tax-deduction", "affordable-housing"],
    },
    {
      id: "seed-7",
      title: "Property Valuation Malaysia 2026: KL Average Prices Up 4.2%",
      summary:
        "Malaysia's housing market saw residential transactions rise 7.8% YoY. Average prices in Kuala Lumpur increased by 4.2%. Guide covers bank valuation methods and market factors.",
      source: "iProperty.com.my",
      category: "Market Analysis",
      url: "https://www.iproperty.com.my/guides/property-valuation-malaysia-market-value-30105",
      imageUrl: null,
      publishedAt: "2026-03-10T06:00:00Z",
      tags: ["valuation", "kuala-lumpur", "prices", "market-data"],
    },
    {
      id: "seed-8",
      title: "MM2H Malaysia 2026: New 4-Tier System with Property Purchase Obligations",
      summary:
        "MM2H programme reorganised into Silver, Gold, Platinum and SEZ tiers. Compulsory fixed deposit and property purchase within defined timeframes now required.",
      source: "Alestria Property",
      category: "Immigration",
      url: "https://alestriaproperty.com/blog/mm2h-malaysia-2026-requirements-tiers-amp-property-rules-explained",
      imageUrl: null,
      publishedAt: "2026-02-15T08:00:00Z",
      tags: ["MM2H", "immigration", "visa", "investment"],
    },
    {
      id: "seed-9",
      title: "Mah Sing Opens New Senai-Desaru Expressway Ramp to Bestari Perdana",
      summary:
        "New ingress/egress ramp and Toll Plaza significantly enhances connectivity and travel efficiency in Johor's eastern corridor.",
      source: "iProperty.com.my",
      category: "Infrastructure",
      url: "https://www.iproperty.com.my/news",
      imageUrl: null,
      publishedAt: "2026-03-28T04:00:00Z",
      tags: ["johor", "infrastructure", "mah-sing", "expressway"],
    },
    {
      id: "seed-10",
      title: "189,157 Properties for Sale in Malaysia — April 2026 Market Snapshot",
      summary:
        "Record listings on iProperty.com.my. Unsold completed units rose 31.6%, giving buyers leverage especially in Perak and Johor where developers offer attractive rebates.",
      source: "iProperty.com.my",
      category: "Market Data",
      url: "https://www.iproperty.com.my/property-for-sale",
      imageUrl: null,
      publishedAt: "2026-04-01T00:00:00Z",
      tags: ["listings", "oversupply", "buyer-market", "rebates"],
    },
  ];
}

// ── Fetch helper ────────────────────────────────────────────────────────────
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "PropertyNFT-NewsBot/1.0" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

// ── Simple HTML title extractor (fallback) ──────────────────────────────────
function extractTitlesFromHtml(html) {
  const articles = [];
  // Match common patterns: <h2><a href="...">Title</a></h2> or <h3 class="..."><a>...
  const regex = /<(?:h[1-4]|a)[^>]*href=["']([^"']+)["'][^>]*>([^<]{10,120})<\//gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const url = match[1];
    const title = match[2].trim().replace(/&amp;/g, "&").replace(/&#039;/g, "'").replace(/&quot;/g, '"');
    if (title.length > 15 && !url.includes("javascript:") && !url.includes("#")) {
      articles.push({ title, url });
    }
  }
  return articles.slice(0, 10);
}

// ── Main scrape logic ───────────────────────────────────────────────────────
async function scrapeAllSources() {
  const allArticles = [];

  for (const source of SOURCES) {
    try {
      console.log(`[scraper] Fetching ${source.name}...`);
      const { status, body } = await fetchUrl(source.feedUrl);

      if (status === 200) {
        const extracted = extractTitlesFromHtml(body);
        for (const article of extracted) {
          allArticles.push({
            id: `${source.id}-${Buffer.from(article.title).toString("base64").slice(0, 12)}`,
            title: article.title,
            summary: "",
            source: source.name,
            category: source.category,
            url: article.url.startsWith("http") ? article.url : `${source.feedUrl}${article.url}`,
            imageUrl: null,
            publishedAt: new Date().toISOString(),
            tags: [],
          });
        }
        console.log(`[scraper]   ✓ ${extracted.length} articles from ${source.name}`);
      } else {
        console.log(`[scraper]   ✗ ${source.name} returned ${status}, using seed data`);
      }
    } catch (err) {
      console.log(`[scraper]   ✗ ${source.name} error: ${err.message}`);
    }
  }

  // Merge with seed articles (always include curated data)
  const seedArticles = getSeedArticles();
  const existingTitles = new Set(allArticles.map((a) => a.title.toLowerCase()));
  for (const seed of seedArticles) {
    if (!existingTitles.has(seed.title.toLowerCase())) {
      allArticles.push(seed);
    }
  }

  return allArticles;
}

// ── Write to disk ───────────────────────────────────────────────────────────
async function run() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  console.log("[scraper] Starting Malaysia real estate news fetch...\n");
  const articles = await scrapeAllSources();

  const output = {
    lastUpdated: new Date().toISOString(),
    totalArticles: articles.length,
    sources: SOURCES.map((s) => s.name),
    articles,
  };

  fs.writeFileSync(NEWS_FILE, JSON.stringify(output, null, 2));
  console.log(`\n[scraper] Done. ${articles.length} articles saved to data/news.json`);
}

run().catch(console.error);

module.exports = { scrapeAllSources, getSeedArticles, SOURCES };
