import type { Pool } from "@neondatabase/serverless";
import { sql, query } from "../db/sql.js";
import type { School } from "../db/schema.js";
import { getPlatformFeePercent } from "../db/schoolSettingsRepo.js";

export interface AdminPaymentStats {
  thisMonthTotal: string;
  commission: string;
  commissionPercent: number;
  itemBreakdown: {
    itemName: string;
    qtySold: number;
    commission: string;
  }[];
  totalOrders: number;
  uniqueCustomers: number;
  trendPayments: number;
  trendCommission: number;
  trendOrders: number;
  trendCustomers: number;
  trendData: {
    date: string;
    totalPayments: number;
    commission: number;
  }[];
}

export interface PaginatedAdminPayments {
  data: AdminPaymentRow[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface AdminPaymentRow {
  id: string;
  amount: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
  studentName: string | null;
  guestName: string | null;
}

export async function getAdminPaymentStats(pool: Pool, school: School): Promise<AdminPaymentStats> {
  const percent = await getPlatformFeePercent(pool, school);
  const actualPercent = percent > 0 ? percent : (school === "KLH" ? 3 : 2);

  // Payments for current and last month
  const { rows: paymentStats } = await query<{ period: string, total: string }>(
    pool,
    sql`
      SELECT 
        CASE WHEN date_trunc('month', p."createdAt") = date_trunc('month', CURRENT_DATE) THEN 'current' ELSE 'last' END as period,
        COALESCE(SUM(p."amount"), 0) AS total
      FROM "Payment" p
      WHERE p."status" = 'SUCCESS'
        AND p."createdAt" >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
        AND p."id" IN (
          SELECT "paymentId" FROM "Order" WHERE "school" = ${school}::"School" AND "paymentId" IS NOT NULL
        )
      GROUP BY 1
    `
  );

  // Orders and unique customers for current and last month
  const { rows: orderStats } = await query<{ period: string, orders: string, customers: string }>(
    pool,
    sql`
      SELECT 
        CASE WHEN date_trunc('month', p."createdAt") = date_trunc('month', CURRENT_DATE) THEN 'current' ELSE 'last' END as period,
        COUNT(DISTINCT o."id") as orders,
        COUNT(DISTINCT COALESCE(o."studentId", o."guestPhone", o."guestName")) as customers
      FROM "Order" o
      JOIN "Payment" p ON p."id" = o."paymentId"
      WHERE p."status" = 'SUCCESS'
        AND p."createdAt" >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
        AND o."school" = ${school}::"School"
      GROUP BY 1
    `
  );

  // Daily aggregations for current month
  const { rows: dailyRows } = await query<{ date_str: string, total: string }>(
    pool,
    sql`
      SELECT 
        to_char(p."createdAt", 'Mon DD') as "date_str",
        COALESCE(SUM(p."amount"), 0) AS total
      FROM "Payment" p
      WHERE p."status" = 'SUCCESS'
        AND date_trunc('month', p."createdAt") = date_trunc('month', CURRENT_DATE)
        AND p."id" IN (
          SELECT "paymentId" FROM "Order" WHERE "school" = ${school}::"School" AND "paymentId" IS NOT NULL
        )
      GROUP BY date_trunc('day', p."createdAt"), to_char(p."createdAt", 'Mon DD')
      ORDER BY date_trunc('day', p."createdAt") ASC
    `
  );

  const calculateTrend = (current: number, last: number) => {
    if (last === 0 && current > 0) return 100;
    if (last === 0 && current === 0) return 0;
    return Math.round(((current - last) / last) * 100);
  };

  const currentPayments = Number(paymentStats.find(r => r.period === 'current')?.total || 0);
  const lastPayments = Number(paymentStats.find(r => r.period === 'last')?.total || 0);

  const currentCommission = (currentPayments * actualPercent) / 100;
  const lastCommission = (lastPayments * actualPercent) / 100;

  const currentOrders = Number(orderStats.find(r => r.period === 'current')?.orders || 0);
  const lastOrders = Number(orderStats.find(r => r.period === 'last')?.orders || 0);

  const currentCustomers = Number(orderStats.find(r => r.period === 'current')?.customers || 0);
  const lastCustomers = Number(orderStats.find(r => r.period === 'last')?.customers || 0);

  // Breakdown by item
  const { rows: itemRows } = await query<{ itemName: string, qtySold: string, itemTotal: string }>(
    pool,
    sql`
      SELECT 
        mi."name" as "itemName",
        SUM(oi."quantity") as "qtySold",
        SUM(oi."quantity" * oi."priceAtOrder") as "itemTotal"
      FROM "OrderItem" oi
      JOIN "MenuItem" mi ON mi."id" = oi."menuItemId"
      JOIN "Order" o ON o."id" = oi."orderId"
      JOIN "Payment" p ON p."id" = o."paymentId"
      WHERE p."status" = 'SUCCESS'
        AND date_trunc('month', p."createdAt") = date_trunc('month', CURRENT_DATE)
        AND o."school" = ${school}::"School"
      GROUP BY mi."id", mi."name"
      ORDER BY "itemTotal" DESC
    `
  );

  const itemBreakdown = itemRows.map(row => {
    const itemTotalRevenue = Number(row.itemTotal || 0);
    const itemComm = (itemTotalRevenue * actualPercent) / 100;
    return {
      itemName: row.itemName,
      qtySold: Number(row.qtySold || 0),
      commission: itemComm.toFixed(2)
    };
  });

  const trendData = dailyRows.map(r => ({
    date: r.date_str,
    totalPayments: Number(r.total || 0),
    commission: (Number(r.total || 0) * actualPercent) / 100
  }));

  return {
    thisMonthTotal: currentPayments.toFixed(2),
    commission: currentCommission.toFixed(2),
    commissionPercent: actualPercent,
    itemBreakdown,
    totalOrders: currentOrders,
    uniqueCustomers: currentCustomers,
    trendPayments: calculateTrend(currentPayments, lastPayments),
    trendCommission: calculateTrend(currentCommission, lastCommission),
    trendOrders: calculateTrend(currentOrders, lastOrders),
    trendCustomers: calculateTrend(currentCustomers, lastCustomers),
    trendData
  };
}

export async function getAdminPaymentsList(
  pool: Pool,
  school: School,
  cursor: string | undefined,
  limit: number,
  isToday: boolean
): Promise<PaginatedAdminPayments> {
  const limitPlusOne = limit + 1;

  let timeFilter = sql``;
  if (isToday) {
    timeFilter = sql`AND date_trunc('day', p."createdAt") = date_trunc('day', CURRENT_DATE)`;
  }

  let cursorFilter = sql``;
  if (cursor) {
    // cursor is payment id. we need createdAt for cursor pagination, or we can just sort by createdAt DESC, id DESC.
    // Since this is a simple dashboard, maybe just offset pagination? The prompt says "live pagination" meaning standard next cursor.
    // For simplicity, let's parse cursor as an offset for now, or fetch createdAt of cursor.
    // Actually, a simpler cursor is just the createdAt timestamp.
    const decoded = Buffer.from(cursor, "base64").toString("utf-8");
    const [createdAt, id] = decoded.split("|");
    if (createdAt && id) {
      cursorFilter = sql`AND (p."createdAt", p."id") < (${new Date(createdAt).toISOString()}::timestamp, ${id}::text)`;
    }
  }

  const { rows } = await query<any>(
    pool,
    sql`
      SELECT p."id", p."amount", p."status", p."createdAt", p."paidAt",
             u."name" as "studentName",
             (SELECT o."guestName" FROM "Order" o WHERE o."paymentId" = p."id" LIMIT 1) as "guestName"
      FROM "Payment" p
      LEFT JOIN "User" u ON p."studentId" = u."id"
      WHERE p."id" IN (
          SELECT "paymentId" FROM "Order" WHERE "school" = ${school}::"School" AND "paymentId" IS NOT NULL
      )
      ${timeFilter}
      ${cursorFilter}
      ORDER BY p."createdAt" DESC, p."id" DESC
      LIMIT ${limitPlusOne}
    `
  );

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;

  let nextCursor: string | null = null;
  if (hasMore) {
    const last = data[data.length - 1];
    nextCursor = Buffer.from(`${new Date(last.createdAt).toISOString()}|${last.id}`).toString("base64");
  }

  return {
    data: data.map(r => ({
      id: r.id,
      amount: Number(r.amount).toFixed(2),
      status: r.status,
      createdAt: new Date(r.createdAt).toISOString(),
      paidAt: r.paidAt ? new Date(r.paidAt).toISOString() : null,
      studentName: r.studentName,
      guestName: r.guestName,
    })),
    nextCursor,
    hasMore
  };
}
