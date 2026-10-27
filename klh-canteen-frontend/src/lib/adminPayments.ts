import { apiClient } from "./apiClient";

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
  trendData: { date: string; totalPayments: number; commission: number; }[];
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

export interface PaginatedAdminPayments {
  data: AdminPaymentRow[];
  nextCursor: string | null;
  hasMore: boolean;
}

export async function getAdminPaymentStats(token: string): Promise<AdminPaymentStats> {
  return apiClient.request<AdminPaymentStats>("GET", "/admin/payments/stats", { token });
}

export async function getAdminPaymentsList(
  token: string,
  options: { cursor?: string; limit?: number; isToday?: boolean } = {}
): Promise<PaginatedAdminPayments> {
  const query = new URLSearchParams();
  if (options.cursor) query.set("cursor", options.cursor);
  if (options.limit) query.set("limit", options.limit.toString());
  if (options.isToday) query.set("isToday", "true");

  return apiClient.request<PaginatedAdminPayments>("GET", `/admin/payments?${query.toString()}`, { token });
}

export interface PendingPayoutStats {
  totalAmount: string;
  totalCommission: string;
  count: number;
}

export interface PayoutLog {
  id: string;
  amount: string;
  commissionAmount: string;
  createdAt: string;
  createdByAdminName: string;
}

export async function getPendingPayoutStats(token: string): Promise<PendingPayoutStats> {
  return apiClient.request<PendingPayoutStats>("GET", "/admin/payments/payouts/pending", { token });
}

export async function createPayout(token: string): Promise<{ success: boolean }> {
  return apiClient.request<{ success: boolean }>("POST", "/admin/payments/payouts", { token });
}

export async function getPayoutLogs(token: string): Promise<PayoutLog[]> {
  return apiClient.request<PayoutLog[]>("GET", "/admin/payments/payouts/logs", { token });
}
