import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { Keeper, useSmoothMood, type KeeperMood } from "@/components/Keeper";
import { appendTurn, loadState, updatePerson, type KeeperTurn, type Speaker } from "@/lib/keeper-state";
import { keeperReply } from "@/lib/keeper-ai.functions";
import { Mic, Send, ArrowLeft } from "lucide-react";

const searchSchema = z.object({ who: z.enum(["A", "B"]).catch("A") });

export const Route = createFileRoute("/talk")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Talking with Keeper" }] }),
  component: Talk,
});

const OPENERS: Record<Speaker, string> = {
  A: "Take your time. What's on your mind about them?",
  B: "Whenever you're ready — what happened from your side?",
};

function Talk() {
  const { who } = Route.useSearch();
  const navigate = useNavigate();
  const reply = useServerFn(keeperReply);

  const [names, setNames] = useState<{ self: string; other: string }>({ self: "Person A", other: "Person B" });
  const [turns, setTurns] = useState<KeeperTurn[]>([]);
  const [enough, setEnough] = useState(false);
  const [tone, setTone] = useState<"calm" | "hurt" | "warm">("calm");
  const [thinking, setThinking] = useState(false);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // bootstrap from localStorage
  useEffect(() => {
    const s = loadState();
    const self = s[who];
    const otherKey: Speaker = who === "A" ? "B" : "A";
    setNames({ self: self.name, other: s[otherKey].name });
    setTurns(self.turns);
    setEnough(self.done);
    // seed an opening Keeper line if empty
    if (self.turns.length === 0) {
      const opener: KeeperTurn = { role: "keeper", text: OPENERS[who], ts: Date.now() };
      const next = appendTurn(who, opener);
      setTurns(next[who].turns);
    }
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [who]);

  // smooth mood transitions
  const targetMood: KeeperMood = thinking
    ? "listening"
    : tone === "hurt"
      ? "concerned"
      : tone === "warm"
        ? "warm"
        : turns.length > 1 ? "listening" : "rest";
  const mood = useSmoothMood(targetMood, 350);

  // autoscroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, thinking]);

  // === voice input via Web Speech API
  const recogRef = useRef<unknown>(null);
  const toggleVoice = useCallback(() => {
    const SR = (typeof window !== "undefined") && ((window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);
    if (!SR) {
      alert("Voice input isn't supported in this browser — try Chrome or Edge.");
      return;
    }
    if (listening) {
      try { (recogRef.current as { stop?: () => void } | null)?.stop?.(); } catch { /* */ }
      setListening(false);
      return;
    }
    const Ctor = SR as new () => {
      lang: string; interimResults: boolean; continuous: boolean;
      onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
      onerror: () => void; onend: () => void; start: () => void; stop: () => void;
    };
    const r = new Ctor();
    r.lang = "en-US";
    r.interimResults = true;
    r.continuous = true;
    let buffer = "";
    r.onresult = (e) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i] as ArrayLike<{ transcript: string }> & { isFinal?: boolean; 0: { transcript: string } };
        const txt = res[0].transcript;
        if ((res as { isFinal?: boolean }).isFinal) final += txt;
        else interim += txt;
      }
      buffer = (final || buffer);
      setInput((final ? buffer : buffer + interim).trim());
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    recogRef.current = r;
    r.start();
    setListening(true);
  }, [listening]);

  async function send() {
    const text = input.trim();
    if (!text || thinking) return;
    // optimistic user turn (tag added after AI response)
    const optimistic: KeeperTurn = { role: "user", text, ts: Date.now() };
    const after = appendTurn(who, optimistic);
    setTurns(after[who].turns);
    setInput("");
    if (listening) toggleVoice();
    setThinking(true);

    try {
      const result = await reply({
        data: {
          personName: names.self,
          otherName: names.other,
          turns: after[who].turns.slice(0, -1).map((t) => ({ role: t.role, text: t.text })),
          latest: text,
        },
      });
      // mutate the just-added turn with tags
      const s = loadState();
      const last = s[who].turns[s[who].turns.length - 1];
      if (last) {
        last.tag = result.tag;
        last.note = result.note;
        last.tone = result.tone === "calm" ? "calm" : result.tone === "warm" ? "warm" : "hurt";
      }
      // append keeper reply
      s[who].turns.push({ role: "keeper", text: result.reply, ts: Date.now() });
      if (result.enough) s[who].done = true; // soft signal, doesn't end conversation
      setTurns([...s[who].turns]);
      setTone(result.tone);
      setEnough((prev) => prev || result.enough);
      // persist
      updatePerson(who, { turns: s[who].turns, done: s[who].done });
    } catch (e) {
      console.error(e);
      const s = loadState();
      s[who].turns.push({ role: "keeper", text: "I'm having trouble hearing you for a moment — could you say that again?", ts: Date.now() });
      setTurns([...s[who].turns]);
      updatePerson(who, { turns: s[who].turns });
    } finally {
      setThinking(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function done() {
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
      <div className="w-full max-w-xl flex items-center justify-between text-xs text-foreground/50">
        <Link to="/who" className="inline-flex items-center gap-1 hover:text-foreground/80 transition-colors">
          <ArrowLeft className="size-3.5" /> switch
        </Link>
        <span>talking as <span className="text-foreground/80">{names.self}</span></span>
      </div>

      <div className="mt-4 flex justify-center">
        <Keeper mood={mood} size={180} />
      </div>

      <div
        ref={scrollRef}
        className="mt-6 w-full max-w-xl flex-1 max-h-[42vh] overflow-y-auto space-y-3 px-1"
      >
        {turns.map((t, i) => (
          <Bubble key={i} turn={t} self={names.self} />
        ))}
        {thinking && (
          <div className="flex gap-1.5 px-3 py-2 text-foreground/40">
            <span className="size-1.5 rounded-full bg-current animate-pulse" style={{ animationDelay: "0ms" }} />
            <span className="size-1.5 rounded-full bg-current animate-pulse" style={{ animationDelay: "200ms" }} />
            <span className="size-1.5 rounded-full bg-current animate-pulse" style={{ animationDelay: "400ms" }} />
          </div>
        )}
      </div>

      {enough && (
        <div className="mt-4 w-full max-w-xl page-in rounded-2xl bg-accent/15 border border-accent/30 px-4 py-3 text-sm text-foreground/80 text-center">
          I think I understand your side.
          <button
            onClick={done}
            className="ml-3 inline-flex rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-accent-foreground"
          >
            Done for now
          </button>
        </div>
      )}

      <div className="mt-5 w-full max-w-xl">
        <div className="flex items-end gap-2 rounded-3xl bg-card border border-border/60 px-3 py-2 shadow-[0_8px_24px_-16px_rgba(0,0,0,0.15)] focus-within:border-primary/50 transition-colors duration-500">
          <button
            onClick={toggleVoice}
            aria-label={listening ? "Stop voice" : "Start voice"}
            className={`shrink-0 size-10 rounded-full inline-flex items-center justify-center transition-all duration-500 ${
              listening
                ? "bg-[color:var(--coral)] text-primary-foreground scale-105"
                : "bg-secondary text-foreground/70 hover:text-foreground"
            }`}
          >
            <Mic className="size-4" />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder={listening ? "listening…" : "tell Keeper what happened…"}
            rows={1}
            className="flex-1 resize-none bg-transparent py-2.5 px-1 outline-none text-[15px] leading-relaxed placeholder:text-foreground/35"
            style={{ maxHeight: 140 }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || thinking}
            aria-label="Send"
            className="shrink-0 size-10 rounded-full bg-primary text-primary-foreground inline-flex items-center justify-center disabled:opacity-40 transition-all duration-500 hover:scale-[1.04]"
          >
            <Send className="size-4" />
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-foreground/40">
          Nothing is shared with {names.other} until you're both done.
        </p>
      </div>
    </main>
  );
}

function Bubble({ turn, self }: { turn: KeeperTurn; self: string }) {
  if (turn.role === "keeper") {
    return (
      <div className="max-w-[85%] mr-auto rounded-2xl rounded-tl-md bg-secondary/60 px-4 py-2.5 text-[15px] leading-relaxed text-foreground/85 page-in">
        {turn.text}
      </div>
    );
  }
  return (
    <div className="max-w-[85%] ml-auto rounded-2xl rounded-tr-md bg-primary/15 px-4 py-2.5 text-[15px] leading-relaxed page-in">
      <div className="text-[10px] uppercase tracking-wider text-foreground/40 mb-0.5">{self}</div>
      {turn.text}
    </div>
  );
}
