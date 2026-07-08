# Prospect Research Enrichment — Design

**Date:** 2026-07-08
**Status:** Approved by Phil (conversation), pending spec review

## Problem

Outreach drafts (letters and cold emails) personalize only from structured lead
fields — category, company size, city/state, website URL — and the draft prompt
explicitly forbids inventing anything beyond those. The result reads "written
for a segment," not "written for this business." We want each letter and each
newly drafted email grounded in true, specific, publicly findable facts about
the prospect.

## Scope

- **In:** the daily letter batch (~10 leads/day to Caroline) and any email
  drafted going forward via the draft endpoint (single Draft button and the
  "Draft all emails" bulk loop).
- **Out:** the 313 leads already enrolled in the drip sequence (their approved
  copy keeps sending unchanged); LinkedIn/FB drafts (can adopt later — the seam
  is channel-agnostic); any re-draft of existing stored drafts.

## Approach

A server-side research step using the Claude API's web search server tool
(`web_search_20260209`), running through the same `ANTHROPIC_API_KEY` and
`claude-sonnet-4-6` model the app already uses for drafting. Findings are
stored on the lead, visible and editable in the UI, and injected into the
draft prompt as verified facts.

## 1. Data model

New columns on `leads` (same idempotent ALTER-TABLE migration pattern as the
letter-batch columns):

| Column | Type | Meaning |
|---|---|---|
| `research_notes` | TEXT | Bullet facts, each with source URL; or the sentinel `NOTHING FOUND` |
| `researched_at` | TEXT | ISO timestamp of the last research run |

The `NOTHING FOUND` sentinel records "we looked and found nothing usable" so
ghost-footprint businesses aren't re-researched (and re-billed) on every run.

## 2. Research module — `src/lib/outreach/research.ts`

`researchLead(db, lead): Promise<string | null>`

- Calls the Messages API with `tools: [{type: 'web_search_20260209', name:
  'web_search', max_uses: 5}]`. This requires a new helper in `src/lib/claude.ts`
  (e.g. `askClaudeWithWebSearch`) since the existing `askClaude` sends no tools;
  server-side tools need no client-side execution loop, but the response is a
  content-block array (text + `web_search_tool_result` blocks) rather than a
  single text block, so the helper extracts the final text.
- Prompt inputs: business name, city/state, website, category, contact person
  (business role context only).
- Prompt asks for **3–6 business-only facts**, each on its own line with its
  source URL: what they specifically do/sell, recent news or milestones (new
  location, award, anniversary), community involvement, review themes, hiring.
- Hard rules in the prompt:
  1. **Business-only.** No personal-life details about owners or staff.
  2. **Identity check.** If a fact can't be confirmed as being about this
     business in this city (vs. a same-named business elsewhere), drop it.
  3. If nothing passes the bar, output exactly `NOTHING FOUND`.
- Writes `research_notes` + `researched_at` and returns the notes.
- **Freshness:** callers skip research when `researched_at` is within 30 days
  (including `NOTHING FOUND` results).

## 3. Trigger points

Both automatic; research always runs before drafting, never blocks it.

1. **Letter batch tick** (`letter-batch-tick`, 13:00 UTC cron): for each of the
   ~10 picked leads, run `researchLead` (respecting freshness) before composing
   the letter draft.
2. **Draft endpoint** (`POST /api/outreach/leads` `{action:'draft'}`): research
   first when the lead has no fresh research, then draft. Covers the per-lead
   Draft button and the bulk "Draft all emails" loop, which call the same action.
3. **Manual:** a `{action:'research'}` API action backing the UI button
   (section 5), which always re-runs regardless of freshness.

## 4. Drafting changes — `src/lib/outreach/draft.ts`

When `research_notes` is present and not `NOTHING FOUND`, `generateDraft`
appends to the lead details:

```
RESEARCHED FACTS (verified via web search, with sources — you may reference these):
<notes>
```

…and adds prompt instructions:

- Weave in **one, at most two** researched facts, naturally — the goal is
  "did their homework," never "was watching them."
- Never quote or include source URLs in the outgoing message.
- The existing never-invent rule stays: anything not in the lead data or the
  researched facts must not be claimed.

No research (or sentinel) → the prompt is byte-identical to today's behavior.

## 5. UI

On each lead in the Outreach Leads tab, alongside the existing draft boxes:

- A **Research** box showing `research_notes` and a "researched <date>" stamp.
- Fully **editable** — Phil can delete a wrong or overly-personal fact (or add
  one) before drafting; drafts use whatever the box contains at draft time.
- A **Research / Re-research** button that calls `{action:'research'}`.

Review safety net is layered: research box (editable) → letter review before
Caroline writes / email review before queueing.

## 6. Failure handling

- Any research error (API failure, timeout, malformed response) logs and falls
  through to a normal un-researched draft. The letter batch must never fail or
  skip a lead because research failed.
- A failed research run does not write `researched_at`, so the next run retries.

## 7. Cost

Web search bills per search (~1¢/search, ≤5 per lead) plus normal Sonnet
tokens: roughly 3–8¢ per researched lead. At ~10 letters/day plus occasional
email drafting, with the 30-day freshness window, expected spend is **$5–10 per
month**. No new vendors or keys.

## 8. Testing

- Unit tests: prompt assembly (facts section present/absent, sentinel handling),
  freshness-window logic, sentinel storage, draft-prompt injection.
- Live verification: run research + draft on 2–3 real leads of different web
  footprints (strong / weak / none) and eyeball the letters before shipping the
  cron integration.

## Build notes

- Build on a feature branch in a worktree off `origin/main` per repo convention;
  deploy via `./scripts/deploy.sh` after merge.
- The drip-sequence steps 2–5 use approved fixed copy and are untouched by this
  design.
