import { useEffect, useState } from "react";
import { AdminNav } from "../../components/AdminNav";
import { useAuth } from "../../context/AuthContext";
import {
  getAdminPaymentStats,
  getAdminPaymentsList,
  getPendingPayoutStats,
  createPayout,
  getPayoutLogs,
} from "../../lib/adminPayments";
import type {
  AdminPaymentStats,
  AdminPaymentRow,
  PendingPayoutStats,
  PayoutLog,
} from "../../lib/adminPayments";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Users,
  ShoppingBag,
  Banknote,
  Wallet,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

function StatCard({
  title,
  value,
  trend,
  icon: Icon,
  valuePrefix = "",
}: {
  title: string;
  value: string | number;
  trend: number;
  icon: any;
  valuePrefix?: string;
}) {
  const isPositive = trend >= 0;
  return (
    <div className="bg-white rounded-3xl p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100/50 flex flex-col justify-between hover:shadow-lg transition-all duration-300">
      <div className="flex justify-between items-start mb-6">
        <div className="p-3 bg-brand-50 rounded-2xl">
          <Icon className="w-6 h-6 text-brand-600" />
        </div>
        <div
          className={`flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold ${
            isPositive
              ? "bg-emerald-50 text-emerald-600"
              : "bg-rose-50 text-rose-600"
          }`}
        >
          {isPositive ? (
            <TrendingUp className="w-3.5 h-3.5" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5" />
          )}
          <span>{Math.abs(trend)}% vs last period</span>
        </div>
      </div>
      <div>
        <div className="text-sm font-medium text-gray-500 mb-1">{title}</div>
        <div className="text-3xl font-bold text-gray-900 tracking-tight">
          {valuePrefix}
          {value}
        </div>
      </div>
    </div>
  );
}

