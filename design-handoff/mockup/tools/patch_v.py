"""Patch V: «Ночное небо» becomes the default button, the profile gets a «Кнопки» choice
(night sky, black, gold); stars on dark screens fly slowly in one direction in three
layers instead of only pulsing; the tarot tab banner gets the «ТАРО» wordmark.
Every replacement must match exactly once."""
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


# ---------------------------------------------------------------- buttons
r("    const CTA_V = {\n      ultra:", "    const CTA_ALL = {\n      flow: [th[0], '0 14px 28px -16px rgba(67,56,202,.6)', '#ffffff'],\n      ultra:")
r("    }[this.props.ctaVariant];\n    const ctaTheme = CTA_V ? { cta: CTA_V[0], shadow: CTA_V[1], fg: CTA_V[2] } : { cta: th[0], shadow: '0 14px 28px -16px rgba(67,56,202,.6)', fg: '#ffffff' };",
  "    };\n    const CTA_V = CTA_ALL[s.btnStyle] || CTA_ALL.night;\n    const ctaTheme = { cta: CTA_V[0], shadow: CTA_V[1], fg: CTA_V[2] };")
r("posterTheme: props.posterTheme || 'light',", "posterTheme: props.posterTheme || 'light', btnStyle: props.ctaVariant || 'night',")
r('"ctaVariant":{"editor":"enum","options":["flow","ultra","night","ink","violet","gold","tint"],"default":"flow"}',
  '"ctaVariant":{"editor":"enum","options":["night","ink","gold","flow","ultra","violet","tint"],"default":"night"}')
r('"poster","posterWall","planet_asc",', '"poster","posterWall","btnStyle","planet_asc",')
r("      ['Внешний вид', [row(STK.theme, 'Тема', '', null, { seg: themeSeg }), row(STK.globe, 'Язык', '', null, { seg: langSeg })]],",
  "      ['Внешний вид', [row(STK.theme, 'Тема', '', null, { seg: themeSeg }), row(STK.roller, 'Кнопки', { night: 'Ночное небо', ink: 'Чёрные', gold: 'Золото' }[s.btnStyle] || 'Ночное небо', () => this.setState({ popup: 'btnStyle' })), row(STK.globe, 'Язык', '', null, { seg: langSeg })]],")
r("const base = { on: true, hasWall: false,", "const base = { on: true, hasBtnStyles: false, btnStyles: [], hasWall: false,")
r("    const CHK = /^(planet|house|sign|asp)_(.+)$/.exec(p || '');\n",
  "    if (p === 'btnStyle') pop = Object.assign({}, base, { title: 'Цвет кнопок', hasText: true, text: 'Так будут выглядеть главные кнопки во всём приложении. Поменять можно в любой момент.', hasBtnStyles: true, btnStyles: [['night', 'Ночное небо', 'Тёмно-синие со звёздами, по умолчанию'], ['ink', 'Чёрные', 'Строго и спокойно. В тёмной теме светлые'], ['gold', 'Золото', 'Тёплые, с тёмным текстом']].map((x) => { const v = CTA_ALL[x[0]], on = s.btnStyle === x[0]; return { label: x[1], sub: x[2], bg: v[0], sh: v[1], fg: v[2], on, ring: on ? 'inset 0 0 0 2px ' + c.accent : 'none', radio: on ? '6px solid ' + c.accent : '2px solid ' + c.label3, pick: () => this.setState({ btnStyle: x[0] }) }; }), buttons: [btn('Готово', close, 'primary')] });\n"
  "    const CHK = /^(planet|house|sign|asp)_(.+)$/.exec(p || '');\n")
BTN_MARKUP = (
    '<sc-if value="{{ pop.hasBtnStyles }}" hint-placeholder-val="{{ false }}"><div style="display: flex; flex-direction: column; gap: 10px">'
    '<sc-for list="{{ pop.btnStyles }}" as="bst" hint-placeholder-count="3"><button type="button" onClick="{{ bst.pick }}" aria-pressed="{{ bst.on }}" style="display: flex; flex-direction: column; gap: 10px; padding: 12px; border: 0; border-radius: 20px; background: {{ c.fill }}; box-shadow: {{ bst.ring }}; font: inherit; text-align: left; color: {{ c.label }}; cursor: pointer; transition: box-shadow .3s ease">'
    '<span style="display: flex; align-items: center; gap: 10px"><span style="width: 20px; height: 20px; flex: none; box-sizing: border-box; border-radius: 50%; border: {{ bst.radio }}; transition: border .3s ease"></span><span style="display: flex; flex-direction: column; gap: 1px"><strong style="font-size: 15.5px; font-weight: 600">{{ bst.label }}</strong><span style="font-size: 12.5px; color: {{ c.label2 }}">{{ bst.sub }}</span></span></span>'
    '<span class="nbCta" style="display: flex; align-items: center; justify-content: center; height: 44px; border-radius: 22px; background: {{ bst.bg }}; background-size: 170% 100%; box-shadow: {{ bst.sh }}; color: {{ bst.fg }}; font-size: 15px; font-weight: 600">Показать мой день</span>'
    '</button></sc-for></div></sc-if>\n'
)
r('<sc-if value="{{ pop.hasSpin }}" hint-placeholder-val="{{ false }}">', BTN_MARKUP + '<sc-if value="{{ pop.hasSpin }}" hint-placeholder-val="{{ false }}">')

