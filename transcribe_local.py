"""Local Mac transcription for CommandPost using faster-whisper.

Transcribes an audio/video file on-device (much faster than the small server)
and writes {transcript, segments, duration} JSON to the given output path.

Usage: python3 transcribe_local.py <audio_file> <out.json> [model]
"""
import json
import sys
import time
from pathlib import Path

from faster_whisper import WhisperModel


def main():
    if len(sys.argv) < 3:
        print("Usage: transcribe_local.py <audio_file> <out.json> [model]", file=sys.stderr)
        sys.exit(1)

    audio = Path(sys.argv[1])
    out_path = Path(sys.argv[2])
    model_size = sys.argv[3] if len(sys.argv) > 3 else "small"

    if not audio.exists():
        print(f"Error: file not found: {audio}", file=sys.stderr)
        sys.exit(1)

    print(f"Loading faster-whisper model ({model_size})…")
    t0 = time.time()
    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    print(f"  Model loaded in {time.time() - t0:.1f}s")

    print(f"Transcribing locally on the Mac: {audio.name} ({audio.stat().st_size / 1e6:.1f} MB)")
    t0 = time.time()
    segments_iter, info = model.transcribe(str(audio), beam_size=5)

    segments = []
    parts = []
    for seg in segments_iter:
        segments.append({"start": round(seg.start, 2), "end": round(seg.end, 2), "text": seg.text.strip()})
        parts.append(seg.text.strip())
        if info.duration > 0:
            pct = min(100, (seg.end / info.duration) * 100)
            print(f"\r  Progress: {pct:.0f}% ({seg.end:.0f}s / {info.duration:.0f}s)", end="", flush=True)

    full_text = " ".join(parts).strip()
    print(f"\n  Done in {time.time() - t0:.0f}s — {len(full_text)} chars, {len(segments)} segments")

    out_path.write_text(json.dumps({
        "transcript": full_text,
        "segments": segments,
        "duration": info.duration,
    }))


if __name__ == "__main__":
    main()
