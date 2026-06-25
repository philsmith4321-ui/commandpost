import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/buffer/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/buffer/client')>('@/lib/buffer/client');
  return { ...actual, bufferGql: vi.fn(), bufferOrgId: () => 'org-123' };
});

import { bufferGql, BufferError } from '@/lib/buffer/client';
import { listChannels, listPosts, createPost, deletePost, editPost } from '@/lib/buffer/queries';

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

  it('editPost returns post on PostActionSuccess', async () => {
    mockGql.mockResolvedValue({ editPost: { __typename: 'PostActionSuccess', post: {
      id: 'p9', status: 'scheduled', text: 'edited', dueAt: '2026-12-02T10:00:00.000Z',
      sentAt: null, channelId: 'c1', channelService: 'linkedin', shareMode: 'customScheduled',
      externalLink: null, allowedActions: ['edit'],
    } } });
    const post = await editPost({ id: 'p9', mode: 'customScheduled', text: 'edited', dueAt: '2026-12-02T10:00:00.000Z' });
    expect(post.id).toBe('p9');
    expect(post.text).toBe('edited');
    expect(post.platform).toBe('linkedin');
    const vars = mockGql.mock.calls[0][1] as { i: Record<string, unknown> };
    expect(vars.i.id).toBe('p9');
    expect(vars.i.schedulingType).toBe('automatic');
    expect(vars.i.mode).toBe('customScheduled');
    expect(vars.i.assets).toEqual([]);
  });

  it('editPost throws BufferError on a union error member', async () => {
    mockGql.mockResolvedValue({ editPost: { __typename: 'NotFoundError', message: 'post not found' } });
    const err = await editPost({ id: 'pX', mode: 'addToQueue' }).catch((e) => e);
    expect(err).toBeInstanceOf(BufferError);
    expect(err.message).toMatch(/post not found/);
  });

  it('createPost forwards saveToDraft when set', async () => {
    mockGql.mockResolvedValue({ createPost: { __typename: 'PostActionSuccess', post: {
      id: 'd1', status: 'draft', text: 'hi', dueAt: null, sentAt: null,
      channelId: 'c1', channelService: 'twitter', shareMode: 'addToQueue',
      externalLink: null, allowedActions: [],
    } } });
    const post = await createPost({ channelId: 'c1', text: 'hi', mode: 'addToQueue', saveToDraft: true });
    expect(post.status).toBe('draft');
    const vars = mockGql.mock.calls[0][1] as { i: Record<string, unknown> };
    expect(vars.i.saveToDraft).toBe(true);
  });

  it('createPost omits saveToDraft when not set', async () => {
    mockGql.mockResolvedValue({ createPost: { __typename: 'PostActionSuccess', post: {
      id: 'd2', status: 'scheduled', text: 'hi', dueAt: null, sentAt: null,
      channelId: 'c1', channelService: 'twitter', shareMode: 'addToQueue',
      externalLink: null, allowedActions: [],
    } } });
    await createPost({ channelId: 'c1', text: 'hi', mode: 'addToQueue' });
    const vars = mockGql.mock.calls[0][1] as { i: Record<string, unknown> };
    expect('saveToDraft' in vars.i).toBe(false);
  });
});
