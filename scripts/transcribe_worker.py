#!/usr/bin/env python3
"""
Transcription worker for the Video / shorts feature.

Usage: python3 transcribe_worker.py <media_item_id>

Spawned (detached) by the upload API route. It:
  1. Reads the media item from the SQLite DB.
  2. Transcribes the uploaded file with faster-whisper (CPU).
  3. Writes transcript + timestamped segments + duration back to the DB.
  4. Triggers shorts extraction via the Next.js API.

Env overrides:
  DB_PATH         path to commandpost.db (default: ../data/commandpost.db)
  UPLOAD_DIR      uploads dir (default: ../data/uploads)
  WHISPER_MODEL   whisper model size (default: base)
  WHISPER_COMPUTE compute type (default: int8)
  APP_URL         base URL of the running app (default: http://127.0.0.1:3004)
"""
import json
import os
import sqlite3
import sys
import traceback
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

DB_PATH = os.environ.get("DB_PATH", os.path.join(ROOT, "data", "commandpost.db"))
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", os.path.join(ROOT, "data", "uploads"))
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "base")
WHISPER_COMPUTE = os.environ.get("WHISPER_COMPUTE", "int8")
APP_URL = os.environ.get("APP_URL", "http://127.0.0.1:3004")


def db_connect():
    conn = sqlite3.connect(DB_PATH, timeout=60)
    conn.execute("PRAGMA busy_timeout = 60000")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def set_status(conn, media_id, status, error=None):
    conn.execute(
        "UPDATE media_items SET status = ?, error = ?, updated_at = datetime('now') WHERE id = ?",
        (status, error, media_id),
    )
    conn.commit()


def ffprobe_duration(path):
    import subprocess
    ffprobe = os.environ.get("FFPROBE_PATH", "ffprobe")
    try:
        out = subprocess.check_output(
            [ffprobe, "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", path],
            stderr=subprocess.STDOUT,
        )
        return float(out.decode().strip())
    except Exception:
        return None


def trigger_extraction(media_id):
    url = f"{APP_URL}/api/content/video/{media_id}/extract"
    req = urllib.request.Request(url, data=b"{}", method="POST",
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            resp.read()
    except Exception as e:
        print(f"Failed to trigger extraction: {e}", file=sys.stderr)


def main():
    if len(sys.argv) < 2:
        print("Usage: transcribe_worker.py <media_item_id>", file=sys.stderr)
        sys.exit(1)
    media_id = int(sys.argv[1])

    conn = db_connect()
    row = conn.execute("SELECT filename FROM media_items WHERE id = ?", (media_id,)).fetchone()
    if not row or not row[0]:
        set_status(conn, media_id, "error", "No file to transcribe")
        return
    filename = row[0]
    path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(path):
        set_status(conn, media_id, "error", f"File not found: {filename}")
        return

    try:
        set_status(conn, media_id, "transcribing")

        duration = ffprobe_duration(path)

        from faster_whisper import WhisperModel
        model = WhisperModel(WHISPER_MODEL, device="cpu", compute_type=WHISPER_COMPUTE)
        segments_gen, info = model.transcribe(path, vad_filter=True)

        segments = []
        text_parts = []
        for s in segments_gen:
            text = s.text.strip()
            segments.append({"start": round(s.start, 2), "end": round(s.end, 2), "text": text})
            text_parts.append(text)

        transcript = " ".join(text_parts).strip()
        if duration is None:
            duration = getattr(info, "duration", None)

        conn.execute(
            """UPDATE media_items
               SET transcript = ?, segments = ?, duration_seconds = ?,
                   status = 'extracting', error = NULL, updated_at = datetime('now')
               WHERE id = ?""",
            (transcript, json.dumps(segments), duration, media_id),
        )
        conn.commit()
    except Exception as e:
        traceback.print_exc()
        set_status(conn, media_id, "error", str(e)[:500])
        return
    finally:
        conn.close()

    # Hand off to the app to run AI shorts extraction.
    trigger_extraction(media_id)


if __name__ == "__main__":
    main()
