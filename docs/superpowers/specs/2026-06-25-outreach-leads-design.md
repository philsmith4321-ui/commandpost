# Outreach Lead List + CSV Import — Design Spec

**Date:** 2026-06-25
**Status:** Approved, building
**Context:** Phil is scraping Nashville business-owner leads for cold outreach (handwritten
letters first, possibly email). Needs to load them into CommandPost under the Outreach tab
and track outreach against them.

## Goal

Let Phil bulk-import scraped leads via CSV and work them from a "Leads" tab on the Outreach
page — see mailing addresses for letters, log letter/email sends, track replies and
follow-ups — all on the existing pipeline so there's one source of truth and the My Week
metrics stay connected.

## Decisions (from brainstorming)

- Import via **CSV upload**.
- Leads live in the **existing `leads`/Pipeline table**, tagged `lane = hunter` (cold
  outreach). Not a separate table.
- Owner name reuses existing `contact_person` (no separate `owner_name` column).
- Letter/email sends are logged as rows in a new `outreach_touches` table (not a single flag).

## Data model (additive migrations, avatar/outreach style)

1. `ALTER TABLE leads ADD COLUMN` (all nullable): `street`, `city`, `state`, `postal_code`,
   `socials`, `replied_at`. (Owner=`contact_person`; email/phone/website/lane already exist.)
2. New table:
   ```sql
   CREATE TABLE outreach_touches (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
     channel TEXT NOT NULL CHECK(channel IN ('letter','email','phone')),
     sent_at TEXT NOT NULL DEFAULT (datetime('now')),
     note TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   ```
3. Reuse existing: `follow_up_date` (follow-ups), `lead_notes` (notes),
   `lead_stage_history` (stage timeline), `stage` (Sourced=`new` → Outreach Sent=`contacted`).

## CSV import

Extend `/api/import` (already handles `clients`/`expenses`) with a `leads` type. Forgiving
header aliasing so scrape columns map automatically:
- `company`/`business`/`business_name`/`name` → `business_name` (REQUIRED)
- `owner`/`contact`/`contact_person`/`owner_name` → `contact_person`
- `street`/`address`/`address1` → `street`; `city`; `state`/`region`; `zip`/`postal`/`postal_code` → `postal_code`
- `email`; `phone`/`telephone`; `website`/`url`/`site`; `socials`/`social`/`instagram`/`facebook` → `socials`; `notes`/`note` → seeds a `lead_notes` row
- Default `lane` = `hunter` (overridable at upload), `source` = `outbound`, `stage` = `new`.
- **Dedupe** before insert: skip rows matching an existing lead by (lower(business_name) +
  lower(coalesce(street,''))) OR by email when present. Return `{ imported, skipped }`.

## Queries — `src/lib/queries/outreach-lead-queries.ts`

- `listLeadsByLane(db, lane, { stage?, uncontactedOnly? })` → leads + derived per-lead summary
  (latest letter/email touch dates, replied flag, follow-up, stage).
- `logTouch(db, leadId, channel, note?)` → insert touch; if lead stage is `new`, advance to
  `contacted` (+ `lead_stage_history` row).
- `markReplied(db, leadId)` / `setFollowUp(db, leadId, date)` / `addNote` (reuse lead-queries).
- `importLeads(db, rows, lane)` → the dedupe + insert used by the route.

## UI — "Leads" tab on the Outreach page

Add a third tab to `outreach-cockpit.tsx` (My Week · Playbook · **Leads**), scoped to the
active lane:
- **Import CSV** control → posts to `/api/import` (type=leads, lane), shows
  "N imported, M skipped (duplicates)".
- Table: business · owner · city/state · channel badges (✉ letter+date, @ email+date) ·
  replied? · follow-up · stage. Filters: by stage, and "not yet contacted".
- Row actions: **Letter sent** / **Email sent** (logs touch + advances stage), **Mark
  replied**, **set follow-up**, **add note**, and a detail panel showing the full mailing
  address for writing the letter.
- New server-fetched data passed from `page.tsx`; mutations via a small `/api/outreach/leads`
  route (POST actions: log-touch, mark-replied, set-followup, add-note).

## Ties to existing features

- Same leads appear in the main Pipeline board (one source of truth).
- "Letter sent" (new→contacted) already feeds the Hunter "outreaches this week" that My Week
  derives from `lead_stage_history`.

## Out of scope (v1)

Auto-syncing My Week reply-rate inputs from touches; export to a letter-printing/mail-merge
service (Lob/Handwrytten); bulk multi-select actions. All easy follow-ups.

## Success criteria

- Upload a CSV of scraped leads → they appear in the Leads tab tagged lane:hunter, stage
  Sourced, with addresses; duplicates skipped on re-import.
- Log a letter/email send → touch recorded with date, badge shows, stage advances to Outreach
  Sent, lead shows in main Pipeline as contacted.
- Mark replied / set follow-up / add note all persist.
- `npm run build` + `npm test` pass; eslint stays clean.
