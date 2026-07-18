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

**Verify — all five checks, no exceptions:**

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://<host>/audible              # expect 401
curl -s -o /dev/null -w '%{http_code}\n' https://<host>/api/audible/history  # expect 401
curl -s -o /dev/null -w '%{http_code}\n' https://<host>/api/backup           # expect 401
curl -s -o /dev/null -w '%{http_code}\n' https://<host>/api/generate/history # expect 200 (NOT gated)
curl --max-time 5 -s -o /dev/null -w '%{http_code}\n' http://<host>:3004/api/audible/history  # expect 000 (connection MUST fail)
```

`/api/backup` streams the raw SQLite DB file — if it returns anything but 401, stop here.

The fifth check proves nginx is the ONLY path to the app. The four https checks all go through nginx and would pass even if the raw app port sat open to the internet — CommandPost has no in-app auth, so a reachable `:3004` serves every gated surface with zero credentials. The repo's `ecosystem.config.js` now starts Next with `-H 127.0.0.1` (loopback-only bind); after the deploy in step 1, run `pm2 startOrReload ecosystem.config.js` on the droplet — a plain `pm2 restart` keeps the old cached args and the bind change silently won't apply. If the fifth check returns anything but a connection failure, stop here.

Also click the sidebar "Phil's Audible AI" link from an ungated page and confirm the browser auth prompt appears on navigation (not just on direct URL entry).

**Script/agent access through the gate:** any curl, cron, or Claude-session call to a gated path needs the basic-auth credentials: `curl -u <user>:<pass> https://<host>/api/audible/history`. The credentials are the htpasswd pair on the droplet at `/etc/nginx/.htpasswd` (same pair as the `/ingestion` gate unless you create a separate one) — record where you keep the password (password manager entry or `~/.zshrc` var) so future automation doesn't dead-end on a 401.

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

Keep the nginx gate up until the content is gone — removing the gate first re-exposes everything.

**The `/ingestion` UI cannot be used for this: the app deliberately hides `doc_set='audible'` docs from that page (the same fence that keeps them out of Generate), so the docs will not appear there even though they exist.** Do not interpret their absence from `/ingestion` as "already deleted." Remove content via the API, driving from the manifest:

```bash
# for each kb_id in ~/audible-kb/kb/commandpost-audible-manifest.md:
curl -u <user>:<pass> -X DELETE https://<host>/api/ingestion/kb/<kb_id>
```

`kb_documents` deletion cascades to `kb_chunks` (FK ON DELETE CASCADE). Then clear the manifest's rows. Audible generations (which also carry personal-register text) are deleted from the `/audible` history panel, or wholesale on the droplet: `DELETE FROM generations WHERE kind='audible';`. Note `/api/backup` keeps up to 10 DB snapshots under `data/backups/` on the droplet — purge those too if the goal is complete removal.

**Deleting rows does not scrub bytes.** SQLite runs here with `secure_delete` off, so deleted stories/generations remain readable in the DB file's free pages and WAL until the file is rewritten — and `/api/backup` streams that raw file. Before removing any nginx blocks, compact the database on the droplet:

```bash
sqlite3 /var/www/commandpost/data/commandpost.db "PRAGMA wal_checkpoint(TRUNCATE); VACUUM;"
```

Verify by downloading a fresh `/api/backup` (with credentials) and grepping it for a phrase from a deleted story — it must not appear.

Only after all content is gone AND the VACUUM has run, remove the `/audible` and `/api/audible/` location blocks and reload. **Keep the `/api/backup` block permanently** — it serves the entire raw database regardless of what this feature's rollback removed, and there is no reason it should ever be public.
