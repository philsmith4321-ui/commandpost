// scripts/buffer-smoke.ts
// Usage: npx tsx scripts/buffer-smoke.ts   (requires BUFFER_API_KEY + BUFFER_ORG_ID in env)
import { listChannels, createPost, deletePost } from '../src/lib/buffer/queries';

async function main() {
  const channels = await listChannels();
  console.log('Channels:', channels.map((c) => `${c.platform ?? c.service}:${c.name}`).join(', '));
  if (!channels.length) throw new Error('No channels — check key/org');

  const draft = await createPost({
    channelId: channels[0].id,
    text: 'CommandPost smoke test — please ignore',
    mode: 'customScheduled',
    dueAt: '2026-12-01T17:00:00.000Z',
  });
  console.log('Created draft/post id:', draft.id, 'status:', draft.status);

  const deleted = await deletePost(draft.id);
  console.log('Deleted id:', deleted);
  console.log('SMOKE OK');
}

main().catch((err) => { console.error('SMOKE FAILED:', err); process.exit(1); });
