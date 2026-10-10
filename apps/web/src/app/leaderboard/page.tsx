"use client";

import { useEffect, useState } from "react";
import { Award, Medal, Trophy } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { getLeaderboard, type LeaderboardEntry } from "@/lib/api";

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void getLeaderboard().then((result) => {
      if (active) setEntries(result);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Could not load leaderboard.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  return (
    <main className="min-h-screen bg-ink">
      <Topbar />
      <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
        <section className="mb-9 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent/10 text-accent">
            <Trophy size={23} />
          </span>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-accent">CodeAK rankings</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white">Leaderboard</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-gray-400">
            Earn points by solving challenges. Each challenge counts once, at its highest awarded difficulty value.
          </p>
          <p className="mt-3 text-xs text-gray-500">Easy: 10 points · Medium: 20 points · Hard: 30 points</p>
        </section>

        {error ? (
          <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-center text-sm text-red-300">{error}</p>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-panel/70">
            <div className="grid grid-cols-[64px_1fr_110px_110px] border-b border-white/[0.07] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500 sm:grid-cols-[80px_1fr_140px_140px]">
              <span>Rank</span><span>Codename</span><span className="text-right">Solved</span><span className="text-right">Points</span>
            </div>
            {loading ? (
              <div className="space-y-3 p-5">{[1, 2, 3].map((row) => <div key={row} className="h-14 animate-pulse rounded-lg bg-white/[0.035]" />)}</div>
            ) : entries.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-gray-500">No accounts to rank yet. Solve a challenge to get started.</p>
            ) : (
              <ol>
                {entries.map((entry) => (
                  <li key={`${entry.rank}-${entry.username}`} className="grid grid-cols-[64px_1fr_110px_110px] items-center border-b border-white/[0.055] px-5 py-4 last:border-0 sm:grid-cols-[80px_1fr_140px_140px]">
                    <span className="flex items-center gap-1.5 font-mono text-sm text-gray-400">
                      {entry.rank <= 3 ? <Medal size={15} className={entry.rank === 1 ? "text-amber-300" : entry.rank === 2 ? "text-gray-300" : "text-orange-300"} /> : `#${entry.rank}`}
                    </span>
                    <span className="truncate text-sm font-medium text-gray-200">{entry.username}</span>
                    <span className="text-right text-sm text-gray-400">{entry.solved_challenges.toLocaleString()}</span>
                    <span className="flex items-center justify-end gap-1.5 text-sm font-semibold text-accent">
                      {entry.rank === 1 && <Award size={14} />}
                      {entry.points.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
