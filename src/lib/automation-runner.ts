import type Database from 'better-sqlite3';
import { getEnabledAutomationsByTrigger, logAutomationRun } from '@/lib/queries/automation-queries';
import { createNotification } from '@/lib/notifications';
import type { NotificationType } from '@/lib/types';

export async function runAutomations(db: Database.Database, triggerType: string, context: {
  entityType?: string;
  entityId?: number;
  entityName?: string;
  email?: string;
  details?: string;
}) {
  const automations = getEnabledAutomationsByTrigger(db, triggerType);
  
  for (const auto of automations) {
    try {
      const triggerDetail = `${triggerType}: ${context.entityName || context.entityId || ''}`;
      let actionDetail = '';

      switch (auto.action_type) {
        case 'create_notification': {
          await createNotification(db, {
            type: triggerType as NotificationType,
            title: `[Auto] ${auto.name}`,
            message: context.details || context.entityName || null,
            link: context.entityType && context.entityId
              ? `/${context.entityType === 'invoice' ? 'finances/invoices' : context.entityType === 'lead' ? 'pipeline' : context.entityType + 's'}/${context.entityId}`
              : null,
          });
          actionDetail = 'Created notification';
          break;
        }
        case 'send_email': {
          if (context.email) {
            const { sendEmail } = await import('@/lib/email');
            const config = auto.action_config ? JSON.parse(auto.action_config) : {};
            await sendEmail({
              to: context.email,
              subject: config.subject || `[CommandPost] ${auto.name}`,
              html: `<div style="font-family:sans-serif;"><h2>${auto.name}</h2><p>${context.details || context.entityName || ''}</p></div>`,
            });
            actionDetail = `Emailed ${context.email}`;
          } else {
            actionDetail = 'Skipped: no email';
          }
          break;
        }
        case 'create_followup': {
          if (context.entityType === 'lead' && context.entityId) {
            const followupDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            db.prepare("UPDATE leads SET follow_up_date = ?, updated_at = datetime('now') WHERE id = ?")
              .run(followupDate, context.entityId);
            actionDetail = `Follow-up set for ${followupDate}`;
          } else {
            actionDetail = 'Skipped: not a lead';
          }
          break;
        }
        default:
          actionDetail = `Unknown action: ${auto.action_type}`;
      }

      logAutomationRun(db, auto.id, triggerDetail, actionDetail);
    } catch (err) {
      console.error(`[automation] Failed to run ${auto.name}:`, err);
      logAutomationRun(db, auto.id, `${triggerType}: error`, String(err));
    }
  }
}
