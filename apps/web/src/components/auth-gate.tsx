"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { recordSiteVisit } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";

type AuthStatus = "checking" | "authenticated" | "configuration-error";

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [status, setStatus] = useState<AuthStatus>("checking");
  const recordedVisit = useRef("");

  useEffect(() => {
    if (pathname === "/auth") return;

    let active = true;
    try {
      const supabase = getSupabase();
      const recordVisit = (session: Session | null) => {
        if (!session) return;
        const today = new Date().toISOString().slice(0, 10);
        const visitKey = `${session.user.id}:${today}`;
        if (recordedVisit.current === visitKey) return;
        recordedVisit.current = visitKey;
        void recordSiteVisit(session.access_token).catch((error: unknown) => {
          console.error("Could not record site visit analytics.", error);
        });
      };

      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!active) return;
        if (session) {
          setStatus("authenticated");
          recordVisit(session);
          return;
        }
        setStatus("checking");
        const next = `${window.location.pathname}${window.location.search}`;
        router.replace(`/auth?next=${encodeURIComponent(next)}`);
      });

      void supabase.auth.getSession().then(({ data, error }) => {
        if (!active) return;
        if (error) throw error;
        if (data.session) {
          setStatus("authenticated");
          recordVisit(data.session);
          return;
        }
        const next = `${window.location.pathname}${window.location.search}`;
        router.replace(`/auth?next=${encodeURIComponent(next)}`);
      }).catch((error: unknown) => {
        if (!active) return;
        console.error("Could not verify the current session.", error);
        setStatus("configuration-error");
      });

      return () => {
        active = false;
        listener.subscription.unsubscribe();
      };
    } catch (error) {
      console.error("Supabase authentication is not configured.", error);
      setStatus("configuration-error");
    }
  }, [pathname, router]);

  if (pathname === "/auth") return children;
  if (status === "authenticated") return children;

  return (
    <main className="grid min-h-screen place-items-center bg-ink px-6 text-center">
      <div>
        <div className="mx-auto mb-4 size-8 animate-spin rounded-full border-2 border-gray-300 border-t-accent" />
        <p className="text-sm text-gray-500">
          {status === "configuration-error"
            ? "Sign-in is temporarily unavailable. Please try again later."
            : "Checking your sign-in..."}
        </p>
      </div>
    </main>
  );
}
