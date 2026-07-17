# Audible AI Page — Production Rollout Runbook

Rollout for the `/audible` page (plan: `docs/plans/2026-07-17-001-feat-audible-ai-page-plan.md`).

**The one rule that cannot be skipped: the nginx gate (step 2) goes live BEFORE the audible-set sync (step 3).** The audible set contains Phil's full worldview profile and personal-register theme syntheses. CommandPost has no in-app auth, so nginx is the only thing standing between that content and the open internet.

## Step 1 — Deploy the app

```bash
git push origin main        # deploy.sh ships origin/main, not the working dir
./scripts/deploy.sh
```

Safe to do first: with zero audible docs synced, `/audible` renders its empty state and all fences are already active.

## Step 2 — Apply and verify the nginx gate (droplet)

On the droplet (`ssh root@<droplet>`), edit the live nginx site config (the repo's `deploy/nginx.conf` carries reference blocks — copy the three `location` blocks for `/audible`, `/api/audible/`, and `/api/backup`, using the same `auth_basic` / htpasswd setup the `/ingestion` gate already uses). Then `nginx -t && systemctl reload nginx`.

**Verify — all four checks, no exceptions:**

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://<host>/audible              # expect 401
curl -s -o /dev/null -w '%{http_code}\n' https://<host>/api/audible/history  # expect 401
curl -s -o /dev/null -w '%{http_code}\n' https://<host>/api/backup           # expect 401
curl -s -o /dev/null -w '%{http_code}\n' https://<host>/api/generate/history # expect 200 (NOT gated)
```

`/api/backup` streams the raw SQLite DB file — if it returns anything but 401, stop here.

Also click the sidebar "Phil's Audible AI" link from an ungated page and confirm the browser auth prompt appears on navigation (not just on direct URL entry).

## Step 3 — Sync the audible set (Mac)

```bash
cd ~/audible-kb
python3 scripts/sync_commandpost.py load audible
python3 scripts/sync_commandpost.py --check
```

Expect 19 docs loaded (18 themes + worldview profile) and a clean `--check` for both manifests.

## Step 4 — Verify fences in production

- `/audible` (behind the gate): 19 categories render; a test generation returns `sources_used > 0` and appears in the page's history.
- `/generate`: source picker shows the six `Influence Map — ` docs and **nothing** `Audible — `-prefixed; the Ideas panel still works; history shows no Audible generations.
- Buffer: run "Send social to Buffer" backfill on `/generate` — it must push nothing new from Audible activity.

## Rollback

Remove the three nginx location blocks and reload nginx (restores the pre-rollout surface). To pull the content itself, delete the 19 docs via the `/ingestion` UI or `DELETE /api/ingestion/kb/{id}` for each id in `~/audible-kb/kb/commandpost-audible-manifest.md`, then clear that manifest's rows. Audible generations can be deleted from the `/audible` history panel.
