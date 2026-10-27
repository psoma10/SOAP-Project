import type { Pool } from "@neondatabase/serverless";
import { sql, query } from "../db/sql.js";
import type { School } from "../db/schema.js";
import { getPlatformFeePercent } from "../db/schoolSettingsRepo.js";
import { randomUUID } from "node:crypto";

export async function getPendingPayoutStats(pool: Pool, school: School) {
  const percent = await getPlatformFeePercent(pool, school);
  const actualPercent = percent > 0 ? percent : (school === "KLH" ? 3 : 2);

  const { rows } = await query<{ totalAmount: string, count: string }>(
    pool,
    sql`
      SELECT 
        COALESCE(SUM(p."amount"), 0) AS "totalAmount",
        COUNT(p."id") AS "count"
      FROM "Payment" p
      WHERE p."status" = 'SUCCESS'
        AND p."payoutId" IS NULL
        AND p."id" IN (
          SELECT "paymentId" FROM "Order" WHERE "school" = ${school}::"School" AND "paymentId" IS NOT NULL
        )
    `
  );

  const totalAmount = Number(rows[0]?.totalAmount || 0);
  const totalCommission = (totalAmount * actualPercent) / 100;

  return {
    totalAmount: totalAmount.toFixed(2),
    totalCommission: totalCommission.toFixed(2),
    count: Number(rows[0]?.count || 0)
  };
}

export async function createPayout(pool: Pool, school: School, adminId: string) {
  const percent = await getPlatformFeePercent(pool, school);
  const actualPercent = percent > 0 ? percent : (school === "KLH" ? 3 : 2);

  const { rows } = await query<{ totalAmount: string }>(
    pool,
    sql`
      SELECT 
        COALESCE(SUM(p."amount"), 0) AS "totalAmount"
      FROM "Payment" p
      WHERE p."status" = 'SUCCESS'
        AND p."payoutId" IS NULL
        AND p."id" IN (
          SELECT "paymentId" FROM "Order" WHERE "school" = ${school}::"School" AND "paymentId" IS NOT NULL
        )
    `
  );

  const totalAmount = Number(rows[0]?.totalAmount || 0);
  if (totalAmount <= 0) {
    throw new Error("No pending payments to payout");
  }

  const totalCommission = (totalAmount * actualPercent) / 100;
  const payoutId = randomUUID();

  // Insert Payout
  await query(
    pool,
    sql`
      INSERT INTO "Payout" ("id", "school", "amount", "commissionAmount", "createdByAdminId")
      VALUES (${payoutId}, ${school}::"School", ${totalAmount}, ${totalCommission}, ${adminId})
    `
  );

  // Update Payment
  await query(
    pool,
    sql`
      UPDATE "Payment"
      SET "payoutId" = ${payoutId}
      WHERE "status" = 'SUCCESS'
        AND "payoutId" IS NULL
        AND "id" IN (
          SELECT "paymentId" FROM "Order" WHERE "school" = ${school}::"School" AND "paymentId" IS NOT NULL
        )
    `
  );

  // Return the new payout
  const { rows: payoutRows } = await query(
    pool,
    sql`SELECT * FROM "Payout" WHERE "id" = ${payoutId}`
  );

  return payoutRows[0];
}

export async function getPayoutLogs(pool: Pool, school: School) {
  const { rows } = await query<{ id: string, amount: string, commissionAmount: string, createdAt: Date, createdByAdminName: string }>(
    pool,
    sql`
      SELECT 
        p."id", 
        p."amount", 
        p."commissionAmount", 
        p."createdAt",
        u."name" AS "createdByAdminName"
      FROM "Payout" p
      JOIN "User" u ON u."id" = p."createdByAdminId"
      WHERE p."school" = ${school}::"School"
      ORDER BY p."createdAt" DESC
    `
  );

  return rows;
}
