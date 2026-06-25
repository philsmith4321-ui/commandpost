import { getDb } from '@/lib/db';
import { FinanceTabs } from '@/components/finance-tabs';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

interface Subscription {
  id: number;
  name: string;
  category: string;
  amount: number;
  frequency: string;
  next_renewal: string | null;
  is_active: number;
  notes: string | null;
}

async function addSubscriptionAction(formData: FormData) {
  'use server';
  const db = getDb();
  db.prepare(
    "INSERT INTO subscriptions (name, category, amount, frequency, next_renewal, notes) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(
    formData.get('name'),
    formData.get('category') || 'software',
    Number(formData.get('amount')),
    formData.get('frequency') || 'monthly',
    formData.get('next_renewal') || null,
    formData.get('notes') || null
  );
  revalidatePath('/finances/subscriptions');
}

async function toggleSubscriptionAction(formData: FormData) {
  'use server';
  const db = getDb();
  const id = Number(formData.get('id'));
  const current = Number(formData.get('is_active'));
  db.prepare("UPDATE subscriptions SET is_active = ? WHERE id = ?").run(current ? 0 : 1, id);
  revalidatePath('/finances/subscriptions');
}

async function deleteSubscriptionAction(formData: FormData) {
  'use server';
  const db = getDb();
  db.prepare("DELETE FROM subscriptions WHERE id = ?").run(Number(formData.get('id')));
  revalidatePath('/finances/subscriptions');
}

export default function SubscriptionsPage() {
  const db = getDb();
  const subs = db.prepare("SELECT * FROM subscriptions ORDER BY is_active DESC, name").all() as Subscription[];

  const activeSubs = subs.filter(s => s.is_active);
  const monthlyTotal = activeSubs.reduce((s, sub) =>
    s + (sub.frequency === 'yearly' ? sub.amount / 12 : sub.amount), 0);
  const yearlyTotal = monthlyTotal * 12;

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-4">Finances</h1>
      <FinanceTabs active="subscriptions" />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Monthly Cost</p>
          <p className="text-2xl font-bold text-red-400">${monthlyTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Yearly Cost</p>
          <p className="text-2xl font-bold text-white">${yearlyTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Active Subscriptions</p>
          <p className="text-2xl font-bold text-white">{activeSubs.length}</p>
        </div>
      </div>

      {/* Add Subscription */}
      <form action={addSubscriptionAction} className="flex flex-wrap gap-3 mb-6 p-4 bg-gray-900 border border-gray-800 rounded-lg">
        <input name="name" placeholder="Service name" required className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
        <input name="amount" type="number" placeholder="Amount" required min="0.01" step="0.01" className="w-24 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
        <select name="frequency" className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
        <select name="category" className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
          <option value="software">Software</option>
          <option value="servers">Servers</option>
          <option value="marketing">Marketing</option>
          <option value="other">Other</option>
        </select>
        <input name="next_renewal" type="date" className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
        <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg">Add</button>
      </form>

      {/* Subscription List */}
      <div className="space-y-2">
        {subs.map(sub => {
          const monthly = sub.frequency === 'yearly' ? sub.amount / 12 : sub.amount;
          return (
            <div key={sub.id} className={`flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-lg ${!sub.is_active ? 'opacity-50' : ''}`}>
              <div>
                <span className="text-white font-medium">{sub.name}</span>
                <div className="flex gap-3 mt-1 text-xs text-gray-400">
                  <span className="px-1.5 py-0.5 bg-gray-800 rounded">{sub.category}</span>
                  <span>${sub.amount}/{sub.frequency === 'yearly' ? 'yr' : 'mo'}</span>
                  {sub.frequency === 'yearly' && <span>(${monthly.toFixed(0)}/mo)</span>}
                  {sub.next_renewal && <span>Renews {sub.next_renewal}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <form action={toggleSubscriptionAction}>
                  <input type="hidden" name="id" value={sub.id} />
                  <input type="hidden" name="is_active" value={sub.is_active} />
                  <button type="submit" className={`text-xs px-2 py-1 rounded ${sub.is_active ? 'text-yellow-400 hover:bg-yellow-900/20' : 'text-green-400 hover:bg-green-900/20'}`}>
                    {sub.is_active ? 'Pause' : 'Activate'}
                  </button>
                </form>
                <form action={deleteSubscriptionAction}>
                  <input type="hidden" name="id" value={sub.id} />
                  <button type="submit" className="text-xs text-red-400 hover:text-red-300 px-2 py-1">Delete</button>
                </form>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
