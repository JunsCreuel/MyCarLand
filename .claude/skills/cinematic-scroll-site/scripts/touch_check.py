#!/usr/bin/env python3
"""snap 모드 모바일 터치 점검: python touch_check.py <사이트 주소> [--chromium 경로]

페이지 안에서 TouchEvent 를 직접 만들어 실제 손가락처럼 시간 간격을 두고 보낸다.
(CDP Input.dispatchTouchEvent 는 이벤트 사이가 ~50ms 씩 벌어져 빠른 튕김을 시험할 수 없었다)

두 번째 섹션 맨 위에서 시작해 6가지 동작 후 어느 섹션에 멈췄는지 확인한다.
"""
import argparse, sys
from playwright.sync_api import sync_playwright

# 손가락 움직임: (이름, 시작 y, 이동량(위로 +), 단계 수, 단계 간격 ms, 기대: 0 제자리 / 1 다음 / -1 이전)
CASES = [
    ("20px 살짝 끌기", 500, 20, 8, 30, 0),
    ("80px 천천히 끌기", 500, 80, 10, 30, 1),
    ("30px 빠르게 튕기기", 500, 30, 4, 16, 1),
    ("아래로 80px 끌기", 400, -80, 10, 30, -1),
    ("탭", 500, 0, 1, 30, 0),
]

SWIPE_JS = """async ([y0, dy, steps, gap]) => {
  const el = document.elementFromPoint(195, y0) || document.body;
  const mk = (y) => new Touch({ identifier: 1, target: el, clientX: 195, clientY: y });
  const fire = (type, y) => el.dispatchEvent(new TouchEvent(type, {
    bubbles: true, cancelable: true,
    touches: type === 'touchend' ? [] : [mk(y)], targetTouches: type === 'touchend' ? [] : [mk(y)],
    changedTouches: [mk(y)] }));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  fire('touchstart', y0);
  for (let i = 1; i <= steps; i++) { await wait(gap); fire('touchmove', y0 - dy * i / steps); }
  await wait(gap); fire('touchend', y0 - dy);
}"""

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("--chromium", default=None, help="Playwright 내장 브라우저가 없을 때 Chromium 경로")
    a = ap.parse_args()
    fails = 0
    with sync_playwright() as p:
        br = p.chromium.launch(**({"executable_path": a.chromium} if a.chromium else {}))
        ctx = br.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(a.url, wait_until="load"); pg.wait_for_timeout(800)
        tops = pg.evaluate("[...document.querySelectorAll('main > section')].map(s => s.offsetTop)")
        if len(tops) < 3:
            print("섹션이 3개 미만이라 점검할 수 없음"); return 1
        def where():
            y = pg.evaluate("scrollY")
            return min(range(len(tops)), key=lambda i: abs(tops[i] - y)), y
        for name, y0, dy, steps, gap, expect in CASES:
            pg.evaluate(f"window.scrollTo(0, {tops[1]})"); pg.wait_for_timeout(700)
            pg.evaluate(SWIPE_JS, [y0, dy, steps, gap]); pg.wait_for_timeout(1500)
            i, y = where()
            ok = i == 1 + expect and abs(y - tops[i]) <= 4
            fails += not ok
            print(f"{'✓' if ok else '✗'} {name:<14} → 섹션 {i} (y={y}, 기대 섹션 {1 + expect})")
        # 맨 위에서 아래로 당기기 → 제자리 (당겨서 새로고침·고무줄 없음)
        pg.evaluate("window.scrollTo(0, 0)"); pg.wait_for_timeout(700)
        pg.evaluate(SWIPE_JS, [300, -150, 10, 30]); pg.wait_for_timeout(1500)
        y = pg.evaluate("scrollY"); ok = y == 0; fails += not ok
        print(f"{'✓' if ok else '✗'} 첫 화면에서 아래로 당기기 → y={y}")
        if errs: print("페이지 에러:", errs); fails += 1
        br.close()
    print("통과" if not fails else f"실패 {fails}개")
    return 1 if fails else 0

if __name__ == "__main__":
    sys.exit(main())
