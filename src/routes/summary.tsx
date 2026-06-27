import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { Keeper } from "@/components/Keeper";
import { loadState, resetState, saveState, type Speaker } from "@/lib/keeper-state";
import { keeperSummary } from "@/lib/keeper-ai.functions";

const searchSchema = z.object({ who: z.enum(["A", "B"]).catch("B") });

export const Route = createFileRoute("/summary")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "What's worth knowing — Keeper" }] }),
  component: Summary,
});

function Summary() {
  const search = Route.useSearch();
  const who = search.who as Speaker;
  const other: Speaker = who === "A" ? "B" : "A";
  const generate = useServerFn(keeperSummary);

  const [names, setNames] = useState({ self: "Person B", other: "Person A" });
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const s = loadState();
      const selfState = s[who];
      const otherState = s[other];
      if (mounted) setNames({ self: selfState.name, other: otherState.name });

      // cache: re-use existing summary if it's for this reader and other person hasn't added turns
      if (s.summary && s.summary.for === who) {
        if (mounted) { setSummary(s.summary.text); setLoading(false); }
        return;
      }

      try {
        const text = await generate({
          data: {
            forName: selfState.name,
            aboutName: otherState.name,
            aboutTranscript: otherState.transcript ?? "",
            selfTranscript: selfState.transcript ?? "",
          },
        });

        if (!mounted) return;
        const next = { ...s, summary: { for: who, text } as const };
        saveState(next);
        setSummary(text);
      } catch (e) {
        console.error(e);
        if (mounted) setError("Keeper couldn't put it into words just now. Try again in a moment.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [who, other, generate]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl page-in">
        <div className="flex justify-center">
          <Keeper mood={loading ? "listening" : "warm"} size={150} />
        </div>

        <h1 className="mt-8 text-center font-display text-3xl sm:text-4xl font-semibold">
          Here's what's worth knowing
        </h1>
        <p className="mt-3 text-center text-sm text-foreground/55">
          for {names.self}, about {names.other}'s side
        </p>

        <div className="mt-8 rounded-3xl bg-card border border-border/60 px-6 sm:px-8 py-7 sm:py-8 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.25)]">
          {loading && (
            <div className="flex justify-center gap-1.5 text-foreground/40 py-4">
              <span className="size-1.5 rounded-full bg-current animate-pulse" />
              <span className="size-1.5 rounded-full bg-current animate-pulse" style={{ animationDelay: "200ms" }} />
              <span className="size-1.5 rounded-full bg-current animate-pulse" style={{ animationDelay: "400ms" }} />
            </div>
          )}
          {error && <p className="text-center text-sm text-foreground/70">{error}</p>}
          {summary && (
            <p className="text-[17px] leading-[1.7] text-foreground/85 whitespace-pre-wrap">
              {summary}
            </p>
          )}
        </div>

        <div className="mt-10 flex flex-col items-center gap-3">
          <Link
            to="/who"
            className="text-sm text-foreground/60 hover:text-foreground/90 transition-colors"
          >
            ← back to who's talking
          </Link>
          <button
            onClick={() => { resetState(); window.location.href = "/"; }}
            className="text-xs text-foreground/40 hover:text-foreground/70 transition-colors"
          >
            start a new conversation
          </button>
        </div>
      </div>
    </main>
  );
}
