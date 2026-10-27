"""Patch L: the day loading screen becomes a small scene with planets rolling and
bouncing like balls, plus rotating captions. Every replacement must match exactly once."""
import sys

path = sys.argv[1]
s = open(path, encoding='utf-8').read()


def r(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        raise SystemExit('expected %d match(es), found %d for: %r' % (count, n, old[:90]))
    s = s.replace(old, new)


KEYFRAMES = (
    "@keyframes nbRollJ{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(150px,0,0)}}\n"
    "@keyframes nbRollJs{0%,100%{transform:rotate(0deg)}50%{transform:rotate(268deg)}}\n"
    "@keyframes nbRollV{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(-168px,0,0)}}\n"
    "@keyframes nbRollVs{0%,100%{transform:rotate(0deg)}50%{transform:rotate(-566deg)}}\n"
    "@keyframes nbBall{0%{transform:translate3d(0,0,0) scale(1.1,.88);animation-timing-function:cubic-bezier(.22,.7,.36,1)}"
    "12%{transform:translate3d(0,-8px,0) scale(.97,1.04);animation-timing-function:cubic-bezier(.22,.7,.36,1)}"
    "50%{transform:translate3d(0,-66px,0) scale(1,1);animation-timing-function:cubic-bezier(.6,0,.8,.4)}"
    "92%{transform:translate3d(0,-4px,0) scale(.98,1.03)}100%{transform:translate3d(0,0,0) scale(1.1,.88)}}\n"
    "@keyframes nbBallSh{0%,100%{transform:scale(1.05);opacity:1;animation-timing-function:cubic-bezier(.22,.7,.36,1)}"
    "50%{transform:scale(.5);opacity:.45;animation-timing-function:cubic-bezier(.6,0,.8,.4)}}\n"
    "@keyframes nbHopX{0%{transform:translate3d(0,0,0)}100%{transform:translate3d(268px,0,0)}}\n"
    "@keyframes nbHopY{0%,100%{transform:translate3d(0,0,0) rotate(0deg);animation-timing-function:cubic-bezier(.22,.7,.36,1)}"
    "50%{transform:translate3d(0,-38px,0) rotate(160deg);animation-timing-function:cubic-bezier(.6,0,.8,.4)}}\n"
    "@keyframes nbHopSh{0%,100%{transform:scale(1);opacity:1;animation-timing-function:cubic-bezier(.22,.7,.36,1)}"
    "50%{transform:scale(.55);opacity:.4;animation-timing-function:cubic-bezier(.6,0,.8,.4)}}\n"
    "@keyframes nbLoadTxt{0%{opacity:0;transform:translate3d(0,8px,0)}5%,21%{opacity:1;transform:translate3d(0,0,0)}"
    "26%,100%{opacity:0;transform:translate3d(0,-8px,0)}}\n"
)
r("@keyframes nbDrift{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(16px,0,0)}}\n</style>",
  "@keyframes nbDrift{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(16px,0,0)}}\n" + KEYFRAMES + "</style>")

OLD_START = '<sc-if value="{{ period.dayLoading }}" hint-placeholder-val="{{ false }}">\n<div style="padding: 22px 20px 0">\n'
i0 = s.index(OLD_START)
i1 = s.index('</div>\n</sc-if>\n<sc-if value="{{ period.dayReady }}"', i0)
old_block = s[i0:i1 + len('</div>\n</sc-if>\n')]
assert old_block.count('nbSkel') >= 8, 'unexpected loading block'

SHADOW = 'position: absolute; left: 50%; bottom: -5px; height: 10px; border-radius: 50%; background: {{ loadScene.shadow }}'
new_block = (
    '<sc-if value="{{ period.dayLoading }}" hint-placeholder-val="{{ false }}">\n'
    '<div style="padding: 18px 16px 0">\n'
    '<div aria-hidden="true" style="position: relative; height: 236px; border-radius: 30px; overflow: hidden; background: {{ loadScene.bg }}; border: 1px solid {{ c.glassSkyBorder }}">\n'
    '<div style="position: absolute; left: 50%; top: -70px; width: 320px; height: 320px; margin-left: -160px; border-radius: 50%; background: {{ loadScene.glow }}"></div>\n'
    '<div style="position: absolute; left: 22px; right: 22px; bottom: 44px; height: 1px; background: {{ loadScene.floor }}"></div>\n'
    # Venus, far away, rolls to the left and back
    '<div style="position: absolute; left: 236px; bottom: 54px; width: 34px; height: 34px; z-index: 1; animation: nbRollV 11s ease-in-out infinite">'
    '<span style="' + SHADOW + '; width: 30px; margin-left: -15px; opacity: .7"></span>'
    '<img src="{{ loadScene.venus }}" alt="" style="position: relative; display: block; width: 100%; height: 100%; object-fit: contain; animation: nbRollVs 11s ease-in-out infinite"></div>\n'
    # Mars bounces like a ball
    '<div style="position: absolute; left: 300px; bottom: 40px; width: 30px; height: 30px; z-index: 2">'
    '<span style="' + SHADOW + '; width: 28px; margin-left: -14px; animation: nbBallSh 1.9s infinite"></span>'
    '<img src="{{ loadScene.mars }}" alt="" style="position: relative; display: block; width: 100%; height: 100%; object-fit: contain; transform-origin: 50% 100%; animation: nbBall 1.9s infinite"></div>\n'
    # Jupiter, close and heavy, rolls slowly to the right and back
    '<div style="position: absolute; left: 30px; bottom: 26px; width: 66px; height: 66px; z-index: 3; animation: nbRollJ 8s ease-in-out infinite">'
    '<span style="' + SHADOW + '; width: 58px; margin-left: -29px"></span>'
    '<img src="{{ loadScene.jupiter }}" alt="" style="position: relative; display: block; width: 100%; height: 100%; object-fit: contain; animation: nbRollJs 8s ease-in-out infinite"></div>\n'
    # the Moon hops across in small arcs
    '<div style="position: absolute; left: 34px; bottom: 36px; width: 22px; height: 22px; z-index: 4; animation: nbHopX 6.3s ease-in-out infinite alternate">'
    '<span style="' + SHADOW + '; width: 20px; margin-left: -10px; animation: nbHopSh 1.05s infinite"></span>'
    '<img src="{{ loadScene.moon }}" alt="" style="position: relative; display: block; width: 100%; height: 100%; object-fit: contain; animation: nbHopY 1.05s infinite"></div>\n'
    '</div>\n'
    '<div style="position: relative; height: 26px; margin-top: 18px">'
    '<sc-for list="{{ loadScene.msgs }}" as="lm" hint-placeholder-count="4">'
    '<span style="position: absolute; inset: 0; text-align: center; font-size: 17px; line-height: 26px; font-weight: 600; color: {{ c.label }}; opacity: 0; animation: nbLoadTxt 8s {{ lm.delay }} ease-in-out infinite both">{{ lm.t }}</span>'
    '</sc-for></div>\n'
    '<span style="display: block; margin-top: 4px; text-align: center; font-size: 13.5px; color: {{ c.label3 }}">{{ loadScene.sub }}</span>\n'
    '<span style="display: block; height: 96px; margin-top: 22px; border-radius: 26px; background: {{ skel.bg }}; background-size: 220% 100%; opacity: .75; animation: nbSkel 1.8s .4s linear infinite"></span>\n'
    '<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 12px; opacity: .75"><span style="display: block; height: 150px; border-radius: 26px; background: {{ skel.bg }}; background-size: 220% 100%; animation: nbSkel 1.8s .6s linear infinite"></span><span style="display: block; height: 150px; border-radius: 26px; background: {{ skel.bg }}; background-size: 220% 100%; animation: nbSkel 1.8s .7s linear infinite"></span></div>\n'
    '</div>\n'
    '</sc-if>\n'
)
s = s[:i0] + new_block + s[i0 + len(old_block):]

LOAD_MSGS = {
    'ru': ['Собираем твой прогноз', 'Считаем твой день', 'Смотрим, где сейчас Луна', 'Сверяем с твоей картой'],
    'en': ['Putting your forecast together', 'Working out your day', 'Checking where the Moon is', 'Matching it to your chart'],
    'es': ['Preparando tu pronóstico', 'Calculando tu día', 'Mirando dónde está la Luna', 'Comparando con tu carta'],
}
LOAD_SUB = {'ru': 'Обычно это пара секунд', 'en': 'Usually takes a couple of seconds', 'es': 'Suele tardar un par de segundos'}
js_msgs = '{ ' + ', '.join("%s: [%s]" % (k, ', '.join("'%s'" % m for m in v)) for k, v in LOAD_MSGS.items()) + ' }'
js_sub = '{ ' + ', '.join("%s: '%s'" % (k, v) for k, v in LOAD_SUB.items()) + ' }'
r("const skel = { bg: dark ?",
  "const LOAD_MSGS = " + js_msgs + ";\n"
  "    const loadScene = { bg: dark ? 'linear-gradient(180deg,#1E2030 0%,#25283A 100%)' : 'linear-gradient(180deg,#EEF3FF 0%,#F8F9FC 100%)', glow: dark ? 'radial-gradient(circle, rgba(124,140,255,.22), rgba(124,140,255,0) 66%)' : 'radial-gradient(circle, rgba(91,140,255,.2), rgba(91,140,255,0) 66%)', floor: dark ? 'rgba(255,255,255,.10)' : 'rgba(11,13,18,.08)', shadow: dark ? 'radial-gradient(closest-side, rgba(0,0,0,.55), rgba(0,0,0,0))' : 'radial-gradient(closest-side, rgba(20,30,70,.22), rgba(20,30,70,0))', jupiter: PL.jupiter, venus: PL.venus, mars: PL.mars, moon: PL.moon, msgs: (LOAD_MSGS[L] || LOAD_MSGS.ru).map((t0, i) => ({ t: t0, delay: (i * 2) + 's' })), sub: (" + js_sub + ")[L] || 'Обычно это пара секунд' };\n"
  "    const skel = { bg: dark ?")
r("err: errorV, skel, signPer,", "err: errorV, skel, loadScene, signPer,")

open(path, 'w', encoding='utf-8').write(s)
print('patch L applied')
