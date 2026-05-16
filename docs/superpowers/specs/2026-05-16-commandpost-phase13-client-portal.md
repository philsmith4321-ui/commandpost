# Phase 13: Client Portal — Design Spec

## Goal

Give each client a unique, shareable URL that shows their project progress, invoices, and recent activity. No login required. Token-based access, revocable by the admin.

## Architecture

- Each client gets a `portal_token` (UUID v4) stored as a nullable column on the `clients` table
- Public route at `/portal/[token]` — outside the dashboard layout, no auth middleware
- Token generated on demand via admin UI or programmatically
- "Reset link" button regenerates token, invalidating previous URL
- Portal page is server-rendered (no client-side data fetching)

## Database Changes

Add column to `clients` table:

```sql
ALTER TABLE clients ADD COLUMN portal_token TEXT;
```

Schema in `db.ts` adds `portal_token TEXT` to the CREATE TABLE statement.

A unique index on `portal_token` ensures fast lookups and prevents collisions.

## Portal Page (`/portal/[token]`)

Light theme (white background, gray-100 cards, gray-700 text, blue-600 accents). Professional, minimal.

### Sections

1. **Header** — Client name, "Powered by CommandPost" subtle footer
2. **Projects** — Each active project as a card:
   - Project name + status badge (active/on-hold/completed)
   - List of deliverables with status icons (not_started: gray circle, in_progress: blue spinner-style, delivered: green check)
   - Overall progress bar (% of deliverables delivered)
3. **Invoices** — Table of outstanding + recent (last 90 days):
   - Invoice number, amount, status badge, due date
   - "Pay Now" button linking to Stripe payment link (if available and status is 'sent')
4. **Activity Feed** — Last 10 relevant updates:
   - Sourced from notifications table filtered by `link LIKE '/clients/{id}%' OR link LIKE '/finances/invoices/%'` cross-referenced with client invoices
   - Shows: icon, title, relative timestamp
   - Types shown: deliverable_overdue, invoice_overdue, invoice_paid, time_invoiced

## Admin UI Additions

On the client detail page (`/clients/[id]`), add a "Client Portal" card:

- If no token exists: "Generate Portal Link" button
- If token exists:
  - Read-only URL field with copy button
  - "Reset Link" button (regenerates token, confirms via browser confirm())
- Server actions: `generatePortalTokenAction`, `resetPortalTokenAction`

## Queries

New file `src/lib/queries/portal-queries.ts`:

- `getClientByPortalToken(db, token)` — returns client or null
- `getPortalProjects(db, clientId)` — active/on-hold projects with deliverables
- `getPortalInvoices(db, clientId)` — invoices from last 90 days or outstanding
- `getPortalActivity(db, clientId)` — last 10 notifications relevant to this client
- `generatePortalToken(db, clientId)` — creates/updates token with crypto.randomUUID()
- `resetPortalToken(db, clientId)` — same as generate (overwrites existing)

## Route Structure

```
src/app/portal/[token]/page.tsx    — public portal page
src/app/portal/layout.tsx          — light theme layout (no sidebar/nav)
```

Note: This sits outside `(dashboard)` group so it doesn't inherit auth or dark theme.

## Security

- Tokens are UUID v4 (122 bits of entropy) — not guessable
- No sensitive data beyond what a client would already know (their projects, their invoices)
- Rate limiting not required for MVP (server-rendered, no API)
- Token can be revoked at any time by regenerating

## Testing

- Unit tests for portal queries (getClientByPortalToken, getPortalProjects, getPortalInvoices)
- Test that invalid/missing token returns 404
- Test that deleted clients return 404 even with valid token
