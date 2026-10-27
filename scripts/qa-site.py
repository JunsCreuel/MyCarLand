"""소개 사이트 검증 (Phase 6): python scripts/qa-site.py [주소] [스크린샷 폴더]

- 모바일 390×844, PC 1440×900 에서 처음부터 끝까지 스크롤하며 섹션별 스크린샷
- 콘솔 에러·실패한 요청
- 첫 화면(load 이후 1초까지) 전송 용량, 끝까지 스크롤한 뒤 전체 전송 용량
- 빠르게 스크롤할 때 캔버스가 비어 있는(검은) 순간이 있는지 (모바일은 4G 속도로 제한)
- 가로 스크롤, 44px 미만 버튼
필요: pip install playwright (브라우저 경로는 PW_CHROMIUM 환경변수로 지정 가능)
"""
import os, sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4173/"
OUT = sys.argv[2] if len(sys.argv) > 2 else "qa-screenshots"
os.makedirs(OUT, exist_ok=True)
CHROMIUM = os.environ.get("PW_CHROMIUM")

# 캔버스 가운데 영역의 평균 밝기 (0이면 아무것도 안 그려진 것)
BRIGHTNESS = """(el) => {
  const c = el; if (!c.width) return 0;
  const ctx = c.getContext('2d'); const w = Math.floor(c.width/4), h = Math.floor(c.height/4);
  const d = ctx.getImageData(Math.floor(c.width*3/8), Math.floor(c.height*3/8), w, h).data;
  let s = 0; for (let i = 0; i < d.length; i += 16) s += d[i] + d[i+1] + d[i+2];
  return s / (d.length / 16) / 3;
}"""

def run(p, name, viewport, mobile):
    b = p.chromium.launch(**({"executable_path": CHROMIUM} if CHROMIUM else {}))
    ctx = b.new_context(viewport=viewport, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile)
    page = ctx.new_page()
    cdp = ctx.new_cdp_session(page)
    cdp.send("Network.enable")
    if mobile:  # 빠른 4G 정도: 9Mbps 다운로드, 지연 60ms
        cdp.send("Network.emulateNetworkConditions", {"offline": False, "latency": 60,
                 "downloadThroughput": 9_000_000 / 8, "uploadThroughput": 1_500_000 / 8})
    sizes = {"total": 0}
    cdp.on("Network.loadingFinished", lambda e: sizes.__setitem__("total", sizes["total"] + e["encodedDataLength"]))
    errors, failed = [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.on("requestfailed", lambda r: failed.append(r.url))
    page.on("response", lambda r: r.status >= 400 and failed.append(f"{r.status} {r.url}"))

    page.goto(BASE, wait_until="load")
    first = sizes["total"]  # 첫 화면(글꼴·JS·CSS·첫 프레임)에 필요한 양 = load 시점까지
    page.wait_for_timeout(1500)
    after_idle = sizes["total"]  # load 직후 이어서 받는 첫 장면 나머지 프레임 포함
    first_frame_ok = page.eval_on_selector("canvas", BRIGHTNESS) > 3
    page.screenshot(path=f"{OUT}/{name}-00-first.png")

    # 섹션별로 천천히 내려가며 스크린샷
    stops = page.evaluate("""() => [...document.querySelectorAll('main > section')].flatMap(s => {
        const top = s.offsetTop, h = s.offsetHeight - innerHeight;
        return s.classList.contains('scene--scrub') ? [[s.id, top + h*0.15], [s.id, top + h*0.5], [s.id, top + h*0.85]] : [[s.id, top]];
    })""")
    for i, (sid, y) in enumerate(stops, 1):
        page.evaluate(f"window.scrollTo(0, {y})"); page.wait_for_timeout(1200)
        page.screenshot(path=f"{OUT}/{name}-{i:02d}-{sid}.png")
    page.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)"); page.wait_for_timeout(2500)
    total = sizes["total"]

    # 빠른 스크롤: 새 탭에서 맨 위부터 바퀴/스와이프로 빠르게 내리면서 50ms 마다 캔버스 밝기 확인
    page2 = ctx.new_page()
    page2.goto(BASE, wait_until="load"); page2.wait_for_timeout(300)
    blank = 0; samples = 0
    H = page2.evaluate("document.documentElement.scrollHeight")
    y = 0
    while y < H:
        y += 300
        page2.mouse.wheel(0, 300)
        page2.wait_for_timeout(30)
        vals = page2.evaluate("""(f) => [...document.querySelectorAll('.scene--scrub')].filter(s => {
            const r = s.getBoundingClientRect(); return r.top <= 0 && r.bottom >= innerHeight; })
            .map(s => (new Function('return ' + f))()(s.querySelector('canvas')))""", BRIGHTNESS)
        for v in vals:
            samples += 1
            if v <= 3: blank += 1
    page2.close()

    overflow = page.evaluate("document.documentElement.scrollWidth > innerWidth")
    small = page.evaluate("""() => [...document.querySelectorAll('a, button')].filter(el => {
        const r = el.getBoundingClientRect(); return r.width && r.height < 44 && getComputedStyle(el).display !== 'none' && el.closest('footer') === null;
    }).map(el => el.textContent.trim().slice(0, 20))""")
    b.close()
    mb = lambda n: f"{n/1024/1024:.2f}MB"
    print(f"\n[{name} {viewport['width']}×{viewport['height']}]")
    print(f"  첫 화면 전송량(load 시점): {mb(first)}  (첫 프레임 표시: {'예' if first_frame_ok else '아니오'})")
    print(f"  load 후 1.5초까지(첫 장면 프레임 미리 받기 포함): {mb(after_idle)}")
    print(f"  끝까지 스크롤한 뒤 전체 전송량: {mb(total)}")
    print(f"  빠른 스크롤 중 빈 캔버스: {blank}/{samples} 회")
    print(f"  가로 스크롤: {'있음' if overflow else '없음'} / 44px 미만 버튼: {small or '없음'}")
    print(f"  콘솔 에러: {errors or '없음'} / 실패한 요청: {failed or '없음'}")

with sync_playwright() as p:
    run(p, "mobile", {"width": 390, "height": 844}, True)
    run(p, "pc", {"width": 1440, "height": 900}, False)
