# Outreach Email Queue + Auto-Sender — Design

**Date:** 2026-06-26
**Status:** Approved (design), pending implementation
**Goal:** Review bulk-drafted outreach emails one place, approve them into a queue, and have CommandPost automatically send 10–15 per weekday from a rekindleleads.com Google Workspace mailbox.

## Background

CommandPost Outreach already (a) bulk-drafts personalized emails per lead ("✦ Draft all emails", stored in `leads.draft_email`) and (b) lets you mark a channel sent (logs an `outreach_touches` row). It is **draft-only** today — nothing sends. This feature adds the missing review → queue → auto-send pipeline for the **email channel only**.

Scope is the email channel. Letter / LinkedIn / FB are unchanged.

## Pipeline & States

Per lead, the email moves through an explicit status (new column `email_status` on `leads`):

- `draft` — a `draft_email` exists, not yet reviewed.
- `queued` — approved, waiting to be auto-sent.
- `sent` — delivered by the auto-sender.
- `skipped` — reviewed and intentionally not sending.
- `failed` — send attempted and errored (retryable).

Plus a `do_not_email` boolean (suppression). **One intro email per lead, ever** — once `sent`, a lead is never re-queued or re-sent.

### Data model (migration on `leads`)
- `email_status TEXT` (nullable; null = no draft yet)
- `email_queued_at TEXT`
- `email_sent_at TEXT`  (also keep logging an `outreach_touches` row on send so existing status badges/unsend work)
- `email_error TEXT`
- `do_not_email INTEGER DEFAULT 0`

Migration is additive (`ALTER TABLE ... ADD COLUMN`), guarded by a column-exists check, consistent with existing CommandPost migrations in `src/lib/db.ts`.

Backfill: existing leads with a non-empty `draft_email` and no send get `email_status='draft'`.

## UI — "Email Queue" page (new, under Outreach)

Three tabs:

1. **Review** (`email_status='draft'`): step-through, one draft at a time.
   - Shows `To:` (lead email), parsed `Subject:` line, and editable body.
   - Actions: **Approve → Queue** (`status=queued`, stamp `email_queued_at`), **Skip** (`status=skipped`), inline **Edit** (persists to `draft_email`), prev/next, and a progress counter.
   - Guard: a lead with no email address cannot be approved (shouldn't appear — drafts only exist for emailable leads, but enforce server-side).
2. **Queued** (`email_status='queued'`): the "approved emails show up here" list, in send order (oldest `email_queued_at` first), each showing a **projected send date** computed from queue position and the daily rate. Can **un-queue** (back to draft) or edit.
3. **Sent** (`email_status in ('sent','failed')`): delivered log + failures with `email_error` and a **Retry** (back to `queued`).

A small `do_not_email` toggle is available per lead (and from the existing Leads tab) to honor opt-outs.

## Auto-sender (10–15/weekday)

- **Trigger:** a system cron on the Droplet calls a secret-protected endpoint `POST /api/outreach/send-tick` (header `x-cron-secret`, value in server `.env`). Cron fires on a fixed cadence during business hours.
- **Cadence/throttle:** Mon–Fri, **09:00–17:00 America/Chicago**, weekends off. Each weekday the sender targets a random **10–15** total. Implementation: the tick endpoint, when called, checks how many were already sent today; if under today's target and within business hours, it sends **one** queued email (oldest first) and returns. Cron cadence (e.g. every ~30 min, ~16 weekday slots) combined with the daily cap yields a naturally spaced 10–15/day. Today's target is derived deterministically from the date (seeded), so it's stable across ticks.
- **Send transport:** `nodemailer` SMTP to `smtp.gmail.com` (TLS) authenticating with the rekindleleads.com address + Gmail **App Password**, both from server `.env` (`OUTREACH_SMTP_USER`, `OUTREACH_SMTP_PASS`, `OUTREACH_SMTP_FROM`, `OUTREACH_CRON_SECRET`).
- **On send success:** parse `Subject:`/body from `draft_email`, send, set `email_status='sent'` + `email_sent_at`, log an `outreach_touches` email row (advances stage to contacted), continue.
- **On failure:** `email_status='failed'`, store `email_error`; not retried automatically (manual Retry from the Sent tab).
- **Skips:** any lead that is `do_not_email`, has `replied_at`, or already has an email touch/`email_sent_at` is never sent (defense in depth).

## Compliance & safety

- Every drafted email already includes the CAN-SPAM opt-out line and the physical mailing address (`MAILING_ADDRESS`).
- **Opt-out:** v1 is **manual** — when a recipient replies "no thanks", operator clicks `do_not_email`; the sender skips them. No automated inbox/reply reading in v1 (future enhancement).
- **No double-send:** hard guard on `email_sent_at`/existing email touch.
- **Secret-protected** send endpoint; SMTP creds only in `.env` (never client-exposed), same pattern as the existing `ANTHROPIC_API_KEY`.

## Operational prerequisites (before the sender goes live)

- A real mailbox on the sending domain (e.g. `phil@rekindleleads.com`).
- A Gmail **App Password** for it (requires 2FA) → placed in server `.env`.
- A crontab entry on the Droplet hitting `/api/outreach/send-tick` during business hours.

The Review/Queue UI and data model are fully functional without these; only the actual send step depends on them.

## Out of scope (v1)

- Automated reply/bounce reading (IMAP).
- Multi-step sequences / follow-ups (this is a single intro email per lead).
- Channels other than email.
- Per-lead custom send scheduling (queue is global FIFO).

## Testing

- Unit: status transitions (approve/skip/unqueue/retry), daily-target seeding determinism, "skip" guards (do_not_email / replied / already-sent), Subject/body parsing from `draft_email`.
- The SMTP transport is injected so the sender can be tested against a mock transport (assert recipients, throttle cap, no double-send) without real email.
