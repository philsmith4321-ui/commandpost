# Handwritten Letter Assignment Workflow — Design

**Date:** 2026-07-03
**Status:** Approved in conversation (with test-first amendment)

## Purpose

Companies that enter the email outreach queue should also receive a handwritten
letter. Caroline Smith (thecarolinem@icloud.com) writes the physical letters;
CommandPost's job is to hand her everything she needs, 10 companies per day, in
one email per day — letter text, recipient name, and envelope address per
company — and to track which companies have already been assigned so none
repeat.

## Decisions (from brainstorming)

- **Source pool:** any lead that has ever entered the email queue
  (`email_status IN ('queued','sent')` with `email_queued_at` set) — leads do
  not fall out of the letter pool just because their email sent first.
- **Eligibility:** requires business name + complete mailing address
  (`street`, `city`, `state`, `postal_code` all non-empty). `contact_person`
  is optional; fall back to the business name for the envelope. Leads with
  `do_not_email` set are excluded.
- **Batch size:** 10/day; fewer than 10 remaining → send a partial batch;
  zero remaining → send nothing.
- **State tracking:** columns on `leads` (mirrors `email_status` pattern),
  not a separate table.
- **Fully automatic** daily send at ~8:00 AM Central via the existing Gmail
  service-account sender. No review UI.
- **Test-first rollout:** the first batch email goes to Phil
  (philsmith4321@gmail.com) as a dry run — no lead state is mutated and
  Caroline gets nothing — so Phil can approve the format. The automatic daily
  send stays disabled behind a settings flag until Phil approves.

## Data model

Migration in `src/lib/db.ts` adds to `leads`:

| Column | Type | Meaning |
|---|---|---|
| `letter_status` | TEXT | `NULL` = never batched; `'sent'` = included in a batch emailed to Caroline; `'skipped'` reserved for future manual exclusion |
| `letter_sent_at` | TEXT | UTC timestamp of the batch email that included this lead |
| `letter_batch_date` | TEXT | Central-time date (`YYYY-MM-DD`) of that batch |

`app_settings` keys:

| Key | Meaning |
|---|---|
| `letter_batch_enabled` | `'1'` to allow real (non-dry-run) batches; absent/`'0'` = off. Armed only after Phil approves the test email. |
| `letter_batch_recipient` | Destination for real batches; defaults to `thecarolinem@icloud.com` when unset |
| `letter_last_batch_date` | Central-time date of the last real batch; guards against double-fires |

## Components

### `src/lib/outreach/letter-batch.ts`

- `getEligibleLetterLeads(db, limit)` — the eligibility query above, ordered
  by `email_queued_at` ascending (oldest first), `LIMIT 10`.
- `composeLetterBatchEmail(leads, date)` — builds subject
  (`Handwritten letters — <Month D> (<n> companies)`) and body. Body header
  states the return address for envelopes (1004 Thistle Court, Hendersonville,
  TN 37075) and the count; then per company: recipient name (`contact_person`
  falling back to business name), envelope address block
  (name / business / street / city, state zip), and the full letter text.
- `runLetterBatchTick(db, { dryRun, to })` — orchestrates:
  1. If not `dryRun`: bail unless `letter_batch_enabled` is `'1'`; bail if
     `letter_last_batch_date` is already today (Central).
  2. Select up to 10 eligible leads; zero → return `{ sent: 0 }`, no email.
  3. For leads missing `draft_letter`, call the existing
     `generateDraft(lead, 'letter')` (pitch-v5-driven, same as the UI) and
     save it. A lead whose draft generation fails is dropped from this batch
     (stays `NULL`, returns to the pool tomorrow); the batch ships with the
     rest.
  4. Send one email via the existing Gmail SA transport
     (`src/lib/email/outreach-sender.ts` pattern, from the outreach sender
     address). Recipient: `to` override, else `letter_batch_recipient`
     setting, else Caroline. This internal handoff email does **not** count
     against the 10–15/day cold-outreach cap.
  5. Only if the send succeeded **and** not `dryRun`: mark each included lead
     `letter_status='sent'`, `letter_sent_at=now`, `letter_batch_date=today`;
     insert an `outreach_touches` row per lead (`channel='letter'`,
     note `'batched to Caroline'`); set `letter_last_batch_date`. A failed
     send mutates nothing — the batch retries next tick.

### `src/app/api/outreach/letter-batch-tick/route.ts`

`POST`, authenticated by the same `x-cron-secret` header /
`OUTREACH_CRON_SECRET` env var as `/api/outreach/send-tick`. Optional JSON
body `{ "dryRun": true, "to": "..." }` for the format test. Returns a JSON
summary (count, skipped-draft failures, recipient, dryRun).

### Scheduling

Crontab entry on the droplet (same pattern as the existing send-tick):
fires 13:00 UTC daily; the endpoint itself verifies it is morning in
America/Chicago, so DST never doubles or skips a day. Runs 7 days/week.
The `letter_batch_enabled` flag is the real on/off switch, so the cron can
be installed immediately without risk of premature sends.

## Error handling

- Gmail send failure → nothing marked, logged to PM2 output, retried next day.
- Per-lead draft failure → lead silently deferred to the next batch, count
  noted in the endpoint's JSON response and PM2 log.
- Double cron fire → `letter_last_batch_date` guard makes the second call a
  no-op.

## Testing

- Unit tests for eligibility (address completeness, pool membership,
  `letter_status` exclusion, ordering, limit) and for batch composition
  (partial batch, contact-name fallback, envelope formatting) against an
  in-memory SQLite DB.
- Manual: dry-run tick to Phil's inbox (the rollout test); verify no lead
  rows changed. After approval: arm flag, real tick, verify Caroline's email
  and that the 10 leads are marked and excluded from the next tick.

## Rollout

1. Deploy; run migration (automatic on boot).
2. Trigger `{ dryRun: true, to: "philsmith4321@gmail.com" }` — Phil reviews.
3. On approval: set `letter_batch_enabled='1'`, trigger the first real batch,
   install the cron entry for daily 8 AM Central.
