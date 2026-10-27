"""Patch M: Today order, moon tile, moon headline, mood charts, scroll on navigation,
compatibility thresholds text. Every replacement must match exactly once."""
import re
import sys

path = sys.argv[1]
s = open(path, encoding='utf-8').read()


def r(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        raise SystemExit('expected %d match(es), found %d for: %r' % (count, n, old[:90]))
    s = s.replace(old, new)


# 1) «Твоё настроение» goes below «Сегодня да / Не стоит».
lines = s.split('\n')
mood_start = next(i for i, l in enumerate(lines) if l.startswith('<div style="margin: 18px 16px 0; padding: 14px 16px; border-radius: 26px; background: {{ c.glassSky }}') and '{{ t.moodTitle }}' in lines[i + 1])
mood_end = next(i for i in range(mood_start, mood_start + 20) if lines[i].startswith('<p style="margin: 10px 0 0; font-size: 14.5px; line-height: 1.45">{{ mood.sum }}</p>')) + 1
assert lines[mood_end] == '</div>', lines[mood_end][:80]
yn_start = mood_end + 2
assert lines[mood_end + 1] == '' and lines[yn_start].startswith('<div style="margin: 12px 16px 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-radius: 26px;'), lines[yn_start][:90]
yn_end = yn_start + 3
assert lines[yn_end] == '</div>', lines[yn_end][:80]
mood = lines[mood_start:mood_end + 1]
yn = lines[yn_start:yn_end + 1]
yn[0] = yn[0].replace('<div style="margin: 12px 16px 0; display: grid;', '<div style="margin: 18px 16px 0; display: grid;', 1)
mood[0] = mood[0].replace('<div style="margin: 18px 16px 0; padding: 14px 16px;', '<div style="margin: 12px 16px 0; padding: 14px 16px;', 1)
lines[mood_start:yn_end + 1] = yn + [''] + mood
s = '\n'.join(lines)

# 2) Moon tile: phase bigger, illumination at the bottom, no list of calendars.
r('<img src="/_blob/dc480753d5ad531cf04054c087563b0c" alt="" style="width: 40px; height: 40px; flex: none; object-fit: contain"><span style="display: flex; flex-direction: column; gap: 2px; min-width: 0"><strong style="font-size: 14.5px; line-height: 1.2; font-weight: 600">{{ t.moonPhase }}</strong><span style="font-size: 12.5px; line-height: 1.3; color: {{ ink.fg3 }}">{{ t.moonSign }}</span></span></div>\n<span style="font-size: 12.5px; color: {{ ink.fg3 }}">{{ t.moonIllum }}</span>\n<span style="margin-top: auto; font-size: 12px; line-height: 1.3; font-weight: 600; color: {{ c.accent }}">{{ t.moonCalSub }}</span>',
  '<img src="/_blob/dc480753d5ad531cf04054c087563b0c" alt="" style="width: 46px; height: 46px; flex: none; object-fit: contain"><span style="display: flex; flex-direction: column; gap: 3px; min-width: 0"><strong style="font-size: 17px; line-height: 1.15; font-weight: 600">{{ t.moonPhase }}</strong><span style="font-size: 13.5px; line-height: 1.3; color: {{ ink.fg3 }}">{{ t.moonSign }}</span></span></div>\n<span style="margin-top: auto; font-size: 13px; line-height: 1.3; font-weight: 500; color: {{ ink.fg3 }}">{{ t.moonIllum }}</span>')

# 3) Moon calendar headline: plain words instead of «Можно, если не терпит».
r("headline: goodN.length ? 'Хороший день: ' + goodN[0].op.n.toLowerCase() + (goodN.length > 1 ? ' и ещё ' + (goodN.length - 1) : '') : okN.length ? 'Можно, если не терпит' : 'Сегодня лучше подождать',",
  "headline: goodN.length ? 'Хороший день: ' + goodN[0].op.n.toLowerCase() + (goodN.length > 1 ? ', и ещё ' + (goodN.length - 1) + ' ' + plDel(goodN.length - 1) : '') : okN.length ? 'Обычный день: ' + (okN.length === 1 ? 'одно дело' : okN.length + ' ' + plDel(okN.length)) + ' можно, остальное подождёт' : 'Сегодня лучше ничего не начинать',")

# 4) Navigation: new screens open at the top, «назад» returns to where you were,
#    each tab keeps its own scroll, tapping the active tab scrolls up.
r("    this.prevSt = { moonDay: this.state.moonDay, screen: this.state.screen, coach: this.state.coach, coachSet: this.state.coachSet, period: this.state.period };\n",
  "    this.prevSt = { moonDay: this.state.moonDay, screen: this.state.screen, coach: this.state.coach, coachSet: this.state.coachSet, period: this.state.period };\n"
  "    this.scrollMem = {}; this.prevNav = this.navKey();\n"
  "    if (this.scroller) { this.onSc = () => { this.scrollMem[this.navKey()] = this.scroller.scrollTop; }; this.scroller.addEventListener('scroll', this.onSc, { passive: true }); }\n")
r("  componentDidUpdate() { const st = this.state, ps = this.prevSt || {};",
  "  navKey() { const st = this.state; return [st.screen, st.screen === 'today' ? st.period : '', st.screen === 'mine' ? st.seg + ':' + st.chartOf : '', st.screen === 'today' && st.period === 'dates' ? (st.topic || '') : ''].join('|'); }\n"
  "  navScroll() { const k = this.navKey(); if (k === this.prevNav || !this.scroller) return; const mode = this.navMode; this.navMode = null; this.prevNav = k; const keep = mode === 'back' || mode === 'tab'; this.scroller.scrollTop = keep ? (this.scrollMem[k] || 0) : 0; }\n"
  "  componentDidUpdate() { this.navScroll(); const st = this.state, ps = this.prevSt || {};")
r("  componentWillUnmount() { [this.mt,",
  "  componentWillUnmount() { if (this.scroller && this.onSc) this.scroller.removeEventListener('scroll', this.onSc); [this.mt,")
r("    const back = () => this.setState({ screen: scr === 'gift'",
  "    const back = () => (this.navMode = 'back') && this.setState({ screen: scr === 'gift'")
r("go: () => { const first = s.tour && !s.seen[k] && k !== 'today'; this.setState(",
  "go: () => { if (on && s.screen === k && this.scroller) { try { this.scroller.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { this.scroller.scrollTop = 0; } return; } this.navMode = 'tab'; const first = s.tour && !s.seen[k] && k !== 'today'; this.setState(")

# 5) Week and month mood without Plus: the line simply ends today.
r("const moodW = { lock: wLock, solid: mgW.path(0, wLock ? 2 : 6), dashed: wLock ? mgW.path(2, 6) : '', dashOp: wLock ? '0.45' : '0',",
  "const moodW = { lock: wLock, solid: mgW.path(0, wLock ? 2 : 6), dashed: '', dashOp: '0',")
r("dots: mgW.pts.map((p, i) => moodDot(p, i === 2 ? 'now' : (wLock && i > 2 ? 'off' : (MOOD_35[i] >= 65 ? 'good' : (MOOD_35[i] <= 35 ? 'bad' : 'on'))))),",
  "dots: mgW.pts.map((p, i) => moodDot(p, i === 2 ? 'now' : (MOOD_35[i] >= 65 ? 'good' : (MOOD_35[i] <= 35 ? 'bad' : 'on')))).filter((d0, i) => !(wLock && i > 2)),")
r("const moodM = { lock: mLock, solid: mgM.path(0, mLock ? 2 : 34), dashed: mLock ? mgM.path(2, 34) : '', dashOp: mLock ? '0.45' : '0',",
  "const moodM = { lock: mLock, solid: mgM.path(0, mLock ? 2 : 34), dashed: '', dashOp: '0',")

# 6) Compatibility numbers: the same thresholds as the labels and the app code.
r('<b style="color: {{ c.label }}">Больше 70</b>: легко. <b style="color: {{ c.label }}">От 50 до 70</b>: по-разному. <b style="color: {{ c.label }}">Меньше 50</b>: придётся договариваться.',
  '<b style="color: {{ c.label }}">78 и выше</b>: да, легко. <b style="color: {{ c.label }}">62-77</b>: скорее да. <b style="color: {{ c.label }}">48-61</b>: по-разному. <b style="color: {{ c.label }}">Ниже 48</b>: непросто, придётся договариваться.')

open(path, 'w', encoding='utf-8').write(s)
print('patch M applied')
