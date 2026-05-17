'use client';

import { useState } from 'react';
import { sendInvoiceEmailAction } from '@/lib/actions/invoice-actions';

export function SendInvoiceEmail({ invoiceId, clientEmail, invoiceNumber, amount, dueDate }: {
  invoiceId: number;
  clientEmail: string | null;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors">
        Email Invoice
      </button>
    );
  }

  return (
    <form action={sendInvoiceEmailAction} className="p-4 bg-gray-900 border border-gray-800 rounded-lg space-y-3">
      <input type="hidden" name="id" value={invoiceId} />
      <div>
        <label className="text-xs text-gray-500 uppercase">Recipient Email</label>
        <input name="email" type="email" required defaultValue={clientEmail || ''}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm mt-1" />
      </div>
      <div>
        <label className="text-xs text-gray-500 uppercase">Message (optional)</label>
        <textarea name="message" rows={3}
          defaultValue={`Please find your invoice ${invoiceNumber} for $${amount.toLocaleString()}, due ${dueDate}. Thank you for your business!`}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm mt-1 resize-none" />
      </div>
      <div className="flex gap-2">
        <button type="submit" className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg">
          Send Email
        </button>
        <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
          Cancel
        </button>
      </div>
    </form>
  );
}
