"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { ArrowLeft, CheckCircle2, ChevronDown, CircleAlert, Clock3, Code2, GripVertical, LoaderCircle, MemoryStick, Play, Send, Terminal, XCircle } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { executeSubmission, getProblem } from "@/lib/api";
import type { ExecutionResult, Language, Problem, Verdict } from "@/lib/types";

const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });
const languageNames: Record<Language, string> = {
  python: "Python 3",
  cpp: "C++",
  java: "Java",
  javascript: "JavaScript"
};
const editorLanguage: Record<Language, string> = {
  python: "python",
  cpp: "cpp",
  java: "java",
  javascript: "javascript"
};
const fileExtensions: Record<Language, string> = { python: "py", cpp: "cpp", java: "java", javascript: "js" };

function StatusIcon({ status }: { status: Verdict }) {
  if (status === "Accepted" || status === "Executed") return <CheckCircle2 size={15} className="text-accent" />;
  if (status === "Wrong Answer" || status === "Compilation Error" || status === "Runtime Error" || status === "Time Limit Exceeded") return <XCircle size={15} className="text-red-400" />;
  return <CircleAlert size={15} className="text-amber-300" />;
}

function verdictColor(status: Verdict): string {
  if (status === "Accepted" || status === "Executed") return "text-accent";
  if (status === "Wrong Answer" || status === "Compilation Error" || status === "Runtime Error" || status === "Time Limit Exceeded") return "text-red-300";
  return "text-amber-300";
}

