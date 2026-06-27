import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { Keeper } from "@/components/Keeper";
import { loadState, updatePerson, type Speaker } from "@/lib/keeper-state";
import { startTavusConversation, endTavusConversation, getTavusTranscript } from "@/lib/tavus.functions";
import { ArrowLeft } from "lucide-react";

const searchSchema = z.object({ who: z.enum(["A", "B"]).catch("A") });

export const Route = createFileRoute("/talk")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Talking with Keeper" }] }),
  component: Talk,
});

function Talk() {
  const search = Route.useSearch();
  const who = search.who as Speaker;
  const navigate = useNavigate();
  const startFn = useServerFn(startTavusConversation);
  const endFn = useServerFn(endTavusConversation);
  const transcriptFn = useServerFn(getTavusTranscript);

  const [names, setNames] = useState<{ self: string; other: string }>({
    self: "Person A",
    other: "Person B",
  });
  const [status, setStatus] = useState<"loading" | "live" | "error" | "ending">("loading");
  const [error, setError] = useState<string | null>(null);
  const [conversationUrl, setConversationUrl] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const startedRef = useRef(false);

  // bootstrap names
  useEffect(() => {
    const s = loadState();
    const otherKey: Speaker = who === "A" ? "B" : "A";
    setNames({ self: s[who].name, other: s[otherKey].name });
  }, [who]);

  // start Tavus conversation once
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        const r = await startFn();
        conversationIdRef.current = r.conversation_id;
        setConversationUrl(r.conversation_url);
        setStatus("live");
      } catch (e) {
        console.error(e);
        const msg = e instanceof Error ? e.message : "Something went wrong.";
        setError(
          msg.includes("TAVUS_API_KEY")
            ? "Keeper isn't quite ready — the Tavus API key hasn't been added yet. Once it's in Project Settings → Secrets, this will work."
            : "We couldn't reach Keeper just now. Please try again in a moment.",
        );
        setStatus("error");
      }
    })();
    // best-effort cleanup if the user navigates away
    return () => {
      const id = conversationIdRef.current;
      if (id) {
        endFn({ data: { conversation_id: id } }).catch(() => {});
        conversationIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function done() {
    setStatus("ending");
    const id = conversationIdRef.current;
    conversationIdRef.current = null;
    if (id) {
      try {
        await endFn({ data: { conversation_id: id } });
      } catch (e) {
        console.error("end conversation failed", e);
      }
    }
    updatePerson(who, { done: true });
    const s = loadState();
    if (s.A.done && s.B.done) {
      navigate({ to: "/summary", search: { who } });
    } else {
      navigate({ to: "/who" });
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-6">
      <div className="w-full max-w-3xl flex items-center justify-between text-xs text-foreground/50">
        <Link to="/who" className="inline-flex items-center gap-1 hover:text-foreground/80 transition-colors">
          <ArrowLeft className="size-3.5" /> switch
        </Link>
        <span>
          talking as <span className="text-foreground/80">{names.self}</span>
        </span>
      </div>

      <div className="mt-6 w-full max-w-3xl relative rounded-3xl overflow-hidden bg-card border border-border/60 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.25)]" style={{ aspectRatio: "16 / 10" }}>
        {status === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <Keeper mood="listening" size={140} />
            <p className="text-sm text-foreground/60">Connecting to Keeper…</p>
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <Keeper mood="concerned" size={140} />
            <p className="text-sm text-foreground/75 max-w-md">{error}</p>
            <button
              onClick={() => {
                startedRef.current = false;
                setStatus("loading");
                setError(null);
                // re-trigger by toggling a microtask
                setTimeout(() => {
                  startedRef.current = true;
                  startFn()
                    .then((r) => {
                      conversationIdRef.current = r.conversation_id;
                      setConversationUrl(r.conversation_url);
                      setStatus("live");
                    })
                    .catch((e) => {
                      const msg = e instanceof Error ? e.message : "Something went wrong.";
                      setError(
                        msg.includes("TAVUS_API_KEY")
                          ? "Keeper isn't quite ready — the Tavus API key hasn't been added yet."
                          : "We couldn't reach Keeper just now. Please try again in a moment.",
                      );
                      setStatus("error");
                    });
                }, 50);
              }}
              className="rounded-full bg-primary text-primary-foreground px-5 py-2 text-sm"
            >
              Try again
            </button>
          </div>
        )}

        {status === "live" && conversationUrl && (
          <iframe
            src={conversationUrl}
            allow="camera; microphone; fullscreen; autoplay; display-capture"
            className="absolute inset-0 w-full h-full"
            title="Keeper video conversation"
          />
        )}

        {/* Companion Keeper blob — small, in the corner, always present */}
        {status === "live" && (
          <div className="absolute bottom-3 right-3 rounded-full bg-background/70 backdrop-blur-md p-1.5 shadow-lg pointer-events-none">
            <Keeper mood="listening" size={56} />
          </div>
        )}
      </div>

      <div className="mt-6 w-full max-w-3xl flex flex-col items-center gap-2">
        <button
          onClick={done}
          disabled={status === "loading" || status === "ending"}
          className="rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-50 transition-all hover:scale-[1.02]"
        >
          {status === "ending" ? "Wrapping up…" : "Done for now"}
        </button>
        <p className="text-center text-[11px] text-foreground/40">
          Nothing is shared with {names.other} until you're both done.
        </p>
      </div>
    </main>
  );
}