# ---------------------------------------------------------------- stars fly
i0 = s.index('<sc-if value="{{ bg.stars }}" hint-placeholder-val="{{ false }}">\n')
i1 = s.index('</sc-if>\n', i0) + len('</sc-if>\n')
assert s[i0:i1].count('<circle') > 40
s = s[:i0] + (
    '<sc-if value="{{ bg.stars }}" hint-placeholder-val="{{ false }}">\n'
    '<div aria-hidden="true" style="position: absolute; inset: 0; overflow: hidden; pointer-events: none">'
    '<sc-for list="{{ starLayers }}" as="sl" hint-placeholder-count="3"><div style="position: absolute; left: 0; top: 0; width: 780px; height: 844px; will-change: transform; animation: nbStarFly {{ sl.dur }} linear infinite">'
    '<svg width="780" height="844" viewBox="0 0 780 844" style="position: absolute; inset: 0"><g fill="#ffffff"><sc-for list="{{ sl.stars }}" as="sx" hint-placeholder-count="20"><circle cx="{{ sx.x }}" cy="{{ sx.y }}" r="{{ sx.r }}" style="--o: {{ sx.o }}; opacity: {{ sx.o }}; animation: {{ sx.anim }}"></circle></sc-for></g></svg>'
    '</div></sc-for></div>\n'
    '</sc-if>\n'
) + s[i1:]
r("@keyframes nbDrift{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(16px,0,0)}}\n",
  "@keyframes nbDrift{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(16px,0,0)}}\n"
  "@keyframes nbStarFly{from{transform:translate3d(0,0,0)}to{transform:translate3d(-390px,0,0)}}\n"
  "@keyframes nbStarTw{0%,100%{opacity:var(--o)}50%{opacity:calc(var(--o) * .35)}}\n")
r("    const bg = { sky,",
  "    const starRnd = (seed) => { let v = seed; return () => (v = (v * 16807) % 2147483647) / 2147483647; };\n"
  "    const starLayer = (seed, n, r0, r1, o0, o1, dur, tw) => { const rnd = starRnd(seed); const one = Array.from({ length: n }, () => ({ x: rnd() * 390, y: rnd() * 844, r: r0 + rnd() * (r1 - r0), o: o0 + rnd() * (o1 - o0), tw: rnd() < tw })); return { dur, stars: one.concat(one.map((st) => Object.assign({}, st, { x: st.x + 390 }))).map((st, i) => ({ x: st.x.toFixed(1), y: st.y.toFixed(1), r: st.r.toFixed(2), o: st.o.toFixed(2), anim: st.tw ? 'nbStarTw ' + (6 + (i % 5)) + 's ' + (i % 4) + 's ease-in-out infinite' : 'none' })) }; };\n"
  "    const starLayers = [starLayer(11, 46, 0.45, 0.8, 0.12, 0.26, '260s', 0.08), starLayer(23, 26, 0.8, 1.15, 0.2, 0.36, '170s', 0.12), starLayer(37, 10, 1.15, 1.6, 0.3, 0.5, '110s', 0.2)];\n"
  "    const bg = { sky,")
r("ink, who, doodleUrl: this.doodle(),", "ink, who, starLayers, doodleUrl: this.doodle(),")

# ---------------------------------------------------------------- «ТАРО» on the tarot banner
ORN = ('<svg width="66" height="11" viewBox="0 0 58 10" aria-hidden="true"><path d="M3 5h18M37 5h18" stroke="#FFE29A" stroke-width="1" stroke-linecap="round" opacity=".7"></path>'
       '<path d="M29 .8l1.3 2.9 2.9 1.3-2.9 1.3L29 9.2l-1.3-2.9L24.8 5l2.9-1.3z" fill="#FFE29A"></path><circle cx="22.6" cy="5" r=".9" fill="#FFE29A"></circle><circle cx="35.4" cy="5" r=".9" fill="#FFE29A"></circle></svg>')
r('<div style="position: absolute; left: 20px; bottom: 20px; display: flex; flex-direction: column; gap: 4px; max-width: 190px"><span style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; opacity: .75">22 старших аркана</span>',
  '<span aria-hidden="true" style="position: absolute; left: 18px; top: 18px; display: flex; flex-direction: column; align-items: center; gap: 5px"><span style="font-family: \'Cormorant Garamond\', Georgia, serif; font-size: 27px; line-height: 1; font-weight: 700; letter-spacing: 0.12em; padding-left: 0.12em; background: linear-gradient(180deg,#FFF3D1 0%,#F5C46B 100%); -webkit-background-clip: text; background-clip: text; color: transparent">{{ t.tarotLbl }}</span>' + ORN + '</span>'
  '<div style="position: absolute; left: 20px; bottom: 20px; display: flex; flex-direction: column; gap: 4px; max-width: 190px"><span style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; opacity: .75">22 старших аркана</span>')

open(path, 'w', encoding='utf-8').write(s)
print('patch V applied')
