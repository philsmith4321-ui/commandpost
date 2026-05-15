import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initDb } from '@/lib/db';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-leads.db');

describe('lead queries', () => {
  let db: Database.Database;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    db = initDb(TEST_DB_PATH);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('creates a lead with initial stage history', async () => {
    const { createLead, getLeadById } = await import('@/lib/queries/lead-queries');
    const id = createLead(db, {
      business_name: 'Acme Corp',
      contact_person: 'John Doe',
      email: 'john@acme.com',
      source: 'referral',
      estimated_value: 5000,
    });
    expect(id).toBeGreaterThan(0);
    const lead = getLeadById(db, id);
    expect(lead!.business_name).toBe('Acme Corp');
    expect(lead!.stage).toBe('new');

    const history = db.prepare('SELECT * FROM lead_stage_history WHERE lead_id = ?').all(id) as any[];
    expect(history).toHaveLength(1);
    expect(history[0].stage).toBe('new');
  });

  it('lists leads grouped by stage', async () => {
    const { createLead, listLeadsByStage } = await import('@/lib/queries/lead-queries');
    createLead(db, { business_name: 'Lead A', source: 'referral' });
    createLead(db, { business_name: 'Lead B', source: 'website' });
    const byStage = listLeadsByStage(db);
    expect(byStage.new).toHaveLength(2);
    expect(byStage.contacted).toHaveLength(0);
  });

  it('updates lead stage and records history', async () => {
    const { createLead, updateLeadStage, getLeadById } = await import('@/lib/queries/lead-queries');
    const id = createLead(db, { business_name: 'Test Lead', source: 'outbound' });
    updateLeadStage(db, id, 'contacted');
    const lead = getLeadById(db, id);
    expect(lead!.stage).toBe('contacted');

    const history = db.prepare('SELECT * FROM lead_stage_history WHERE lead_id = ? ORDER BY entered_at').all(id) as any[];
    expect(history).toHaveLength(2);
    expect(history[0].stage).toBe('new');
    expect(history[1].stage).toBe('contacted');
  });

  it('marks lead as lost with reason', async () => {
    const { createLead, markLeadLost, getLeadById } = await import('@/lib/queries/lead-queries');
    const id = createLead(db, { business_name: 'Lost Lead', source: 'website' });
    markLeadLost(db, id, 'too_expensive');
    const lead = getLeadById(db, id);
    expect(lead!.stage).toBe('lost');
    expect(lead!.lost_reason).toBe('too_expensive');
  });

  it('adds and lists lead notes', async () => {
    const { createLead, addLeadNote, listLeadNotes } = await import('@/lib/queries/lead-queries');
    const id = createLead(db, { business_name: 'Note Lead', source: 'referral' });
    addLeadNote(db, id, 'Called, left voicemail');
    addLeadNote(db, id, 'Sent follow-up email');
    const notes = listLeadNotes(db, id);
    expect(notes).toHaveLength(2);
    expect(notes[0].content).toBe('Sent follow-up email');
  });

  it('gets pipeline summary', async () => {
    const { createLead, getPipelineSummary } = await import('@/lib/queries/lead-queries');
    createLead(db, { business_name: 'A', source: 'referral', estimated_value: 3000 });
    createLead(db, { business_name: 'B', source: 'website', estimated_value: 2000 });
    const summary = getPipelineSummary(db);
    expect(summary.totalLeads).toBe(2);
    expect(summary.totalValue).toBe(5000);
  });
});
