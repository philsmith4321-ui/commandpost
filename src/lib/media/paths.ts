import path from 'path';

/** Shared upload directory (same location used by documents + content images). */
export const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');

/** Extensions we accept for audio/video processing. */
export const MEDIA_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.aac', '.mp4', '.mov', '.webm', '.ogg', '.flac'];

export const MEDIA_MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
};

export function mimeForFile(filename: string): string {
  return MEDIA_MIME[path.extname(filename).toLowerCase()] || 'application/octet-stream';
}
