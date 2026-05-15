import type Database from 'better-sqlite3';

export interface MonthlyRevenue {
  month: string; // 'YYYY-MM'
  amount: number;
}

export interface ClientProfitability {
  client_id: number;
  client_name: string;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number | null;
}

export interface YtdStats {
  revenue: number;
  expenses: number;
  profit: number;
}

export interface ClientRevenue {
  client_id: number;
  client_name: string;
  total: number;
}

export function getMonthlyRevenue(db: Database.Database): MonthlyRevenue[] {
  const months: MonthlyRevenue[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const amount = (db.prepare(
      "SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'paid' AND strftime('%Y-%m', paid_at) = ?"
    ).get(month) as any).total;
    months.push({ month, amount });
  }
  return months;
}

export function getProfitabilityByClient(db: Database.Database, period?: string): ClientProfitability[] {
  let revenueWhere = "i.status = 'paid'";
  let expenseWhere = '1=1';
  const year = new Date().getFullYear();

  if (period === 'this_month') {
    const m = `${year}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    revenueWhere += ` AND strftime('%Y-%m', i.paid_at) = '${m}'`;
    expenseWhere += ` AND strftime('%Y-%m', e.expense_date) = '${m}'`;
  } else if (period === 'last_3_months') {
    const d = new Date(); d.setMonth(d.getMonth() - 3);
    const cutoff = d.toISOString().split('T')[0];
    revenueWhere += ` AND i.paid_at >= '${cutoff}'`;
    expenseWhere += ` AND e.expense_date >= '${cutoff}'`;
  } else if (period === 'ytd') {
    revenueWhere += ` AND strftime('%Y', i.paid_at) = '${year}'`;
    expenseWhere += ` AND strftime('%Y', e.expense_date) = '${year}'`;
  }

  const rows = db.prepare(`
    SELECT * FROM (
      SELECT c.id as client_id, c.name as client_name,
        COALESCE((SELECT SUM(i.total_amount) FROM invoices i WHERE i.client_id = c.id AND ${revenueWhere}), 0) as revenue,
        COALESCE((SELECT SUM(e.amount) FROM expenses e WHERE e.client_id = c.id AND ${expenseWhere}), 0) as expenses
      FROM clients c
      WHERE c.deleted_at IS NULL
    ) WHERE revenue > 0 OR expenses > 0
    ORDER BY (revenue - expenses) DESC
  `).all() as any[];

  return rows.map((r: any) => ({
    client_id: r.client_id,
    client_name: r.client_name,
    revenue: r.revenue,
    expenses: r.expenses,
    profit: r.revenue - r.expenses,
    margin: r.revenue > 0 ? Math.round(((r.revenue - r.expenses) / r.revenue) * 100) : null,
  }));
}

export function getYtdStats(db: Database.Database): YtdStats {
  const year = String(new Date().getFullYear());
  const revenue = (db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'paid' AND strftime('%Y', paid_at) = ?").get(year) as any).total;
  const expenses = (db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE strftime('%Y', expense_date) = ?").get(year) as any).total;
  return { revenue, expenses, profit: revenue - expenses };
}

export function getRevenueByClient(db: Database.Database, limit: number = 5): ClientRevenue[] {
  return db.prepare(`
    SELECT c.id as client_id, c.name as client_name, COALESCE(SUM(i.total_amount), 0) as total
    FROM invoices i JOIN clients c ON i.client_id = c.id
    WHERE i.status = 'paid' AND c.deleted_at IS NULL
    GROUP BY c.id
    ORDER BY total DESC
    LIMIT ?
  `).all(limit) as ClientRevenue[];
}
