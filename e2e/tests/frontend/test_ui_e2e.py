"""Browser E2E: real Chromium -> nginx -> FastAPI -> Qdrant/SQLite."""

import re

import pytest
from playwright.sync_api import Page, expect

# Pad button ids for each song (see PLAN.md section 3).
TIME = ["c-right", "a", "c-down", "c-right", "a", "c-down"]  # A4 D4 F4 A4 D4 F4
SARIA = ["c-down", "c-right", "c-left", "c-down", "c-right", "c-left"]
LULLABY = ["c-left", "c-up", "c-right", "c-left", "c-up", "c-right"]
STORMS = ["a", "c-down", "c-up", "a", "c-down", "c-up"]
STORMS_WRONG_LAST = ["a", "c-down", "c-up", "a", "c-down", "c-left"]  # near-miss
ZIGZAG = ["a", "c-up", "a", "c-up", "a", "c-up"]  # matches nothing

# Counts oscillator starts/stops so tests can observe sound without hearing it.
AUDIO_SPY = """
window.__audio = { started: 0, stopped: 0, times: [] };
const s = OscillatorNode.prototype.start, t = OscillatorNode.prototype.stop;
OscillatorNode.prototype.start = function (...a) { window.__audio.started++; window.__audio.times.push(a[0]); return s.apply(this, a); };
OscillatorNode.prototype.stop = function (...a) { window.__audio.stopped++; return t.apply(this, a); };
"""


@pytest.fixture
def app(page: Page) -> Page:
    page.add_init_script(AUDIO_SPY)
    page.goto("/")
    expect(page.get_by_test_id("ocarina")).to_be_visible()
    return page


def play(page: Page, ids: list[str]) -> None:
    for i in ids:
        page.get_by_test_id(f"pad-{i}").click()


def staff_notes(page: Page):
    return page.locator("[data-testid=staff] .staff-note")


def audio(page: Page) -> dict:
    return page.evaluate("window.__audio")


def test_page_layout(app: Page):
    expect(app).to_have_title("Ocarina RAG")
    for i in ["a", "c-up", "c-down", "c-left", "c-right"]:
        expect(app.get_by_test_id(f"pad-{i}")).to_be_visible()
    expect(app.get_by_test_id("staff")).to_be_visible()
    # pitch / volume / reset live outside the ocarina
    ocarina = app.get_by_test_id("ocarina")
    for tid in ["shift-up", "shift-down", "volume", "reset"]:
        expect(ocarina.get_by_test_id(tid)).to_have_count(0)
        expect(app.get_by_test_id(tid)).to_be_visible()


def test_notes_appear_on_the_staff_and_submit_waits_for_sixth(app: Page):
    play(app, TIME[:5])
    expect(staff_notes(app)).to_have_count(5)
    expect(app.get_by_role("dialog")).to_have_count(0)
    play(app, TIME[5:])
    expect(staff_notes(app)).to_have_count(6)
    expect(app.get_by_role("dialog")).to_be_visible()


@pytest.mark.parametrize(
    "ids,title",
    [(TIME, "Song of Time"), (SARIA, "Saria's Song"), (LULLABY, "Zelda's Lullaby"), (STORMS, "Song of Storms")],
)
def test_recognised_song_pops_up(app: Page, ids, title):
    play(app, ids)
    dialog = app.get_by_role("dialog")
    expect(dialog.get_by_test_id("banner-title")).to_have_text(title)
    expect(dialog.get_by_test_id("banner-confidence")).to_contain_text("100% match")


def test_popup_reset_closes_and_clears(app: Page):
    play(app, TIME)
    expect(app.get_by_role("dialog")).to_be_visible()
    app.get_by_test_id("banner-reset").click()
    expect(app.get_by_role("dialog")).to_have_count(0)
    expect(staff_notes(app)).to_have_count(0)


def test_popup_closes_with_escape(app: Page):
    play(app, TIME)
    expect(app.get_by_role("dialog")).to_be_visible()
    app.keyboard.press("Escape")
    expect(app.get_by_role("dialog")).to_have_count(0)
    expect(staff_notes(app)).to_have_count(0)


