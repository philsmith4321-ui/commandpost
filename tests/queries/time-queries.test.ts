import { describe, it, expect, beforeEach } from 'vitest';
import { initDb } from '@/lib/db';
import { createTimeEntry, getTimeEntriesByProject, getUninvoicedByProject, getUninvoicedByClient, getProjectTimeSummary, getDeliverableHours, getTimeStats } from '@/lib/queries/time-queries';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeEach(() => {
  db = initDb(':memory:');
  db.exec("INSERT INTO clients (name) VALUES ('Test Client')");
  db.exec("INSERT INTO projects (client_id, name, hourly_rate) VALUES (1, 'Test Project', 150)");
  db.exec("INSERT INTO deliverables (project_id, title) VALUES (1, 'Design Homepage')");
});

describe('createTimeEntry', () => {
  it('creates and returns an entry id', () => {
    const id = createTimeEntry(db, {
      project_id: 1,
      deliverable_id: 1,
      duration_minutes: 90,
      entry_date: '2026-05-15',
      hourly_rate: 150,
      description: 'Mockups',
    });
    expect(id).toBe(1);
  });
});

describe('getTimeEntriesByProject', () => {
  it('returns entries sorted by date desc', () => {
    createTimeEntry(db, { project_id: 1, duration_minutes: 60, entry_date: '2026-05-14', hourly_rate: 150 });
    createTimeEntry(db, { project_id: 1, duration_minutes: 30, entry_date: '2026-05-15', hourly_rate: 150 });
    const entries = getTimeEntriesByProject(db, 1);
    expect(entries).toHaveLength(2);
    expect(entries[0].entry_date).toBe('2026-05-15');
  });
});

describe('getUninvoicedByProject', () => {
  it('returns only uninvoiced entries', () => {
    createTimeEntry(db, { project_id: 1, duration_minutes: 60, entry_date: '2026-05-14', hourly_rate: 150 });
    createTimeEntry(db, { project_id: 1, duration_minutes: 30, entry_date: '2026-05-15', hourly_rate: 150 });
    db.exec("UPDATE time_entries SET is_invoiced = 1 WHERE id = 1");
    const entries = getUninvoicedByProject(db, 1);
    expect(entries).toHaveLength(1);
    expect(entries[0].duration_minutes).toBe(30);
  });
});

describe('getUninvoicedByClient', () => {
  it('returns uninvoiced entries across all client projects', () => {
    createTimeEntry(db, { project_id: 1, duration_minutes: 60, entry_date: '2026-05-14', hourly_rate: 150 });
    const entries = getUninvoicedByClient(db, 1);
    expect(entries).toHaveLength(1);
  });
});

describe('getProjectTimeSummary', () => {
  it('computes total hours and uninvoiced amounts', () => {
    createTimeEntry(db, { project_id: 1, duration_minutes: 90, entry_date: '2026-05-14', hourly_rate: 100 });
    createTimeEntry(db, { project_id: 1, duration_minutes: 60, entry_date: '2026-05-15', hourly_rate: 150 });
    db.exec("UPDATE time_entries SET is_invoiced = 1 WHERE id = 1");
    const summary = getProjectTimeSummary(db, 1);
    expect(summary.totalHours).toBeCloseTo(2.5);
    expect(summary.totalCost).toBeCloseTo(300); // (90/60*100) + (60/60*150) = 150 + 150
    expect(summary.uninvoicedHours).toBeCloseTo(1);
    expect(summary.uninvoicedCost).toBeCloseTo(150);
  });
});

describe('getDeliverableHours', () => {
  it('returns hours per deliverable', () => {
    createTimeEntry(db, { project_id: 1, deliverable_id: 1, duration_minutes: 90, entry_date: '2026-05-14', hourly_rate: 150 });
    createTimeEntry(db, { project_id: 1, deliverable_id: 1, duration_minutes: 30, entry_date: '2026-05-15', hourly_rate: 150 });
    const hours = getDeliverableHours(db, 1);
    expect(hours[1]).toBeCloseTo(2);
  });
});

describe('getTimeStats', () => {
  it('returns monthly and uninvoiced stats', () => {
    const today = new Date().toISOString().slice(0, 10);
    createTimeEntry(db, { project_id: 1, duration_minutes: 120, entry_date: today, hourly_rate: 100 });
    const stats = getTimeStats(db);
    expect(stats.hoursThisMonth).toBeCloseTo(2);
    expect(stats.uninvoicedTotal).toBeCloseTo(200);
    expect(stats.uninvoicedHours).toBeCloseTo(2);
  });
});
