"""Patch W: real tests. Eight short self-knowledge tests with honest scoring, an intro
before the start, a psychologist-style breakdown of the result, a «Тест недели», a list of
all tests with what is already passed. Every replacement must match exactly once."""
import importlib.util
import json
import os
import re
import sys

path = sys.argv[1]
s = open(path, encoding='utf-8').read()
here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('tests_data', os.path.join(here, 'tests_data.py'))
td = importlib.util.module_from_spec(spec)
spec.loader.exec_module(td)


def r(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        raise SystemExit('expected %d match(es), found %d for: %r' % (count, n, old[:90]))
    s = s.replace(old, new)


J = lambda v: json.dumps(v, ensure_ascii=False)

# ------------------------------------------------------------------ data, before the «Отдых» shelves use it
DATA_JS = (
    "    // tests\n"
    "    const TESTS = " + J(td.TESTS) + ";\n"
    "    const T_ORDER = " + J(td.ORDER) + ", T_WEEK = " + J(td.WEEK) + ", T_THEMES = " + J(td.THEMES) + ", T_NOTE = " + J(td.BASIS_NOTE) + ";\n"
    "    const tCover = (tt) => { const cv = tt.cover, ph = cv[0].indexOf('photo:') === 0; return { bg: ph ? '#2B2F6B' : cv[0], photo: ph ? cv[0].slice(6) : '', hasPhoto: ph, stk: ph ? '' : (STK[cv[1]] || I[cv[1]] || STK.star), hasStk: !ph }; };\n"
    "    const tScore = (tt, ans) => {\n"
    "      const n = tt.q.length, pick = (i) => { const op = tt.q[i][1] || tt.opts; return op[Math.min(ans[i] == null ? 0 : ans[i], op.length - 1)]; };\n"
    "      if (tt.kind === 'types') { const cnt = {}; tt.order.forEach((k) => { cnt[k] = 0; }); for (let i = 0; i < n; i++) cnt[pick(i)[1]] += 1; let best = tt.order[0]; tt.order.forEach((k) => { if (cnt[k] > cnt[best]) best = k; }); return { key: best, bars: tt.order.slice().sort((a, b) => cnt[b] - cnt[a]).map((k) => { const pc = Math.round(100 * cnt[k] / n); return { label: tt.res[k].name, v: pc + '%', w: pc + '%', fw: k === best ? '700' : '500', bg: k === best ? c.accent : c.accentSoft2 }; }) }; }\n"
    "      if (tt.kind === 'scale') { let tot = 0; for (let i = 0; i < n; i++) tot += pick(i)[1]; const band = tt.bands.filter((b) => tot >= b[0])[0] || tt.bands[tt.bands.length - 1]; const m = tt.meter; let pc = Math.round(100 * (tot - m[1]) / (m[2] - m[1])); if (m[3]) pc = 100 - pc; const col = m[3] ? (pc >= 66 ? c.green : pc >= 33 ? '#F59E0B' : '#F97316') : c.accent; return { key: band[1], bars: [{ label: m[0], v: pc + '%', w: pc + '%', fw: '700', bg: col }] }; }\n"
    "      let H = 0, Q = 0; for (let i = 0; i < n; i++) { const k = pick(i)[1]; if (k[0] === 'h') H += 1; if (k[1] === 'q') Q += 1; }\n"
    "      const hp = Math.round(100 * H / n), qp = Math.round(100 * Q / n);\n"
    "      return { key: (H * 2 >= n ? 'h' : 'f') + (Q * 2 > n ? 'q' : 's'), bars: [{ label: 'Голова ' + hp + '% · сердце ' + (100 - hp) + '%', v: '', w: hp + '%', fw: '600', bg: c.accent }, { label: 'Быстро ' + qp + '% · взвешенно ' + (100 - qp) + '%', v: '', w: qp + '%', fw: '600', bg: c.accent }] };\n"
    "    };\n"
    "    const tDone = s.testDone || {};\n"
    "    const tGo = (k) => () => this.setState({ screen: 'test', testId: k, testQ: -1, testAns: [] });\n"
)
r("    const poster = (img, title, sub, w, h, go) => ({ go,", "    const poster = (img, title, sub, w, h, go) => ({ badge: false, badgeText: '', go,")
r("    const cover = (bgx, img, title, sub, w, h, imgS, go) => ({ imgL: '50%',", "    const cover = (bgx, img, title, sub, w, h, imgS, go) => ({ badge: false, badgeText: '', imgL: '50%',")
r("    const shelves = [\n", DATA_JS + "    const shelves0 = [\n")
line = re.search(r"      \{ title: 'Тесты', items: \[.*\n", s).group(0)
s = s.replace(line,
              "      { title: 'Тесты', link: 'Все тесты', goLink: () => this.setState({ screen: 'tests' }), items: T_ORDER.map((k) => { const x0 = TESTS[k], cv = tCover(x0), sub = x0.q.length + ' вопросов · ' + x0.mins + ' мин'; const it = cv.hasPhoto ? poster(cv.photo, x0.title, sub, 168, 112, tGo(k)) : cover(cv.bg, cv.stk, x0.title, sub, 168, 112, 76, tGo(k)); return k === T_WEEK ? Object.assign(it, { badge: true, badgeText: 'Тест недели' }) : it; }) },\n")
i0 = s.index("    const shelves0 = [\n")
i1 = s.index("    ];\n", i0) + len("    ];\n")
s = s[:i1] + "    const shelves = shelves0.map((sh) => Object.assign({ hasLink: false, link: '', goLink: () => null }, sh, { hasLink: !!sh.link }));\n" + s[i1:]

# ------------------------------------------------------------------ view values
j0 = s.index("    const TESTS = {\n      rhythm:")
j1 = s.index("    const breathV = ", j0)
TEST_JS = (
    "    const tId = TESTS[s.testId] ? s.testId : T_WEEK, tt = TESTS[tId], tN = tt.q.length, tIntro = s.testQ < 0, tQi = Math.max(0, Math.min(s.testQ, tN - 1));\n"
    "    const tq = tt.q[tQi], tOpts = tq[1] || tt.opts, tAns = tt.q.map((x0, i) => (s.testAns[i] != null ? s.testAns[i] : tt.demo[i]));\n"
    "    const tRes = tScore(tt, tAns), tR = tt.res[tRes.key], tCv = tCover(tt), tPrev = tDone[tId];\n"
    "    const testV = {\n"
    "      intro: tIntro, quiz: !tIntro, theme: tt.theme, meta: tN + ' вопросов · ' + tt.mins + ' мин', about: tt.about, basis: tt.basis, gets: tt.gets.map((g) => ({ t: g })), week: tId === T_WEEK,\n"
    "      coverBg: tCv.bg, hasPhoto: tCv.hasPhoto, photo: tCv.photo, hasStk: tCv.hasStk, stk: tCv.stk, resBg: tCv.hasPhoto ? '#2B2F6B' : tCv.bg,\n"
    "      hasPrev: !!tPrev, prevName: tPrev ? tt.res[tPrev.key].name : '', openPrev: () => this.setState({ screen: 'testResult', testAns: tPrev ? tPrev.ans : [] }),\n"
    "      start: () => this.setState({ testQ: 0, testAns: [] }),\n"
    "      title: tt.title, n: 'вопрос ' + (tQi + 1) + ' из ' + tN, q: tq[0], hasSub: !!tt.qSub, qSub: tt.qSub || '', img: tCv.hasStk ? tCv.stk : I.tests,\n"
    "      segs: tt.q.map((x0, i) => ({ bg: i <= tQi ? c.accent : c.fill })),\n"
    "      opts: tOpts.map((o, i) => ({ label: o[0], letter: 'АБВГ'[i], pick: () => { const ans = s.testAns.slice(0, tQi).concat([i]); if (tQi + 1 >= tN) { const full = tt.q.map((x0, k) => (ans[k] != null ? ans[k] : tt.demo[k])); this.setState({ screen: 'testResult', testAns: ans, testDone: Object.assign({}, tDone, { [tId]: { key: tScore(tt, full).key, ans } }) }); } else this.setState({ testQ: tQi + 1, testAns: ans }); } })),\n"
    "      resTitle: tR.title, resText: tR.summary, bars: tRes.bars,\n"
    "      sections: [['Как это проявляется', tR.how], ['Твоя сильная сторона', tR.strength], ['Где бывает трудно', tR.watch]].map((x0, i) => ({ label: x0[0], text: x0[1], border: i ? '1px solid ' + c.sep : '0' })),\n"
    "      tips: tR.tips.map((t0) => ({ t: t0 })), resChart: tt.chart, hasChart: acc !== 'guest', note: T_NOTE,\n"
    "      share: () => this.setState({ popup: 'share', shareFrom: 'test' }), again: () => this.setState({ screen: 'test', testQ: 0, testAns: [] }), all: () => this.setState({ screen: 'tests' }),\n"
    "    };\n"
    "    const testsCat = {\n"
    "      week: (() => { const w0 = TESTS[T_WEEK], cv = tCover(w0); return { title: w0.title, short: w0.short, meta: w0.q.length + ' вопросов · ' + w0.mins + ' мин', bg: cv.bg, stk: cv.stk, go: tGo(T_WEEK) }; })(),\n"
    "      groups: T_THEMES.map((th0) => ({ title: th0, rows: T_ORDER.filter((k) => TESTS[k].theme === th0).map((k, i) => { const x0 = TESTS[k], cv = tCover(x0), d0 = tDone[k]; return { title: x0.title, sub: x0.short + ' · ' + x0.q.length + ' вопросов', bg: cv.bg, stk: cv.stk, hasStk: cv.hasStk, hasPhoto: cv.hasPhoto, photo: cv.photo, done: !!d0, doneLabel: d0 ? 'Пройден: ' + x0.res[d0.key].name : '', border: i ? '1px solid ' + c.sep : '0', go: tGo(k) }; }) })).filter((g) => g.rows.length),\n"
    "    };\n"
)
s = s[:j0] + TEST_JS + s[j1:]
r("test: testV,", "test: testV, testsCat,")

# share card for a test result
r("day: [PL.moon, 'Мой день · 21 октября', 'День, чтобы договориться'] }[s.shareFrom]",
  "day: [PL.moon, 'Мой день · 21 октября', 'День, чтобы договориться'], test: [tCv.hasStk ? tCv.stk : STK.star, 'Тест · ' + tt.title, tR.name + '. ' + tR.summary] }[s.shareFrom]")

# ------------------------------------------------------------------ state, props, navigation
r("testId: props.testId || 'rhythm', testQ: num(props.testQ, 0), testAns: [],",
  "testId: props.testId || 'love', testQ: num(props.testQ, 0), testAns: [], testDone: { rhythm: { key: 'evening', ans: [2, 2, 2, 2, 1, 2] } },")
r('"testId":{"editor":"enum","options":["rhythm","energy"],"default":"rhythm"},"testQ":{"editor":"int","min":0,"max":4,"default":0}',
  '"testId":{"editor":"enum","options":' + J(td.ORDER) + ',"default":"love"},"testQ":{"editor":"int","min":-1,"max":9,"default":0}')
r('"testResult","breath"', '"testResult","tests","breath"')
r("test: scr === 'test', testResult: scr === 'testResult',", "test: scr === 'test', testResult: scr === 'testResult', tests: scr === 'tests',")
r("'test', 'testResult', 'breath', 'bubbles', 'notifSettings'", "'test', 'testResult', 'tests', 'breath', 'bubbles', 'notifSettings'", count=2)
r("'test', 'testResult', 'breath', 'bubbles'].indexOf(scr) >= 0) ? 'rest'", "'test', 'testResult', 'tests', 'breath', 'bubbles'].indexOf(scr) >= 0) ? 'rest'", count=2)
r("test: 'Тест', testResult: 'Результат теста',", "test: 'Тест', testResult: 'Результат теста', tests: 'Тесты',")
r("@keyframes nbStarFly{", "@keyframes nbBarIn{from{transform:scaleX(0)}to{transform:none}}\n@keyframes nbStarFly{")

# ------------------------------------------------------------------ markup: «Отдых» shelves get a link and a badge
r('<div style="padding: 26px 0 0"><div style="display: flex; align-items: baseline; justify-content: space-between; padding: 0 20px 12px"><h2 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.015em">{{ sh.title }}</h2></div>',
  '<div style="padding: 26px 0 0"><div style="display: flex; align-items: baseline; justify-content: space-between; padding: 0 20px 12px"><h2 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.015em">{{ sh.title }}</h2><sc-if value="{{ sh.hasLink }}" hint-placeholder-val="{{ false }}"><button type="button" onClick="{{ sh.goLink }}" style="padding: 0; border: 0; background: none; font: inherit; font-size: 15px; font-weight: 600; color: {{ c.accent }}; cursor: pointer">{{ sh.link }}</button></sc-if></div>')
r('object-fit: {{ si.fit }}; filter: {{ si.filter }}"></div>',
  'object-fit: {{ si.fit }}; filter: {{ si.filter }}"><sc-if value="{{ si.badge }}" hint-placeholder-val="{{ false }}"><span style="position: absolute; left: 8px; top: 8px; padding: 3px 8px; border-radius: 999px; background: rgba(255,255,255,.92); color: #1D2A6B; font-size: 11px; font-weight: 700">{{ si.badgeText }}</span></sc-if></div>')

# ------------------------------------------------------------------ markup: intro, questions, result, list of tests
k0 = s.index('<sc-if value="{{ show.test }}" hint-placeholder-val="{{ false }}">\n')
k1 = s.index('<sc-if value="{{ show.breath }}"', k0)
old = s[k0:k1]
qstart = old.index('<div style="padding: 0 20px; animation: nbFade .3s ease both">')
qend = old.index('</div>\n</sc-if>\n', qstart) + len('</div>\n')
quiz = old[qstart:qend]
quiz = quiz.replace('{{ test.title }} · {{ test.n }}', '{{ test.title }} · {{ test.n }}')
H1 = re.search(r'<h1 [^>]*>\{\{ test\.q \}\}</h1>\n', quiz).group(0)
quiz = quiz.replace(H1, H1 + '<sc-if value="{{ test.hasSub }}" hint-placeholder-val="{{ false }}"><p style="margin: 8px 0 0; font-size: 15px; line-height: 1.45; color: {{ c.label2 }}">{{ test.qSub }}</p></sc-if>\n')
CHECK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="{{ c.green }}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none; margin-top: 1px"><path d="{{ ic.check }}"></path></svg>'
CHEV = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="{{ c.label3 }}" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="flex: none"><path d="{{ ic.chevR }}"></path></svg>'
OVER = 'font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;'
CTA = 'class="nbCta" style="display: flex; align-items: center; justify-content: center; height: 52px; border: 0; border-radius: 26px; background: {{ ctaTheme.cta }}; background-size: 170% 100%; box-shadow: {{ ctaTheme.shadow }}; color: {{ ctaTheme.fg }}; font: inherit; font-size: 16px; font-weight: 600; cursor: pointer'
new = (
    '<sc-if value="{{ show.test }}" hint-placeholder-val="{{ false }}">\n'
    '<sc-if value="{{ test.intro }}" hint-placeholder-val="{{ false }}">\n'
    '<div style="padding: 0 16px; animation: nbFade .3s ease both">\n'
    '<div style="position: relative; height: 200px; border-radius: 28px; background: {{ test.coverBg }}; overflow: hidden">'
    '<sc-if value="{{ test.hasPhoto }}" hint-placeholder-val="{{ false }}"><img src="{{ test.photo }}" alt="" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover"></sc-if>'
    '<sc-if value="{{ test.hasStk }}" hint-placeholder-val="{{ true }}"><img src="{{ test.stk }}" alt="" style="position: absolute; left: 50%; top: 50%; width: 118px; height: 118px; margin: -59px 0 0 -59px; object-fit: contain; filter: drop-shadow(0 16px 20px rgba(20,20,60,.22)); animation: nbFloat 7s ease-in-out infinite"></sc-if>'
    '<sc-if value="{{ test.week }}" hint-placeholder-val="{{ false }}"><span style="position: absolute; left: 14px; top: 14px; padding: 4px 10px; border-radius: 999px; background: rgba(255,255,255,.92); color: #1D2A6B; font-size: 12px; font-weight: 700">Тест недели</span></sc-if>'
    '</div>\n'
    '<span style="display: block; margin: 16px 4px 0; ' + OVER + ' color: {{ c.accent }}">{{ test.theme }} · {{ test.meta }}</span>\n'
    '<h1 style="margin: 6px 4px 0; font-size: 30px; line-height: 1.12; font-weight: 700; letter-spacing: -0.025em">{{ test.title }}</h1>\n'
    '<p style="margin: 10px 4px 0; font-size: 16px; line-height: 1.55; color: {{ c.label2 }}">{{ test.about }}</p>\n'
    '<div style="margin-top: 16px; padding: 14px 16px 16px; border-radius: 22px; background: {{ c.paper }}"><span style="' + OVER + ' color: {{ c.label3 }}">Что получишь</span>'
    '<sc-for list="{{ test.gets }}" as="tg" hint-placeholder-count="3"><div style="display: flex; align-items: flex-start; gap: 10px; margin-top: 10px">' + CHECK + '<span style="font-size: 15px; line-height: 1.4">{{ tg.t }}</span></div></sc-for></div>\n'
    '<p style="display: flex; gap: 8px; margin: 12px 4px 0; font-size: 13px; line-height: 1.45; color: {{ c.label2 }}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none; margin-top: 1px"><path d="{{ ic.book }}"></path></svg><span>{{ test.basis }}</span></p>\n'
    '<sc-if value="{{ test.hasPrev }}" hint-placeholder-val="{{ false }}"><button type="button" onClick="{{ test.openPrev }}" style="display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; margin-top: 12px; padding: 12px 16px; border: 0; border-radius: 18px; background: {{ c.greenSoft }}; font: inherit; text-align: left; color: {{ c.label }}; cursor: pointer"><span style="font-size: 14.5px">Прошлый результат: <b>{{ test.prevName }}</b></span>' + CHEV + '</button></sc-if>\n'
    '<button type="button" onClick="{{ test.start }}" ' + CTA + '; width: 100%; margin-top: 16px">Начать</button>\n'
    '<p style="margin: 10px 4px 0; text-align: center; font-size: 12.5px; line-height: 1.45; color: {{ c.label3 }}">Правильных ответов нет. Отвечай так, как обычно бывает в жизни.</p>\n'
    '</div>\n'
    '</sc-if>\n'
    '<sc-if value="{{ test.quiz }}" hint-placeholder-val="{{ true }}">\n' + quiz + '</sc-if>\n'
    '</sc-if>\n\n'
    '<sc-if value="{{ show.testResult }}" hint-placeholder-val="{{ false }}">\n'
    '<div style="padding: 0 16px; animation: nbFade .4s ease both">\n'
    '<div style="position: relative; display: flex; flex-direction: column; justify-content: flex-end; min-height: 330px; box-sizing: border-box; padding: 24px 20px 22px; border-radius: 30px; background: {{ test.resBg }}; color: #ffffff; overflow: hidden">'
    '<sc-if value="{{ test.hasPhoto }}" hint-placeholder-val="{{ false }}"><img src="{{ test.photo }}" alt="" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover"></sc-if>'
    '<sc-if value="{{ test.hasStk }}" hint-placeholder-val="{{ true }}"><img src="{{ test.stk }}" alt="" style="position: absolute; right: 16px; top: 34px; width: 124px; height: 124px; object-fit: contain; filter: drop-shadow(0 18px 22px rgba(0,0,0,.22)); animation: nbFloat 7s ease-in-out infinite"></sc-if>'
    '<div style="position: absolute; inset: 0; background: linear-gradient(180deg, rgba(10,14,40,0) 22%, rgba(10,14,40,.82) 100%)"></div>'
    '<span style="position: absolute; left: 16px; top: 16px; display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px 4px 4px; border-radius: 999px; background: rgba(255,255,255,.88); color: #1D2A6B; font-size: 12px; font-weight: 700; letter-spacing: 0.04em"><img src="/_blob/7645b5dbb1ba45e62382209bfcab9dc2" alt="" style="width: 20px; height: 20px; border-radius: 6px">NEBO</span>'
    '<span style="position: relative; display: block; ' + OVER + ' opacity: .85">{{ test.title }}</span>'
    '<strong style="position: relative; display: block; margin-top: 4px; font-size: 30px; line-height: 1.1; font-weight: 700; letter-spacing: -0.02em">{{ test.resTitle }}</strong>'
    '<p style="position: relative; margin: 10px 0 0; font-size: 16px; line-height: 1.55; opacity: .94">{{ test.resText }}</p></div>\n'
    '<div style="margin-top: 12px; padding: 14px 16px 16px; border-radius: 22px; background: {{ c.paper }}"><span style="' + OVER + ' color: {{ c.label3 }}">Твой результат</span>'
    '<sc-for list="{{ test.bars }}" as="tb" hint-placeholder-count="3"><div style="margin-top: 12px"><div style="display: flex; justify-content: space-between; gap: 10px; font-size: 14px"><span style="font-weight: {{ tb.fw }}">{{ tb.label }}</span><span style="color: {{ c.label2 }}; font-variant-numeric: tabular-nums">{{ tb.v }}</span></div><div style="height: 8px; margin-top: 6px; border-radius: 4px; background: {{ c.fill }}; overflow: hidden"><div style="width: {{ tb.w }}; height: 100%; border-radius: 4px; background: {{ tb.bg }}; transform-origin: left center; animation: nbBarIn 1.1s cubic-bezier(.22,1,.36,1) both"></div></div></div></sc-for></div>\n'
    '<div style="margin-top: 12px; padding: 2px 16px; border-radius: 22px; background: {{ c.paper }}"><sc-for list="{{ test.sections }}" as="tsx" hint-placeholder-count="3"><div style="padding: 14px 0; border-top: {{ tsx.border }}"><span style="' + OVER + ' color: {{ c.accent }}">{{ tsx.label }}</span><p style="margin: 6px 0 0; font-size: 15.5px; line-height: 1.55">{{ tsx.text }}</p></div></sc-for></div>\n'
    '<div style="margin-top: 12px; padding: 14px 16px 6px; border-radius: 22px; background: {{ c.paper }}"><span style="' + OVER + ' color: {{ c.green }}">Что попробовать</span>'
    '<sc-for list="{{ test.tips }}" as="ttp" hint-placeholder-count="3"><div style="display: flex; align-items: flex-start; gap: 12px; padding: 10px 0">' + CHECK + '<span style="font-size: 15.5px; line-height: 1.4">{{ ttp.t }}</span></div></sc-for></div>\n'
    '<sc-if value="{{ test.hasChart }}" hint-placeholder-val="{{ true }}"><div style="display: flex; gap: 10px; margin-top: 12px; padding: 14px 16px; border-radius: 20px; background: {{ c.accentSoft }}; font-size: 14px; line-height: 1.45"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="{{ c.accent }}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none; margin-top: 1px"><path d="{{ ic.wheel }}"></path></svg><span>{{ test.resChart }}</span></div></sc-if>\n'
    '<p style="margin: 12px 4px 0; font-size: 12.5px; line-height: 1.45; color: {{ c.label3 }}">{{ test.note }}</p>\n'
    '<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 14px"><button type="button" onClick="{{ test.share }}" ' + CTA + '">Поделиться</button><button type="button" onClick="{{ test.all }}" style="height: 52px; border: 0; border-radius: 26px; background: {{ c.fill }}; color: {{ c.label }}; font: inherit; font-size: 16px; font-weight: 600; cursor: pointer">Все тесты</button></div>\n'
    '<button type="button" onClick="{{ test.again }}" style="display: block; width: 100%; height: 44px; margin-top: 4px; border: 0; background: none; color: {{ c.accent }}; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer">Пройти ещё раз</button>\n'
    '</div>\n'
    '</sc-if>\n\n'
    '<sc-if value="{{ show.tests }}" hint-placeholder-val="{{ false }}">\n'
    '<div style="padding: 0 16px; animation: nbFade .3s ease both">\n'
    '<button type="button" onClick="{{ testsCat.week.go }}" style="position: relative; display: block; width: 100%; height: 196px; padding: 0; border: 0; border-radius: 28px; background: {{ testsCat.week.bg }}; overflow: hidden; font: inherit; text-align: left; color: #ffffff; cursor: pointer">'
    '<img src="{{ testsCat.week.stk }}" alt="" style="position: absolute; right: 14px; top: 26px; width: 120px; height: 120px; object-fit: contain; filter: drop-shadow(0 16px 20px rgba(20,20,60,.22)); animation: nbFloat 7s ease-in-out infinite">'
    '<span style="position: absolute; inset: 0; background: linear-gradient(90deg, rgba(20,16,60,.78) 0%, rgba(20,16,60,.35) 62%, rgba(20,16,60,0) 100%)"></span>'
    '<span style="position: absolute; left: 16px; top: 16px; padding: 4px 10px; border-radius: 999px; background: rgba(255,255,255,.92); color: #1D2A6B; font-size: 12px; font-weight: 700">Тест недели</span>'
    '<span style="position: absolute; left: 18px; right: 120px; bottom: 18px; display: flex; flex-direction: column; gap: 4px"><strong style="font-size: 23px; line-height: 1.15; font-weight: 700; letter-spacing: -0.015em">{{ testsCat.week.title }}</strong><span style="font-size: 14px; line-height: 1.35; opacity: .9">{{ testsCat.week.short }}</span><span style="font-size: 12.5px; font-weight: 600; opacity: .75">{{ testsCat.week.meta }}</span></span></button>\n'
    '<p style="margin: 10px 4px 0; font-size: 13.5px; line-height: 1.45; color: {{ c.label2 }}">Каждый понедельник новый тест. Все тесты бесплатно.</p>\n'
    '<sc-for list="{{ testsCat.groups }}" as="tgr" hint-placeholder-count="3"><h2 style="margin: 22px 4px 10px; font-size: 20px; font-weight: 700; letter-spacing: -0.01em">{{ tgr.title }}</h2><div style="border-radius: 22px; background: {{ c.paper }}; overflow: hidden">'
    '<sc-for list="{{ tgr.rows }}" as="trw" hint-placeholder-count="3"><button type="button" onClick="{{ trw.go }}" style="display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 14px; border: 0; border-top: {{ trw.border }}; background: none; font: inherit; text-align: left; color: {{ c.label }}; cursor: pointer">'
    '<span style="position: relative; width: 52px; height: 52px; flex: none; border-radius: 15px; background: {{ trw.bg }}; overflow: hidden"><sc-if value="{{ trw.hasPhoto }}" hint-placeholder-val="{{ false }}"><img src="{{ trw.photo }}" alt="" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover"></sc-if><sc-if value="{{ trw.hasStk }}" hint-placeholder-val="{{ true }}"><img src="{{ trw.stk }}" alt="" style="position: absolute; left: 50%; top: 50%; width: 38px; height: 38px; margin: -19px 0 0 -19px; object-fit: contain"></sc-if></span>'
    '<span style="display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0"><strong style="font-size: 15.5px; line-height: 1.25; font-weight: 600">{{ trw.title }}</strong><span style="font-size: 12.5px; line-height: 1.35; color: {{ c.label2 }}">{{ trw.sub }}</span>'
    '<sc-if value="{{ trw.done }}" hint-placeholder-val="{{ false }}"><span style="align-self: flex-start; margin-top: 4px; padding: 2px 8px; border-radius: 999px; background: {{ c.greenSoft }}; color: {{ c.green }}; font-size: 11.5px; font-weight: 700">{{ trw.doneLabel }}</span></sc-if></span>' + CHEV + '</button></sc-for></div></sc-for>\n'
    '</div>\n'
    '</sc-if>\n\n'
)
s = s[:k0] + new + s[k1:]

open(path, 'w', encoding='utf-8').write(s)
print('patch W applied')
