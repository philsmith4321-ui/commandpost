import { bufferGql, bufferOrgId, BufferError } from './client';
import { serviceToPlatform } from './map';
import type { BufferChannel, BufferPost, ShareMode } from './types';

const POST_FIELDS = `
  id status text dueAt sentAt channelId channelService shareMode externalLink allowedActions
`;

const POST_ACTION_RESULT = `
  __typename
  ... on PostActionSuccess { post { ${POST_FIELDS} } }
  ... on RestProxyError { message code }
  ... on InvalidInputError { message }
  ... on LimitReachedError { message }
  ... on UnauthorizedError { message }
  ... on NotFoundError { message }
  ... on UnexpectedError { message }
`;

interface RawChannel { id: string; service: string; name: string; }
interface RawPost {
  id: string; status: string; text: string | null; dueAt: string | null; sentAt: string | null;
  channelId: string; channelService: string; shareMode: ShareMode | null;
  externalLink: string | null; allowedActions: string[] | null;
}

function toChannel(c: RawChannel): BufferChannel {
  return { id: c.id, service: c.service, name: c.name, platform: serviceToPlatform(c.service) };
}

function toPost(p: RawPost): BufferPost {
  return {
    id: p.id,
    status: p.status,
    text: p.text ?? '',
    dueAt: p.dueAt,
    sentAt: p.sentAt,
    channelId: p.channelId,
    channelService: p.channelService,
    platform: serviceToPlatform(p.channelService),
    shareMode: p.shareMode,
    externalLink: p.externalLink,
    allowedActions: p.allowedActions ?? [],
  };
}

// Branch on the PostActionPayload union; return the post or throw the typed error.
function unwrapPostAction(result: { __typename: string; post?: RawPost; message?: string }): BufferPost {
  if (result.__typename === 'PostActionSuccess' && result.post) return toPost(result.post);
  throw new BufferError(result.message ?? `Buffer error (${result.__typename})`);
}

export async function listChannels(): Promise<BufferChannel[]> {
  const data = await bufferGql<{ channels: RawChannel[] }>(
    `query($o:OrganizationId!){ channels(input:{organizationId:$o}){ id service name } }`,
    { o: bufferOrgId() },
  );
  return data.channels.map(toChannel);
}

export async function listPosts(opts: { channelIds?: string[]; status?: string[]; first?: number }): Promise<BufferPost[]> {
  const filter: Record<string, unknown> = {};
  if (opts.channelIds?.length) filter.channelIds = opts.channelIds;
  if (opts.status?.length) filter.status = opts.status;
  const data = await bufferGql<{ posts: { edges: Array<{ node: RawPost }> } }>(
    `query($i:PostsInput!,$first:Int){ posts(input:$i, first:$first){ edges { node { ${POST_FIELDS} } } } }`,
    { i: { organizationId: bufferOrgId(), filter }, first: opts.first ?? 100 },
  );
  return data.posts.edges.map((e) => toPost(e.node));
}

export async function createPost(args: { channelId: string; text: string; mode: ShareMode; dueAt?: string }): Promise<BufferPost> {
  const data = await bufferGql<{ createPost: { __typename: string; post?: RawPost; message?: string } }>(
    `mutation($i:CreatePostInput!){ createPost(input:$i){ ${POST_ACTION_RESULT} } }`,
    { i: {
      channelId: args.channelId,
      text: args.text,
      schedulingType: 'automatic',
      mode: args.mode,
      ...(args.dueAt ? { dueAt: args.dueAt } : {}),
      assets: [],
      source: 'commandpost',
    } },
  );
  return unwrapPostAction(data.createPost);
}

export async function editPost(args: { id: string; mode: ShareMode; text?: string; dueAt?: string }): Promise<BufferPost> {
  const data = await bufferGql<{ editPost: { __typename: string; post?: RawPost; message?: string } }>(
    `mutation($i:EditPostInput!){ editPost(input:$i){ ${POST_ACTION_RESULT} } }`,
    { i: {
      id: args.id,
      schedulingType: 'automatic',
      mode: args.mode,
      ...(args.text !== undefined ? { text: args.text } : {}),
      ...(args.dueAt ? { dueAt: args.dueAt } : {}),
      assets: [],
    } },
  );
  return unwrapPostAction(data.editPost);
}

export async function deletePost(id: string): Promise<string> {
  const data = await bufferGql<{ deletePost: { __typename: string; id?: string; message?: string } }>(
    `mutation($i:DeletePostInput!){ deletePost(input:$i){ __typename ... on DeletePostSuccess { id } ... on VoidMutationError { message } } }`,
    { i: { id } },
  );
  if (data.deletePost.__typename === 'DeletePostSuccess' && data.deletePost.id) return data.deletePost.id;
  throw new BufferError(data.deletePost.message ?? 'Buffer delete failed');
}
