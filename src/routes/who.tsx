import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Keeper } from "@/components/Keeper";
import { loadState, saveState, resetState, type Speaker } from "@/lib/keeper-state";

export const Route = createFileRoute("/who")({
  head: () => ({ meta: [{ title: "Who's talking — Keeper" }] }),
  component: Who,
});

function Who() {
  const navigate = useNavigate();
  const [nameA, setNameA] = useState("Person A");
  const [nameB, setNameB] = useState("Person B");
  const [doneA, setDoneA] = useState(false);
  const [doneB, setDoneB] = useState(false);

  useEffect(() => {
    const s = loadState();
    setNameA(s.A.name);
    setNameB(s.B.name);
    setDoneA(s.A.done);
    setDoneB(s.B.done);
  }, []);

  function start(speaker: Speaker) {
    const s = loadState();
    s.A.name = nameA.trim() || "Person A";
    s.B.name = nameB.trim() || "Person B";
    saveState(s);
    navigate({ to: "/talk", search: { who: speaker } });
  }

  function startFresh() {
    resetState();
    setNameA("Person A");
    setNameB("Person B");
    setDoneA(false);
    setDoneB(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg page-in">
        <div className="flex justify-center">
          <Keeper mood="rest" size={140} />
        </div>
        <h1 className="mt-8 text-center font-display text-3xl sm:text-4xl font-semibold">
          Who's talking first?
        </h1>
        <p className="mt-4 text-center text-foreground/70 leading-relaxed">
          Keeper will listen to your side first. Nothing is shared until you're both done.
        </p>

        <div className="mt-10 grid gap-4">
          <PersonCard
            label="I'm"
            name={nameA}
            onName={setNameA}
            done={doneA}
            onStart={() => start("A")}
            accent="coral"
          />
          <PersonCard
            label="I'm"
            name={nameB}
            onName={setNameB}
            done={doneB}
            onStart={() => start("B")}
            accent="periwinkle"
            disabled={!doneA && !doneB ? false : false /* both selectable for demo */}
          />
        </div>

        {doneA && doneB && (
          <div className="mt-8 text-center">
            <Link
              to="/summary"
              search={{ who: "B" }}
              className="inline-flex rounded-full bg-accent px-6 py-3 text-sm text-accent-foreground"
            >
              See what Keeper shared
            </Link>
          </div>
        )}

        <div className="mt-10 text-center">
          <button
            onClick={startFresh}
            className="text-xs text-foreground/50 hover:text-foreground/80 transition-colors"
          >
            start over
          </button>
        </div>
      </div>
    </main>
  );
}

function PersonCard({
  label, name, onName, done, onStart, accent,
}: {
  label: string;
  name: string;
  onName: (v: string) => void;
  done: boolean;
  onStart: () => void;
  accent: "coral" | "periwinkle";
  disabled?: boolean;
}) {
  const ring = accent === "coral" ? "focus-within:ring-[color:var(--coral)]" : "focus-within:ring-[color:var(--periwinkle)]";
  const btn = accent === "coral"
    ? "bg-[color:var(--coral)] text-primary-foreground"
    : "bg-[color:var(--periwinkle)] text-accent-foreground";
  return (
    <div className={`rounded-3xl bg-card border border-border/60 p-5 sm:p-6 flex items-center gap-4 transition-shadow duration-500 ${ring} focus-within:ring-2 ring-offset-2 ring-offset-background`}>
      <div className="flex-1">
        <div className="text-xs uppercase tracking-wider text-foreground/50">{label}</div>
        <input
          value={name}
          onChange={(e) => onName(e.target.value)}
          className="mt-1 w-full bg-transparent text-lg font-display font-medium outline-none"
          aria-label="Your name"
        />
        {done && <div className="mt-1 text-xs text-foreground/50">already talked to Keeper</div>}
      </div>
      <button
        onClick={onStart}
        className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-500 hover:scale-[1.03] ${btn}`}
      >
        {done ? "talk again" : "start"}
      </button>
    </div>
  );
}
