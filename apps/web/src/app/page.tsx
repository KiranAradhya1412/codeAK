"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Check, ChevronRight, Code2, Search, Sparkles } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { getSolvedProblemIds, listProblems } from "@/lib/api";
import type { Difficulty, Problem } from "@/lib/types";

const difficultyStyle: Record<Difficulty, string> = {
  Easy: "text-[#a9e96e]",
  Medium: "text-[#f3bf69]",
  Hard: "text-[#f07f84]"
};

export default function HomePage() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [solvedProblemIds, setSolvedProblemIds] = useState<string[]>([]);
  const [statusError, setStatusError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  async function loadProblems() {
    setLoading(true);
    setError("");
    setStatusError("");
    try {
      const [problemList, solvedIds] = await Promise.all([
        listProblems(),
        getSolvedProblemIds().catch((cause: unknown) => {
          setStatusError(cause instanceof Error ? cause.message : "Submission status is unavailable.");
          return [];
        })
      ]);
      setProblems(problemList);
      setSolvedProblemIds(solvedIds);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load problems.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadProblems(); }, []);

  const filtered = problems.filter((problem) => {
    const matchesSearch = `${problem.title} ${problem.category}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (filter === "All" || problem.difficulty === filter);
  });
  const easyCount = problems.filter((problem) => problem.difficulty === "Easy").length;

  return (
    <main className="min-h-screen bg-ink">
      <Topbar />
      <div className="mx-auto max-w-[1440px] px-6 pb-20 lg:px-10">
        <section className="relative overflow-hidden pb-12 pt-16 md:pb-16 md:pt-24">
          <div className="pointer-events-none absolute -right-10 -top-8 size-[400px] rounded-full bg-accent/[0.055] blur-[100px]" />
          <div className="relative max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/[0.07] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
              <Sparkles size={13} /> Your next breakthrough starts here
            </div>
            <h1 className="text-4xl font-semibold leading-[1.1] tracking-[-0.055em] text-white md:text-[60px]">
              Practice with purpose.<br /><span className="text-gray-500">Build your edge.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-7 text-gray-400 md:text-base">
              A focused space to sharpen your problem-solving skills. Pick a challenge, write your solution, and see how far you can go.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3 text-xs text-gray-400">
              <span className="flex items-center gap-2"><Code2 size={15} className="text-accent" /> Python, JavaScript, Java &amp; C++</span>
              <span className="flex items-center gap-2"><Check size={15} className="text-accent" /> Sandboxed execution</span>
              <span className="flex items-center gap-2"><Sparkles size={14} className="text-accent" /> Instant feedback</span>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">The practice set</p>
              <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white">Choose your challenge</h2>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-panel px-3 py-2.5">
              <Search size={15} className="text-gray-500" />
              <input aria-label="Search challenges" className="w-40 bg-transparent text-sm text-gray-200 outline-none placeholder:text-gray-600" placeholder="Find a challenge..." value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
          </div>

          <div className="mb-4 flex items-center gap-2">
            {["All", "Easy", "Medium", "Hard"].map((item) => (
              <button key={item} onClick={() => setFilter(item)} className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${filter === item ? "bg-accent text-ink" : "border border-white/[0.08] text-gray-400 hover:border-white/20 hover:text-white"}`}>
                {item}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-panel/70">
            <div className="hidden grid-cols-[1fr_120px_130px_110px_36px] items-center border-b border-white/[0.07] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500 md:grid">
              <span>Challenge</span><span>Difficulty</span><span>Topic</span><span>Status</span><span />
            </div>
            {loading ? (
              <div className="space-y-3 p-5">{[1, 2, 3].map((key) => <div key={key} className="h-[62px] animate-pulse rounded-lg bg-white/[0.035]" />)}</div>
            ) : error ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm text-gray-300">{error}</p>
                <p className="mt-2 text-xs text-gray-500">Check that the API is running and your Supabase environment is configured.</p>
                <button onClick={() => void loadProblems()} className="mt-4 rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-200 hover:border-accent/50">Try again</button>
              </div>
            ) : filtered.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-gray-500">No challenges match your search.</p>
            ) : filtered.map((problem, index) => (
              <Link key={problem.id} href={`/problems/${problem.slug}`} className="group grid gap-2 border-b border-white/[0.055] px-5 py-4 transition last:border-0 hover:bg-white/[0.025] md:grid-cols-[1fr_120px_130px_110px_36px] md:items-center">
                <span className="flex items-center gap-3">
                  <span className="font-mono text-xs text-gray-600">{String(index + 1).padStart(2, "0")}</span>
                  <span className="text-sm font-medium text-gray-200 transition group-hover:text-white">{problem.title}</span>
                </span>
                <span className={`pl-7 text-xs font-medium md:pl-0 ${difficultyStyle[problem.difficulty]}`}>{problem.difficulty}</span>
                <span className="pl-7 text-xs text-gray-500 md:pl-0">{problem.category}</span>
                <span className={`pl-7 text-xs md:pl-0 ${solvedProblemIds.includes(problem.id) ? "font-medium text-accent" : "text-gray-600"}`}>
                  {solvedProblemIds.includes(problem.id) ? "Solved" : statusError ? "Unavailable" : "Not solved"}
                </span>
                <span className="hidden text-gray-600 transition group-hover:translate-x-0.5 group-hover:text-accent md:block"><ChevronRight size={17} /></span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-12 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/[0.07] bg-panel/60 p-5">
            <div className="mb-5 flex items-center justify-between"><span className="text-xs text-gray-500">Practice set</span><ArrowUpRight size={16} className="text-accent" /></div>
            <div className="text-3xl font-semibold tracking-tight text-white">{problems.length || "—"}</div>
            <p className="mt-2 text-xs text-gray-500">Challenges ready to explore</p>
            <div className="mt-4 flex items-center gap-2 text-[11px] text-gray-500"><span className="size-1.5 rounded-full bg-accent" />{easyCount} beginner-friendly challenges</div>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-panel/60 p-5 sm:col-span-2">
            <div className="mb-4 flex items-center gap-2 text-xs text-gray-500"><Sparkles size={14} className="text-accent" /> A note to keep you going</div>
            <p className="max-w-2xl text-sm leading-6 text-gray-300">Getting stuck is part of getting better. Take a breath, break the problem into smaller pieces, and give it another go.</p>
            <Link href={problems[0] ? `/problems/${problems[0].slug}` : "/"} className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-accent hover:text-[#d2ffa0]">Start practicing <ArrowDownRight size={14} /></Link>
          </div>
        </section>
        <footer className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-6 text-[11px] text-gray-600">
          <span>codeAK · Learn by doing</span><span>Code execution powered by isolated Piston sandboxes</span>
        </footer>
      </div>
    </main>
  );
}
