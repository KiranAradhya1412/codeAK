"use client";

import Link from "next/link";
import { useState } from "react";
import { Code2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

export default function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const normalizedUsername = username.trim();
      const normalizedFullName = fullName.trim();
      if (mode === "signup" && (normalizedFullName.length < 2 || normalizedFullName.length > 100)) {
        throw new Error("Enter your full name (2–100 characters).");
      }
      if (mode === "signup" && !/^[a-zA-Z0-9_]{3,32}$/.test(normalizedUsername)) {
        throw new Error("Choose a codename with 3–32 letters, numbers, or underscores.");
      }
      if (mode === "signup" && normalizedUsername.toLowerCase() === "ak") {
        throw new Error("That keyword is reserved and cannot be used as a username.");
      }
      if (mode === "signup" && password.toLowerCase() === normalizedUsername.toLowerCase()) {
        throw new Error("Your password cannot match your username.");
      }
      const supabase = getSupabase();
      const result = mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: normalizedFullName, username: normalizedUsername } }
        });
      if (result.error) throw result.error;
      if (mode === "signup" && !result.data.session) {
        setMessage("Account created. Check your email to confirm your address, then sign in.");
      } else {
        const requestedPath = new URLSearchParams(window.location.search).get("next");
        const next = requestedPath?.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/";
        window.location.assign(next);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-ink lg:grid-cols-[1fr_0.9fr]">
      <section className="relative hidden overflow-hidden border-r border-white/[0.06] p-12 lg:flex lg:flex-col lg:justify-between xl:p-20">
        <div className="absolute -left-24 top-1/3 size-[450px] rounded-full bg-accent/[0.055] blur-[120px]" />
        <Link href="/" className="relative flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-accent text-ink"><Code2 size={19} /></span>
          <span className="text-[17px] font-semibold tracking-[-0.04em] text-white">codeAK<span className="text-accent">.</span></span>
        </Link>
        <div className="relative max-w-lg">
          <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Make today count</p>
          <h1 className="text-5xl font-semibold leading-[1.08] tracking-[-0.055em] text-white">Small steps.<br />Sharper thinking.</h1>
          <p className="mt-6 max-w-md text-sm leading-7 text-gray-400">Create your free account to run solutions in a secure sandbox and take on coding challenges at your own pace.</p>
        </div>
        <p className="relative text-xs text-gray-600">A good problem is an invitation to think differently.</p>
      </section>
      <section className="flex min-h-screen flex-col px-6 py-8 sm:px-10 lg:justify-center lg:px-16">
        <Link href="/auth" className="mb-12 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white lg:absolute lg:left-8 lg:top-8">codeAK sign in</Link>
        <div className="mx-auto w-full max-w-[380px]">
          <div className="mb-8 lg:hidden"><div className="mb-6 grid size-9 place-items-center rounded-xl bg-accent text-ink"><Code2 size={20} /></div><p className="text-2xl font-semibold tracking-tight text-white">Welcome to codeAK</p></div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-accent">{mode === "signin" ? "Your practice, your pace" : "Start your journey"}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-white">{mode === "signin" ? "Good to have you back." : "Create your account."}</h2>
          <p className="mt-2 text-sm text-gray-500">{mode === "signin" ? "Sign in to pick up where you left off." : "It's free. Let's get you coding."}</p>

          <form onSubmit={(event) => void submit(event)} className="mt-8 space-y-4">
            {mode === "signup" && (
              <>
                <label className="block text-xs font-medium text-gray-300">Full name
                  <input type="text" required minLength={2} maxLength={100} autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-2 w-full rounded-xl border border-white/[0.09] bg-panel px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-accent/60" placeholder="Your full name" />
                </label>
                <label className="block text-xs font-medium text-gray-300">Code name
                  <input type="text" required minLength={3} maxLength={32} autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} className="mt-2 w-full rounded-xl border border-white/[0.09] bg-panel px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-accent/60" placeholder="3–32 letters, numbers, or underscores" />
                  <span className="mt-1 block text-[11px] text-gray-500">Your code name appears on the leaderboard.</span>
                </label>
              </>
            )}
            <label className="block text-xs font-medium text-gray-300">Email address
              <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-white/[0.09] bg-panel px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-accent/60" placeholder="you@example.com" />
            </label>
            <label className="block text-xs font-medium text-gray-300">Password
              <input type="password" required minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-white/[0.09] bg-panel px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-accent/60" placeholder="At least 6 characters" />
            </label>
            {error && <p role="alert" className="rounded-lg border border-red-400/20 bg-red-400/[0.06] px-3 py-2.5 text-xs text-red-300">{error}</p>}
            {message && <p role="status" className="rounded-lg border border-accent/20 bg-accent/[0.06] px-3 py-2.5 text-xs text-accent">{message}</p>}
            <button disabled={busy} className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-ink transition hover:bg-[#cffb9d] disabled:cursor-not-allowed disabled:opacity-60">{busy ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}</button>
          </form>
          <p className="mt-6 text-center text-sm text-gray-500">
            {mode === "signin" ? "New to codeAK?" : "Already have an account?"}{" "}
            <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setMessage(""); }} className="font-medium text-accent hover:text-[#d2ffa0]">{mode === "signin" ? "Create an account" : "Sign in"}</button>
          </p>
          <p className="mt-9 text-center text-[11px] leading-5 text-gray-600">By continuing, you agree to use this platform responsibly. Your solutions run in isolated Piston sandboxes.</p>
        </div>
      </section>
    </main>
  );
}
