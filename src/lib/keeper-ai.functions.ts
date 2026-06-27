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
  transcript: z.string(),      // raw transcript text of what {aboutName} said to Keeper
});

const SUMMARY_SYSTEM = `You are Keeper. You are writing a short, warm note for {forName} about what's worth knowing from {aboutName}'s side of a misunderstanding.

You will be given the raw transcript of what {aboutName} said out loud to you during a private video conversation. Do this in one pass, silently:
1. Read the transcript and decide what's actually fair and relevant for {forName} to hear — the reasons, context, intentions, or care behind {aboutName}'s actions, and what they wished {forName} understood.
2. Set aside anything that's just venting, unflattering remarks about {forName}'s character, gossip, or things said in pure frustration. Do not include those.
3. Then write the note.

Rules for the note:
- 3-5 sentences, plain language. No headings, no bullets, no preamble, no quotes around it.
- Sound like a caring mutual friend explaining context — never like a report or transcript.
- Never quote {aboutName} verbatim. Paraphrase. Soften, don't sharpen. Never blame either person.
- Focus on the *why* and the underlying care or intention that may not have been visible to {forName}.
- End with one warm, open-ended sentence — something like "What you do with this is up to you both."

If the transcript is empty, only a sentence or two, or doesn't contain anything meaningful to pass along, do NOT fabricate. Instead return a single short, graceful line such as: "{aboutName} didn't get to share much this time — there may not be much to pass along yet."

Return plain text only.`;

export const keeperSummary = createServerFn({ method: "POST" })
  .inputValidator((d) => SummaryInput.parse(d))
  .handler(async ({ data }) => {
    const sys = SUMMARY_SYSTEM
      .replaceAll("{forName}", data.forName)
      .replaceAll("{aboutName}", data.aboutName);

    const transcript = data.transcript.trim();

    const text = await chat({
      model: MODEL,
      messages: [
        { role: "system", content: sys },
        {
          role: "user",
          content: transcript
            ? `Raw transcript of what ${data.aboutName} said to Keeper:\n\n${transcript}`
            : `(${data.aboutName} did not share anything in their session — the transcript is empty.)`,
        },
      ],
    });
    return text.trim();
  });
