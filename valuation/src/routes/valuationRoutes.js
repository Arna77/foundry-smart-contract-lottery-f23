/**
 * Valuation API Routes
 *
 * POST /api/valuation/estimate        - Submit property for valuation
 * GET  /api/valuation/:id             - Retrieve a saved estimate
 * GET  /api/comparables               - Search comparable transactions
 * POST /api/valuation/review-request  - Request agent or valuer review
 * GET  /api/market-stats              - Malaysia market stats for 2026
 */

const express = require("express");
const { estimatePropertyValue } = require("../engine/valuationEngine");

const router = express.Router();

// ── In-memory stores (replace with Prisma in production) ────────────────────
let subjectProperties = [];
let comparableTransactions = [];
let areaTrends = [];
let valuationEstimates = [];
let reviewRequests = [];

function initStores(data) {
  if (data.transactions) comparableTransactions = data.transactions;
  if (data.trends) areaTrends = data.trends;
}

// ── POST /api/valuation/estimate ────────────────────────────────────────────

router.post("/valuation/estimate", (req, res) => {
  const body = req.body;

  // Validate required fields
  const required = ["propertyType", "address", "postcode", "state", "builtUpSqft", "tenure"];
  const missing = required.filter((f) => !body[f]);
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(", ")}` });
  }

  // Build subject property
  const subject = {
    id: generateId(),
    propertyType: body.propertyType,
    projectName: body.projectName || null,
    addressLine: body.address,
    postcode: body.postcode,
    city: body.city || "",
    district: body.district || "",
    state: body.state,
    tenure: body.tenure,
    builtUpSqft: Number(body.builtUpSqft),
    landAreaSqft: body.landAreaSqft ? Number(body.landAreaSqft) : null,
    bedrooms: body.bedrooms || null,
    bathrooms: body.bathrooms || null,
    carParks: body.carParks || null,
    floorLevel: body.floorLevel || null,
    totalFloors: body.totalFloors || null,
    cornerFlag: body.cornerFlag || false,
    endLotFlag: body.endLotFlag || false,
    viewQuality: body.viewQuality || "normal",
    furnishingLevel: body.furnishingLevel || "unfurnished",
    renovationLevel: body.renovationLevel || "original",
    yearCompleted: body.yearCompleted || null,
    gatedGuarded: body.gatedGuarded || false,
  };

  subjectProperties.push(subject);

  // Filter comp pool by state + nearby postcodes
  const compPool = comparableTransactions.filter((c) => {
    if (c.state !== subject.state) return false;
    // Same postcode or same city
    return c.postcode === subject.postcode || c.city === subject.city;
  });

  // Filter area trends for subject's area
  const subjectTrends = areaTrends.filter(
    (t) => t.areaCode === subject.postcode || t.areaCode === subject.city
  );

  // Run valuation engine
  const result = estimatePropertyValue(subject, compPool, subjectTrends);

  // Save estimate
  const estimate = {
    id: `val_${generateId()}`,
    subjectPropertyId: subject.id,
    ...result,
    createdAt: new Date().toISOString(),
  };
  valuationEstimates.push(estimate);

  res.json({
    estimateId: estimate.id,
    ...result,
  });
});

// ── GET /api/valuation/:id ──────────────────────────────────────────────────

router.get("/valuation/:id", (req, res) => {
  const estimate = valuationEstimates.find((e) => e.id === req.params.id);
  if (!estimate) return res.status(404).json({ error: "Estimate not found" });
  res.json(estimate);
});

// ── GET /api/comparables ────────────────────────────────────────────────────

router.get("/comparables", (req, res) => {
  let results = [...comparableTransactions];

  if (req.query.projectName) {
    const pn = req.query.projectName.toLowerCase();
    results = results.filter((c) => c.projectName && c.projectName.toLowerCase().includes(pn));
  }
  if (req.query.propertyType) {
    results = results.filter((c) => c.propertyType === req.query.propertyType);
  }
  if (req.query.state) {
    results = results.filter((c) => c.state === req.query.state);
  }
  if (req.query.postcode) {
    results = results.filter((c) => c.postcode === req.query.postcode);
  }
  if (req.query.builtUpSqft) {
    const target = Number(req.query.builtUpSqft);
    results = results.filter((c) => {
      const diff = Math.abs(Number(c.builtUpSqft) - target) / target;
      return diff <= 0.25;
    });
  }

  // Sort by transaction date descending
  results.sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate));

  res.json({
    total: results.length,
    comparables: results.slice(0, 20),
  });
});

// ── POST /api/valuation/review-request ──────────────────────────────────────

router.post("/valuation/review-request", (req, res) => {
  const { estimateId, reviewType } = req.body;

  if (!estimateId || !reviewType) {
    return res.status(400).json({ error: "estimateId and reviewType required" });
  }
  if (!["agent", "valuer"].includes(reviewType)) {
    return res.status(400).json({ error: "reviewType must be 'agent' or 'valuer'" });
  }

  const estimate = valuationEstimates.find((e) => e.id === estimateId);
  if (!estimate) return res.status(404).json({ error: "Estimate not found" });

  const review = {
    id: `rev_${generateId()}`,
    estimateId,
    reviewType,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  reviewRequests.push(review);

  res.json(review);
});

// ── GET /api/market-stats ───────────────────────────────────────────────────

router.get("/market-stats", (req, res) => {
  res.json({
    lastUpdated: "2026-04-01",
    source: "NAPIC / Bank Negara / IMF / iProperty.com.my",
    stats: {
      gdpGrowth: "4.5%",
      opr: "2.75%",
      residentialTransactionGrowthYoY: "+7.8%",
      klAveragePriceGrowth: "+4.2%",
      totalListings: 189157,
      unsoldUnitsGrowth: "+31.6%",
      foreignStampDuty: "8%",
      affordableHousingTarget: "1M homes (2026-2035)",
      ringgitPerUsd: "4.09",
      ringgitAppreciation2Y: "+14%",
      medianHomePriceBelowRM300k: "52% of volume",
      luxurySegmentGrowth: "+6.5% (RM1M+)",
    },
    keyMarkets: {
      johor: { outlook: "Fastest growth — RTS Link completion + JS-SEZ", medianPsfGrowth: "+5.2%" },
      kualaLumpur: { outlook: "Selective premium growth, transit-oriented", medianPsfGrowth: "+4.2%" },
      selangor: { outlook: "Stable, strong volume in mid-range", medianPsfGrowth: "+3.1%" },
      penang: { outlook: "Steady demand, limited land supply", medianPsfGrowth: "+3.8%" },
    },
  });
});

// ── Helper ──────────────────────────────────────────────────────────────────

function generateId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

module.exports = { router, initStores };
