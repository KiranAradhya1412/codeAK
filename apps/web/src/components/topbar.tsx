"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Code2, LogOut, UserRound } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

export function Topbar() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    const supabase = getSupabase();
    void supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setEmail(session?.user.email ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await getSupabase().auth.signOut();
    setEmail(null);
  }

  return (
    <header className="border-b border-white/[0.07] bg-[#11151d]">
      <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between px-6 lg:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-accent text-ink"><Code2 size={19} strokeWidth={2.5} /></span>
          <span className="text-[17px] font-semibold tracking-[-0.04em] text-white">codeAK<span className="text-accent">.</span></span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted sm:block">{email ?? ""}</span>
          {email ? (
            <button onClick={() => void signOut()} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-300 transition hover:border-white/20 hover:text-white">
              <LogOut size={15} /> <span className="hidden sm:inline">Sign out</span>
            </button>
          ) : (
            <Link href="/auth" className="flex items-center gap-2 rounded-lg border border-white/10 px-3.5 py-2 text-sm font-medium text-gray-200 transition hover:border-accent/50 hover:text-accent">
              <UserRound size={15} /> Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