export function AdminPaymentsPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState<AdminPaymentStats | null>(null);
  const [logs, setLogs] = useState<AdminPaymentRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [filterToday, setFilterToday] = useState(false); // default to all time for better visual demo
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Payout states
  const [activeTab, setActiveTab] = useState<"recent" | "payouts">("recent");
  const [payoutLogs, setPayoutLogs] = useState<PayoutLog[]>([]);
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [pendingStats, setPendingStats] = useState<PendingPayoutStats | null>(null);
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    if (!token) return;

    let mounted = true;

    async function loadInitial() {
      try {
        setLoading(true);
        const [statsData, logsData, payoutLogsData] = await Promise.all([
          getAdminPaymentStats(token!),
          getAdminPaymentsList(token!, { limit: 10, isToday: filterToday }),
          getPayoutLogs(token!),
        ]);

        if (mounted) {
          setStats(statsData);
          setLogs(logsData.data);
          setNextCursor(logsData.nextCursor);
          setHasMore(logsData.hasMore);
          setPayoutLogs(payoutLogsData);
        }
      } catch (err) {
        console.error("Failed to load payment dashboard", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadInitial();
    return () => {
      mounted = false;
    };
  }, [token, filterToday]);

  async function handleOpenPayoutModal() {
    setIsPayoutModalOpen(true);
    setPendingStats(null);
    try {
      const stats = await getPendingPayoutStats(token!);
      setPendingStats(stats);
    } catch (err) {
      console.error("Failed to load pending stats", err);
    }
  }

  async function handleConfirmPayout() {
    try {
      setSettling(true);
      await createPayout(token!);
      setIsPayoutModalOpen(false);
      // Refresh data
      const [statsData, logsData, payoutLogsData] = await Promise.all([
        getAdminPaymentStats(token!),
        getAdminPaymentsList(token!, { limit: 10, isToday: filterToday }),
        getPayoutLogs(token!)
      ]);
      setStats(statsData);
      setLogs(logsData.data);
      setNextCursor(logsData.nextCursor);
      setHasMore(logsData.hasMore);
      setPayoutLogs(payoutLogsData);
    } catch (err) {
      console.error("Failed to confirm payout", err);
    } finally {
      setSettling(false);
    }
  }

  async function handleLoadMore() {
    if (!token || !nextCursor || loadingMore) return;
    try {
      setLoadingMore(true);
      const res = await getAdminPaymentsList(token, {
        cursor: nextCursor,
        limit: 10,
        isToday: filterToday,
      });
      setLogs((prev) => [...prev, ...res.data]);
      setNextCursor(res.nextCursor);
      setHasMore(res.hasMore);
    } catch (err) {
      console.error("Failed to load more logs", err);
    } finally {
      setLoadingMore(false);
    }
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-gray-100/50">
          <p className="text-sm font-medium text-gray-500 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center space-x-2 text-sm font-bold mt-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-900">
                {entry.name}: ₹{entry.value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-32">
      <AdminNav />
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              Payments Dashboard
            </h1>
            <p className="text-gray-500 mt-1.5 font-medium">
              Monitor your digital transactions, commissions, and overall growth.
            </p>
          </div>
          <button
            onClick={handleOpenPayoutModal}
            className="flex items-center space-x-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-md hover:shadow-lg active:scale-95"
          >
            <Banknote className="w-5 h-5" />
            <span>Settle Payout</span>
          </button>
        </div>

        {loading && !stats ? (
          <div className="flex justify-center p-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
          </div>
        ) : (
          <>
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                  title="Total Payments"
                  value={stats.thisMonthTotal}
                  trend={stats.trendPayments || 0}
                  icon={Wallet}
                  valuePrefix="₹"
                />
                <StatCard
                  title={`Commission (${stats.commissionPercent}%)`}
                  value={stats.commission}
                  trend={stats.trendCommission || 0}
                  icon={Banknote}
                  valuePrefix="₹"
                />
                <StatCard
                  title="Total Orders"
                  value={stats.totalOrders || 0}
                  trend={stats.trendOrders || 0}
                  icon={ShoppingBag}
                />
                <StatCard
                  title="Unique Customers"
                  value={stats.uniqueCustomers || 0}
                  trend={stats.trendCustomers || 0}
                  icon={Users}
                />
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mt-8">
              {/* Chart Section */}
              <div className="xl:col-span-2 bg-white rounded-[2rem] p-6 lg:p-8 shadow-[0_2px_20px_-4px_rgba(0,0,0,0.02)] border border-gray-100/50">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xl font-bold text-gray-900 tracking-tight">
                    Revenue Overview
                  </h3>
                </div>
                <div className="h-[400px] w-full">
                  {stats?.trendData && stats.trendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={stats.trendData}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="colorPayments"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#0284c7"
                              stopOpacity={0.2}
                            />
                            <stop
                              offset="95%"
                              stopColor="#0284c7"
                              stopOpacity={0}
                            />
                          </linearGradient>
                          <linearGradient
                            id="colorCommission"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#10b981"
                              stopOpacity={0.2}
                            />
                            <stop
                              offset="95%"
                              stopColor="#10b981"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#E2E8F0"
                        />
                        <XAxis
                          dataKey="date"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#64748b", fontSize: 12 }}
                          dy={10}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#64748b", fontSize: 12 }}
                          dx={-10}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                          verticalAlign="top"
                          height={36}
                          iconType="circle"
                          wrapperStyle={{
                            fontSize: "13px",
                            fontWeight: 500,
                            color: "#475569",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="totalPayments"
                          name="Total Payments"
                          stroke="#0284c7"
                          strokeWidth={3}
                          fillOpacity={1}
                          fill="url(#colorPayments)"
                          activeDot={{ r: 6, strokeWidth: 0, fill: "#0284c7" }}
                        />
                        <Area
                          type="monotone"
                          dataKey="commission"
                          name="Commission"
                          stroke="#10b981"
                          strokeWidth={3}
                          fillOpacity={1}
                          fill="url(#colorCommission)"
                          activeDot={{ r: 6, strokeWidth: 0, fill: "#10b981" }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400 font-medium">
                      No trend data available
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Payments Section */}
              <div className="bg-white rounded-[2rem] shadow-[0_2px_20px_-4px_rgba(0,0,0,0.02)] border border-gray-100/50 flex flex-col overflow-hidden">
                <div className="p-6 lg:p-8 border-b border-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex space-x-6">
                    <button
                      onClick={() => setActiveTab("recent")}
                      className={`text-xl font-bold tracking-tight transition-colors ${activeTab === 'recent' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      Recent Payments
                    </button>
                    <button
                      onClick={() => setActiveTab("payouts")}
                      className={`text-xl font-bold tracking-tight transition-colors ${activeTab === 'payouts' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      Payout Logs
                    </button>
                  </div>
                  {activeTab === "recent" && (
                    <div className="bg-gray-100/80 p-1 rounded-xl flex">
                      <button
                      onClick={() => setFilterToday(true)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        filterToday
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      Today
                    </button>
                    <button
                      onClick={() => setFilterToday(false)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        !filterToday
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      All Time
                    </button>
                  </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto min-h-[400px] max-h-[600px] p-2">
                  {activeTab === "recent" ? (
                    <>
                      {loading && logs.length === 0 ? (
                        <div className="p-12 text-center text-gray-400">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto mb-4"></div>
                      Loading logs...
                    </div>
                  ) : logs.length === 0 ? (
                    <div className="p-12 text-center text-gray-400 flex flex-col items-center">
                      <Banknote className="w-12 h-12 mb-3 text-gray-200" />
                      No payments found.
                    </div>
                  ) : (
                    <ul className="space-y-2 p-2">
                      {logs.map((log) => (
                        <li
                          key={log.id}
                          className="p-4 rounded-2xl hover:bg-gray-50 transition-colors flex items-center justify-between group"
                        >
                          <div className="flex items-center space-x-4">
                            <div
                              className={`p-2.5 rounded-full ${
                                log.status === "SUCCESS"
                                  ? "bg-emerald-50 text-emerald-600"
                                  : log.status === "FAILED"
                                  ? "bg-rose-50 text-rose-600"
                                  : "bg-amber-50 text-amber-600"
                              }`}
                            >
                              {log.status === "SUCCESS" ? (
                                <CheckCircle2 className="w-5 h-5" />
                              ) : log.status === "FAILED" ? (
                                <XCircle className="w-5 h-5" />
                              ) : (
                                <Clock className="w-5 h-5" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900">
                                {log.studentName || log.guestName || "Unknown"}
                              </p>
                              <div className="text-xs font-medium text-gray-500 mt-0.5 flex items-center space-x-2">
                                <span>
                                  {new Date(log.createdAt).toLocaleDateString(
                                    undefined,
                                    { month: "short", day: "numeric" }
                                  )}
                                </span>
                                <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                <span>
                                  {new Date(log.createdAt).toLocaleTimeString(
                                    undefined,
                                    { hour: "numeric", minute: "2-digit" }
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-gray-900">
                              ₹{log.amount}
                            </p>
                            {log.guestName && (
                              <p className="text-[10px] font-bold text-brand-600 uppercase tracking-wider mt-1">
                                Guest
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                      {hasMore && !loading && (
                        <div className="p-4 flex justify-center">
                          <button
                            onClick={handleLoadMore}
                            disabled={loadingMore}
                            className="px-6 py-2.5 text-sm font-bold text-brand-700 bg-brand-50 rounded-xl hover:bg-brand-100 transition-colors disabled:opacity-50"
                          >
                            {loadingMore ? "Loading..." : "Load More"}
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    loading && payoutLogs.length === 0 ? (
                      <div className="p-12 text-center text-gray-400">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto mb-4"></div>
                        Loading logs...
                      </div>
                    ) : payoutLogs.length === 0 ? (
                      <div className="p-12 text-center text-gray-400 flex flex-col items-center">
                        <Banknote className="w-12 h-12 mb-3 text-gray-200" />
                        No payout logs found.
                      </div>
                    ) : (
                      <ul className="space-y-2 p-2">
                        {payoutLogs.map((log) => (
                          <li
                            key={log.id}
                            className="p-4 rounded-2xl hover:bg-gray-50 transition-colors flex items-center justify-between group"
                          >
                            <div className="flex items-center space-x-4">
                              <div className="p-2.5 rounded-full bg-brand-50 text-brand-600">
                                <CheckCircle2 className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-gray-900">
                                  {log.createdByAdminName || "Admin"}
                                </p>
                                <div className="text-xs font-medium text-gray-500 mt-0.5 flex items-center space-x-2">
                                  <span>
                                    {new Date(log.createdAt).toLocaleDateString(
                                      undefined,
                                      { month: "short", day: "numeric", year: "numeric" }
                                    )}
                                  </span>
                                  <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                  <span>
                                    {new Date(log.createdAt).toLocaleTimeString(
                                      undefined,
                                      { hour: "numeric", minute: "2-digit" }
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-gray-900">
                                ₹{log.amount} Settled
                              </p>
                              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mt-1">
                                ₹{log.commissionAmount} Commission
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Payout Modal */}
      {isPayoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Settle Payout</h2>
            <p className="text-gray-500 text-sm mb-6">Review the pending amounts before confirming.</p>
            
            {!pendingStats ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-2xl p-4 flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Total Amount to Settle</span>
                  <span className="text-lg font-bold text-gray-900">₹{pendingStats.totalAmount}</span>
                </div>
                <div className="bg-emerald-50 rounded-2xl p-4 flex justify-between items-center">
                  <span className="text-sm font-medium text-emerald-700">Commission</span>
                  <span className="text-lg font-bold text-emerald-700">₹{pendingStats.totalCommission}</span>
                </div>
                <div className="bg-gray-50 rounded-2xl p-4 flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Pending Payments</span>
                  <span className="text-lg font-bold text-gray-900">{pendingStats.count}</span>
                </div>

                <div className="flex space-x-3 mt-8">
                  <button
                    onClick={() => setIsPayoutModalOpen(false)}
                    className="flex-1 px-4 py-3 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmPayout}
                    disabled={settling || pendingStats.count === 0}
                    className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-brand-600 hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                  >
                    {settling ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      "Confirm Payout"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
