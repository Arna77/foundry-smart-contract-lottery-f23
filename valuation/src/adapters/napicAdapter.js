/**
 * NAPIC Publication Adapter
 *
 * Polls https://napic.jpph.gov.my/en/latest-publication for new reports,
 * extracts transaction data, and normalizes into ComparableTransaction records.
 *
 * NAPIC (National Property Information Centre) under JPPH publishes:
 *   - Malaysian Property Market Reports (quarterly)
 *   - Property Stock Reports
 *   - Residential Property Transaction Data
 *
 * In production, pair with Bright Data MCP for reliable scraping.
 * For MVP, this adapter provides the structure + seed data import.
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

const NAPIC_URL = "https://napic.jpph.gov.my/en/latest-publication";
const SEED_DATA_PATH = path.join(__dirname, "..", "..", "prisma", "seed-transactions.json");

// ── NAPIC Page Fetcher ──────────────────────────────────────────────────────

async function fetchNapicPublications() {
  console.log("[napic] Fetching latest publications from NAPIC...");

  try {
    const html = await httpGet(NAPIC_URL);

    // Extract publication links and dates
    const publications = parsePublicationList(html);
    console.log(`[napic] Found ${publications.length} publications`);

    return publications;
  } catch (err) {
    console.log(`[napic] Fetch failed: ${err.message}. Using cached/seed data.`);
    return [];
  }
}

function parsePublicationList(html) {
  const publications = [];
  // Match links to PDF reports or publication pages
  const regex = /<a[^>]+href=["']([^"']*(?:report|publication|property-market)[^"']*)["'][^>]*>([^<]+)<\/a>/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    publications.push({
      url: match[1].startsWith("http") ? match[1] : `https://napic.jpph.gov.my${match[1]}`,
      title: match[2].trim(),
      fetchedAt: new Date().toISOString(),
    });
  }

  return publications;
}

// ── Normalize NAPIC data into ComparableTransaction format ──────────────────

function normalizeNapicRecord(raw) {
  return {
    source: "napic.jpph",
    sourceRef: raw.ref || null,
    transactionDate: raw.transactionDate || raw.date,
    projectName: raw.projectName || raw.scheme || null,
    addressLine: raw.address || raw.lot || null,
    postcode: raw.postcode || "",
    city: raw.city || raw.mukim || "",
    district: raw.district || "",
    state: raw.state || "",
    latitude: raw.lat || null,
    longitude: raw.lng || null,
    propertyType: mapNapicPropertyType(raw.propertyType || raw.type),
    tenure: raw.tenure?.toLowerCase().includes("free") ? "freehold" : "leasehold",
    transactedPrice: Number(raw.price || raw.transactedPrice || 0),
    builtUpSqft: Number(raw.builtUp || raw.builtUpSqft || 0),
    landAreaSqft: raw.landArea ? Number(raw.landArea) : null,
    psf: 0, // calculated below
    bedrooms: raw.bedrooms || null,
    bathrooms: raw.bathrooms || null,
    carParks: raw.carParks || null,
    floorLevel: raw.floorLevel || null,
    renovationProxy: null,
    yearCompleted: raw.yearCompleted || null,
    confidenceTag: "verified", // NAPIC is official data
  };
}

function mapNapicPropertyType(type) {
  if (!type) return "condominium";
  const t = type.toLowerCase();
  if (t.includes("condo") || t.includes("condominium")) return "condominium";
  if (t.includes("apartment") || t.includes("apt")) return "apartment";
  if (t.includes("serviced")) return "serviced_residence";
  if (t.includes("flat")) return "flat";
  if (t.includes("terrace") || t.includes("teres")) return "terrace";
  if (t.includes("semi")) return "semi_detached";
  if (t.includes("bungalow") || t.includes("detached")) return "bungalow";
  if (t.includes("town")) return "townhouse";
  if (t.includes("cluster")) return "cluster_house";
  return "condominium";
}

// ── Seed Data Generator ─────────────────────────────────────────────────────
// Real-ish Malaysian property transaction data for MVP testing

function generateSeedTransactions() {
  const projects = [
    { name: "Pavilion Damansara Heights", city: "Kuala Lumpur", state: "Kuala Lumpur", postcode: "50490", type: "condominium", basePsf: 1100, tenure: "freehold", year: 2023 },
    { name: "The Astaka", city: "Johor Bahru", state: "Johor", postcode: "80000", type: "condominium", basePsf: 650, tenure: "freehold", year: 2019 },
    { name: "Mont Kiara Palma", city: "Kuala Lumpur", state: "Kuala Lumpur", postcode: "50480", type: "condominium", basePsf: 620, tenure: "freehold", year: 2005 },
    { name: "Setia Eco Park", city: "Shah Alam", state: "Selangor", postcode: "40170", type: "semi_detached", basePsf: 480, tenure: "freehold", year: 2010 },
    { name: "Tropicana Aman", city: "Kota Kemuning", state: "Selangor", postcode: "42500", type: "terrace", basePsf: 420, tenure: "leasehold", year: 2020 },
    { name: "Suria Stonor", city: "Kuala Lumpur", state: "Kuala Lumpur", postcode: "50450", type: "condominium", basePsf: 850, tenure: "freehold", year: 2012 },
    { name: "D'Latour", city: "Kuala Lumpur", state: "Kuala Lumpur", postcode: "54100", type: "serviced_residence", basePsf: 750, tenure: "leasehold", year: 2022 },
    { name: "Emerald Hills", city: "Cheras", state: "Selangor", postcode: "43200", type: "bungalow", basePsf: 550, tenure: "freehold", year: 2018 },
    { name: "M Vertica", city: "Kuala Lumpur", state: "Kuala Lumpur", postcode: "56000", type: "condominium", basePsf: 540, tenure: "leasehold", year: 2022 },
    { name: "Bandar Sunway Geo", city: "Petaling Jaya", state: "Selangor", postcode: "47500", type: "condominium", basePsf: 680, tenure: "leasehold", year: 2019 },
    { name: "Iskandar Puteri Medini", city: "Iskandar Puteri", state: "Johor", postcode: "79250", type: "condominium", basePsf: 380, tenure: "freehold", year: 2021 },
    { name: "Eco Ardence", city: "Setia Alam", state: "Selangor", postcode: "40170", type: "terrace", basePsf: 450, tenure: "freehold", year: 2021 },
  ];

  const transactions = [];

  for (const project of projects) {
    // Generate 5-8 transactions per project over last 12 months
    const count = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const monthsAgo = Math.floor(Math.random() * 12);
      const date = new Date();
      date.setMonth(date.getMonth() - monthsAgo);

      const sizeVariation = 0.85 + Math.random() * 0.30; // 85% to 115% of base
      const builtUp = Math.round((project.type === "terrace" || project.type === "semi_detached" || project.type === "bungalow" ? 2200 : 1100) * sizeVariation);
      const psfVariation = 0.92 + Math.random() * 0.16; // ±8% from base
      const psf = Math.round(project.basePsf * psfVariation);
      const price = psf * builtUp;

      const floorLevel = project.type === "condominium" || project.type === "serviced_residence" || project.type === "apartment"
        ? 3 + Math.floor(Math.random() * 35)
        : null;

      transactions.push({
        source: "napic.jpph",
        sourceRef: `NAPIC-${project.state.substring(0, 2).toUpperCase()}-${Date.now()}-${i}`,
        transactionDate: date.toISOString().split("T")[0],
        projectName: project.name,
        addressLine: `Unit ${Math.floor(Math.random() * 30) + 1}, ${project.name}`,
        postcode: project.postcode,
        city: project.city,
        district: project.city,
        state: project.state,
        latitude: null,
        longitude: null,
        propertyType: project.type,
        tenure: project.tenure,
        transactedPrice: price,
        builtUpSqft: builtUp,
        landAreaSqft: project.type === "terrace" ? builtUp * 0.6 : project.type === "semi_detached" ? builtUp * 0.8 : project.type === "bungalow" ? builtUp * 1.2 : null,
        psf,
        bedrooms: builtUp < 800 ? 2 : builtUp < 1300 ? 3 : 4,
        bathrooms: builtUp < 800 ? 1 : builtUp < 1300 ? 2 : 3,
        carParks: builtUp < 1000 ? 1 : 2,
        floorLevel,
        renovationProxy: ["original", "light", "moderate"][Math.floor(Math.random() * 3)],
        yearCompleted: project.year,
        confidenceTag: "verified",
      });
    }
  }

  return transactions;
}

// ── Generate area trends from transaction data ──────────────────────────────

function generateAreaTrends(transactions) {
  const groups = {};

  for (const tx of transactions) {
    const key = `${tx.postcode}-${tx.propertyType}`;
    if (!groups[key]) {
      groups[key] = { areaCode: tx.postcode, propertyType: tx.propertyType, months: {} };
    }
    const month = tx.transactionDate.substring(0, 7); // YYYY-MM
    if (!groups[key].months[month]) {
      groups[key].months[month] = { psfs: [], count: 0 };
    }
    groups[key].months[month].psfs.push(tx.psf);
    groups[key].months[month].count++;
  }

  const trends = [];
  for (const group of Object.values(groups)) {
    const months = Object.keys(group.months).sort();
    const basePsf = median(group.months[months[0]].psfs);

    for (const month of months) {
      const monthData = group.months[month];
      const medPsf = median(monthData.psfs);
      trends.push({
        areaCode: group.areaCode,
        period: `${month}-01`,
        propertyType: group.propertyType,
        medianPsf: medPsf,
        transactionVolume: monthData.count,
        priceIndexFactor: basePsf > 0 ? round2(medPsf / basePsf) : 1.0,
        source: "napic.jpph",
      });
    }
  }

  return trends;
}

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function round2(n) { return Math.round(n * 100) / 100; }

// ── HTTP Helper ─────────────────────────────────────────────────────────────

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "Stellarise-NAPIC-Adapter/1.0" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGet(res.headers.location).then(resolve).catch(reject);
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

// ── CLI entry point ─────────────────────────────────────────────────────────

if (require.main === module) {
  (async () => {
    console.log("[napic] Generating seed transaction data...\n");
    const transactions = generateSeedTransactions();
    const trends = generateAreaTrends(transactions);

    const output = { transactions, trends, generatedAt: new Date().toISOString() };
    const outPath = path.join(__dirname, "..", "..", "prisma", "seed-transactions.json");
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
    console.log(`[napic] Generated ${transactions.length} transactions and ${trends.length} area trends`);
    console.log(`[napic] Saved to ${outPath}`);

    // Also try fetching real NAPIC publications
    const publications = await fetchNapicPublications();
    if (publications.length > 0) {
      console.log("\n[napic] Latest publications:");
      publications.slice(0, 5).forEach((p) => console.log(`  - ${p.title}`));
    }
  })();
}

module.exports = {
  fetchNapicPublications,
  normalizeNapicRecord,
  generateSeedTransactions,
  generateAreaTrends,
};
