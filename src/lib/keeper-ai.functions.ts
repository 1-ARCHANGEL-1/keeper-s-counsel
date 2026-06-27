import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

function apiKey() {
  const k = process.env.LOVABLE_API_KEY;
  if (!k) throw new Error("LOVABLE_API_KEY missing");
  return k;
}

async function chat(body: unknown): Promise<string> {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`AI gateway ${res.status}: ${txt}`);
  }
  const j = await res.json();
  return j?.choices?.[0]?.message?.content ?? "";
}

const TurnSchema = z.object({
  role: z.enum(["user", "keeper"]),
  text: z.string(),
});

// === Keeper reply ============================================================
const ReplyInput = z.object({
  personName: z.string(),
  otherName: z.string(),
  turns: z.array(TurnSchema),
  latest: z.string(),
});

const KEEPER_SYSTEM = `You are Keeper — a warm, soft-spoken mediator helping one person process a misunderstanding with someone they care about. You speak like a caring friend, never a therapist or coach. You never give advice, never take sides, never moralize, never use bullet points or numbered lists.

Your job in each reply is to gently help the person tell more of their story so the full picture comes out. Ask short, warm follow-up questions that invite specifics, feelings, or what happened just before. Examples of your style:
- "What happened right before that?"
- "How did that land for you in the moment?"
- "What did you want them to understand?"

Keep replies under 2 sentences. Sometimes just reflect back a feeling instead of asking. Use the person's own words. Never name an emotion they didn't name themselves more than gently.

You also silently classify what they just said:
- tone: "calm" | "hurt" | "warm"  — the emotional temperature of THEIR latest message.
- tag: "shareable" | "private" — would sharing this with {other} actually help resolve the misunderstanding (reasons, context, what they wished {other} knew)? Or is this venting / unflattering / not their place to share?
- note: if shareable, a brief one-line paraphrase from a caring mutual friend's POV that {other} could hear without it feeling like an attack. Empty string if private.
- enough: true only after at least 3 substantive user turns AND you feel you understand their side enough to move on. Otherwise false.

Return ONLY JSON, no prose:
{ "reply": string, "tone": "calm"|"hurt"|"warm", "tag": "shareable"|"private", "note": string, "enough": boolean }`;

export const keeperReply = createServerFn({ method: "POST" })
  .inputValidator((d) => ReplyInput.parse(d))
  .handler(async ({ data }) => {
    const sys = KEEPER_SYSTEM.replaceAll("{other}", data.otherName);
    const history = data.turns.map((t) => ({
      role: t.role === "keeper" ? "assistant" : "user",
      content: t.text,
    }));
    const content = await chat({
      model: MODEL,
      messages: [
        { role: "system", content: sys },
        { role: "system", content: `You are speaking with ${data.personName}. The other person in the conflict is ${data.otherName}.` },
        ...history,
        { role: "user", content: data.latest },
      ],
      response_format: { type: "json_object" },
    });
    let parsed: { reply: string; tone: "calm"|"hurt"|"warm"; tag: "shareable"|"private"; note: string; enough: boolean };
    try {
      parsed = JSON.parse(content);
    } catch {
      // strip code fences if model added them
      const cleaned = content.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    }
    return parsed;
  });

// === Final summary ===========================================================
const SummaryInput = z.object({
  forName: z.string(),         // person who will READ the summary (Person B)
  aboutName: z.string(),       // person whose side it summarizes (Person A)
  shareable: z.array(z.object({ text: z.string(), note: z.string().optional() })),
});

const SUMMARY_SYSTEM = `You are Keeper. You are writing a short, warm note for {forName} about what's worth knowing from {aboutName}'s side of a misunderstanding.

Rules:
- 3-5 sentences, plain language.
- Sound like a caring mutual friend explaining context — never like a report, never with headings or bullets.
- Never blame either person. Never quote ugly venting. Soften, don't sharpen.
- Focus on the *why* behind {aboutName}'s actions, what they wished {forName} knew, and any care or intention that wasn't visible.
- Do NOT include private content, complaints about {forName}'s character, or things said in pure frustration.
- End with one warm, open-ended sentence — something like "What you do with this is up to you both."

Return plain text. No quotes, no preamble.`;

export const keeperSummary = createServerFn({ method: "POST" })
  .inputValidator((d) => SummaryInput.parse(d))
  .handler(async ({ data }) => {
    const sys = SUMMARY_SYSTEM
      .replaceAll("{forName}", data.forName)
      .replaceAll("{aboutName}", data.aboutName);

    const material = data.shareable
      .map((s, i) => `(${i + 1}) ${s.note?.trim() || s.text}`)
      .join("\n");

    const text = await chat({
      model: MODEL,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: `Shareable context from ${data.aboutName}:\n\n${material || "(nothing notable was marked shareable)"}` },
      ],
    });
    return text.trim();
  });
