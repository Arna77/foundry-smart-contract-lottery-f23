/**
 * Stellarise Valuation API Server
 *
 * Malaysia Property Valuation Tool — Express MVP
 * Ready for migration to NestJS + BullMQ.
 *
 * Endpoints:
 *   POST /api/valuation/estimate
 *   GET  /api/valuation/:id
 *   GET  /api/comparables
 *   POST /api/valuation/review-request
 *   GET  /api/market-stats
 *   GET  /                              (frontend)
 */

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { router, initStores } = require("./routes/valuationRoutes");
const { generateSeedTransactions, generateAreaTrends } = require("./adapters/napicAdapter");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// ── Load or generate seed data ──────────────────────────────────────────────
const seedPath = path.join(__dirname, "..", "prisma", "seed-transactions.json");

let seedData;
if (fs.existsSync(seedPath)) {
  seedData = JSON.parse(fs.readFileSync(seedPath, "utf-8"));
  console.log(`  Loaded ${seedData.transactions.length} transactions from cache`);
} else {
  console.log("  No cached data. Generating seed transactions...");
  const transactions = generateSeedTransactions();
  const trends = generateAreaTrends(transactions);
  seedData = { transactions, trends, generatedAt: new Date().toISOString() };
  fs.mkdirSync(path.dirname(seedPath), { recursive: true });
  fs.writeFileSync(seedPath, JSON.stringify(seedData, null, 2));
  console.log(`  Generated ${transactions.length} transactions`);
}

initStores(seedData);

// ── Routes ──────────────────────────────────────────────────────────────────
app.use("/api", router);

// ── Serve frontend ──────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// ── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  Stellarise Property Valuation Tool`);
  console.log(`  ──────────────────────────────────`);
  console.log(`  Local:      http://localhost:${PORT}`);
  console.log(`  Estimate:   POST http://localhost:${PORT}/api/valuation/estimate`);
  console.log(`  Comparables: GET http://localhost:${PORT}/api/comparables`);
  console.log(`  Stats:      GET  http://localhost:${PORT}/api/market-stats\n`);
});
