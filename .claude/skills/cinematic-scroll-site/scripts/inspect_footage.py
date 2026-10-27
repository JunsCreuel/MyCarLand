#!/usr/bin/env python3
"""원본 영상에서 스크롤/자동 재생에 쓸 구간을 고른다.

    python inspect_footage.py raw/clip.mp4 --duration 2.5            # 영상 전체에서 가장 잔잔한 2.5초 구간
    python inspect_footage.py raw/clip.mp4 --duration 2.5 --range 36 44
    python inspect_footage.py raw/clip.mp4 --sheet out/sheet.png     # 1초 간격 미리보기 시트

출력:
  - 컷(장면이 툭 바뀌는 곳) 시각 목록 — 구간 안에 컷이 있으면 프레임 재생 때 번쩍인다
  - 컷 없는 구간 중 화면 변화(카메라 움직임)가 가장 작은 순서 TOP N
    motion = 이웃 프레임 사이 밝기 차이 평균(0~255). 대략 6 이하면 매끈, 10 이상이면 끊겨 보이기 쉽다.
  - 원본 fps — 프레임을 뽑을 fps 를 정할 때 쓴다 (원본보다 높게 뽑아 봐야 같은 장면이 반복될 뿐)

필요: ffmpeg, ffprobe (PATH 에 있어야 함). 파이썬 표준 라이브러리만 쓴다.
"""
import argparse
import json
import re
import shutil
import subprocess
import sys


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, check=True)


def probe(path):
    out = run(["ffprobe", "-v", "error", "-select_streams", "v:0",
               "-show_entries", "stream=width,height,r_frame_rate:format=duration",
               "-of", "json", path]).stdout
    data = json.loads(out)
    st = data["streams"][0]
    num, den = st["r_frame_rate"].split("/")
    return {"width": st["width"], "height": st["height"],
            "fps": float(num) / float(den), "duration": float(data["format"]["duration"])}


def frame_diffs(path, start=None, end=None):
    """프레임마다 직전 프레임과의 평균 밝기 차이. 320px 로 줄여서 빠르게 계산한다."""
    cmd = ["ffmpeg", "-v", "error"]
    if start is not None:
        cmd += ["-ss", str(start)]
    if end is not None:
        cmd += ["-to", str(end)]
    cmd += ["-i", path, "-vf",
            "scale=320:-2,tblend=all_mode=difference,signalstats,"
            "metadata=print:key=lavfi.signalstats.YAVG:file=-",
            "-an", "-f", "null", "-"]
    out = run(cmd).stdout
    times = [float(x) for x in re.findall(r"pts_time:([\d.]+)", out)]
    vals = [float(x) for x in re.findall(r"YAVG=([\d.]+)", out)]
    offset = start or 0.0
    return [(t + offset, v) for t, v in zip(times, vals)]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video")
    ap.add_argument("--duration", type=float, default=2.5, help="찾을 구간 길이(초)")
    ap.add_argument("--range", nargs=2, type=float, metavar=("FROM", "TO"), help="이 시간 범위 안에서만 찾기")
    ap.add_argument("--step", type=float, default=0.25, help="구간 시작점을 옮겨 보는 간격(초)")
    ap.add_argument("--cut", type=float, default=40.0, help="이 값보다 크게 바뀌면 컷으로 본다")
    ap.add_argument("--top", type=int, default=8)
    ap.add_argument("--sheet", help="1초 간격 미리보기 시트(PNG) 저장 경로")
    args = ap.parse_args()

    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        sys.exit("ffmpeg/ffprobe 가 필요합니다 (Windows: winget install Gyan.FFmpeg, macOS: brew install ffmpeg)")

    info = probe(args.video)
    print(f"원본: {info['width']}x{info['height']}, {info['fps']:.2f}fps, {info['duration']:.1f}초")

    if args.sheet:
        cols = 5
        rows = max(1, int(info["duration"] // cols) + 1)
        font = "drawtext=text='%{pts\\:hms}':fontsize=18:fontcolor=yellow:x=6:y=6"
        run(["ffmpeg", "-v", "error", "-y", "-i", args.video, "-vf",
             f"fps=1,scale=320:-2,{font},tile={cols}x{rows}", "-frames:v", "1", args.sheet])
        print(f"미리보기 시트: {args.sheet}")

    lo, hi = args.range if args.range else (0.0, info["duration"])
    diffs = frame_diffs(args.video, lo, hi)
    cuts = [t for t, v in diffs if v > args.cut]
    print("컷 위치(초):", ", ".join(f"{c:.2f}" for c in cuts) or "없음")

    windows = []
    s = lo
    while s + args.duration <= hi + 1e-6:
        e = s + args.duration
        if not any(s <= c < e for c in cuts):
            vals = [v for t, v in diffs if s <= t < e]
            if vals:
                windows.append((sum(vals) / len(vals), max(vals), s))
        s = round(s + args.step, 3)
    windows.sort()

    print(f"\n가장 잔잔한 {args.duration}초 구간 TOP {args.top} (motion 낮을수록 매끈)")
    for mean, peak, start in windows[: args.top]:
        print(f"  --start {start:7.2f}   motion 평균 {mean:5.1f}  최대 {peak:5.1f}")
    if windows:
        best = windows[0][2]
        fps = min(48, round(info["fps"]))
        frames = round(args.duration * fps)
        print(f"\n추천: --start {best:.2f} --duration {args.duration} --fps {fps}  (→ {frames}장)")
        if frames > 120:
            print("  120장을 넘으면 extract-frames 가 fps 를 자동으로 낮춥니다. 구간을 줄이는 편이 더 매끈해요.")


if __name__ == "__main__":
    main()
