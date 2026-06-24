import type Database from 'better-sqlite3';
import { getMediaItem, updateMediaItem, replaceClips } from '@/lib/queries/media-queries';
import { extractShorts } from '@/lib/media/shorts';
import type { TranscriptSegment } from '@/lib/types';

/**
 * Run (or re-run) shorts extraction for a media item that already has a transcript.
 * Sets status to 'extracting' then 'ready' (or 'error').
 */
export async function runExtraction(
  db: Database.Database,
  mediaItemId: number,
  maxClips = 6
): Promise<void> {
  const item = getMediaItem(db, mediaItemId);
  if (!item) throw new Error('Media item not found');

  if (!item.transcript || !item.transcript.trim()) {
    updateMediaItem(db, mediaItemId, { status: 'error', error: 'No transcript available to extract from.' });
    return;
  }

  updateMediaItem(db, mediaItemId, { status: 'extracting', error: null });

  let segments: TranscriptSegment[] = [];
  if (item.segments) {
    try {
      const parsed = JSON.parse(item.segments);
      if (Array.isArray(parsed)) segments = parsed;
    } catch {
      /* ignore malformed segments */
    }
  }

  try {
    const shorts = await extractShorts({ transcript: item.transcript, segments, maxClips });
    replaceClips(
      db,
      mediaItemId,
      shorts.map((s) => ({
        media_item_id: mediaItemId,
        title: s.title,
        start_seconds: s.start,
        end_seconds: s.end,
        transcript_excerpt: s.excerpt,
        reason: s.reason,
      }))
    );
    updateMediaItem(db, mediaItemId, { status: 'ready', error: null });
  } catch (err) {
    updateMediaItem(db, mediaItemId, {
      status: 'error',
      error: err instanceof Error ? err.message : 'Extraction failed',
    });
  }
}