def test_success_plays_the_jingle_and_replay_plays_it_again(app: Page):
    play(app, TIME)
    expect(app.get_by_role("dialog")).to_be_visible()
    after_success = audio(app)["started"]
    app.get_by_test_id("replay").click()
    assert audio(app)["started"] >= after_success + 12  # 6 notes x (tone + vibrato)


def test_lullaby_jingle_uses_its_real_note_lengths(app: Page):
    play(app, LULLABY)
    expect(app.get_by_role("dialog")).to_be_visible()
    app.wait_for_timeout(300)
    app.evaluate("window.__audio.times.length = 0")  # ignore the pad presses and first jingle
    app.get_by_test_id("replay").click()
    times = sorted(set(app.evaluate("window.__audio.times")))  # tone + vibrato share a start time
    assert len(times) == 6
    gaps = [b - a for a, b in zip(times, times[1:])]
    beat = 60 / 84  # Zelda's Lullaby: 3/4 at 84 bpm
    # half, quarter, dotted half, half, quarter  (the 6th note's own length is not observable here)
    for gap, beats in zip(gaps, [2, 1, 3, 2, 1]):
        assert gap == pytest.approx(beats * beat, rel=0.02)


def test_transposition_via_pitch_toggle_is_shown_with_a_small_penalty(app: Page):
    app.get_by_test_id("shift-up").click()
    app.get_by_test_id("shift-up").click()
    expect(app.get_by_test_id("shift-value")).to_have_text("+2 st")
    play(app, SARIA)
    confidence = app.get_by_role("dialog").get_by_test_id("banner-confidence")
    expect(confidence).to_contain_text("98% match")
    expect(confidence).to_contain_text("+2 st")


def test_near_miss_shows_candidates_not_a_popup(app: Page):
    play(app, STORMS_WRONG_LAST)
    results = app.get_by_test_id("results")
    expect(results).to_be_visible()
    expect(results.get_by_test_id("result-song-of-storms")).to_contain_text("Interval")
    expect(app.get_by_role("dialog")).to_have_count(0)


def test_no_match_drops_the_actual_notes_then_resets(app: Page):
    play(app, ZIGZAG)
    expect(app.get_by_test_id("no-match")).to_be_visible()
    expect(app.get_by_test_id("staff")).to_have_class(re.compile("staff-falling"))
    expect(staff_notes(app)).to_have_count(6)  # the real notes, shown once (no duplicate row)
    # automatic reset after the 2 s fall
    expect(staff_notes(app)).to_have_count(0, timeout=5000)
    expect(app.get_by_test_id("no-match")).to_have_count(0)


def test_reset_button_clears_a_partial_snippet(app: Page):
    play(app, TIME[:3])
    expect(staff_notes(app)).to_have_count(3)
    app.get_by_test_id("reset").click()
    expect(staff_notes(app)).to_have_count(0)
    expect(app.get_by_test_id("reset")).to_be_disabled()


def test_sound_starts_on_press_and_sustains_until_release(app: Page):
    pad = app.get_by_test_id("pad-a")
    pad.hover()
    app.mouse.down()
    app.wait_for_function("window.__audio.started > 0")
    app.wait_for_timeout(300)
    assert audio(app)["stopped"] == 0  # still held -> still sounding
    app.mouse.up()
    app.wait_for_function("window.__audio.stopped > 0")


def test_sound_is_released_when_the_pointer_leaves_before_release(app: Page):
    app.get_by_test_id("pad-a").hover()
    app.mouse.down()
    app.wait_for_function("window.__audio.started > 0")
    app.mouse.move(5, 5)  # drag off the button
    app.mouse.up()
    app.wait_for_function("window.__audio.stopped > 0")


def test_no_horizontal_scroll_on_a_phone(page: Page):
    page.set_viewport_size({"width": 360, "height": 740})
    page.goto("/")
    expect(page.get_by_test_id("ocarina")).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    box = page.get_by_test_id("pad-c-right").bounding_box()
    assert box and box["x"] + box["width"] <= 360
