"""Patch S: the day loading screen becomes full screen. A calm chart animation (a slow
light sweeps the zodiac ring, aspect lines draw one by one, planets breathe) and phrases
that change: «Рассчитываем точно», «Смотрим внимательно»... No grey placeholder blocks.
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


# keyframes: the rolling/bouncing ones go, the calm ones come in
old_kf = re.findall(r'@keyframes (?:nbRollJ|nbRollJs|nbRollV|nbRollVs|nbBall|nbBallSh|nbHopX|nbHopY|nbHopSh|nbLoadTxt)\{.*\n', s)
assert len(old_kf) == 10, len(old_kf)
for k in old_kf:
    r(k, '')
r("@keyframes nbDrift{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(16px,0,0)}}\n</style>",
  "@keyframes nbDrift{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(16px,0,0)}}\n"
  "@keyframes nbGlyph{0%{opacity:1;transform:scale(1.2)}22%,100%{opacity:.32;transform:scale(1)}}\n"
  "@keyframes nbDrawLine{0%{stroke-dashoffset:var(--len);opacity:0}6%{opacity:.9}32%,72%{stroke-dashoffset:0;opacity:.9}88%,100%{stroke-dashoffset:0;opacity:0}}\n"
  "@keyframes nbLoadMsg{0%{opacity:0;transform:translate3d(0,10px,0);filter:blur(4px)}3.5%,13.5%{opacity:1;transform:translate3d(0,0,0);filter:blur(0)}16.7%,100%{opacity:0;transform:translate3d(0,-10px,0);filter:blur(4px)}}\n"
  "@keyframes nbPlanetGlow{0%,100%{transform:scale(1);filter:drop-shadow(0 0 0 rgba(255,214,120,0))}50%{transform:scale(1.07);filter:drop-shadow(0 0 7px rgba(255,214,120,.55))}}\n"
  "</style>")

# the old in-page scene and grey blocks give way to an empty spacer under the overlay
i0 = s.index('<sc-if value="{{ period.dayLoading }}" hint-placeholder-val="{{ false }}">\n')
i1 = s.index('<sc-if value="{{ period.dayReady }}"', i0)
assert 'loadScene.jupiter' in s[i0:i1]
s = s[:i0] + '<sc-if value="{{ period.dayLoading }}" hint-placeholder-val="{{ false }}"><div style="height: 560px"></div></sc-if>\n' + s[i1:]

OVERLAY = (
    '<sc-if value="{{ loadFull.on }}" hint-placeholder-val="{{ false }}">\n'
    '<div role="status" aria-live="polite" style="position: absolute; inset: 0; z-index: 45; display: flex; flex-direction: column; align-items: center; justify-content: center; padding-bottom: 40px; box-sizing: border-box; background: {{ loadFull.bg }}; overflow: hidden; animation: nbFade .4s ease both">\n'
    '<div style="position: absolute; left: 50%; top: 50%; width: 560px; height: 560px; margin: -330px 0 0 -280px; border-radius: 50%; background: {{ loadFull.glow }}; animation: nbHalo 8s ease-in-out infinite"></div>\n'
    '<span style="position: relative; font-size: 13px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: {{ c.label3 }}">{{ loadFull.date }}</span>\n'
    '<div aria-hidden="true" style="position: relative; width: 300px; height: 300px; margin-top: 30px">\n'
    '<svg width="300" height="300" viewBox="0 0 300 300" style="position: absolute; inset: 0">'
    '<circle cx="150" cy="150" r="146" fill="none" stroke="{{ c.sep2 }}" stroke-width="1"></circle>'
    '<circle cx="150" cy="150" r="108" fill="none" stroke="{{ c.sep2 }}" stroke-width="1"></circle>'
    '<circle cx="150" cy="150" r="64" fill="none" stroke="{{ c.sep2 }}" stroke-width="1" stroke-dasharray="2 5"></circle>'
    '<sc-for list="{{ loadFull.ticks }}" as="lt" hint-placeholder-count="12"><line x1="{{ lt.x1 }}" y1="{{ lt.y1 }}" x2="{{ lt.x2 }}" y2="{{ lt.y2 }}" stroke="{{ c.sep2 }}" stroke-width="1"></line></sc-for>'
    '<sc-for list="{{ loadFull.lines }}" as="ll" hint-placeholder-count="6"><line x1="{{ ll.x1 }}" y1="{{ ll.y1 }}" x2="{{ ll.x2 }}" y2="{{ ll.y2 }}" stroke="{{ ll.color }}" stroke-width="1.5" stroke-linecap="round" style="--len: {{ ll.len }}; stroke-dasharray: {{ ll.len }}; stroke-dashoffset: {{ ll.len }}; opacity: 0; animation: nbDrawLine 7.2s {{ ll.delay }} ease-in-out infinite both"></line></sc-for>'
    '</svg>\n'
    '<div style="position: absolute; inset: 0; border-radius: 50%; background: {{ loadFull.beam }}; -webkit-mask: radial-gradient(circle, transparent 107px, #000 108px, #000 146px, transparent 147px); mask: radial-gradient(circle, transparent 107px, #000 108px, #000 146px, transparent 147px); animation: nbSpin 6s linear infinite"></div>\n'
    '<sc-for list="{{ loadFull.signs }}" as="lg" hint-placeholder-count="12"><img src="{{ lg.img }}" alt="" style="position: absolute; left: {{ lg.x }}; top: {{ lg.y }}; width: 22px; height: 22px; margin: -11px 0 0 -11px; object-fit: contain; opacity: .32; animation: nbGlyph 6s {{ lg.delay }} linear infinite"></sc-for>\n'
    '<sc-for list="{{ loadFull.planets }}" as="lp" hint-placeholder-count="7"><img src="{{ lp.img }}" alt="" style="position: absolute; left: {{ lp.x }}; top: {{ lp.y }}; width: {{ lp.s }}; height: {{ lp.s }}; margin: {{ lp.m }}; object-fit: contain; animation: nbPlanetGlow 5.6s {{ lp.delay }} ease-in-out infinite"></sc-for>\n'
    '<span style="position: absolute; left: 50%; top: 50%; width: 10px; height: 10px; margin: -5px 0 0 -5px; border-radius: 50%; background: {{ c.accent }}; box-shadow: 0 0 0 7px {{ c.accentSoft }}; animation: nbBreathe 3.2s ease-in-out infinite"></span>\n'
    '</div>\n'
    '<div style="position: relative; width: 100%; height: 36px; margin-top: 34px">'
    '<sc-for list="{{ loadFull.msgs }}" as="lm" hint-placeholder-count="6"><span style="position: absolute; inset: 0; text-align: center; font-size: 24px; line-height: 36px; font-weight: 700; letter-spacing: -0.015em; color: {{ c.label }}; opacity: 0; animation: nbLoadMsg 14.4s {{ lm.delay }} ease-in-out infinite both">{{ lm.t }}</span></sc-for>'
    '</div>\n'
    '<span style="position: relative; max-width: 290px; margin-top: 10px; text-align: center; font-size: 15px; line-height: 1.45; color: {{ c.label2 }}">{{ loadFull.sub }}</span>\n'
    '<span style="position: absolute; left: 0; right: 0; bottom: 42px; display: flex; align-items: center; justify-content: center; gap: 8px"><img src="/_blob/7645b5dbb1ba45e62382209bfcab9dc2" alt="" style="width: 24px; height: 24px; border-radius: 7px"><strong style="font-size: 14px; font-weight: 600; letter-spacing: 0.05em; color: {{ c.label2 }}">NEBO</strong></span>\n'
    '</div>\n'
    '</sc-if>\n\n'
)
r('<sc-if value="{{ pop.on }}" hint-placeholder-val="{{ false }}">', OVERLAY + '<sc-if value="{{ pop.on }}" hint-placeholder-val="{{ false }}">')

# data: phrases, ring, planets, aspect lines
j0 = s.index('    const LOAD_MSGS = ')
j1 = s.index('    const skel = ', j0)
assert 'const loadScene' in s[j0:j1]
LOAD_JS = (
    "    const LOAD_MSGS = { ru: ['Рассчитываем точно', 'Смотрим внимательно', 'Ничего не упускаем', 'Важна каждая мелочь', 'Сверяем с твоей картой', 'Проверяем каждую планету'], en: ['Calculating precisely', 'Looking closely', 'Missing nothing', 'Every detail matters', 'Checking against your chart', 'Checking every planet'], es: ['Calculamos con precisión', 'Miramos con atención', 'No se nos escapa nada', 'Cada detalle importa', 'Comparando con tu carta', 'Revisando cada planeta'] };\n"
    "    const LOAD_SUB = { ru: 'Считаем по твоей дате, времени и месту рождения', en: 'Based on your birth date, time and place', es: 'Según tu fecha, hora y lugar de nacimiento' };\n"
    "    const lfP = (deg, rr) => [150 + rr * Math.sin(deg * Math.PI / 180), 150 - rr * Math.cos(deg * Math.PI / 180)];\n"
    "    const LF_PL = [['sun', 18, 30], ['moon', 72, 24], ['mercury', 128, 20], ['venus', 166, 22], ['mars', 214, 22], ['jupiter', 262, 30], ['saturn', 318, 34]];\n"
    "    const LF_LINES = [[0, 1, '#3AA8E8'], [5, 0, '#22A35A'], [1, 3, '#F08A3C'], [4, 6, '#22A35A'], [2, 4, '#F08A3C'], [6, 1, '#3AA8E8']];\n"
    "    const loadFull = {\n"
    "      on: scr === 'today' && s.period === 'day' && !!s.loading,\n"
    "      bg: c.page, glow: dark ? 'radial-gradient(circle, rgba(124,140,255,.20), rgba(124,140,255,0) 62%)' : 'radial-gradient(circle, rgba(91,120,255,.16), rgba(91,120,255,0) 62%)',\n"
    "      beam: dark ? 'conic-gradient(from 0deg, rgba(165,180,252,0) 0deg, rgba(165,180,252,0) 250deg, rgba(165,180,252,.08) 300deg, rgba(165,180,252,.30) 359deg, rgba(165,180,252,0) 360deg)' : 'conic-gradient(from 0deg, rgba(79,70,229,0) 0deg, rgba(79,70,229,0) 250deg, rgba(79,70,229,.05) 300deg, rgba(79,70,229,.20) 359deg, rgba(79,70,229,0) 360deg)',\n"
    "      date: t.dateLine,\n"
    "      ticks: Array.from({ length: 12 }, (x0, i) => { const a = lfP(i * 30, 108), b = lfP(i * 30, 146); return { x1: a[0].toFixed(1), y1: a[1].toFixed(1), x2: b[0].toFixed(1), y2: b[1].toFixed(1) }; }),\n"
    "      signs: SYM.map((img, i) => { const q = lfP(i * 30 + 15, 127); return { img, x: q[0].toFixed(1) + 'px', y: q[1].toFixed(1) + 'px', delay: ((i * 30 + 15) / 60 - 6).toFixed(2) + 's' }; }),\n"
    "      planets: LF_PL.map((x0, i) => { const q = lfP(x0[1], 86); return { img: PL[x0[0]], x: q[0].toFixed(1) + 'px', y: q[1].toFixed(1) + 'px', s: x0[2] + 'px', m: (-x0[2] / 2) + 'px 0 0 ' + (-x0[2] / 2) + 'px', delay: (-i * 0.8).toFixed(1) + 's' }; }),\n"
    "      lines: LF_LINES.map((x0, i) => { const a = lfP(LF_PL[x0[0]][1], 58), b = lfP(LF_PL[x0[1]][1], 58); return { x1: a[0].toFixed(1), y1: a[1].toFixed(1), x2: b[0].toFixed(1), y2: b[1].toFixed(1), color: x0[2], len: Math.hypot(a[0] - b[0], a[1] - b[1]).toFixed(1) + 'px', delay: (i * 1.2).toFixed(1) + 's' }; }),\n"
    "      msgs: (LOAD_MSGS[L] || LOAD_MSGS.ru).map((t0, i) => ({ t: t0, delay: (i * 2.4).toFixed(1) + 's' })),\n"
    "      sub: LOAD_SUB[L] || LOAD_SUB.ru,\n"
    "    };\n"
)
s = s[:j0] + LOAD_JS + s[j1:]
r("err: errorV, skel, loadScene, signPer,", "err: errorV, skel, loadFull, signPer,")
assert 'loadScene' not in s, 'loadScene left over'

open(path, 'w', encoding='utf-8').write(s)
print('patch S applied')
