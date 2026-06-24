#!/bin/bash
# mac-ingest.sh — CommandPost local-transcribe + upload (same approach as PWI).
#
# Transcribes the file LOCALLY on the Mac with faster-whisper (fast, off the
# small server), then uploads the media file + transcript to CommandPost. The
# server skips Whisper, AI-extracts short-form clips, and keeps the media file
# so clips can be cut. Opens the Video tab when done.
#
# Usage:
#   ./mac-ingest.sh <file> [title] [type]
#     file:  .mp3/.wav/.m4a/.aac/.mp4/.mov/.webm/.ogg/.flac
#     title: display title (default: filename stem)
#     type:  podcast | radio | video | interview | other (default: podcast)

set -uo pipefail

BASE="${COMMANDPOST_URL:-https://commandpost.rekindleleads.com}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Reuse the faster-whisper venv that already powers PWI local transcription.
VENV="${WHISPER_VENV:-$HOME/paul-winkler-ai/transcribe-venv}"
MODEL="${WHISPER_MODEL:-small}"
ALLOWED="mp3 wav m4a aac mp4 mov webm ogg flac"

FILE="${1:-}"
if [ -z "$FILE" ]; then echo "Usage: mac-ingest.sh <file> [title] [type]"; exit 1; fi
if [ ! -f "$FILE" ]; then echo "File not found: $FILE"; exit 1; fi

NAME="$(basename "$FILE")"
EXT="$(printf '%s' "${NAME##*.}" | tr '[:upper:]' '[:lower:]')"
case " $ALLOWED " in
  *" $EXT "*) ;;
  *) echo "Unsupported file type .$EXT (allowed: $ALLOWED)"; exit 1 ;;
esac
TITLE="${2:-${NAME%.*}}"
TYPE="${3:-podcast}"

if [ ! -x "$VENV/bin/python3" ]; then
  echo "✗ Whisper venv not found at $VENV"
  echo "  Set WHISPER_VENV, or create one: python3 -m venv <dir> && <dir>/bin/pip install faster-whisper"
  exit 1
fi

echo "================================================================"
echo " CommandPost Ingest   (local transcribe → upload)"
echo " File:  $NAME"
echo " Title: $TITLE"
echo " Type:  $TYPE"
echo "================================================================"

# 1) Transcribe locally on the Mac (faster-whisper). KMP_DUPLICATE_LIB_OK works
#    around a libomp double-load crash with ctranslate2 on macOS.
OUT="$(mktemp -t cp-transcript).json"
echo "▶ Transcribing locally with faster-whisper ($MODEL)…"
KMP_DUPLICATE_LIB_OK=TRUE "$VENV/bin/python3" "$SCRIPT_DIR/transcribe_local.py" "$FILE" "$OUT" "$MODEL"
if [ ! -s "$OUT" ]; then echo "✗ Transcription produced no output"; exit 1; fi

# 2) Split the transcript JSON into upload fields.
TXT="$(mktemp)"; SEG="$(mktemp)"
DUR="$(python3 - "$OUT" "$TXT" "$SEG" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
open(sys.argv[2], "w").write(d.get("transcript", ""))
json.dump(d.get("segments", []), open(sys.argv[3], "w"))
print(d.get("duration") or "")
PY
)"

# 3) Upload media file + transcript. Server skips Whisper, runs AI extraction.
echo "▶ Uploading media + transcript to $BASE …"
RESP="$(curl -s --fail-with-body -X POST "$BASE/api/content/video/upload" \
  -F "file=@$FILE" -F "title=$TITLE" -F "type=$TYPE" \
  -F "transcript=@$TXT;type=text/plain" \
  -F "segments=@$SEG;type=application/json" \
  -F "duration=$DUR")"
RC=$?
rm -f "$OUT" "$TXT" "$SEG"
if [ $RC -ne 0 ]; then echo "✗ Upload failed: $RESP"; exit 1; fi

ID="$(printf '%s' "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("id",""))' 2>/dev/null)"
if [ -z "$ID" ]; then echo "✗ Upload failed: $RESP"; exit 1; fi

echo "✓ Uploaded as item #$ID — extracting clips on the server…"
for i in $(seq 1 60); do
  S="$(curl -s "$BASE/api/content/video/$ID")"
  STATUS="$(printf '%s' "$S" | python3 -c 'import sys,json;print(json.load(sys.stdin)["status"])' 2>/dev/null || echo '?')"
  printf "\r   status: %-16s" "$STATUS"
  case "$STATUS" in
    ready)
      echo; echo "✓ Done — suggested clips:"
      printf '%s' "$S" | python3 -c 'import sys,json
for c in json.load(sys.stdin)["clips"]:
    print("   •", c["title"])'
      echo; echo "Opening the Video tab to review & cut clips…"
      open "$BASE/content/video"; exit 0 ;;
    error)
      echo; echo "✗ Processing error:"
      printf '%s' "$S" | python3 -c 'import sys,json;print("  ",json.load(sys.stdin).get("error"))'
      exit 1 ;;
  esac
  sleep 3
done
echo; echo "Still processing — check $BASE/content/video"
open "$BASE/content/video"
