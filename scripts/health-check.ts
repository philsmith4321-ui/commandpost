import { initDb } from '../src/lib/db';
import { listActiveEndpoints } from '../src/lib/queries/endpoint-queries';
import { recordHealthCheck, getLastHealthCheck, getLastNHealthChecks, deleteOldHealthChecks } from '../src/lib/queries/health-check-queries';
import { getOpenIncident, createIncident, resolveIncident } from '../src/lib/queries/incident-queries';

const TIMEOUT_MS = 10_000;

async function checkEndpoint(url: string): Promise<{ statusCode: number | null; responseTimeMs: number; isHealthy: boolean }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const responseTimeMs = Date.now() - start;
    const isHealthy = response.status >= 200 && response.status < 300;
    return { statusCode: response.status, responseTimeMs, isHealthy };
  } catch {
    return { statusCode: null, responseTimeMs: Date.now() - start, isHealthy: false };
  }
}

async function main() {
  const db = initDb();

  const endpoints = listActiveEndpoints(db);
  const now = Date.now();

  for (const ep of endpoints) {
    // Check if enough time has passed since last check
    const last = getLastHealthCheck(db, ep.id);
    if (last) {
      const lastTime = new Date(last.checked_at + 'Z').getTime();
      if (now - lastTime < ep.check_interval_seconds * 1000) {
        continue; // Not time yet
      }
    }

    console.log(`Checking ${ep.name} (${ep.url})...`);
    const result = await checkEndpoint(ep.url);

    recordHealthCheck(db, {
      endpoint_id: ep.id,
      status_code: result.statusCode,
      response_time_ms: result.responseTimeMs,
      is_healthy: result.isHealthy ? 1 : 0,
    });

    console.log(`  ${result.isHealthy ? 'OK' : 'FAIL'} — ${result.statusCode ?? 'timeout'} in ${result.responseTimeMs}ms`);

    // Down detection: last 2 checks both unhealthy
    if (!result.isHealthy) {
      const last2 = getLastNHealthChecks(db, ep.id, 2);
      if (last2.length >= 2 && last2.every(c => c.is_healthy === 0)) {
        const openIncident = getOpenIncident(db, ep.id);
        if (!openIncident) {
          createIncident(db, ep.id);
          console.log(`  INCIDENT CREATED for ${ep.name}`);
        }
      }
    }

    // Recovery: healthy + open incident → resolve
    if (result.isHealthy) {
      const openIncident = getOpenIncident(db, ep.id);
      if (openIncident) {
        resolveIncident(db, openIncident.id);
        console.log(`  INCIDENT RESOLVED for ${ep.name}`);
      }
    }
  }

  // Data retention
  const deleted = deleteOldHealthChecks(db);
  if (deleted > 0) {
    console.log(`Cleaned up ${deleted} old health checks.`);
  }

  db.close();
}

main().catch((err) => {
  console.error('Health check script failed:', err);
  process.exit(1);
});
