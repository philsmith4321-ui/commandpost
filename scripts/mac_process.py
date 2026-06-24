#!/usr/bin/env python3
"""
Local-Mac processing for the Video / shorts feature.

Transcribes an audio/video file locally on the Mac with faster-whisper, then
pushes the transcript (+ timestamped segments) to CommandPost's ingest endpoint.
Keeps heavy processing off the small server (mirrors the PWI local-transcribe pattern).

Usage:
  python3 scripts/mac_process.py /path/to/file.mp4 \
      --title "Episode 12" --type podcast

Options:
  --title TEXT     Title for the library item (default: file name)
  --type  TEXT     podcast|radio|video|interview|other (default: podcast)
  --url   URL      Site base URL (default: https://commandpost.rekindleleads.com)
  --model NAME     Whisper model size (default: base; try small/medium for accuracy)

Env:
  INGEST_SECRET    If set on the server, pass the same value here (sent as x-ingest-secret).

Requires: pip install faster-whisper   (and ffmpeg on PATH)
"""
import argparse
import json
import os
import subprocess
import sys
import urllib.request

DEFAULT_URL = "https://commandpost.rekindleleads.com"


def ffprobe_duration(path):
    try:
        out = subprocess.check_output(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", path],
            stderr=subprocess.STDOUT,
        )
        return float(out.decode().strip())
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser(description="Transcribe locally and push to CommandPost.")
    ap.add_argument("file", help="Path to the audio/video file")
    ap.add_argument("--title", default=None)
    ap.add_argument("--type", default="podcast")
    ap.add_argument("--url", default=os.environ.get("COMMANDPOST_URL", DEFAULT_URL))
    ap.add_argument("--model", default=os.environ.get("WHISPER_MODEL", "base"))
    args = ap.parse_args()

    if not os.path.exists(args.file):
        print(f"File not found: {args.file}", file=sys.stderr)
        sys.exit(1)

    title = args.title or os.path.splitext(os.path.basename(args.file))[0]
    print(f"Transcribing '{title}' with faster-whisper ({args.model})...")

    duration = ffprobe_duration(args.file)

    from faster_whisper import WhisperModel
    model = WhisperModel(args.model, device="cpu", compute_type="int8")
    segments_gen, info = model.transcribe(args.file, vad_filter=True)

    segments = []
    text_parts = []
    for s in segments_gen:
        text = s.text.strip()
        segments.append({"start": round(s.start, 2), "end": round(s.end, 2), "text": text})
        text_parts.append(text)
        print(f"  [{s.start:7.1f}s] {text}")

    transcript = " ".join(text_parts).strip()
    if duration is None:
        duration = getattr(info, "duration", None)

    payload = json.dumps({
        "title": title,
        "type": args.type,
        "transcript": transcript,
        "segments": segments,
        "duration": duration,
    }).encode()

    headers = {"Content-Type": "application/json"}
    if os.environ.get("INGEST_SECRET"):
        headers["x-ingest-secret"] = os.environ["INGEST_SECRET"]

    url = args.url.rstrip("/") + "/api/content/video/ingest"
    print(f"Pushing transcript ({len(transcript)} chars, {len(segments)} segments) to {url} ...")
    req = urllib.request.Request(url, data=payload, method="POST", headers=headers)
    with urllib.request.urlopen(req, timeout=180) as resp:
        body = json.loads(resp.read().decode())
    print(f"Done. Created media item #{body.get('id')}. Review clips in the Video tab.")


if __name__ == "__main__":
    main()
