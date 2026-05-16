import type Database from 'better-sqlite3';
import type { NotificationType } from '@/lib/types';
import { insertNotification, getEmailDeliveryForType } from '@/lib/queries/notification-queries';
import { sendEmail } from '@/lib/email';
import { buildAlertEmail } from '@/lib/email-templates';

interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  message: string | null;
  link: string | null;
}

export async function createNotification(db: Database.Database, input: CreateNotificationInput): Promise<number> {
  const id = insertNotification(db, input);

  const delivery = getEmailDeliveryForType(db, input.type);

  if (delivery === 'immediate') {
    const to = process.env.NOTIFICATION_TO_EMAIL;
    if (to) {
      const html = buildAlertEmail(input.title, input.message, input.link);
      await sendEmail({ to, subject: `[CommandPost] ${input.title}`, html });
    }
  }

  return id;
}
