"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Search, Users } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { getAdminDashboard, type AdminDashboard } from "@/lib/api";

export default function AdminPage() {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void getAdminDashboard(page).then((result) => {
      if (active) setDashboard(result);
    }).catch((cause: unknown) => {
      if (!active) return;
      const message = cause instanceof Error ? cause.message : "Could not load this page.";
      setError(message === "Not found." ? "This page is unavailable." : message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [page]);

  const visibleAccounts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return dashboard?.accounts ?? [];
    return (dashboard?.accounts ?? []).filter((account) =>
      [account.email, account.fullName, account.username, account.role].some((value) => value?.toLowerCase().includes(query))
    );
  }, [dashboard, search]);

  return (
    <div className="min-h-screen bg-ink text-white">
      <Topbar />
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        {error ? (
          <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        ) : (
          <>
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Overview</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Accounts &amp; activity</h1>
            </div>

            {dashboard && (
              <section aria-label="Site metrics" className="mb-8 grid gap-4 sm:grid-cols-3">
                <MetricCard icon={<Users size={18} />} label="Accounts" value={dashboard.metrics.totalUsers} />
                <MetricCard icon={<Eye size={18} />} label="Visits" value={dashboard.metrics.totalVisits} />
                <MetricCard icon={<Users size={18} />} label="Unique visitors" value={dashboard.metrics.uniqueVisitors} />
              </section>
            )}

            <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-panel">
              <div className="flex flex-col gap-4 border-b border-white/[0.07] p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold">User accounts</h2>
                  <p className="mt-1 text-xs text-gray-500">Full name, code name, email, role, and sign-in activity</p>
                </div>
                <label className="relative block sm:w-72">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search this page"
                    aria-label="Search user accounts"
                    className="w-full rounded-lg border border-white/10 bg-ink py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-accent/50"
                  />
                </label>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead className="bg-white/[0.025] text-[11px] uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-5 py-3 font-medium">Full name</th>
                      <th className="px-5 py-3 font-medium">Code name</th>
                      <th className="px-5 py-3 font-medium">Email</th>
                      <th className="px-5 py-3 font-medium">Role</th>
                      <th className="px-5 py-3 font-medium">Joined</th>
                      <th className="px-5 py-3 font-medium">Last sign-in</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {loading ? (
                      <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-500">Loading accounts…</td></tr>
                    ) : visibleAccounts.length === 0 ? (
                      <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-500">No accounts found on this page.</td></tr>
                    ) : visibleAccounts.map((account) => (
                      <tr key={account.id} className="hover:bg-white/[0.02]">
                        <td className="px-5 py-4 text-gray-300">{account.fullName ?? "—"}</td>
                        <td className="px-5 py-4 text-gray-300">{account.username ?? "—"}</td>
                        <td className="px-5 py-4 text-gray-200">{account.email ?? "—"}</td>
                        <td className="px-5 py-4">
                          <span className={account.role === "admin"
                            ? "rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent"
                            : "rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-gray-400"}>
                            {account.role}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-400">{formatDate(account.createdAt)}</td>
                        <td className="px-5 py-4 text-xs text-gray-400">{formatDate(account.lastSignInAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-white/[0.07] px-5 py-3">
                <span className="text-xs text-gray-500">Page {page}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page === 1 || loading}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-300 hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={14} /> Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((current) => current + 1)}
                    disabled={!dashboard?.hasMore || loading}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-300 hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-panel p-5">
      <div className="flex size-9 items-center justify-center rounded-xl bg-accent/10 text-accent">{icon}</div>
      <p className="mt-4 text-sm text-gray-400">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight">{value.toLocaleString()}</p>
    </article>
  );
}

function formatDate(value: string | null) {
  if (!value) return "Never";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Unknown";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(timestamp);
}
