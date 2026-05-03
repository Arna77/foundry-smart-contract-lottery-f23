/**
 * Database Seed Script
 *
 * Populates comparable_transactions and area_trends tables
 * with realistic Malaysian property data for MVP testing.
 *
 * Usage:
 *   npx prisma db push          # create tables first
 *   node prisma/seed.js         # seed data
 */

const { PrismaClient } = require("@prisma/client");
const { generateSeedTransactions, generateAreaTrends } = require("../src/adapters/napicAdapter");

const prisma = new PrismaClient();

async function main() {
  console.log("[seed] Generating transactions...");
  const transactions = generateSeedTransactions();
  const trends = generateAreaTrends(transactions);

  // Clear existing data
  console.log("[seed] Clearing existing data...");
  await prisma.reviewRequest.deleteMany();
  await prisma.valuationEstimate.deleteMany();
  await prisma.subjectProperty.deleteMany();
  await prisma.comparableTransaction.deleteMany();
  await prisma.areaTrend.deleteMany();
  await prisma.sourceRun.deleteMany();

  // Insert transactions
  console.log(`[seed] Inserting ${transactions.length} comparable transactions...`);
  for (const tx of transactions) {
    await prisma.comparableTransaction.create({
      data: {
        source: tx.source,
        sourceRef: tx.sourceRef,
        transactionDate: new Date(tx.transactionDate),
        projectName: tx.projectName,
        addressLine: tx.addressLine,
        postcode: tx.postcode,
        city: tx.city,
        district: tx.district,
        state: tx.state,
        propertyType: tx.propertyType,
        tenure: tx.tenure,
        transactedPrice: tx.transactedPrice,
        builtUpSqft: tx.builtUpSqft,
        landAreaSqft: tx.landAreaSqft,
        psf: tx.psf,
        bedrooms: tx.bedrooms,
        bathrooms: tx.bathrooms,
        carParks: tx.carParks,
        floorLevel: tx.floorLevel,
        renovationProxy: tx.renovationProxy,
        yearCompleted: tx.yearCompleted,
        confidenceTag: tx.confidenceTag,
      },
    });
  }

  // Insert area trends
  console.log(`[seed] Inserting ${trends.length} area trends...`);
  for (const trend of trends) {
    await prisma.areaTrend.create({
      data: {
        areaCode: trend.areaCode,
        period: new Date(trend.period),
        propertyType: trend.propertyType,
        medianPsf: trend.medianPsf,
        transactionVolume: trend.transactionVolume,
        priceIndexFactor: trend.priceIndexFactor,
        source: trend.source,
      },
    });
  }

  // Log the source run
  await prisma.sourceRun.create({
    data: {
      sourceName: "seed-script",
      status: "completed",
      itemsFound: transactions.length + trends.length,
      itemsImported: transactions.length + trends.length,
      completedAt: new Date(),
    },
  });

  console.log(`[seed] Done. ${transactions.length} transactions + ${trends.length} trends inserted.`);
}

main()
  .catch((e) => {
    console.error("[seed] Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
