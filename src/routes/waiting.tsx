import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Keeper } from "@/components/Keeper";
import { loadState, updatePerson, type Speaker } from "@/lib/keeper-state";

const SESSION_LIMIT = 2;
const searchSchema = z.object({ who: z.enum(["A", "B"]).catch("A") });

export const Route = createFileRoute("/waiting")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Waiting — Keeper" }] }),
  component: Waiting,
});

function Waiting() {
  const { who } = Route.useSearch();
  const other: Speaker = who === "A" ? "B" : "A";
  const navigate = useNavigate();

  const [selfName, setSelfName] = useState("");
  const [otherName, setOtherName] = useState("");
  const [sessionCount, setSessionCount] = useState(0);

  // hydrate + poll for the other person finishing
  useEffect(() => {
    const sync = () => {
      const s = loadState();
      setSelfName(s[who].name);
      setOtherName(s[other].name);
      setSessionCount(s[who].sessionCount ?? 0);
      if (s.A.done && s.B.done) {
        navigate({ to: "/summary", search: { who } });
      }
    };
    sync();
    const id = setInterval(sync, 1500);
    const onFocus = () => sync();
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onFocus);
    };
  }, [who, other, navigate]);

  const canReenter = sessionCount < SESSION_LIMIT;

  function reenter() {
    // Re-open the talk screen as the same person; talk.tsx will start a fresh
    // Tavus conversation, bump sessionCount, and append the new transcript.
    updatePerson(who, { done: false });
    navigate({ to: "/talk", search: { who } });
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg page-in text-center">
        <div className="flex justify-center">
          <Keeper mood="listening" size={140} />
        </div>

        <h1 className="mt-8 font-display text-3xl sm:text-4xl font-semibold">
          Waiting for {otherName || "the other person"}'s side
        </h1>
        <p className="mt-4 text-foreground/70 leading-relaxed">
          Thank you, {selfName || "friend"}. Keeper has what you shared.
          As soon as {otherName || "they"} finish their side, you'll see the summary together.
        </p>

        <div className="mt-3 flex justify-center gap-1.5 text-foreground/40">
          <span className="size-1.5 rounded-full bg-current animate-pulse" />
          <span className="size-1.5 rounded-full bg-current animate-pulse" style={{ animationDelay: "200ms" }} />
          <span className="size-1.5 rounded-full bg-current animate-pulse" style={{ animationDelay: "400ms" }} />
        </div>

        <div className="mt-10 rounded-3xl bg-card border border-border/60 px-6 py-6">
          {canReenter ? (
            <>
              <p className="text-sm text-foreground/75">
                Thought of something else you wanted Keeper to know?
              </p>
              <button
                onClick={reenter}
                className="mt-4 rounded-full bg-[color:var(--coral)] text-primary-foreground px-5 py-2.5 text-sm font-medium transition-transform hover:scale-[1.02]"
              >
                Talk to Keeper again
              </button>
              <p className="mt-3 text-[11px] text-foreground/40">
                {SESSION_LIMIT - sessionCount} re-entry left
              </p>
            </>
          ) : (
            <p className="text-sm text-foreground/60">
              You've used both of your sessions with Keeper. Hang tight while {otherName || "they"} finish up.
            </p>
          )}
        </div>

        <div className="mt-8">
          <Link to="/who" className="text-xs text-foreground/40 hover:text-foreground/70 transition-colors">
            ← back to who's talking
          </Link>
        </div>
      </div>
    </main>
  );
}