export default function ProblemPage() {
  const params = useParams<{ slug: string }>();
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [loadError, setLoadError] = useState("");
  const [language, setLanguage] = useState<Language>("python");
  const [drafts, setDrafts] = useState<Partial<Record<Language, string>>>({});
  const [source, setSource] = useState("");
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [requestError, setRequestError] = useState("");
  const [busy, setBusy] = useState<"sample" | "submit" | null>(null);
  const [consoleTab, setConsoleTab] = useState<"result" | "samples">("result");
  const [leftPane, setLeftPane] = useState(40);

  useEffect(() => {
    let active = true;
    void getProblem(params.slug).then((data) => {
      if (!active) return;
      setProblem(data);
      setSource(data.starter_code.python ?? "");
    }).catch((cause: unknown) => {
      if (active) setLoadError(cause instanceof Error ? cause.message : "Could not load problem.");
    });
    return () => { active = false; };
  }, [params.slug]);

  function changeLanguage(next: Language) {
    setDrafts((previous) => ({ ...previous, [language]: source }));
    setLanguage(next);
    setSource(drafts[next] ?? problem?.starter_code[next] ?? "");
    setResult(null);
  }

  function changeSource(value: string | undefined) {
    const next = value ?? "";
    setSource(next);
    setDrafts((previous) => ({ ...previous, [language]: next }));
  }

  function resizePane(event: PointerEvent<HTMLDivElement>) {
    if (event.buttons !== 1 || !workspaceRef.current) return;
    const bounds = workspaceRef.current.getBoundingClientRect();
    const next = ((event.clientX - bounds.left) / bounds.width) * 100;
    setLeftPane(Math.max(28, Math.min(62, next)));
  }

  function resizeFromKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    setLeftPane((value) => Math.max(28, Math.min(62, value + (event.key === "ArrowLeft" ? -2 : 2))));
  }

  async function execute(mode: "sample" | "submit") {
    if (!problem) return;
    setBusy(mode);
    setConsoleTab("result");
    setResult(null);
    setRequestError("");
    try {
      setResult(await executeSubmission(problem.id, source, language, mode));
    } catch (cause) {
      setRequestError(cause instanceof Error ? cause.message : "Execution failed.");
    } finally {
      setBusy(null);
    }
  }

  if (loadError) {
    return <main className="min-h-screen bg-ink"><Topbar /><div className="mx-auto max-w-xl px-6 py-24 text-center"><h1 className="text-2xl font-semibold text-white">{loadError}</h1><Link href="/" className="mt-5 inline-flex items-center gap-2 text-sm text-accent"><ArrowLeft size={15} /> Back to challenges</Link></div></main>;
  }

  if (!problem) return <main className="min-h-screen bg-ink"><Topbar /><div className="mx-auto mt-20 h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-accent" /></main>;

  return (
    <main className="flex min-h-screen flex-col bg-[#10141b]">
      <Topbar />
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" aria-label="Back to challenges" className="grid size-8 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-white/[0.06] hover:text-white"><ArrowLeft size={17} /></Link>
          <span className="h-4 w-px bg-white/10" />
          <span className="truncate text-sm font-medium text-gray-200">{problem.title}</span>
          <span className={`hidden rounded-md border px-2 py-1 text-[10px] font-medium sm:block ${problem.difficulty === "Easy" ? "border-accent/20 bg-accent/[0.06] text-accent" : problem.difficulty === "Medium" ? "border-amber-300/20 bg-amber-300/[0.06] text-amber-300" : "border-red-300/20 bg-red-300/[0.06] text-red-300"}`}>{problem.difficulty}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <label className="relative flex items-center gap-2 rounded-lg border border-white/[0.08] bg-panel px-2.5 py-2 text-xs text-gray-300">
            <Code2 size={14} className="text-accent" />
            <select aria-label="Programming language" value={language} onChange={(event) => changeLanguage(event.target.value as Language)} className="appearance-none bg-transparent pr-4 outline-none">
              {(Object.keys(languageNames) as Language[]).map((key) => <option key={key} value={key} className="bg-panel">{languageNames[key]}</option>)}
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute right-2 text-gray-500" />
          </label>
          <button disabled={busy !== null} onClick={() => void execute("sample")} className="flex items-center gap-1.5 rounded-lg border border-white/[0.1] px-3 py-2 text-xs font-medium text-gray-200 transition hover:border-white/20 hover:bg-white/[0.04] disabled:opacity-50"><Play size={13} /> <span className="hidden sm:inline">Run Sample Cases</span><span className="sm:hidden">Run</span></button>
          <button disabled={busy !== null} onClick={() => void execute("submit")} className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-ink transition hover:bg-[#cffb9d] disabled:opacity-50">{busy === "submit" ? <LoaderCircle size={13} className="animate-spin" /> : <Send size={13} />} <span className="hidden sm:inline">Submit Code</span><span className="sm:hidden">Submit</span></button>
        </div>
      </div>

      <div ref={workspaceRef} style={{ "--left-pane": `${leftPane}%` } as CSSProperties} className="grid flex-1 grid-cols-1 md:min-h-[calc(100vh-116px)] md:grid-cols-[minmax(0,var(--left-pane))_8px_minmax(0,1fr)]">
        <section className="scrollbar-thin max-h-[48vh] overflow-y-auto border-b border-white/[0.07] px-5 py-5 md:max-h-none md:border-b-0 md:border-r-0 md:px-7 md:py-7">
          <div className="mb-5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-accent"><span className="size-1.5 rounded-full bg-accent" /> {problem.category}</div>
          <h1 className="text-2xl font-semibold tracking-[-0.04em] text-white">{problem.title}</h1>
          <p className="mt-4 whitespace-pre-line text-[13px] leading-[1.8] text-gray-300">{problem.description}</p>
          <div className="mt-5 flex flex-wrap gap-2 text-[10px] text-gray-500">
            <span className="rounded-md border border-white/[0.08] px-2 py-1">Time limit: {problem.time_limit} ms</span>
            <span className="rounded-md border border-white/[0.08] px-2 py-1">Memory limit: {problem.memory_limit} MB</span>
          </div>
          <div className="mt-6 rounded-xl border border-white/[0.07] bg-panel/75 p-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">Input format</h2>
            <p className="mt-2 text-xs leading-5 text-gray-300">{problem.input_format}</p>
            <h2 className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">Output format</h2>
            <p className="mt-2 text-xs leading-5 text-gray-300">{problem.output_format}</p>
          </div>
          <div className="mt-6">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">Sample cases</h2>
            {problem.examples.map((example, index) => (
              <div key={index} className="mb-3 rounded-xl border border-white/[0.07] bg-panel/75 p-4">
                <p className="mb-3 text-[10px] text-gray-500">Example {index + 1}</p>
                <div className="grid grid-cols-[62px_1fr] gap-y-2.5 font-mono text-xs">
                  <span className="text-gray-500">Input</span><pre className="whitespace-pre-wrap text-gray-200">{example.input}</pre>
                  <span className="text-gray-500">Output</span><pre className="whitespace-pre-wrap text-accent">{example.output}</pre>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div
          role="separator"
          aria-label="Resize problem description panel"
          aria-orientation="vertical"
          aria-valuemin={28}
          aria-valuemax={62}
          aria-valuenow={Math.round(leftPane)}
          tabIndex={0}
          onKeyDown={resizeFromKeyboard}
          onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
          onPointerMove={resizePane}
          className="group hidden cursor-col-resize items-center justify-center bg-white/[0.035] outline-none hover:bg-accent/20 focus-visible:bg-accent/20 md:flex"
        ><GripVertical size={14} className="text-gray-600 group-hover:text-accent" /></div>

        <section className="flex min-h-[560px] min-w-0 flex-col md:min-h-0">
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/[0.07] px-4">
            <span className="flex items-center gap-2 text-[11px] text-gray-400"><Code2 size={14} className="text-gray-500" /> solution.{fileExtensions[language]}</span>
            <span className="text-[10px] text-gray-600">Sandboxed editor</span>
          </div>
          <div className="min-h-[280px] flex-1">
            <Editor
              height="100%"
              language={editorLanguage[language]}
              theme="vs-dark"
              value={source}
              onChange={changeSource}
              options={{
                automaticLayout: true,
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: "Consolas, 'Courier New', monospace",
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                padding: { top: 16, bottom: 16 },
                roundedSelection: false,
                renderLineHighlight: "line",
                guides: { indentation: true },
                wordWrap: "on",
                tabSize: language === "python" ? 4 : 2
              }}
            />
          </div>
          <div className="shrink-0 border-t border-white/[0.08] bg-[#141922]">
            <div className="flex h-10 items-center justify-between border-b border-white/[0.06] px-4">
              <div className="flex h-full items-center gap-4">
                <button onClick={() => setConsoleTab("result")} className={`flex h-full items-center gap-2 border-b text-[11px] font-medium ${consoleTab === "result" ? "border-accent text-gray-200" : "border-transparent text-gray-500 hover:text-gray-300"}`}><Terminal size={13} /> Result</button>
                <button onClick={() => setConsoleTab("samples")} className={`flex h-full items-center gap-2 border-b text-[11px] font-medium ${consoleTab === "samples" ? "border-accent text-gray-200" : "border-transparent text-gray-500 hover:text-gray-300"}`}>Sample cases</button>
              </div>
              {busy && <span className="flex items-center gap-1.5 text-[10px] text-gray-400"><LoaderCircle size={12} className="animate-spin text-accent" /> {busy === "sample" ? "Running sample cases..." : "Checking hidden tests..."}</span>}
            </div>
            <div className="h-[200px] overflow-y-auto px-4 py-3">
              {consoleTab === "samples" ? (
                problem.examples.length ? problem.examples.map((example, index) => (
                  <div key={index} className="mb-3 grid grid-cols-[72px_1fr] gap-2 text-[11px]">
                    <span className="text-gray-500">Example {index + 1}</span>
                    <pre className="whitespace-pre-wrap break-words font-mono text-gray-300">{example.input}</pre>
                  </div>
                )) : <p className="text-xs text-gray-500">No sample cases are configured.</p>
              ) : requestError ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300/15 bg-amber-300/[0.035] p-3 text-xs leading-5 text-amber-200"><CircleAlert size={15} className="mt-0.5 shrink-0" /><div>{requestError}{requestError.includes("Sign in") && <Link href="/auth" className="ml-1 underline underline-offset-2">Sign in</Link>}</div></div>
              ) : result ? (
                <div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    <div className={`flex items-center gap-2 text-sm font-semibold ${verdictColor(result.status)}`}><StatusIcon status={result.status} />{result.status}</div>
                    {typeof result.passed === "number" && <span className="text-[11px] text-gray-400">{result.mode === "sample" ? "Sample cases" : "Hidden tests"} <span className={result.status === "Accepted" ? "text-accent" : "text-gray-200"}>{result.passed} / {result.total}</span></span>}
                    {result.timeMs !== null && <span className="flex items-center gap-1 text-[11px] text-gray-500"><Clock3 size={12} /> Wall {result.timeMs} ms</span>}
                    <span className="flex items-center gap-1 text-[11px] text-gray-500" title="Piston does not expose per-run memory usage"><MemoryStick size={12} /> Memory not reported</span>
                  </div>
                  {result.message && <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-red-400/10 bg-red-400/[0.035] p-3 font-mono text-[11px] leading-5 text-red-200">{result.message}</pre>}
                  {result.sampleResults?.map((sample, index) => (
                    <div key={index} className="mt-3 rounded-lg border border-white/[0.07] bg-black/15 p-3">
                      <div className="flex items-center gap-2 text-xs font-medium"><StatusIcon status={sample.status} /><span className={verdictColor(sample.status)}>Sample {index + 1}: {sample.status === "Executed" ? "Output produced" : sample.status}</span></div>
                      <p className="mt-2 text-[10px] uppercase tracking-wider text-gray-600">Your output</p>
                      <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs leading-5 text-gray-200">{sample.stdout || "(no output)"}</pre>
                      {sample.status === "Wrong Answer" && <><p className="mt-2 text-[10px] uppercase tracking-wider text-gray-600">Expected</p><pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs leading-5 text-gray-400">{sample.expectedOutput}</pre></>}
                    </div>
                  ))}
                  {result.status === "Accepted" && <p className="mt-3 text-[10px] text-gray-600">{result.mode === "sample" ? "All sample cases passed." : "All hidden test cases passed."}</p>}
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-gray-600"><Terminal size={19} /><p className="text-xs">Run sample cases to see execution results.</p><p className="text-[10px]">Hidden cases are only available during submission.</p></div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
