import { initDb } from '../src/lib/db';
import { isTwilioConfigured, sendSms } from '../src/lib/twilio';
import { recordAlert, hasAlertBeenSentInLastDays } from '../src/lib/queries/alert-queries';
import { getClientHealthSummary } from '../src/lib/queries/client-queries';

async function main() {
  const db = initDb();

  // Client health alerts
  const clientHealth = getClientHealthSummary(db);
  for (const h of clientHealth) {
    if (h.status === 'needs_attention') {
      if (!hasAlertBeenSentInLastDays(db, 'client_health_warning', h.clientId, 7)) {
        const message = `ALERT: ${h.clientName} needs attention — health score ${h.score}/100`;
        console.log(`Client health alert: ${message}`);
        if (isTwilioConfigured()) {
          const sent = await sendSms(message);
          if (sent) {
            recordAlert(db, { alert_type: 'client_health_warning', reference_id: h.clientId, message });
            console.log(`  SMS SENT: ${message}`);
          }
        }
      }
    }
  }

  db.close();
}

main().catch((err) => {
  console.error('Health check script failed:', err);
  process.exit(1);
});
