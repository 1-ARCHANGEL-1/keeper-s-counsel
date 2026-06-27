## What's actually in the Tavus response

For real conversation `c62eeaffadc3d491` (persona `pf7e97838198`, ended normally), GET `/v2/conversations/{id}?verbose=true` returns:

```
top-level keys: conversation_id, conversation_name, conversation_url,
                conversational_context, callback_url, status, replica_id,
                persona_id, created_at, updated_at, events
```

There is **no top-level `transcript` field**. The transcript is nested one level deeper, inside the `events` array, on the event whose `event_type === "application.transcription_ready"`:

```
events: [
  { event_type: "system.replica_joined", ... },
  { event_type: "system.shutdown", properties: { shutdown_reason: ... } },
  { event_type: "application.perception_analysis", properties: { analysis: "..." } },
  {
    event_type: "application.transcription_ready",
    properties: {
      persona_id: "...",
      replica_id: "...",
      transcript: [
        { role: "system",    content: "...", seconds_from_start, timestamp },
        { role: "user",      content: "Bigaby?", duration, inference_id, role, seconds_from_start, timestamp },
        { role: "assistant", content: "What's going on from your side? ...", ... },
        ...
      ]
    }
  }
]
```

So the canonical shape is:
- field name: `transcript` (array)
- entry fields: `role` ("system" | "user" | "assistant"), `content` (string), plus `seconds_from_start`, `timestamp`, and for user/assistant entries also `inference_id` and sometimes `duration`.
- the role and content key names we're guessing at are correct — `role` and `content`. The `speaker`/`text`/`message` fallbacks are unused.

## Why the current code returns ""

`src/lib/tavus.functions.ts` line 82 does:

```ts
const transcript = (j.transcript ?? (j.events as unknown)) as unknown;
```

`j.transcript` is undefined (doesn't exist at top level), so it falls through to `j.events`. It then iterates the **events array** — which contains `system.replica_joined`, `system.shutdown`, etc. None of those have `role: "user"`, so 0 lines get extracted and we return `transcriptText: ""`. The real transcript (16 entries, 7 user turns in this example) is one nesting level deeper and never gets read.

This is a parsing bug, not a timing bug. Even if we waited an hour, the current code would still extract 0 user lines.

## Timing (secondary)

For this real conversation:
- `system.shutdown` event created_at: `21:15:59 GMT` (end endpoint hit)
- `application.transcription_ready` event created_at: `21:16:03 GMT`

So the transcript appeared ~**4 seconds** after end. Our current retry window is 3 attempts × 2s = 6s max wait, which is borderline — fine in this sample but a single slow run could miss it. Worth bumping but not the root cause.

## Fix plan (when you give the go-ahead)

1. In `getTavusTranscript`, change the extraction to:
   - Read `j.events` (array).
   - Find the entry where `event_type === "application.transcription_ready"`.
   - Read `entry.properties.transcript` (array of `{ role, content, ... }`).
   - Filter to `role === "user"`, map to `content.trim()`, join with `"\n"`.
   - Drop the `speaker`/`text`/`message`/`participant` fallbacks — they were never real.
2. If the `application.transcription_ready` event isn't present yet, that's the legitimate retry case — keep the loop, and widen it to ~6 attempts × 2s (12s) to give comfortable headroom over the observed 4s.
3. Leave `startTavusConversation` / `endTavusConversation` untouched.

No other files need to change — `summary.tsx` and `keeperSummary` already consume the joined string returned by this function.