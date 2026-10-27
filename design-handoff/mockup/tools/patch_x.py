"""Patch X: esoteric features and the rotating promo on «Сегодня».
Today gets «Число дня» and «Руна дня» tiles; «Моя карта» gets a «Руны» tab with a paid
three-rune reading; «Числа» get the personal month and day, the name number and a paid
full report; «Знаки» get a Chinese horoscope tab; the pair result gets numbers and the
Chinese horoscope; the promo card on Today rotates and prefers new and unvisited sections.
Every replacement must match exactly."""
import json
import re
import sys
from urllib.parse import quote

sys.path.insert(0, sys.path[0])
import eso_data as E

path = sys.argv[1]
s = open(path, encoding='utf-8').read()
J = lambda x: json.dumps(x, ensure_ascii=False)


def r(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        raise SystemExit('expected %d match(es), found %d for: %r' % (count, n, old[:90]))
    s = s.replace(old, new)


# ------------------------------------------------------------------ shared markup pieces
def stone(w, h, gw, gh, d, extra=''):
    return ('<span style="position: relative; display: inline-flex; width: ' + w + '; height: ' + h + '; flex: none; align-items: center; justify-content: center; '
            'border-radius: 48% 52% 46% 54% / 56% 50% 50% 44%; background: radial-gradient(120% 90% at 30% 22%, #8794A1 0%, #4E5B69 50%, #29323C 100%); '
            'box-shadow: inset 0 2px 1px rgba(255,255,255,.25), inset 0 -4px 8px rgba(0,0,0,.35), 0 10px 18px -10px rgba(10,20,40,.65)' + extra + '">'
            '<svg width="' + gw + '" height="' + gh + '" viewBox="0 0 20 30" aria-hidden="true">'
            '<path d="' + d + '" fill="none" stroke="rgba(8,12,18,.55)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" transform="translate(.5 .8)"></path>'
            '<path d="' + d + '" fill="none" stroke="#F2CF7A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path></svg></span>')


def medal(size, fs, ch, big=False):
    ring = 'inset 0 0 0 3px rgba(255,255,255,.75), inset 0 0 0 4px rgba(120,130,150,.30)'
    if big:
        ring += ', inset 0 0 0 12px rgba(255,255,255,.28), inset 0 0 0 13px rgba(120,130,150,.22)'
    return ('<span style="display: inline-flex; width: ' + size + '; height: ' + size + '; flex: none; align-items: center; justify-content: center; border-radius: 50%; '
            'background: radial-gradient(circle at 34% 28%, #FFFFFF 0%, #EEF1F6 44%, #C3CAD7 100%); box-shadow: ' + ring + ', 0 14px 26px -14px rgba(20,30,80,.5)">'
            '<span style="font-family: \'Noto Serif SC\', \'Songti SC\', \'STSong\', \'SimSun\', serif; font-size: ' + fs + '; line-height: 1; font-weight: 600; color: #2A3142; text-shadow: 0 1px 0 rgba(255,255,255,.9)">' + ch + '</span></span>')


OVER = 'font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;'
CHEV = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="{{ c.label3 }}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none"><path d="{{ ic.chevR }}"></path></svg>'
LOCK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="{{ c.label3 }}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none"><path d="{{ ic.lock }}"></path></svg>'
HASH = 'M9.5 4L7.5 20M16.5 4l-2 16M4.5 9h15M3.5 15h15'
RUNE_IC = 'M8 3.5v17M8 5l7 4.5L8 14'
CTA_STYLE = 'class="nbCta" style="display: flex; align-items: center; justify-content: space-between; width: calc(100% - 32px); margin: 18px 16px 0; height: 54px; padding: 0 8px 0 18px; border: 0; border-radius: 27px; background: {{ ctaTheme.cta }}; background-size: 170% 100%; box-shadow: {{ ctaTheme.shadow }}; color: {{ ctaTheme.fg }}; font: inherit; font-size: 16.5px; font-weight: 600; cursor: pointer"'
ORN = ('<svg width="66" height="11" viewBox="0 0 58 10" aria-hidden="true"><path d="M3 5h18M37 5h18" stroke="#FFE29A" stroke-width="1" stroke-linecap="round" opacity=".7"></path>'
       '<path d="M29 .8l1.3 2.9 2.9 1.3-2.9 1.3L29 9.2l-1.3-2.9L24.8 5l2.9-1.3z" fill="#FFE29A"></path><circle cx="22.6" cy="5" r=".9" fill="#FFE29A"></circle><circle cx="35.4" cy="5" r=".9" fill="#FFE29A"></circle></svg>')
GLASS = 'border: 1px solid {{ c.glassSkyBorder }}; background: {{ c.glassSky }}; box-shadow: {{ ink.cardHi }}; backdrop-filter: blur(24px) saturate(170%); -webkit-backdrop-filter: blur(24px) saturate(170%); color: {{ ink.fg }}'
TILE_HEAD = 'display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: {{ ink.fg2 }}'

# ------------------------------------------------------------------ fonts: Chinese characters for the medallions only
HAN = ''.join(x[2] for x in E.CN)
r('<link href="https://fonts.googleapis.com/css2?family=Onest:wght@300;400;500;600;700&amp;family=Cormorant+Garamond:wght@600;700&amp;display=swap" rel="stylesheet">\n',
  '<link href="https://fonts.googleapis.com/css2?family=Onest:wght@300;400;500;600;700&amp;family=Cormorant+Garamond:wght@600;700&amp;display=swap" rel="stylesheet">\n'
  '<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@600&amp;text=' + quote(HAN) + '&amp;display=swap" rel="stylesheet">\n')

# ------------------------------------------------------------------ props
r('"tarot","tarotDeck","tarotRead","askAnswer"', '"tarot","tarotDeck","tarotRead","runes","runeRead","askAnswer"')
r('"planet_asc","planet_venus"', '"dayNumber","dayRune","buyRunes","buyNumbers","numFull_year","numFull_pairs","numFull_name","rune_3","planet_asc","planet_venus"')
r('"shareFrom":{"editor":"enum","options":["tarot","sign","day"]', '"shareFrom":{"editor":"enum","options":["tarot","sign","day","runes"]')
r(',"$preview":{"width":390,"height":844}}',
  ',"signsMode":{"editor":"enum","options":["zodiac","cn"],"default":"zodiac"},"runeSample":{"editor":"boolean","default":false},"promoIdx":{"editor":"int","min":0,"max":11,"default":0},"numOwned":{"editor":"boolean","default":false},"$preview":{"width":390,"height":844}}')

# ------------------------------------------------------------------ state, timers, visits, payments
r("const mineSeg = { natal: 'natal', matrix: 'matrix', numbers: 'numbers', ask: 'natal', tarot: 'tarot' }[start];",
  "const mineSeg = { natal: 'natal', matrix: 'matrix', numbers: 'numbers', ask: 'natal', tarot: 'tarot', runes: 'runes' }[start];")
r("tarotSample: yes(props.tarotSample),",
  "tarotSample: yes(props.tarotSample), signsMode: props.signsMode === 'cn' ? 'cn' : 'zodiac', cnIdx: -1, runeQ: " + J(E.RUNE_READ['q']) + ", runeSample: yes(props.runeSample), numOwned: yes(props.numOwned), promoIdx: num(props.promoIdx, 0), promoAt: 0, "
  "visited: { today: true, 'signs:zodiac': true, 'mine:natal': true, 'mine:tarot': true, people: true, pair: true, rest: true, profile: true, moon: true, year: true },")
r("this.phT = setInterval(",
  "this.prT = setInterval(() => { const st = this.state; if (st.screen !== 'today' || st.period !== 'day' || st.popup || st.hold || st.coach >= 0 || st.loading || Date.now() - (st.promoAt || 0) < 6000) return; this.setState({ promoIdx: (st.promoIdx || 0) + 1 }); }, 6500);\n"
  "    this.phT = setInterval(")
r("[this.mxT, this.wrT, this.calcT, this.codeT, this.phT].forEach(clearInterval);", "[this.mxT, this.wrT, this.calcT, this.codeT, this.phT, this.prT].forEach(clearInterval);")
r("componentDidUpdate() { this.navScroll();", "componentDidUpdate() { this.navScroll(); this.markVisit();")
r("  navKey() {",
  "  markVisit() { const st = this.state; const k = st.screen === 'mine' ? 'mine:' + st.seg : st.screen === 'signs' ? 'signs:' + (st.signsMode || 'zodiac') : st.screen; const seen = st.visited || {}; const add = [k].concat(st.popup ? ['pop:' + st.popup] : []).filter((x) => !seen[x]); if (add.length) this.setState({ visited: Object.assign({}, seen, Object.fromEntries(add.map((x) => [x, true]))) }); }\n"
  "  navKey() {")
r("    if (k === 'spread') { this.setState({ payStage: 0 }); this.startDeck(); return; }\n",
  "    if (k === 'spread') { this.setState({ payStage: 0 }); this.startDeck(); return; }\n"
  "    if (k === 'runes') { this.setState({ payStage: 0, popup: null, screen: 'runeRead', runeSample: false }); return; }\n"
  "    if (k === 'numbers') { this.setState({ payStage: 0, popup: null, numOwned: true }); this.toast('Всё о числах открыто'); return; }\n")
r("spread: STK.tarot, buyNatal:", "spread: STK.tarot, runes: STK.star, numbers: STK.star, buyNatal:")

# ------------------------------------------------------------------ navigation for the rune reading
r("tarotRead: scr === 'tarotRead',", "tarotRead: scr === 'tarotRead', runeRead: scr === 'runeRead',")
r("numbers: s.seg === 'numbers', tarot: s.seg === 'tarot' }", "numbers: s.seg === 'numbers', tarot: s.seg === 'tarot', runes: s.seg === 'runes' }")
r("'tarotDeck', 'tarotRead', 'askAnswer', 'guide', 'year', 'player'", "'tarotDeck', 'tarotRead', 'runeRead', 'askAnswer', 'guide', 'year', 'player'")
r("['chapter', 'tarotDeck', 'tarotRead', 'askAnswer', 'guide', 'year'].indexOf(scr) >= 0) ? 'mine'", "['chapter', 'tarotDeck', 'tarotRead', 'runeRead', 'askAnswer', 'guide', 'year'].indexOf(scr) >= 0) ? 'mine'", count=2)
r("seg: (scr === 'tarotDeck' || scr === 'tarotRead') ? 'tarot' :", "seg: (scr === 'tarotDeck' || scr === 'tarotRead') ? 'tarot' : scr === 'runeRead' ? 'runes' :")
r("'tarotDeck', 'tarotRead', 'year', 'player'", "'tarotDeck', 'tarotRead', 'runeRead', 'year', 'player'")
r("'tarot', 'tarotDeck', 'tarotRead', 'askAnswer', 'guide', 'year'].indexOf(scr) >= 0) ? 'deep'", "'tarot', 'tarotDeck', 'tarotRead', 'runeRead', 'askAnswer', 'guide', 'year'].indexOf(scr) >= 0) ? 'deep'")
r("tarotRead: 'Твой расклад',", "tarotRead: 'Твой расклад', runeRead: 'Расклад рун',")
r("largeTitles = { signs: ['Гороскоп на сегодня', 'Знаки'], mine: s.seg === 'tarot' ? ['Расклады на любой вопрос', 'Таро'] :",
  "largeTitles = { signs: s.signsMode === 'cn' ? ['Китайский гороскоп по году рождения', 'Знаки'] : ['Гороскоп на сегодня', 'Знаки'], mine: s.seg === 'tarot' ? ['Расклады на любой вопрос', 'Таро'] : s.seg === 'runes' ? ['Руна дня и расклады', 'Руны'] :")
r("    const mineSegs = [['natal', 'Карта'], ['matrix', 'Матрица'], ['numbers', 'Числа'], ['tarot', 'Таро']]",
  "    const mineSegs = [['natal', 'Карта'], ['matrix', 'Матрица'], ['numbers', 'Числа'], ['tarot', 'Таро'], ['runes', 'Руны']]")
r('grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 2px; padding: 3px; border-radius: 999px; background: {{ c.fill }}">\n<sc-for list="{{ mineSegs }}" as="ms" hint-placeholder-count="4">',
  'grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 2px; padding: 3px; border-radius: 999px; background: {{ c.fill }}">\n<sc-for list="{{ mineSegs }}" as="ms" hint-placeholder-count="5">')

# ------------------------------------------------------------------ texts on Today in three languages
r("promoOver: 'Есть в NEBO',", "promoOver: 'Есть в NEBO', promoNew: 'Новое в NEBO', promoTry: 'Загляни', numOfDay: 'Число дня', runeOfDay: 'Руна дня', runeTileSub: 'Ансуз · слово', runesLbl: 'РУНЫ',")
r("promoOver: 'In NEBO',", "promoOver: 'In NEBO', promoNew: 'New in NEBO', promoTry: 'Take a look', numOfDay: 'Number of the day', runeOfDay: 'Rune of the day', runeTileSub: 'Ansuz · the word', runesLbl: 'RUNES',")
r("promoOver: 'En NEBO',", "promoOver: 'En NEBO', promoNew: 'Nuevo en NEBO', promoTry: 'Echa un vistazo', numOfDay: 'Número del día', runeOfDay: 'Runa del día', runeTileSub: 'Ansuz · la palabra', runesLbl: 'RUNAS',")

# ------------------------------------------------------------------ data and values
ESO_JS = (
    "    // runes, numbers of the day and of the name, chinese horoscope, promo on Today\n"
    "    const RUNES = " + J(E.RUNES) + ";\n"
    "    const RUNE_IX = Object.fromEntries(RUNES.map((r0, i) => [r0[0], i]));\n"
    "    const RR = " + J(E.RUNE_READ) + ";\n"
    "    const NUM_DAY = " + J(E.NUM_DAY) + ", NUM_DAY_TX = " + J(E.NUM_DAY_TX) + ";\n"
    "    const NUM_MONTH = " + J(E.NUM_MONTH) + ", NUM_MONTH_SHORT = " + J(E.NUM_MONTH_SHORT) + ";\n"
    "    const NUM_NAME = " + J(E.NUM_NAME) + ", NUM_NAME_OTHER = " + J(E.NUM_NAME_OTHER) + ", NUM_NAME_GROW = " + J(E.NUM_NAME_GROW) + ";\n"
    "    const NUM_PAIR = " + J(E.NUM_PAIR) + ", NUM_FULL = " + J(E.NUM_FULL) + ";\n"
    "    const CN = " + J(E.CN) + ", CN_GEN = " + J(E.CN_GEN) + ", CN_EL = " + J(E.CN_EL) + ", CN_REL = " + J(E.CN_REL) + ";\n"
    "    const CNY = " + J(E.CNY) + ";\n"
    "    const digSum = (n) => String(n).split('').reduce((a, b) => a + Number(b), 0);\n"
    "    const redNum = (n) => { let v = n; while (v > 9) v = digSum(v); return v; };\n"
    "    const BD = { me: [6, 3, 1989], dariya: [12, 8, 1994], nika: [7, 1, 1996], mark: [3, 9, 1992], olya: [14, 10, 1994], artem: [4, 6, 1991], sasha: [2, 4, 1993] };\n"
    "    const bdOf = (k) => BD[k] || BD.me;\n"
    "    const lpOf = (k) => { const b = bdOf(k); return redNum(digSum(b[0]) + digSum(b[1]) + digSum(b[2])); };\n"
    "    const pyOf = (k) => { const b = bdOf(k); return redNum(digSum(b[0]) + digSum(b[1]) + digSum(2026)); };\n"
    "    const pmOf = (k, m) => redNum(pyOf(k) + digSum(m));\n"
    "    const pdOf = (k) => redNum(pmOf(k, 10) + digSum(21));\n"
    "    const LETTERS = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';\n"
    "    const letterNum = (ch) => { const lc = ch.toLowerCase(); const i = LETTERS.indexOf(lc); if (i >= 0) return (i % 9) + 1; const j = 'abcdefghijklmnopqrstuvwxyz'.indexOf(lc); return j >= 0 ? (j % 9) + 1 : 0; };\n"
    "    const nameNum = (nm) => { const ls = nm.split('').filter((ch) => letterNum(ch) > 0).map((ch) => ({ ch: ch.toUpperCase(), n: String(letterNum(ch)) })); const sum = ls.reduce((a, x) => a + Number(x.n), 0); return { ls, sum, n: Math.max(1, redNum(sum)) }; };\n"
    "    const cnOf = (b) => { const ny = CNY[b[2] - 1950] || 204; const y = b[1] * 100 + b[0] < ny ? b[2] - 1 : b[2]; return { y, a: ((y - 4) % 12 + 12) % 12, e: Math.floor((y % 10) / 2) }; };\n"
    "    const cnK = (k) => cnOf(bdOf(k));\n"
    "    const cnAdj = (x) => CN_EL[x.e][CN[x.a][1] === 'm' ? 1 : 2] + ' ' + CN[x.a][0];\n"
    "    const CN_HARM = [[0, 7], [1, 6], [2, 5], [3, 4], [8, 11], [9, 10]], CN_FRIEND = [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]];\n"
    "    const inPairs = (list, a, b) => list.some((q) => (q[0] === a && q[1] === b) || (q[0] === b && q[1] === a));\n"
    "    const cnRel = (a, b) => (a === b ? 'same' : a % 4 === b % 4 ? 'trine' : inPairs(CN_FRIEND, a, b) ? 'friend' : (a + 6) % 12 === b ? 'clash' : inPairs(CN_HARM, a, b) ? 'harm' : 'neutral');\n"
    "    const numGroup = (n) => ([1, 5, 7].indexOf(n) >= 0 ? 0 : [2, 4, 8].indexOf(n) >= 0 ? 1 : 2);\n"
    "    const numPairKey = (x, y) => { const gx = numGroup(x), gy = numGroup(y); return x === y ? 'same' : gx === gy ? 'g' + gx : 'g' + Math.min(gx, gy) + '-g' + Math.max(gx, gy); };\n"
    "    const stoneOf = (k) => { const r0 = RUNES[RUNE_IX[k]]; return { key: k, d: r0[3], name: r0[1], kw: r0[2], text: r0[4], advice: r0[5] }; };\n"
    "    const bigStone = (d) => ({ d, w: '78px', h: '94px', gw: '34px', gh: '51px', rot: '-4deg', delay: '0s' });\n"
    "    const numGrad = sky ? 'linear-gradient(160deg,#FFFFFF 0%,#D9E4FF 100%)' : (dark ? 'linear-gradient(160deg,#9DB7FF 0%,#C9B2FF 100%)' : 'linear-gradient(160deg,#2C5BEA 0%,#8B5CF6 100%)');\n"
    "    const popNumGrad = dark ? 'linear-gradient(160deg,#9DB7FF 0%,#C9B2FF 100%)' : 'linear-gradient(160deg,#2C5BEA 0%,#8B5CF6 100%)';\n"
    "    // Today: number and rune of the day, always for the account owner\n"
    "    const myPY = pyOf('me'), myPM = pmOf('me', 10), myPD = pdOf('me');\n"
    "    const myCalc = (() => { const b = BD.me; const ds = String(b[0]).split('').concat(String(b[1]).split(''), '2026'.split('')); const sm = ds.reduce((a, x) => a + Number(x), 0); return ds.join(' + ') + ' = ' + sm + (sm > 9 ? ' → ' + redNum(sm) : ''); })();\n"
    "    const dayRuneS = stoneOf(" + J(E.RUNE_OF_DAY) + ");\n"
    "    const dayNum = { n: String(myPD), title: NUM_DAY_TX[L] ? NUM_DAY_TX[L][myPD - 1] : NUM_DAY[myPD - 1][0], grad: numGrad, open: () => this.setState({ popup: 'dayNumber' }) };\n"
    "    const dayRune = { d: dayRuneS.d, open: () => this.setState({ popup: 'dayRune' }) };\n"
    "    // runes tab and reading\n"
    "    const runesV = {\n"
    "      day: dayRuneS, openDay: () => this.setState({ popup: 'dayRune' }),\n"
    "      q: s.runeSample ? RR.q : s.runeQ, chips: RR.chips.map((q) => ({ label: q, pick: () => this.setState({ runeQ: q }) })),\n"
    "      price: plusOn ? 'в Plus' : '99 ₽', note: plusOn ? 'В Plus расклады рун без оплаты' : 'Расклад 99 ₽. В Plus без оплаты',\n"
    "      cta: plusOn ? 'Бросить руны' : 'Бросить руны · 99 ₽', go: () => (plusOn ? this.setState({ screen: 'runeRead', runeSample: false }) : this.setState({ popup: 'buyRunes' })),\n"
    "      example: () => this.setState({ screen: 'runeRead', runeSample: true }),\n"
    "      hero: [['raidho', '86px', '30px', '-12deg', '0s'], ['ansuz', '28px', '22px', '9deg', '1.6s'], ['jera', '56px', '96px', '-3deg', '3.2s']].map((x) => ({ d: stoneOf(x[0]).d, right: x[1], top: x[2], rot: x[3], delay: x[4] })),\n"
    "      grid: RUNES.map((r0, i) => ({ d: r0[3], name: r0[1], open: () => this.setState({ popup: 'rune_' + i }) })),\n"
    "      sample: !!s.runeSample, own: () => this.setState({ screen: 'mine', seg: 'runes', runeSample: false }), ownLabel: plusOn ? 'Сделать свой' : 'Свой за 99 ₽',\n"
    "      cast: RR.cast.map((x, i) => Object.assign(stoneOf(x[1]), { label: x[0], reading: x[2], delay: (0.2 + i * 0.5).toFixed(2) + 's', rot: ['-6deg', '4deg', '-3deg'][i], border: i ? '1px solid ' + c.sep : '0' })),\n"
    "      meaning: RR.meaning, advice: RR.advice,\n"
    "      save: () => this.toast('Расклад сохранён в дневник'), share: () => this.setState({ popup: 'share', shareFrom: 'runes' }), again: () => this.setState({ screen: 'mine', seg: 'runes', runeSample: false }),\n"
    "    };\n"
    "    // numbers: month, day and name of the person whose chart is open\n"
    "    const nk = s.chartOf || 'me';\n"
    "    const nPY = pyOf(nk), nPM = pmOf(nk, 10), nPD = pdOf(nk);\n"
    "    const nName = nk === 'me' ? (s.uname || 'Михаил') : who.name;\n"
    "    const nn = nameNum(nName);\n"
    "    const PRN = who.sex === 'f' ? { pn: 'неё', ins: 'ней', dat: 'ей', datn: 'ней', acc: 'её', nom: 'она', pos: 'Её' } : { pn: 'него', ins: 'ним', dat: 'ему', datn: 'нему', acc: 'его', nom: 'он', pos: 'Его' };\n"
    "    const prn = (str) => str.replace(/\\{(\\w+)\\}/g, (m0, k0) => PRN[k0] || m0);\n"
    "    const numOwned = plusOn || !!s.numOwned;\n"
    "    const NUM_MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];\n"
    "    const numV = {\n"
    "      monthOver: (isMe ? 'Твой' : PRN.pos) + ' октябрь · личный месяц', monthN: String(nPM), monthTitle: NUM_MONTH[nPM - 1][0], monthText: NUM_MONTH[nPM - 1][1],\n"
    "      dayN: String(nPD), dayTitle: NUM_DAY[nPD - 1][0], dayText: NUM_DAY[nPD - 1][1],\n"
    "      name: nName, letters: nn.ls, sum: nn.sum > 9 ? '= ' + nn.sum + ' → ' + nn.n : '= ' + nn.n, nameN: String(nn.n), nameTitle: NUM_NAME[nn.n - 1][0], nameText: isMe ? NUM_NAME[nn.n - 1][1] : prn(NUM_NAME_OTHER[nn.n - 1][1]),\n"
    "      more: [['year', 'Год по месяцам', 'Все 12 месяцев 2026 по числам'], ['pairs', 'Пары по числам', 'С кем из близких легко и почему'], ['name', 'Имя подробно', 'Сильные стороны и над чем работать']].map((x, i) => ({ title: x[1], sub: x[2], locked: !numOwned, open2: numOwned, open: () => this.setState({ popup: numOwned ? 'numFull_' + x[0] : 'buyNumbers' }), border: i ? '1px solid ' + c.sep : '0' })),\n"
    "      locked: !numOwned, go: () => this.setState({ popup: 'buyNumbers' }),\n"
    "    };\n"
    "    // chinese horoscope on «Знаки»\n"
    "    const myCn = cnOf(acc === 'guest' && s.d && s.y ? [s.d, s.m, s.y] : BD.me);\n"
    "    const cnI = s.cnIdx >= 0 ? s.cnIdx : myCn.a;\n"
    "    const cnPick = (i) => bump({ cnIdx: i });\n"
    "    const cnYears = (a) => { const out = []; for (let y = 1977; y <= 2031; y++) if (((y - 4) % 12 + 12) % 12 === a) out.push(y); return out; };\n"
    "    const cnRels = CN.map((x, i) => [i, cnRel(cnI, i)]).filter((x) => x[0] !== cnI);\n"
    "    const cnChip = (x) => ({ ch: CN[x[0]][2], name: CN[x[0]][0], pick: () => cnPick(x[0]) });\n"
    "    const cnV = {\n"
    "      on: s.signsMode === 'cn', off: s.signsMode !== 'cn',\n"
    "      modes: [['zodiac', 'Зодиак'], ['cn', 'Китайский']].map(([k0, l0]) => ({ label: l0, bg: s.signsMode === k0 ? c.segOn : 'transparent', sh: s.signsMode === k0 ? '0 1px 4px rgba(11,13,18,.12)' : 'none', fg: s.signsMode === k0 ? c.label : c.label2, pick: () => this.setState({ signsMode: k0 }) })),\n"
    "      ch: CN[cnI][2], name: CN[cnI][0], gen: CN_GEN[cnI], years: cnYears(cnI).join(' · '),\n"
    "      prevCh: CN[(cnI + 11) % 12][2], nextCh: CN[(cnI + 1) % 12][2], prevName: CN[(cnI + 11) % 12][0], nextName: CN[(cnI + 1) % 12][0],\n"
    "      prev: () => cnPick((cnI + 11) % 12), next: () => cnPick((cnI + 1) % 12), anim: s.pop % 2 ? 'nbSignA' : 'nbSignB',\n"
    "      glow: dark ? 'radial-gradient(circle, rgba(170,185,255,.18), rgba(170,185,255,0) 66%)' : 'radial-gradient(circle, rgba(255,214,150,.40), rgba(255,214,150,0) 66%)',\n"
    "      mine: cnI === myCn.a, mineLabel: 'Твой знак · ' + cnAdj(myCn) + ', ' + myCn.y, elText: CN_EL[myCn.e][4], elColor: CN_EL[myCn.e][3],\n"
    "      character: CN[cnI][3], year: CN[cnI][4],\n"
    "      good: cnRels.filter((x) => x[1] === 'trine' || x[1] === 'friend').map(cnChip), hard: cnRels.filter((x) => x[1] === 'clash' || x[1] === 'harm').map(cnChip),\n"
    "      grid: CN.map((x, i) => ({ ch: x[2], name: x[0], bg: i === cnI ? c.accentSoft : 'transparent', pick: () => cnPick(i) })),\n"
    "      dots: CN.map((x, i) => ({ w: i === cnI ? '18px' : '6px', bg: i === cnI ? c.accent : c.fill })),\n"
    "      toPair: () => this.setState({ screen: 'pair', pairMode: 'date', popup: null }),\n"
    "    };\n"
    "    // promo on Today: new sections first, then the ones not opened yet, then the rest\n"
    "    const PROMO_X = " + J(E.PROMO) + ";\n"
    "    const PROMO_XT = " + J(E.PROMO_TX) + "[L];\n"
    "    const CN_NAME_TX = " + J(E.CN_NAME_TX) + ";\n"
    "    const myNN = nameNum(acc === 'guest' ? (s.uname || 'Михаил') : 'Михаил');\n"
    "    const cnMyName = CN_NAME_TX[L] ? CN_NAME_TX[L][myCn.a] : CN[myCn.a][0];\n"
    "    const PROMO_GO = {\n"
    "      runes: () => this.setState({ screen: 'mine', seg: 'runes' }), cn: () => this.setState({ screen: 'signs', signsMode: 'cn', cnIdx: -1 }),\n"
    "      tests: () => this.setState({ screen: 'test', testId: 'love', testQ: -1, testAns: [] }), nameNum: () => this.setState({ screen: 'mine', seg: 'numbers', chartOf: 'me' }),\n"
    "      pairMore: () => this.setState({ screen: 'pairResult', pairMode: 'date', pairA: 'me', pairB: 'dariya', pairRel: 'relationship' }),\n"
    "      matrix: () => { this.setState({ screen: 'mine', seg: 'matrix', chartOf: 'me' }); setTimeout(() => this.runMatrix(), 50); },\n"
    "      guide: () => this.setState({ screen: 'guide' }), moon: () => this.setState({ screen: 'moon' }), poster: () => this.setState({ popup: 'poster' }),\n"
    "      year: () => this.setState({ screen: 'year' }), gift: () => this.setState({ screen: 'gift' }), breath: () => this.setState({ screen: 'breath' }),\n"
    "    };\n"
    "    const PROMO_ART = { runes: ['rune', dayRuneS.d], cn: ['han', CN[myCn.a][2]], tests: ['img', STK.loveletter], nameNum: ['num', String(myNN.n)], pairMore: ['img', STK.rings], matrix: ['img', STK.star], guide: ['img', P('cb36ecd5fc8e6f4c9b386ee96d38616c')], moon: ['img', STK.moonphase], poster: ['img', STK.poster], year: ['img', STK.calendar], gift: ['img', STK.gift], breath: ['img', STK.leaf] };\n"
    "    const seenV = s.visited || {};\n"
    "    const pxAll = PROMO_X.map((x) => ({ key: x[0], vk: x[1], isNew: x[2], title: x[3], text: x[4] }));\n"
    "    const pxNew = pxAll.filter((x) => x.isNew && !seenV[x.vk]), pxTry = pxAll.filter((x) => !x.isNew && !seenV[x.vk]), pxSeen = pxAll.filter((x) => seenV[x.vk]);\n"
    "    let pxList = [];\n"
    "    for (let i = 0; i < 6; i++) { if (pxNew[i]) pxList.push([pxNew[i], 'new']); if (pxTry[i]) pxList.push([pxTry[i], 'try']); }\n"
    "    pxList = pxList.slice(0, 7).concat(pxSeen.slice(0, 2).map((x) => [x, 'all']));\n"
    "    const pxPin = { gift: 'gift', guide: 'guide', poster: 'poster', year: 'year' }[this.props.promo];\n"
    "    if (pxPin) { const one = pxAll.filter((x) => x.key === pxPin)[0]; pxList = [[one, 'all']].concat(pxList.filter((x) => x[0].key !== pxPin)); }\n"
    "    const pxI = (s.promoIdx || 0) % pxList.length;\n"
    "    const pxFill = (str) => str.replace('{cnName}', cnMyName);\n"
    "    const promos = pxList.map(([x, why], i) => { const on = i === pxI; const tx = PROMO_XT && PROMO_XT[x.key]; const art = PROMO_ART[x.key] || ['img', STK.star]; return { over: why === 'new' ? t.promoNew : why === 'try' ? t.promoTry : t.promoOver, title: pxFill(tx ? tx[0] : x.title), text: pxFill(tx ? tx[1] : x.text), hasImg: art[0] === 'img', img: art[0] === 'img' ? art[1] : '', hasRune: art[0] === 'rune', d: art[0] === 'rune' ? art[1] : '', hasHan: art[0] === 'han', ch: art[0] === 'han' ? art[1] : '', hasNum: art[0] === 'num', n: art[0] === 'num' ? art[1] : '', grad: numGrad, op: on ? '1' : '0', vis: on ? 'visible' : 'hidden', tf: on ? 'none' : 'translateY(10px)', hid: on ? 'false' : 'true', tab: on ? '0' : '-1', go: PROMO_GO[x.key] }; });\n"
    "    const promoDots = pxList.map((x, i) => ({ w: i === pxI ? '16px' : '6px', bg: i === pxI ? (sky ? '#ffffff' : c.accent) : (sky ? 'rgba(255,255,255,.4)' : c.sep2), aria: 'Подсказка ' + (i + 1) + ' из ' + pxList.length, pick: () => this.setState({ promoIdx: i, promoAt: Date.now() }) }));\n"
    "\n"
)
r("    // people\n", ESO_JS + "    // people\n")

PAIR_JS = (
    "    const pmA = s.pairA || 'me', pmB = s.pairB || 'dariya';\n"
    "    const lpA = lpOf(pmA), lpB = lpOf(pmB), npk = numPairKey(lpA, lpB);\n"
    "    const cxA = cnK(pmA), cxB = cnK(pmB), cxr = cnRel(cxA.a, cxB.a);\n"
    "    const cxGood = cxr === 'trine' || cxr === 'friend' || cxr === 'same', cxBad = cxr === 'clash' || cxr === 'harm';\n"
    "    const pairMore = {\n"
    "      on: !signMode, nameA: nameOf(pmA), nameB: nameOf(pmB), numA: String(lpA), numB: String(lpB), numTitle: NUM_PAIR[npk][0], numText: NUM_PAIR[npk][1], grad: popNumGrad,\n"
    "      chA: CN[cxA.a][2], chB: CN[cxB.a][2], cnA: cnAdj(cxA), cnB: cnAdj(cxB), cnTitle: CN_REL[cxr][0], cnText: CN_REL[cxr][1],\n"
    "      cnBg: cxGood ? c.greenSoft : cxBad ? (dark ? 'rgba(240,138,60,.16)' : 'rgba(240,138,60,.12)') : c.fill, cnFg: cxGood ? c.green : cxBad ? '#D9701E' : c.label2,\n"
    "      goCn: () => this.setState({ screen: 'signs', signsMode: 'cn', cnIdx: cxA.a, popup: null }),\n"
    "    };\n"
)
r("    const pairNames = signMode ?", PAIR_JS + "    const pairNames = signMode ?")

r("ink, who, starLayers, doodleUrl: this.doodle(),", "ink, who, starLayers, dayNum, dayRune, runes: runesV, numx: numV, cn: cnV, pairMore, promos, promoDots, doodleUrl: this.doodle(),")

# ------------------------------------------------------------------ popups
r("const base = { on: true, hasBtnStyles: false,", "const base = { on: true, hasBigNum: false, bigNum: '', bigNumGrad: '', hasStones: false, stones: [], hasTip: false, tipOver: '', tipText: '', hasBtnStyles: false,")
POP_JS = (
    "    const rowsOf = (list, hi) => list.map((x, i) => ({ k: x[0], v: String(x[1]), vc: i === hi ? c.accent : c.label, border: i ? '1px solid ' + c.sep : '0' }));\n"
    "    if (p === 'dayNumber') pop = Object.assign({}, base, { icon: false, hasBigNum: true, bigNum: String(myPD), bigNumGrad: popNumGrad, hasOver: true, over: 'Твоё число дня · 21 октября', title: NUM_DAY[myPD - 1][0], hasText: true, text: NUM_DAY[myPD - 1][1], hasRows: true, rows: rowsOf([['Личный год 2026', myPY], ['Личный месяц, октябрь', myPM], ['Число дня, 21-е', myPD]], 2), hasTip: true, tipOver: 'Как считаем', tipText: 'Складываем день и месяц рождения с годом: ' + myCalc + '. Это личный год. К нему прибавляем месяц и число, поэтому число дня у каждого своё.', buttons: [btn('Все мои числа', () => this.setState({ popup: null, screen: 'mine', seg: 'numbers', chartOf: 'me' }), 'primary'), btn('Понятно', close, 'link')] });\n"
    "    if (p === 'dayRune') pop = Object.assign({}, base, { icon: false, hasStones: true, stones: [bigStone(dayRuneS.d)], hasOver: true, over: 'Руна дня · 21 октября', title: dayRuneS.name + ' · ' + dayRuneS.kw, hasText: true, text: dayRuneS.text, hasTip: true, tipOver: 'Совет на сегодня', tipText: dayRuneS.advice, buttons: [btn('Разложить три руны', () => this.setState({ popup: null, screen: 'mine', seg: 'runes' }), 'primary'), btn('Понятно', close, 'link')] });\n"
    "    const RUM = /^rune_(\\d+)$/.exec(p || '');\n"
    "    if (RUM && RUNES[Number(RUM[1])]) { const r0 = RUNES[Number(RUM[1])]; pop = Object.assign({}, base, { icon: false, hasStones: true, stones: [bigStone(r0[3])], hasOver: true, over: 'Руна ' + (Number(RUM[1]) + 1) + ' из 24', title: r0[1] + ' · ' + r0[2], hasText: true, text: r0[4], hasTip: true, tipOver: 'Совет, если выпала', tipText: r0[5], buttons: [btn('Понятно', close, 'primary')] }); }\n"
    "    if (p === 'buyRunes') pop = Object.assign({}, base, { icon: false, hasStones: true, stones: RR.cast.map((x, i) => ({ d: stoneOf(x[1]).d, w: '52px', h: '62px', gw: '22px', gh: '33px', rot: ['-8deg', '3deg', '9deg'][i], delay: (i * 0.8) + 's' })), hasOver: true, over: 'Расклад рун', title: 'Три руны: что было, что есть, к чему идёт', hasBullets: true, bullets: ['Три руны из 24 рун старшего футарка', 'Толкование под твой вопрос', 'Совет: что делать дальше', 'Расклад сохранится в дневнике'], hasExample: true, exampleOver: 'Пример: «Что есть · Райдо»', example: RR.cast[1][2], buttons: [btn('Купить расклад', () => (acc === 'guest' ? this.setState({ popup: 'signin' }) : this.pay('runes', 'Расклад «Три руны»', '99 ₽')), 'primary', '99 ₽'), btn('Или все расклады в Plus · от 399\u00a0₽', () => this.setState({ popup: null, screen: 'plus' }), 'link')] });\n"
    "    if (p === 'buyNumbers') { const nov = pmOf(nk, 11); pop = Object.assign({}, base, { icon: true, iconPath: '" + HASH + "', hasOver: true, over: 'Числа целиком · навсегда', title: 'Открой всё о числах', hasBullets: true, bullets: NUM_FULL, hasExample: true, exampleOver: 'Пример: ноябрь 2026', example: 'Ноябрь под числом ' + nov + ': ' + NUM_MONTH[nov - 1][0].toLowerCase() + '. ' + NUM_MONTH[nov - 1][1] + ' Лучшие дни для важного: 3, 12 и 21 ноября, а с 18-го', buttons: [btn('Купить навсегда', () => (acc === 'guest' ? this.setState({ popup: 'signin' }) : this.pay('numbers', 'Числа целиком', '290 ₽')), 'primary', '290 ₽'), btn('Или всё в Plus · от 399 ₽ в месяц', () => this.setState({ popup: null, screen: 'plus' }), 'link')] }); }\n"
    "    if (p === 'numFull_year') pop = Object.assign({}, base, { icon: false, hasBigNum: true, bigNum: String(nPY), bigNumGrad: popNumGrad, hasOver: true, over: (isMe ? 'Твой' : PRN.pos) + ' 2026 по месяцам', title: who.num.yearTitle, hasText: true, text: who.num.yearText + ' Внутри года у каждого месяца своё число:', hasRows: true, rows: rowsOf(NUM_MONTHS.map((mn, i) => { const n = pmOf(nk, i + 1); return [mn, n + ' · ' + NUM_MONTH_SHORT[n - 1]]; }), 9), buttons: [btn('Понятно', close, 'primary')] });\n"
    "    if (p === 'numFull_pairs') pop = Object.assign({}, base, { icon: true, iconPath: ic.people, hasOver: true, over: 'Пары по числам', title: (isMe ? 'Твоё' : PRN.pos) + ' число судьбы ' + lpOf(nk), hasText: true, text: 'Числа делятся на три семьи: 1, 5, 7 про свободу и ум, 2, 4, 8 про дело и порядок, 3, 6, 9 про чувства и заботу. Внутри семьи легко, а между семьями люди дополняют друг друга.', hasRows: true, rows: rowsOf(['me', 'dariya', 'nika', 'mark', 'artem'].filter((k) => k !== nk).map((k) => [(k === 'me' ? 'Михаил' : PP[k].name) + ' · ' + lpOf(k), NUM_PAIR[numPairKey(lpOf(nk), lpOf(k))][0]]), -1), buttons: [btn('Сравнить пару целиком', () => this.setState({ popup: null, screen: 'pair', pairMode: 'date' }), 'primary'), btn('Понятно', close, 'link')] });\n"
    "    if (p === 'numFull_name') pop = Object.assign({}, base, { icon: false, hasBigNum: true, bigNum: String(nn.n), bigNumGrad: popNumGrad, hasOver: true, over: 'Число имени · ' + nName, title: NUM_NAME[nn.n - 1][0], hasText: true, text: numV.nameText, hasSteps: true, steps: [{ n: '1', label: 'Сильная сторона', text: NUM_NAME_GROW[nn.n - 1][0], bg: c.green }, { n: '2', label: 'Над чем работать', text: NUM_NAME_GROW[nn.n - 1][1], bg: c.accent }], buttons: [btn('Понятно', close, 'primary')] });\n"
)
r("    const CHK = /^(planet|house|sign|asp)_(.+)$/.exec(p || '');\n", POP_JS + "    const CHK = /^(planet|house|sign|asp)_(.+)$/.exec(p || '');\n")
r("test: [tCv.hasStk ? tCv.stk : STK.star, 'Тест · ' + tt.title, tR.name + '. ' + tR.summary] }[s.shareFrom]",
  "test: [tCv.hasStk ? tCv.stk : STK.star, 'Тест · ' + tt.title, tR.name + '. ' + tR.summary], runes: [STK.star, 'Мои руны', 'Райдо: путь выбран верно, главное не останавливаться'] }[s.shareFrom]")

POP_MARK = (
    '<sc-if value="{{ pop.hasBigNum }}" hint-placeholder-val="{{ false }}"><span style="align-self: center; font-size: 96px; line-height: .95; font-weight: 300; letter-spacing: -0.05em; background: {{ pop.bigNumGrad }}; -webkit-background-clip: text; background-clip: text; color: transparent; animation: nbDrop .7s ease both">{{ pop.bigNum }}</span></sc-if>\n'
    '<sc-if value="{{ pop.hasStones }}" hint-placeholder-val="{{ false }}"><div style="align-self: center; display: flex; align-items: flex-end; gap: 12px; padding: 4px 0 2px"><sc-for list="{{ pop.stones }}" as="pst" hint-placeholder-count="1"><span style="display: block; transform: rotate({{ pst.rot }})"><span style="display: block; animation: nbFloat 6s {{ pst.delay }} ease-in-out infinite">'
    + stone('{{ pst.w }}', '{{ pst.h }}', '{{ pst.gw }}', '{{ pst.gh }}', '{{ pst.d }}') + '</span></span></sc-for></div></sc-if>\n'
)
r('<sc-if value="{{ pop.hasSticker }}" hint-placeholder-val="{{ false }}">', POP_MARK + '<sc-if value="{{ pop.hasSticker }}" hint-placeholder-val="{{ false }}">')
TIP_MARK = ('<sc-if value="{{ pop.hasTip }}" hint-placeholder-val="{{ false }}"><div style="padding: 14px 16px; border-radius: 18px; background: {{ c.accentSoft }}"><span style="' + OVER + ' color: {{ c.accent }}">{{ pop.tipOver }}</span><p style="margin: 6px 0 0; font-size: 15px; line-height: 1.5; color: {{ c.label }}">{{ pop.tipText }}</p></div></sc-if>\n')
r('<sc-if value="{{ pop.hasStars }}" hint-placeholder-val="{{ false }}">', TIP_MARK + '<sc-if value="{{ pop.hasStars }}" hint-placeholder-val="{{ false }}">')

# ------------------------------------------------------------------ Today: number and rune tiles, rotating promo
TILES = (
    '<div style="margin: 12px 16px 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px">\n'
    '<button type="button" onClick="{{ dayNum.open }}" style="position: relative; display: flex; flex-direction: column; gap: 6px; height: 132px; box-sizing: border-box; padding: 14px 16px; border-radius: 26px; ' + GLASS + '; font: inherit; text-align: left; cursor: pointer; overflow: hidden">'
    '<span style="' + TILE_HEAD + '"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="' + HASH + '"></path></svg>{{ t.numOfDay }}</span>'
    '<span aria-hidden="true" style="position: absolute; right: 16px; top: 28px; font-size: 64px; line-height: 1; font-weight: 300; letter-spacing: -0.04em; background: {{ dayNum.grad }}; -webkit-background-clip: text; background-clip: text; color: transparent">{{ dayNum.n }}</span>'
    '<span style="margin-top: auto; font-size: 13.5px; line-height: 1.3; font-weight: 600; max-width: 110px">{{ dayNum.title }}</span></button>\n'
    '<button type="button" onClick="{{ dayRune.open }}" style="position: relative; display: flex; flex-direction: column; gap: 6px; height: 132px; box-sizing: border-box; padding: 14px 16px; border-radius: 26px; ' + GLASS + '; font: inherit; text-align: left; cursor: pointer; overflow: hidden">'
    '<span style="' + TILE_HEAD + '"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + RUNE_IC + '"></path></svg>{{ t.runeOfDay }}</span>'
    '<span aria-hidden="true" style="position: absolute; right: 16px; top: 34px; transform: rotate(8deg)"><span style="display: block; animation: nbFloat 7s ease-in-out infinite">' + stone('44px', '54px', '20px', '30px', '{{ dayRune.d }}') + '</span></span>'
    '<span style="margin-top: auto; font-size: 13.5px; line-height: 1.3; font-weight: 600; max-width: 100px">{{ t.runeTileSub }}</span></button>\n'
    '</div>\n'
)
r('<span style="margin-top: auto; font-size: 13.5px; line-height: 1.3; font-weight: 600; max-width: 100px">{{ t.tarotTileSub }}</span>\n</button>\n</div>\n',
  '<span style="margin-top: auto; font-size: 13.5px; line-height: 1.3; font-weight: 600; max-width: 100px">{{ t.tarotTileSub }}</span>\n</button>\n</div>\n' + TILES)

PROMO_MARK = (
    '<div style="position: relative; margin: 12px 16px 0; height: 98px; border-radius: 26px; ' + GLASS + '; overflow: hidden">'
    '<sc-for list="{{ promos }}" as="pm" hint-placeholder-count="3"><button type="button" onClick="{{ pm.go }}" aria-hidden="{{ pm.hid }}" tabindex="{{ pm.tab }}" style="position: absolute; inset: 0; display: flex; align-items: center; gap: 14px; width: 100%; padding: 12px 16px 12px 12px; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; opacity: {{ pm.op }}; visibility: {{ pm.vis }}; transform: {{ pm.tf }}; transition: opacity .7s ease, transform .7s cubic-bezier(.22,1,.36,1), visibility .7s">'
    '<span style="display: inline-flex; width: 56px; height: 56px; flex: none; align-items: center; justify-content: center">'
    '<sc-if value="{{ pm.hasImg }}" hint-placeholder-val="{{ true }}"><img src="{{ pm.img }}" alt="" style="width: 56px; height: 56px; object-fit: contain"></sc-if>'
    '<sc-if value="{{ pm.hasRune }}" hint-placeholder-val="{{ false }}">' + stone('40px', '48px', '18px', '27px', '{{ pm.d }}') + '</sc-if>'
    '<sc-if value="{{ pm.hasHan }}" hint-placeholder-val="{{ false }}">' + medal('50px', '25px', '{{ pm.ch }}') + '</sc-if>'
    '<sc-if value="{{ pm.hasNum }}" hint-placeholder-val="{{ false }}"><span style="font-size: 50px; line-height: 1; font-weight: 300; letter-spacing: -0.04em; background: {{ pm.grad }}; -webkit-background-clip: text; background-clip: text; color: transparent">{{ pm.n }}</span></sc-if>'
    '</span>'
    '<span style="display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0"><span style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: {{ ink.fg2 }}">{{ pm.over }}</span><strong style="font-size: 16px; line-height: 1.25; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{ pm.title }}</strong><span style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 13px; line-height: 1.35; color: {{ ink.fg3 }}">{{ pm.text }}</span></span>'
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="{{ ink.chev }}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none"><path d="{{ ic.chevR }}"></path></svg></button></sc-for></div>\n'
    '<div style="display: flex; justify-content: center; gap: 5px; margin: 6px 16px 0"><sc-for list="{{ promoDots }}" as="pd" hint-placeholder-count="5"><button type="button" onClick="{{ pd.pick }}" aria-label="{{ pd.aria }}" style="width: {{ pd.w }}; height: 6px; box-sizing: content-box; padding: 6px 0; border: 0; border-radius: 3px; background: {{ pd.bg }}; background-clip: content-box; cursor: pointer; transition: width .4s ease, background-color .4s ease"></button></sc-for></div>'
)
i0 = s.index('<button type="button" onClick="{{ promo.go }}"')
i1 = s.index('</button>', i0) + len('</button>')
s = s[:i0] + PROMO_MARK + s[i1:]

# ------------------------------------------------------------------ «Моя карта»: runes tab
RUNES_SEG = (
    '<sc-if value="{{ seg.runes }}" hint-placeholder-val="{{ false }}">\n'
    '<div style="animation: nbFade .3s ease both">\n'
    '<div style="position: relative; height: 176px; margin: 10px 16px 0; border-radius: 28px; background: linear-gradient(160deg,#0E1A2B 0%,#1C3348 55%,#2D5068 100%); overflow: hidden; color: #ffffff">'
    '<div style="position: absolute; right: -50px; top: -50px; width: 230px; height: 230px; border-radius: 50%; background: radial-gradient(circle, rgba(242,207,122,.30), rgba(242,207,122,0) 65%)"></div>'
    '<sc-for list="{{ runes.hero }}" as="rh" hint-placeholder-count="3"><span style="position: absolute; right: {{ rh.right }}; top: {{ rh.top }}; transform: rotate({{ rh.rot }})"><span style="display: block; animation: nbFloat 7s {{ rh.delay }} ease-in-out infinite">' + stone('50px', '60px', '22px', '33px', '{{ rh.d }}') + '</span></span></sc-for>'
    '<span aria-hidden="true" style="position: absolute; left: 18px; top: 18px; display: flex; flex-direction: column; align-items: center; gap: 5px"><span style="font-family: \'Cormorant Garamond\', Georgia, serif; font-size: 27px; line-height: 1; font-weight: 700; letter-spacing: 0.12em; padding-left: 0.12em; background: linear-gradient(180deg,#FFF3D1 0%,#F5C46B 100%); -webkit-background-clip: text; background-clip: text; color: transparent">{{ t.runesLbl }}</span>' + ORN + '</span>'
    '<div style="position: absolute; left: 20px; bottom: 20px; display: flex; flex-direction: column; gap: 4px; max-width: 222px"><span style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; opacity: .75">24 руны старшего футарка</span><strong style="font-size: 24px; line-height: 1.12; font-weight: 700; letter-spacing: -0.02em">Ответ в трёх знаках</strong></div>'
    '</div>\n'
    '<button type="button" onClick="{{ runes.openDay }}" style="display: flex; align-items: center; gap: 12px; width: calc(100% - 32px); margin: 12px 16px 0; padding: 12px 14px; border: 0; border-radius: 22px; background: {{ c.paper }}; font: inherit; text-align: left; color: {{ c.label }}; cursor: pointer">'
    + stone('36px', '44px', '16px', '24px', '{{ runes.day.d }}') +
    '<span style="display: flex; flex-direction: column; gap: 2px; flex: 1"><strong style="font-size: 16px; font-weight: 600">Руна дня · {{ runes.day.name }}</strong><span style="font-size: 13px; color: {{ c.label2 }}">Бесплатно: руна и совет на сегодня</span></span>' + CHEV + '</button>\n'
    '<div style="margin: 12px 16px 0; padding: 14px 16px; border-radius: 22px; background: {{ c.paper }}"><span style="' + OVER + ' color: {{ c.label3 }}">Твой вопрос</span><div style="margin-top: 6px; font-size: 18px; line-height: 1.4; font-weight: 500; color: {{ c.label }}">{{ runes.q }}</div>'
    '<div class="nbh" style="display: flex; gap: 6px; overflow-x: auto; margin: 12px -16px 0; padding: 0 16px"><sc-for list="{{ runes.chips }}" as="rqc" hint-placeholder-count="3"><button type="button" onClick="{{ rqc.pick }}" style="flex: none; height: 32px; padding: 0 12px; border: 0; border-radius: 999px; background: {{ c.page }}; color: {{ c.label }}; font: inherit; font-size: 13px; cursor: pointer">{{ rqc.label }}</button></sc-for></div></div>\n'
    '<div style="padding: 20px 16px 0"><h2 style="margin: 0 4px; font-size: 22px; font-weight: 700; letter-spacing: -0.015em">Расклад</h2>'
    '<div style="display: flex; align-items: center; gap: 12px; margin-top: 10px; padding: 10px 14px; border-radius: 20px; background: {{ c.paper }}; box-shadow: inset 0 0 0 2px {{ c.accent }}"><span style="display: inline-flex; width: 38px; height: 52px; flex: none; align-items: center; justify-content: center; border-radius: 12px; background: linear-gradient(160deg,#1C3348,#2D5068); color: #F2CF7A; font-size: 16px; font-weight: 700">3</span>'
    '<span style="display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0"><strong style="font-size: 15.5px; font-weight: 600">Три руны</strong><span style="font-size: 12.5px; color: {{ c.label2 }}">Что было, что есть, к чему идёт</span></span><span style="font-size: 13.5px; font-weight: 600; color: {{ c.accent }}">{{ runes.price }}</span></div>'
    '<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 12px 4px 0"><span style="font-size: 13.5px; line-height: 1.35; color: {{ c.label2 }}">{{ runes.note }}</span><button type="button" onClick="{{ runes.example }}" style="flex: none; padding: 8px 14px; border: 0; border-radius: 999px; background: {{ c.accentSoft }}; color: {{ c.accent }}; font: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer">Посмотреть пример</button></div></div>\n'
    '<button type="button" onClick="{{ runes.go }}" class="nbCta" style="display: block; width: calc(100% - 32px); margin: 18px 16px 0; height: 54px; border: 0; border-radius: 27px; background: {{ ctaTheme.cta }}; background-size: 170% 100%; box-shadow: {{ ctaTheme.shadow }}; color: {{ ctaTheme.fg }}; font: inherit; font-size: 17px; font-weight: 600; cursor: pointer">{{ runes.cta }}</button>\n'
    '<div style="padding: 26px 16px 0"><div style="display: flex; align-items: baseline; justify-content: space-between; padding: 0 4px"><h2 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.015em">Все 24 руны</h2><span style="font-size: 12.5px; color: {{ c.label3 }}">нажми, чтобы прочитать</span></div>'
    '<div style="display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px 2px; margin-top: 14px; padding: 16px 8px; border-radius: 22px; background: {{ c.paper }}"><sc-for list="{{ runes.grid }}" as="rg" hint-placeholder-count="24"><button type="button" onClick="{{ rg.open }}" style="display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 0; border: 0; background: none; font: inherit; color: {{ c.label2 }}; cursor: pointer">'
    + stone('38px', '46px', '17px', '25px', '{{ rg.d }}') + '<span style="font-size: 11px; font-weight: 600; white-space: nowrap">{{ rg.name }}</span></button></sc-for></div></div>\n'
    '</div>\n'
    '</sc-if>\n'
)
r('</sc-if>\n</div>\n</sc-if>\n\n<sc-if value="{{ show.people }}"', '</sc-if>\n' + RUNES_SEG + '</div>\n</sc-if>\n\n<sc-if value="{{ show.people }}"')

RUNE_READ = (
    '<sc-if value="{{ show.runeRead }}" hint-placeholder-val="{{ false }}">\n'
    '<div style="animation: nbFade .4s ease both">\n'
    '<sc-if value="{{ runes.sample }}" hint-placeholder-val="{{ false }}"><div style="display: flex; align-items: center; gap: 12px; margin: 0 16px 14px; padding: 12px 14px; border-radius: 20px; background: {{ c.accentSoft }}; color: {{ c.label }}"><span style="display: flex; flex-direction: column; gap: 2px; flex: 1"><strong style="font-size: 14.5px; font-weight: 600">Это пример расклада</strong><span style="font-size: 12.5px; line-height: 1.35; color: {{ c.label2 }}">Так выглядит ответ на вопрос Ильи. Твой будет про твой вопрос.</span></span><button type="button" onClick="{{ runes.own }}" style="flex: none; padding: 9px 12px; border: 0; border-radius: 999px; background: {{ c.accent }}; color: #ffffff; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer">{{ runes.ownLabel }}</button></div></sc-if>\n'
    '<div style="padding: 0 24px; text-align: center"><span style="' + OVER + ' color: {{ c.accent }}">Три руны</span><p style="margin: 6px 0 0; font-size: 17px; line-height: 1.4; font-weight: 500">«{{ runes.q }}»</p></div>\n'
    '<div style="position: relative; margin: 16px 16px 0; height: 196px; border-radius: 28px; background: linear-gradient(160deg,#0E1A2B 0%,#1C3348 55%,#2D5068 100%); overflow: hidden">'
    '<div style="position: absolute; left: 50%; top: -80px; width: 300px; height: 300px; margin-left: -150px; border-radius: 50%; background: radial-gradient(circle, rgba(242,207,122,.22), rgba(242,207,122,0) 65%)"></div>'
    '<div style="position: absolute; left: 0; right: 0; top: 22px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr))"><sc-for list="{{ runes.cast }}" as="rc" hint-placeholder-count="3"><div style="display: flex; flex-direction: column; align-items: center; gap: 10px"><span style="font-size: 11.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(255,255,255,.62)">{{ rc.label }}</span>'
    '<span style="display: block; transform: rotate({{ rc.rot }})"><span style="display: block; animation: nbRuneDrop .9s {{ rc.delay }} cubic-bezier(.22,1,.36,1) both">' + stone('62px', '74px', '26px', '39px', '{{ rc.d }}') + '</span></span>'
    '<strong style="font-size: 14px; font-weight: 600; color: #ffffff">{{ rc.name }}</strong></div></sc-for></div></div>\n'
    '<div style="margin: 18px 16px 0; padding: 4px 16px; border-radius: 24px; background: {{ c.paper }}"><sc-for list="{{ runes.cast }}" as="rcr" hint-placeholder-count="3"><div style="padding: 14px 0; border-top: {{ rcr.border }}"><span style="' + OVER + ' color: {{ c.label3 }}">{{ rcr.label }} · {{ rcr.name }}, {{ rcr.kw }}</span><p style="margin: 6px 0 0; font-size: 16px; line-height: 1.55">{{ rcr.reading }}</p></div></sc-for></div>\n'
    '<div style="margin: 12px 16px 0; padding: 16px 18px; border-radius: 22px; background: {{ c.accentSoft }}"><span style="display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: {{ c.accent }}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{{ ic.sparkle }}"></path></svg>Что это значит для тебя</span><p style="margin: 6px 0 0; font-size: 16px; line-height: 1.55">{{ runes.meaning }}</p></div>\n'
    '<div style="display: flex; gap: 12px; margin: 12px 16px 0; padding: 16px 18px; border-radius: 22px; background: {{ c.greenSoft }}"><img src="/_blob/b739cf28b15df1ea9f6e70bebc2266f4" alt="" style="width: 36px; height: 36px; flex: none; object-fit: contain"><span><b style="display: block; font-size: 12.5px; letter-spacing: 0.05em; text-transform: uppercase; color: {{ c.green }}">Совет</b><span style="display: block; margin-top: 4px; font-size: 15.5px; line-height: 1.5">{{ runes.advice }}</span></span></div>\n'
    '<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 16px 16px 0"><button type="button" onClick="{{ runes.save }}" style="height: 50px; border: 0; border-radius: 25px; background: {{ c.fill }}; color: {{ c.label }}; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer">Сохранить</button><button type="button" onClick="{{ runes.share }}" style="height: 50px; border: 0; border-radius: 25px; background: {{ c.fill }}; color: {{ c.label }}; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer">Поделиться</button></div>\n'
    '<button type="button" onClick="{{ runes.again }}" style="display: block; width: calc(100% - 32px); margin: 8px 16px 0; height: 46px; border: 0; background: none; color: {{ c.accent }}; font: inherit; font-size: 15.5px; font-weight: 600; cursor: pointer">Новый расклад</button>\n'
    '</div>\n'
    '</sc-if>\n\n'
)
r('<sc-if value="{{ show.askAnswer }}" hint-placeholder-val="{{ false }}">', RUNE_READ + '<sc-if value="{{ show.askAnswer }}" hint-placeholder-val="{{ false }}">')
r("@keyframes nbStarFly{", "@keyframes nbRuneDrop{0%{opacity:0;transform:translateY(-54px) rotate(-16deg) scale(1.1)}60%{opacity:1;transform:translateY(5px) rotate(3deg) scale(1)}100%{opacity:1;transform:none}}\n@keyframes nbStarFly{")

# ------------------------------------------------------------------ «Числа»: month, day, name, full report
CIRCLE = 'display: inline-flex; width: 48px; height: 48px; flex: none; align-items: center; justify-content: center; border-radius: 50%; background: linear-gradient(160deg,#2C5BEA,#8B5CF6); color: #ffffff; font-size: 22px; font-weight: 600'
NUM_MARK = (
    '<div style="margin: 12px 16px 0; border-radius: 20px; background: {{ c.paper }}; box-shadow: {{ c.groupShadow }}; overflow: hidden">'
    '<div style="display: flex; align-items: center; gap: 16px; padding: 16px"><span style="' + CIRCLE + '">{{ numx.monthN }}</span><span style="display: flex; flex-direction: column; gap: 2px"><span style="' + OVER + ' color: {{ c.label3 }}">{{ numx.monthOver }}</span><strong style="font-size: 16.5px; font-weight: 600">{{ numx.monthTitle }}</strong><span style="font-size: 13.5px; line-height: 1.4; color: {{ c.label2 }}">{{ numx.monthText }}</span></span></div>'
    '<div style="display: flex; align-items: center; gap: 16px; padding: 16px; border-top: 1px solid {{ c.sep }}"><span style="' + CIRCLE + '">{{ numx.dayN }}</span><span style="display: flex; flex-direction: column; gap: 2px"><span style="' + OVER + ' color: {{ c.label3 }}">Сегодня · личный день</span><strong style="font-size: 16.5px; font-weight: 600">{{ numx.dayTitle }}</strong><span style="font-size: 13.5px; line-height: 1.4; color: {{ c.label2 }}">{{ numx.dayText }}</span></span></div></div>\n'
    '<div style="margin: 22px 16px 0; padding: 18px 16px; border-radius: 22px; background: {{ c.paper }}; box-shadow: {{ c.groupShadow }}">'
    '<div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px"><span style="display: flex; flex-direction: column; gap: 4px"><span style="' + OVER + ' color: {{ c.label3 }}">Число имени</span><strong style="font-size: 22px; font-weight: 700; letter-spacing: -0.01em">{{ numx.name }}</strong></span>'
    '<span style="font-size: 58px; line-height: .9; font-weight: 300; letter-spacing: -0.04em; background: linear-gradient(160deg,#2C5BEA,#8B5CF6); -webkit-background-clip: text; background-clip: text; color: transparent">{{ numx.nameN }}</span></div>'
    '<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 12px"><sc-for list="{{ numx.letters }}" as="nl" hint-placeholder-count="6"><span style="display: inline-flex; flex-direction: column; align-items: center; min-width: 30px; padding: 6px 4px; border-radius: 12px; background: {{ c.fill }}"><b style="font-size: 15px; font-weight: 700">{{ nl.ch }}</b><span style="font-size: 12px; color: {{ c.label2 }}">{{ nl.n }}</span></span></sc-for><span style="margin-left: 4px; font-size: 15px; font-weight: 600; color: {{ c.label2 }}; font-variant-numeric: tabular-nums">{{ numx.sum }}</span></div>'
    '<strong style="display: block; margin-top: 14px; font-size: 17px; font-weight: 600">{{ numx.nameTitle }}</strong><p style="margin: 4px 0 0; font-size: 15px; line-height: 1.55; color: {{ c.label2 }}">{{ numx.nameText }}</p></div>\n'
    '<div style="padding: 22px 16px 0"><h2 style="margin: 0 4px 10px; font-size: 22px; font-weight: 700; letter-spacing: -0.015em">Больше о числах</h2>'
    '<div style="border-radius: 20px; background: {{ c.paper }}; box-shadow: {{ c.groupShadow }}; overflow: hidden"><sc-for list="{{ numx.more }}" as="nm" hint-placeholder-count="3"><button type="button" onClick="{{ nm.open }}" style="display: flex; align-items: center; gap: 12px; width: 100%; padding: 13px 16px; border: 0; border-top: {{ nm.border }}; background: none; font: inherit; text-align: left; color: {{ c.label }}; cursor: pointer">'
    '<span style="display: inline-flex; width: 34px; height: 34px; flex: none; align-items: center; justify-content: center; border-radius: 11px; background: {{ c.accentSoft }}; color: {{ c.accent }}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="' + HASH + '"></path></svg></span>'
    '<span style="display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0"><strong style="font-size: 15.5px; font-weight: 600">{{ nm.title }}</strong><span style="font-size: 13px; color: {{ c.label2 }}">{{ nm.sub }}</span></span>'
    '<sc-if value="{{ nm.locked }}" hint-placeholder-val="{{ true }}">' + LOCK + '</sc-if><sc-if value="{{ nm.open2 }}" hint-placeholder-val="{{ false }}">' + CHEV + '</sc-if></button></sc-for>'
    '<sc-if value="{{ numx.locked }}" hint-placeholder-val="{{ true }}"><button type="button" onClick="{{ numx.go }}" class="nbCta" style="display: flex; align-items: center; justify-content: space-between; width: calc(100% - 24px); margin: 4px 12px 12px; height: 50px; padding: 0 8px 0 16px; border: 0; border-radius: 25px; background: {{ ctaTheme.cta }}; background-size: 170% 100%; box-shadow: {{ ctaTheme.shadow }}; color: {{ ctaTheme.fg }}; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer"><span>Открыть всё о числах</span><span style="display: inline-flex; align-items: center; height: 34px; padding: 0 12px; border-radius: 17px; background: rgba(255,255,255,.22)">290 ₽</span></button></sc-if>'
    '</div></div>\n'
)
r('</div>\n</sc-if>\n\n<sc-if value="{{ seg.tarot }}" hint-placeholder-val="{{ false }}">', NUM_MARK + '</div>\n</sc-if>\n\n<sc-if value="{{ seg.tarot }}" hint-placeholder-val="{{ false }}">')
# ------------------------------------------------------------------ «Знаки»: zodiac or chinese
CN_MARK = (
    '<sc-if value="{{ cn.on }}" hint-placeholder-val="{{ false }}">\n'
    '<div style="animation: nbFade .3s ease both">\n'
    '<div style="position: relative; height: 318px; margin-top: 2px">'
    '<div style="position: absolute; left: 50%; top: 20px; width: 260px; height: 260px; margin-left: -130px; border-radius: 50%; background: {{ cn.glow }}"></div>'
    '<button type="button" onClick="{{ cn.prev }}" aria-label="Предыдущее животное" style="position: absolute; left: 4px; top: 92px; padding: 0; border: 0; background: none; cursor: pointer; opacity: .45">' + medal('84px', '38px', '{{ cn.prevCh }}') + '</button>'
    '<button type="button" onClick="{{ cn.next }}" aria-label="Следующее животное" style="position: absolute; right: 4px; top: 92px; padding: 0; border: 0; background: none; cursor: pointer; opacity: .45">' + medal('84px', '38px', '{{ cn.nextCh }}') + '</button>'
    '<span style="position: absolute; left: 0; top: 184px; width: 92px; text-align: center; font-size: 12.5px; font-weight: 600; color: {{ c.label3 }}">{{ cn.prevName }}</span>'
    '<span style="position: absolute; right: 0; top: 184px; width: 92px; text-align: center; font-size: 12.5px; font-weight: 600; color: {{ c.label3 }}">{{ cn.nextName }}</span>'
    '<div style="position: absolute; left: 50%; top: 34px; width: 190px; height: 190px; margin-left: -95px; animation: {{ cn.anim }} .5s cubic-bezier(.34,1.56,.64,1) both">' + medal('190px', '92px', '{{ cn.ch }}', big=True) + '</div>'
    '<div style="position: absolute; left: 70px; right: 70px; top: 240px; display: flex; flex-direction: column; align-items: center; gap: 2px; animation: nbFade .4s ease both"><strong style="font-size: 28px; line-height: 1.1; font-weight: 700; letter-spacing: -0.02em">{{ cn.name }}</strong><span style="font-size: 13.5px; color: {{ c.label2 }}; font-variant-numeric: tabular-nums">{{ cn.years }}</span></div>'
    '<div style="position: absolute; left: 0; right: 0; bottom: 6px; display: flex; justify-content: center; gap: 6px"><sc-for list="{{ cn.dots }}" as="cnd" hint-placeholder-count="12"><span style="width: {{ cnd.w }}; height: 6px; border-radius: 3px; background: {{ cnd.bg }}"></span></sc-for></div>'
    '</div>\n'
    '<sc-if value="{{ cn.mine }}" hint-placeholder-val="{{ true }}"><div style="display: flex; align-items: center; gap: 12px; margin: 14px 16px 0; padding: 12px 14px; border-radius: 20px; background: {{ c.paper }}; box-shadow: {{ c.groupShadow }}"><span style="width: 12px; height: 12px; flex: none; border-radius: 50%; background: {{ cn.elColor }}"></span><span style="display: flex; flex-direction: column; gap: 2px"><strong style="font-size: 15px; font-weight: 600">{{ cn.mineLabel }}</strong><span style="font-size: 13.5px; line-height: 1.4; color: {{ c.label2 }}">{{ cn.elText }}</span></span></div></sc-if>\n'
    '<div style="padding: 18px 22px 0"><span style="font-size: 13px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: {{ c.label3 }}">2026 · год Огненной Лошади</span><p style="margin: 8px 0 0; font-size: 18px; line-height: 1.55; color: {{ c.label }}; animation: nbFade .5s ease both">{{ cn.year }}</p></div>\n'
    '<div style="padding: 18px 22px 0"><span style="font-size: 13px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: {{ c.label3 }}">Характер</span><p style="margin: 8px 0 0; font-size: 16px; line-height: 1.55; color: {{ c.label2 }}">{{ cn.character }}</p></div>\n'
    '<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; padding: 18px 20px 0">'
    '<div><span style="' + OVER + ' color: {{ c.green }}">Легко с</span><div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px"><sc-for list="{{ cn.good }}" as="cg" hint-placeholder-count="3"><button type="button" onClick="{{ cg.pick }}" style="display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 10px 0 4px; border: 0; border-radius: 999px; background: {{ c.fill }}; color: {{ c.label }}; font: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer">' + medal('26px', '13px', '{{ cg.ch }}') + '{{ cg.name }}</button></sc-for></div></div>'
    '<div><span style="' + OVER + ' color: #D9701E">Труднее с</span><div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px"><sc-for list="{{ cn.hard }}" as="ch2" hint-placeholder-count="2"><button type="button" onClick="{{ ch2.pick }}" style="display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 10px 0 4px; border: 0; border-radius: 999px; background: {{ c.fill }}; color: {{ c.label }}; font: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer">' + medal('26px', '13px', '{{ ch2.ch }}') + '{{ ch2.name }}</button></sc-for></div></div>'
    '</div>\n'
    '<button type="button" onClick="{{ cn.toPair }}" style="display: flex; align-items: center; justify-content: space-between; width: calc(100% - 40px); margin: 20px 20px 0; padding: 14px 0; border: 0; border-top: 1px solid {{ c.sep }}; border-bottom: 1px solid {{ c.sep }}; background: none; font: inherit; color: {{ c.label }}; cursor: pointer"><span style="display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 500"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="{{ c.accent }}" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" style="flex: none"><path d="{{ ic.rings2 }}"></path></svg><span>Сравнить пару по году рождения</span></span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="{{ c.label3 }}" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="{{ ic.chevR }}"></path></svg></button>\n'
    '<div style="padding: 26px 20px 0"><span style="font-size: 13px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: {{ c.label3 }}">Все животные</span>'
    '<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px 4px; margin-top: 12px"><sc-for list="{{ cn.grid }}" as="cgr" hint-placeholder-count="12"><button type="button" onClick="{{ cgr.pick }}" style="display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 9px 2px 8px; border: 0; border-radius: 18px; background: {{ cgr.bg }}; font: inherit; color: {{ c.label }}; cursor: pointer">' + medal('46px', '22px', '{{ cgr.ch }}') + '<span style="font-size: 12px; font-weight: 600">{{ cgr.name }}</span></button></sc-for></div></div>\n'
    '<p style="margin: 18px 22px 0; font-size: 12.5px; line-height: 1.5; color: {{ c.label3 }}">Год по китайскому календарю начинается в конце января или в феврале. Если день рождения в январе или начале февраля, животное считается по прошлому году. Это для интереса, а не для важных решений.</p>\n'
    '</div>\n'
    '</sc-if>\n'
)
MODES = ('<div style="margin: 0 16px 6px; height: 38px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2px; padding: 3px; border-radius: 999px; background: {{ c.fill }}"><sc-for list="{{ cn.modes }}" as="cnm" hint-placeholder-count="2"><button type="button" onClick="{{ cnm.pick }}" style="border: 0; border-radius: 999px; background: {{ cnm.bg }}; box-shadow: {{ cnm.sh }}; color: {{ cnm.fg }}; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; transition: background .3s ease">{{ cnm.label }}</button></sc-for></div>\n')
r('<sc-if value="{{ show.signs }}" hint-placeholder-val="{{ false }}">\n<div style="animation: nbFade .3s ease both">\n',
  '<sc-if value="{{ show.signs }}" hint-placeholder-val="{{ false }}">\n' + MODES + '<sc-if value="{{ cn.off }}" hint-placeholder-val="{{ true }}">\n<div style="animation: nbFade .3s ease both">\n')
r('</div>\n</sc-if>\n\n<sc-if value="{{ show.mine }}" hint-placeholder-val="{{ false }}">',
  '</div>\n</sc-if>\n' + CN_MARK + '</sc-if>\n\n<sc-if value="{{ show.mine }}" hint-placeholder-val="{{ false }}">')

# ------------------------------------------------------------------ pair result: numbers and chinese horoscope
PAIR_MARK = (
    '<sc-if value="{{ pairMore.on }}" hint-placeholder-val="{{ true }}">\n'
    '<div style="padding: 22px 16px 0"><h2 style="margin: 0 4px 10px; font-size: 20px; font-weight: 700; letter-spacing: -0.01em">Ещё два взгляда на пару</h2>'
    '<div style="display: flex; flex-direction: column; gap: 10px">'
    '<div style="padding: 16px; border-radius: 22px; background: {{ c.paper }}"><span style="' + OVER + ' color: {{ c.label3 }}">По числам судьбы</span>'
    '<div style="display: flex; align-items: center; justify-content: center; gap: 22px; margin-top: 10px">'
    '<span style="display: flex; flex-direction: column; align-items: center; gap: 2px"><span style="font-size: 54px; line-height: 1; font-weight: 300; letter-spacing: -0.04em; background: {{ pairMore.grad }}; -webkit-background-clip: text; background-clip: text; color: transparent">{{ pairMore.numA }}</span><span style="font-size: 13px; font-weight: 600; color: {{ c.label2 }}">{{ pairMore.nameA }}</span></span>'
    '<span style="font-size: 20px; color: {{ c.label3 }}">и</span>'
    '<span style="display: flex; flex-direction: column; align-items: center; gap: 2px"><span style="font-size: 54px; line-height: 1; font-weight: 300; letter-spacing: -0.04em; background: {{ pairMore.grad }}; -webkit-background-clip: text; background-clip: text; color: transparent">{{ pairMore.numB }}</span><span style="font-size: 13px; font-weight: 600; color: {{ c.label2 }}">{{ pairMore.nameB }}</span></span></div>'
    '<span style="display: inline-flex; align-items: center; height: 26px; margin-top: 12px; padding: 0 11px; border-radius: 999px; background: {{ c.accentSoft }}; color: {{ c.accent }}; font-size: 12.5px; font-weight: 600">{{ pairMore.numTitle }}</span>'
    '<p style="margin: 8px 0 0; font-size: 15.5px; line-height: 1.55; color: {{ c.label }}">{{ pairMore.numText }}</p></div>'
    '<div style="padding: 16px; border-radius: 22px; background: {{ c.paper }}"><span style="' + OVER + ' color: {{ c.label3 }}">По китайскому гороскопу</span>'
    '<div style="display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px; margin-top: 12px">'
    '<span style="display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center">' + medal('58px', '28px', '{{ pairMore.chA }}') + '<span style="font-size: 12.5px; line-height: 1.3; font-weight: 600; color: {{ c.label2 }}">{{ pairMore.nameA }}<br>{{ pairMore.cnA }}</span></span>'
    '<span style="font-size: 20px; color: {{ c.label3 }}">и</span>'
    '<span style="display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center">' + medal('58px', '28px', '{{ pairMore.chB }}') + '<span style="font-size: 12.5px; line-height: 1.3; font-weight: 600; color: {{ c.label2 }}">{{ pairMore.nameB }}<br>{{ pairMore.cnB }}</span></span></div>'
    '<span style="display: inline-flex; align-items: center; height: 26px; margin-top: 12px; padding: 0 11px; border-radius: 999px; background: {{ pairMore.cnBg }}; color: {{ pairMore.cnFg }}; font-size: 12.5px; font-weight: 600">{{ pairMore.cnTitle }}</span>'
    '<p style="margin: 8px 0 0; font-size: 15.5px; line-height: 1.55; color: {{ c.label }}">{{ pairMore.cnText }}</p>'
    '<button type="button" onClick="{{ pairMore.goCn }}" style="margin-top: 6px; padding: 6px 0; border: 0; background: none; font: inherit; font-size: 14px; font-weight: 600; color: {{ c.accent }}; cursor: pointer">Подробнее о китайском гороскопе</button></div>'
    '</div></div>\n'
    '</sc-if>\n'
)
r('<sc-if value="{{ cres.free }}" hint-placeholder-val="{{ true }}">', PAIR_MARK + '<sc-if value="{{ cres.free }}" hint-placeholder-val="{{ true }}">')

open(path, 'w', encoding='utf-8').write(s)
print('patch X applied')
