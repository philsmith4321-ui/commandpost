# Phase 14: Proposals & Contracts — Design Spec

## Goal

Create structured proposals for leads/clients with shareable links, simple acceptance flow, and automatic conversion to client + project + contract on acceptance.

## Architecture

- New `proposals` table with structured fields and a shareable token
- New `proposal_items` table for pricing line items (same shape as invoice_items)
- New `contracts` table linked to proposal + client, with expiry tracking
- Public route at `/proposals/view/[token]` for client-facing proposal view
- On acceptance: record timestamp/IP, convert lead to client, create project from items, create contract record
- Cron integration for contract expiry alerts

## Database

### `proposals` table

```sql
CREATE TABLE IF NOT EXISTS proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  scope TEXT,
  timeline TEXT,
  valid_until TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','accepted','rejected','expired')),
  token TEXT UNIQUE,
  accepted_at TEXT,
  accepted_ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### `proposal_items` table

```sql
CREATE TABLE IF NOT EXISTS proposal_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL,
  amount REAL NOT NULL
);
```

### `contracts` table

```sql
CREATE TABLE IF NOT EXISTS contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  proposal_id INTEGER REFERENCES proposals(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  terms_summary TEXT,
  signed_at TEXT NOT NULL,
  expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','expired','renewed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## Admin Routes

### `/proposals` — List page
- Table showing all proposals: title, lead/client name, total amount, status badge, created date
- Filter by status (draft/sent/accepted/rejected/expired)
- "New Proposal" button

### `/proposals/new` — Builder form
- Title (text)
- Link to: lead select OR client select (one or the other)
- Scope (textarea)
- Timeline (text, e.g. "4-6 weeks")
- Valid until (date picker)
- Line items: description, quantity, unit_price (auto-calc amount), add/remove rows
- Save as draft

### `/proposals/[id]` — Detail page
- Shows all proposal info, line items, total
- Actions: "Mark as Sent" (generates token + copies link), "Copy Link", "Mark Rejected"
- If accepted: shows acceptance details + link to contract

### `/contracts` — List page
- Table: title, client name, signed date, expires date, status badge
- Highlight contracts expiring within 30 days

## Public Route

### `/proposals/view/[token]` — Client-facing proposal
- Light theme (same as portal layout)
- Shows: title, scope, timeline, valid until date, line items table, total
- "Accept Proposal" button (only if status is 'sent' and not expired)
- On accept: confirms via browser confirm(), POSTs to an API route

### `/api/proposals/[token]/accept` — Acceptance endpoint
- Validates token, checks status is 'sent', checks not expired
- Records `accepted_at` and `accepted_ip`
- Sets status to 'accepted'
- If `lead_id` set: converts lead to client (same logic as convertLeadToClientAction)
- Creates project with title from proposal, deliverables from proposal_items
- Creates contract record with terms_summary = scope + items snapshot
- Fires `proposal_accepted` notification
- Returns JSON success

## Notification Integration

Add two notification types:
- `proposal_accepted` — fired when client accepts (immediate delivery)
- `contract_expiring` — fired by cron when contract expires within 30 days

Add these to the `NotificationType` union in types.ts and to the notification settings page typeLabels.

## Cron Integration

In `/api/cron/notifications/route.ts`, add a check:
- Query contracts where `expires_at` is within 30 days and status is 'active'
- Fire `contract_expiring` notification if not already sent in last 7 days (use `hasAlertBeenSentInLastDays`)

## Sidebar

Add "Proposals" nav item with icon `◈` between Pipeline and Finances in both sidebar.tsx and mobile-nav.tsx. Move Pipeline's icon to `◇` to avoid duplication.

## Acceptance Flow Detail

When a proposal is accepted via the API route:

1. Update proposal: `status = 'accepted'`, `accepted_at = now`, `accepted_ip = request IP`
2. If `lead_id` is set and lead is not already won:
   - Create client from lead data (business_name, contact_person, email, phone, source)
   - Mark lead as won with new client_id
   - Set `proposal.client_id` to new client
3. If `client_id` is already set (proposal for existing client), skip step 2
4. Create project: name = proposal title, client_id = resolved client, status = 'active'
5. Create deliverables from proposal_items: each item.description becomes a deliverable title
6. Create contract: client_id, proposal_id, title = proposal title, terms_summary = scope text, signed_at = now, expires_at = valid_until or null
7. Fire `proposal_accepted` notification with link to `/contracts`

## Testing

- Unit tests for proposal queries (CRUD, getByToken, accept logic)
- Unit tests for contract queries
- Test acceptance flow: proposal accepted → client created → project created → contract created
- Test expired proposal cannot be accepted
- Test invalid token returns 404
