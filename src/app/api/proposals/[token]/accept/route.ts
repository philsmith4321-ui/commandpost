import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getProposalByToken, getProposalItems, updateProposalStatus } from '@/lib/queries/proposal-queries';
import { createContract } from '@/lib/queries/contract-queries';
import { createNotification } from '@/lib/notifications';
import { createClient } from '@/lib/queries/client-queries';
import { markLeadWon } from '@/lib/queries/lead-queries';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const db = getDb();

  const proposal = getProposalByToken(db, token);
  if (!proposal) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (proposal.status !== 'sent') {
    return NextResponse.json({ error: 'Proposal cannot be accepted' }, { status: 400 });
  }

  if (proposal.valid_until && new Date(proposal.valid_until) < new Date()) {
    return NextResponse.json({ error: 'Proposal has expired' }, { status: 400 });
  }

  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  // 1. Mark proposal accepted
  db.prepare("UPDATE proposals SET status = 'accepted', accepted_at = ?, accepted_ip = ?, updated_at = ? WHERE id = ?")
    .run(now, ip, now, proposal.id);

  // 2. Resolve client_id
  let clientId = proposal.client_id;

  if (!clientId && proposal.lead_id) {
    // Convert lead to client
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(proposal.lead_id) as any;
    if (lead && lead.stage !== 'won') {
      const newClientId = createClient(db, {
        name: lead.business_name,
        contact_person: lead.contact_person,
        email: lead.email,
        phone: lead.phone,
        source: lead.source,
        status: 'active',
        monthly_value: lead.estimated_value,
      });
      markLeadWon(db, proposal.lead_id, newClientId);
      clientId = newClientId;
      db.prepare('UPDATE proposals SET client_id = ? WHERE id = ?').run(clientId, proposal.id);
    }
  }

  if (!clientId) {
    return NextResponse.json({ error: 'No client could be resolved' }, { status: 400 });
  }

  // 3. Create project with deliverables from items
  const items = getProposalItems(db, proposal.id);
  const projectResult = db.prepare(
    "INSERT INTO projects (client_id, name, status) VALUES (?, ?, 'active')"
  ).run(clientId, proposal.title);
  const projectId = Number(projectResult.lastInsertRowid);

  for (const item of items) {
    db.prepare(
      "INSERT INTO deliverables (project_id, title, status) VALUES (?, ?, 'not_started')"
    ).run(projectId, item.description);
  }

  // 4. Create contract
  createContract(db, {
    client_id: clientId,
    proposal_id: proposal.id,
    title: proposal.title,
    terms_summary: proposal.scope || null,
    signed_at: now.slice(0, 10),
    expires_at: proposal.valid_until || null,
  });

  // 5. Notification
  await createNotification(db, {
    type: 'proposal_accepted',
    title: `Proposal accepted: ${proposal.title}`,
    message: proposal.lead_name || proposal.client_name || null,
    link: `/contracts`,
  });

  return NextResponse.json({ ok: true });
}
