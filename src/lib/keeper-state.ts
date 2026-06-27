// Browser-side state for Keeper. localStorage keeps everything for the demo.
export type Speaker = "A" | "B";

export interface KeeperTurn {
  role: "user" | "keeper";
  text: string;
  // For user turns: AI-decided privacy tag
  tag?: "private" | "shareable";
  // Brief reason it's shareable (only used to seed summary)
  note?: string;
  tone?: "calm" | "hurt" | "warm";
  ts: number;
}

export interface PersonState {
  name: string;
  turns: KeeperTurn[];
  done: boolean;
}

export interface KeeperState {
  A: PersonState;
  B: PersonState;
  summary?: { for: Speaker; text: string };
}

const KEY = "keeper:state:v1";

const initial: KeeperState = {
  A: { name: "Person A", turns: [], done: false },
  B: { name: "Person B", turns: [], done: false },
};

export function loadState(): KeeperState {
  if (typeof window === "undefined") return initial;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return initial;
    return { ...initial, ...JSON.parse(raw) };
  } catch {
    return initial;
  }
}

export function saveState(s: KeeperState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
}

export function resetState() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

export function updatePerson(speaker: Speaker, patch: Partial<PersonState>) {
  const s = loadState();
  s[speaker] = { ...s[speaker], ...patch };
  saveState(s);
  return s;
}

export function appendTurn(speaker: Speaker, turn: KeeperTurn) {
  const s = loadState();
  s[speaker].turns = [...s[speaker].turns, turn];
  saveState(s);
  return s;
}
