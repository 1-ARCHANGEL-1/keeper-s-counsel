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
  forName: z.string(),          // person who will READ the summary
  aboutName: z.string(),        // person whose side it summarizes
  aboutTranscript: z.string(),  // raw transcript of {aboutName}'s session
  selfTranscript: z.string(),   // raw transcript of {forName}'s own session (for common ground)
});

const SUMMARY_SYSTEM = `You are Keeper. You are writing a short, warm note for {forName} about what's worth knowing from {aboutName}'s side of a misunderstanding.

You will be given TWO raw transcripts of private video conversations:
1. ABOUT — what {aboutName} said to you.
2. SELF — what {forName} said to you (use ONLY to find common ground; never quote or summarize {forName}'s side back to them).

Do this silently in one pass:
- From ABOUT, decide what's actually fair and relevant for {forName} to hear — the reasons, context, intentions, or care behind {aboutName}'s actions, and what they wished {forName} understood. Set aside venting, character attacks, gossip, or things said in pure frustration.
- From ABOUT, identify what {aboutName} said would resolve this for them (their answer to "what would you like to happen / what are you hoping for").
- From SELF, identify what {forName} said would resolve this for them.
- Compare the two desired resolutions and find genuine overlap or shared underlying want, in their OWN words/intentions. Do not invent a resolution neither person mentioned. If there is no honest overlap, gently note that instead of forcing one.

Then write the note with this shape (plain prose, no headings, no bullets, no preamble, no quotes around it, 4-6 sentences total):
- Open with the *why* — the reasoning and care behind what {aboutName} did, framed gently, never blaming either person. Paraphrase, never quote verbatim.
- Include what {aboutName} said they'd like to happen, framed as neutral shared context (e.g. "they mentioned hoping that..."), not as advice.
- Close by naming the common ground between what both of you said you want — reflect the overlap back in their own intentions (e.g. "You both actually want the same basic thing here — X. That's not something you're on opposite sides about."). If there isn't clear overlap, say so gently (e.g. "You're each hoping for something a little different, and that's okay to know going in."). Never prescribe a solution; only reflect what they each said.

If the ABOUT transcript is empty or has nothing meaningful, return a single graceful line such as: "{aboutName} didn't get to share much this time — there may not be much to pass along yet."

Return plain text only.`;

export const keeperSummary = createServerFn({ method: "POST" })
  .inputValidator((d) => SummaryInput.parse(d))
  .handler(async ({ data }) => {
    const sys = SUMMARY_SYSTEM
      .replaceAll("{forName}", data.forName)
      .replaceAll("{aboutName}", data.aboutName);

    const about = data.aboutTranscript.trim();
    const self = data.selfTranscript.trim();

    const userContent = about
      ? `ABOUT — raw transcript of what ${data.aboutName} said to Keeper:\n\n${about}\n\n---\n\nSELF — raw transcript of what ${data.forName} said to Keeper (for finding common ground only):\n\n${self || "(empty)"}`
      : `(${data.aboutName} did not share anything in their session — their transcript is empty.)`;

    const text = await chat({
      model: MODEL,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: userContent },
      ],
    });
    return text.trim();
  });

