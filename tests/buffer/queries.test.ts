import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/buffer/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/buffer/client')>('@/lib/buffer/client');
  return { ...actual, bufferGql: vi.fn(), bufferOrgId: () => 'org-123' };
});

import { bufferGql, BufferError } from '@/lib/buffer/client';
import { listChannels, listPosts, createPost, deletePost } from '@/lib/buffer/queries';

const mockGql = vi.mocked(bufferGql);

describe('buffer queries', () => {
  beforeEach(() => mockGql.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it('listChannels maps service to platform', async () => {
    mockGql.mockResolvedValue({ channels: [{ id: 'c1', service: 'twitter', name: 'X acct' }] });
    const channels = await listChannels();
    expect(channels[0]).toMatchObject({ id: 'c1', service: 'twitter', platform: 'x' });
  });

  it('listPosts flattens edges and maps platform', async () => {
    mockGql.mockResolvedValue({
      posts: { edges: [{ node: {
        id: 'p1', status: 'scheduled', text: 'hi', dueAt: '2026-12-01T17:00:00.000Z',
        sentAt: null, channelId: 'c1', channelService: 'facebook', shareMode: 'customScheduled',
        externalLink: null, allowedActions: ['edit', 'delete'],
      } }] },
    });
    const posts = await listPosts({});
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ id: 'p1', platform: 'facebook' });
  });

  it('createPost returns post on PostActionSuccess', async () => {
    mockGql.mockResolvedValue({ createPost: { __typename: 'PostActionSuccess', post: {
      id: 'p2', status: 'scheduled', text: 'hi', dueAt: '2026-12-01T17:00:00.000Z',
      sentAt: null, channelId: 'c1', channelService: 'twitter', shareMode: 'customScheduled',
      externalLink: null, allowedActions: [],
    } } });
    const post = await createPost({ channelId: 'c1', text: 'hi', mode: 'customScheduled', dueAt: '2026-12-01T17:00:00.000Z' });
    expect(post.id).toBe('p2');
    expect(post.platform).toBe('x');
  });

  it('createPost throws BufferError on a union error member', async () => {
    mockGql.mockResolvedValue({ createPost: { __typename: 'InvalidInputError', message: 'text too long' } });
    await expect(
      createPost({ channelId: 'c1', text: 'x', mode: 'addToQueue' }),
    ).rejects.toThrow('text too long');
  });

  it('deletePost resolves on DeletePostSuccess', async () => {
    mockGql.mockResolvedValue({ deletePost: { __typename: 'DeletePostSuccess', id: 'p1' } });
    await expect(deletePost('p1')).resolves.toBe('p1');
  });

  it('deletePost throws on VoidMutationError', async () => {
    mockGql.mockResolvedValue({ deletePost: { __typename: 'VoidMutationError', message: 'nope' } });
    await expect(deletePost('p1')).rejects.toBeInstanceOf(BufferError);
  });
});
