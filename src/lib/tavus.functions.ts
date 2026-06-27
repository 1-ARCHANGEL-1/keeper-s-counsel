import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ⚠️ REPLACE_ME: paste your Tavus persona_id once you've created the Keeper persona
// in the Tavus dashboard (https://platform.tavus.io). Until then, calls will fail
// with a clear error from Tavus's API.
const PERSONA_ID_PLACEHOLDER = "REPLACE_WITH_TAVUS_PERSONA_ID";

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
