"""촬영 가이드 검증 (Phase 6): python scripts/qa-guide.py [주소] [스크린샷 폴더]

모바일 390×844 기준으로
- 도식 번호 누르기 → 해당 카드로 이동, 도식 강조가 스크롤을 따라가는지
- 촬영 모드를 처음부터 끝까지 넘기기
- 새로고침 후 체크 상태 유지
- 버튼 높이 44px 이상, 본문 글자 16px 이상, 가로 스크롤, 콘솔 에러
"""
import os, sys
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4173/").rstrip("/") + "/guide.html"
OUT = sys.argv[2] if len(sys.argv) > 2 else "qa-screenshots"
os.makedirs(OUT, exist_ok=True)
CHROMIUM = os.environ.get("PW_CHROMIUM")
results = []
def check(ok, msg):
    results.append((ok, msg)); print(("  OK   " if ok else "  FAIL ") + msg)

with sync_playwright() as p:
    b = p.chromium.launch(**({"executable_path": CHROMIUM} if CHROMIUM else {}))
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page(); errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and "404" not in m.text and errors.append(m.text))
    page.goto(BASE, wait_until="networkidle"); page.wait_for_timeout(500)
    page.screenshot(path=f"{OUT}/guide-mobile-01-intro.png")
    page.evaluate("document.querySelector('#positions').scrollIntoView()"); page.wait_for_timeout(400)
    page.screenshot(path=f"{OUT}/guide-mobile-02-diagram.png")

    # 도식 번호 3 누르기 → 카드 3이 화면 안에
    page.tap(".diagram .pin[data-shot='3']"); page.wait_for_timeout(1200)
    top = page.evaluate("document.getElementById('shot-3').getBoundingClientRect().top")
    check(0 <= top < 844, f"3번을 누르면 3번 카드로 이동 (카드 위치 {round(top)}px)")
    cur = page.evaluate("document.querySelector('.pin.is-current')?.dataset.shot")
    check(cur == "3", f"도식에서 3번이 강조됨 (현재 강조: {cur})")
    page.screenshot(path=f"{OUT}/guide-mobile-03-card3.png")
    page.evaluate("document.getElementById('shot-10').scrollIntoView({block:'center'})"); page.wait_for_timeout(500)
    cur = page.evaluate("document.querySelector('.pin.is-current')?.dataset.shot")
    check(cur == "10", f"스크롤하면 강조가 따라감 (10번 카드에서 강조: {cur})")

    # 촬영 모드 끝까지
    page.evaluate("window.scrollTo(0,0)"); page.wait_for_timeout(300)
    page.click(".needs [data-start-shoot]"); page.wait_for_timeout(400)
    check(page.is_visible("#shoot[open]"), "촬영 시작 → 촬영 모드 열림")
    page.screenshot(path=f"{OUT}/guide-mobile-04-shoot-1.png")
    counts = []
    for i in range(17):
        counts.append(page.inner_text("[data-shoot-count]"))
        if i == 2: page.screenshot(path=f"{OUT}/guide-mobile-05-shoot-3.png")
        page.click("[data-shoot-next]"); page.wait_for_timeout(80)
    check(counts[0] == "1 / 12" and counts[11] == "12 / 12" and counts[12] == "선택 1 / 5", f"진행 표시 {counts[0]} → {counts[11]} → {counts[12]}")
    check(page.is_visible("[data-shoot-finish]"), "마지막 컷 다음 → 완료 화면")
    check(page.inner_text("[data-finish-title]") == "다 찍었어요", f"완료 문구: {page.inner_text('[data-finish-title]')}")
    page.screenshot(path=f"{OUT}/guide-mobile-06-shoot-done.png")
    page.click("[data-finish-send]"); page.wait_for_timeout(800)
    done = page.inner_text(".list-head [data-done-count]")
    check(done == "12", f"목록의 찍음 개수 {done}/12")

    # 새로고침 후 유지
    page.check("[data-checklist=landscape]", force=True)
    page.reload(wait_until="networkidle"); page.wait_for_timeout(400)
    done = page.inner_text(".list-head [data-done-count]")
    land = page.is_checked("[data-checklist=landscape]")
    check(done == "12" and land, f"새로고침 후 체크 유지 (찍음 {done}, 가로 체크 {land})")
    check(page.inner_text("[data-start-label]") == "촬영 시작", "다 찍으면 버튼 문구가 '촬영 시작'으로")
    page.evaluate("document.querySelector('#send').scrollIntoView()"); page.wait_for_timeout(400)
    page.screenshot(path=f"{OUT}/guide-mobile-07-send.png")

    # 크기 검사
    small = page.evaluate("""() => [...document.querySelectorAll('main button, main a, .dock button, label.done-toggle, label.checklist__item')]
        .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height < 44 && !el.classList.contains('skip-link'); })
        .map(el => (el.className + ' ' + el.textContent.trim()).slice(0, 40))""")
    check(not small, f"44px 미만 터치 영역: {small or '없음'}")
    tiny = page.evaluate("""() => [...document.querySelectorAll('.card__howto, .rule__why, .tip p, .intro__lede, .needs__list li, .shoot__howto')]
        .filter(el => parseFloat(getComputedStyle(el).fontSize) < 15).length""")
    check(tiny == 0, f"설명 글 15px 미만: {tiny}개 (본문 16px)")
    over = page.evaluate("document.documentElement.scrollWidth > innerWidth")
    check(not over, "가로 스크롤 없음")

    # 저장소가 막힌 브라우저에서도 동작
    ctx2 = b.new_context(viewport={"width": 390, "height": 844})
    ctx2.add_init_script("Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } })")
    p2 = ctx2.new_page(); e2 = []; p2.on("pageerror", lambda e: e2.append(str(e)))
    p2.goto(BASE, wait_until="networkidle"); p2.wait_for_timeout(300)
    p2.click(".needs [data-start-shoot]"); p2.click("[data-shoot-next]")
    check(not e2 and p2.is_visible("[data-storage-note]"), f"localStorage 차단 시에도 동작 + 안내 표시 (에러 {e2 or '없음'})")

    pc = b.new_page(viewport={"width": 1440, "height": 900})
    pc.goto(BASE, wait_until="networkidle"); pc.wait_for_timeout(400)
    pc.screenshot(path=f"{OUT}/guide-pc-01.png")
    pc.evaluate("document.getElementById('shot-6').scrollIntoView({block:'center'})"); pc.wait_for_timeout(500)
    pc.screenshot(path=f"{OUT}/guide-pc-02-sticky.png")
    check(not errors, f"콘솔 에러: {errors or '없음'}")
    b.close()

print(f"\n{sum(ok for ok, _ in results)}/{len(results)} 통과")
