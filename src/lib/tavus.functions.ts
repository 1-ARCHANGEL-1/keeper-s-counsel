import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ⚠️ REPLACE_ME: paste your Tavus persona_id once you've created the Keeper persona
// in the Tavus dashboard (https://platform.tavus.io). Until then, calls will fail
// with a clear error from Tavus's API.
const PERSONA_ID_PLACEHOLDER = "pf7e97838198";

const TAVUS_BASE = "https://tavusapi.com/v2";

function getKey() {
  const k = process.env.TAVUS_API_KEY;
  if (!k) {
    throw new Error(
      "TAVUS_API_KEY is not set. Add it in Project Settings → Secrets.",
    );
  }
  return k;
}

export const startTavusConversation = createServerFn({ method: "POST" })
  .handler(async () => {
    const apiKey = getKey();
    const res = await fetch(`${TAVUS_BASE}/conversations`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        persona_id: PERSONA_ID_PLACEHOLDER,
        conversation_name: "Keeper session",
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Tavus start failed (${res.status}): ${txt}`);
    }
    const j = (await res.json()) as {
      conversation_url?: string;
      conversation_id?: string;
    };
    if (!j.conversation_url || !j.conversation_id) {
      throw new Error("Tavus response missing conversation_url / conversation_id");
    }
    return {
      conversation_url: j.conversation_url,
      conversation_id: j.conversation_id,
    };
  });

export const endTavusConversation = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ conversation_id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const apiKey = getKey();
    const res = await fetch(
      `${TAVUS_BASE}/conversations/${encodeURIComponent(data.conversation_id)}/end`,
      {
        method: "POST",
        headers: { "x-api-key": apiKey },
      },
    );
    if (!res.ok && res.status !== 404) {
      const txt = await res.text();
      throw new Error(`Tavus end failed (${res.status}): ${txt}`);
    }
    return { ok: true };
  });

export const getTavusTranscript = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ conversation_id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const apiKey = getKey();
    const url = `${TAVUS_BASE}/conversations/${encodeURIComponent(data.conversation_id)}?verbose=true`;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    for (let attempt = 0; attempt < 6; attempt++) {
      if (attempt > 0) await sleep(2000);
      const res = await fetch(url, { headers: { "x-api-key": apiKey } });
      if (!res.ok) continue;
      const j = (await res.json()) as Record<string, unknown>;
      const events = j.events;
      if (!Array.isArray(events)) continue;
      const ready = events.find(
        (e) =>
          e && typeof e === "object" &&
          (e as Record<string, unknown>).event_type === "application.transcription_ready",
      ) as { properties?: { transcript?: unknown } } | undefined;
      const transcript = ready?.properties?.transcript;
      if (!Array.isArray(transcript) || transcript.length === 0) continue;
      const lines: string[] = [];
      for (const entry of transcript) {
        if (!entry || typeof entry !== "object") continue;
        const e = entry as Record<string, unknown>;
        if (e.role !== "user") continue;
        const text = typeof e.content === "string" ? e.content.trim() : "";
        if (text) lines.push(text);
      }
      if (lines.length > 0) return { transcriptText: lines.join("\n") };
    }
    return { transcriptText: "" };
  });


