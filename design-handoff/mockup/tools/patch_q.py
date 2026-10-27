"""Patch Q: tarot becomes the fourth tab of «Моя карта» (Карта · Матрица · Числа · Таро),
questions about the chart move inside the «Карта» tab, the tarot word on the Today tile
is translated. Every replacement must match exactly once."""
import sys

path = sys.argv[1]
s = open(path, encoding='utf-8').read()


def r(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        raise SystemExit('expected %d match(es), found %d for: %r' % (count, n, old[:90]))
    s = s.replace(old, new)


def cut(start_marker, end_marker):
    """Remove and return s[start:end] where end is the first end_marker after start."""
    global s
    i0 = s.index(start_marker)
    i1 = s.index(end_marker, i0) + len(end_marker)
    block = s[i0:i1]
    s = s[:i0] + s[i1:]
    return block


# ---- markup: the old «Вопросы» tab goes away
ask_block = cut('<sc-if value="{{ seg.ask }}" hint-placeholder-val="{{ false }}">\n', '</div>\n</sc-if>\n')
assert 'askOpen' in ask_block and ask_block.count('<sc-if') == 1, 'unexpected ask block'

# ---- markup: the tarot hub moves from its own screen into the new tab
tarot_block = cut('<sc-if value="{{ show.tarot }}" hint-placeholder-val="{{ false }}">\n', '</div>\n</sc-if>\n')
assert 'tarotHub.example' in tarot_block and 'refs.tarotSpreads' in tarot_block, 'unexpected tarot block'
inner = tarot_block[len('<sc-if value="{{ show.tarot }}" hint-placeholder-val="{{ false }}">\n'):-len('</sc-if>\n')]
HERO = '<div style="position: relative; height: 176px; margin: 0 16px; border-radius: 28px;'
assert inner.count(HERO) == 1
inner = inner.replace(HERO, '<div style="position: relative; height: 176px; margin: 10px 16px 0; border-radius: 28px;')
tarot_tab = '<sc-if value="{{ seg.tarot }}" hint-placeholder-val="{{ false }}">\n' + inner + '</sc-if>\n'
# the new tab sits right after «Числа», where «Вопросы» used to be
r('</div>\n</sc-if>\n\n<sc-if value="{{ show.people }}"',
  tarot_tab + '</div>\n</sc-if>\n\n<sc-if value="{{ show.people }}"')

# ---- markup: questions about the chart live inside «Карта», after the story chapters
SEND = ask_block[ask_block.index('<span style="display: inline-flex; width: 40px; height: 40px;'):]
SEND = SEND[:SEND.index('</span></div>') + len('</span>')]
CHIPS = ask_block[ask_block.index('<sc-for list="{{ askChips }}"'):]
CHIPS = CHIPS[:CHIPS.index('</sc-for>') + len('</sc-for>')]
ask_in_chart = (
    '<div ref="{{ refs.askBox }}" style="padding: 26px 16px 0"><h2 style="margin: 0 4px 10px; font-size: 22px; font-weight: 700; letter-spacing: -0.015em">{{ askHead }}</h2>\n'
    '<div style="padding: 14px; border-radius: 24px; background: {{ c.paper }}; box-shadow: {{ c.groupShadow }}">\n'
    '<button type="button" onClick="{{ askOpen }}" style="display: block; width: 100%; min-height: 64px; padding: 4px 4px 10px; border: 0; background: none; font: inherit; font-size: 18px; line-height: 1.45; text-align: left; color: {{ c.label3 }}; cursor: text">{{ who.askTitle }}</button>\n'
    '<div style="display: flex; align-items: center; justify-content: space-between"><span style="font-size: 12.5px; color: {{ c.label2 }}">1 вопрос бесплатно · 3 в подарок с картой</span>' + SEND + '</div>\n'
    '</div>\n'
    '<div class="nbh" style="display: flex; gap: 8px; overflow-x: auto; margin: 0 -16px; padding: 12px 16px 2px">' + CHIPS + '</div>\n'
    '</div>\n'
)
r('<sc-if value="{{ yearCard.show }}" hint-placeholder-val="{{ true }}">', ask_in_chart + '<sc-if value="{{ yearCard.show }}" hint-placeholder-val="{{ true }}">')

# ---- the tarot word on the Today tile follows the language
r('color: transparent">ТАРО</span>', 'color: transparent">{{ t.tarotLbl }}</span>')
r("cardOfDay: 'Карта дня',", "cardOfDay: 'Карта дня', tarotLbl: 'ТАРО',")
r("cardOfDay: 'Card of the day',", "cardOfDay: 'Card of the day', tarotLbl: 'TAROT',")
r("cardOfDay: 'Carta del día',", "cardOfDay: 'Carta del día', tarotLbl: 'TAROT',")

# ---- state and navigation
r("const mineSeg = { natal: 'natal', matrix: 'matrix', numbers: 'numbers', ask: 'ask' }[start];",
  "const mineSeg = { natal: 'natal', matrix: 'matrix', numbers: 'numbers', ask: 'natal', tarot: 'tarot' }[start];")
r("[['natal', 'Карта'], ['matrix', 'Матрица'], ['numbers', 'Числа'], ['ask', 'Вопросы']]",
  "[['natal', 'Карта'], ['matrix', 'Матрица'], ['numbers', 'Числа'], ['tarot', 'Таро']]")
r("numbers: s.seg === 'numbers', ask: s.seg === 'ask' };", "numbers: s.seg === 'numbers', tarot: s.seg === 'tarot' };")
r("'moon', 'tarot', 'tarotDeck', 'tarotRead', 'askAnswer'", "'moon', 'tarotDeck', 'tarotRead', 'askAnswer'")
r("(scr === 'tarotDeck' || scr === 'tarotRead') ? 'tarot' : (['chapter', 'tarot', 'askAnswer', 'guide', 'year'].indexOf(scr) >= 0) ? 'mine'",
  "(['chapter', 'tarotDeck', 'tarotRead', 'askAnswer', 'guide', 'year'].indexOf(scr) >= 0) ? 'mine'")
r("seg: (scr === 'tarot' || scr === 'askAnswer' || scr === 'guide') ? 'ask' : s.seg,",
  "seg: (scr === 'tarotDeck' || scr === 'tarotRead') ? 'tarot' : (scr === 'askAnswer' || scr === 'guide') ? 'natal' : s.seg,")
r("(scr === 'moon' || scr === 'tarot' || scr === 'tarotDeck' || scr === 'tarotRead') ? 'today' : (['chapter', 'askAnswer', 'guide', 'year'].indexOf(scr) >= 0) ? 'mine'",
  "scr === 'moon' ? 'today' : (['chapter', 'tarotDeck', 'tarotRead', 'askAnswer', 'guide', 'year'].indexOf(scr) >= 0) ? 'mine'")
r("openTarotHub: set({ screen: 'tarot', tarotSample: false })", "openTarotHub: set({ screen: 'mine', seg: 'tarot', tarotSample: false })")
r("own: () => this.setState({ screen: 'tarot', tarotSample: false })", "own: () => this.setState({ screen: 'mine', seg: 'tarot', tarotSample: false })")
r("again: () => this.setState({ screen: 'tarot', tarotSample: false }),", "again: () => this.setState({ screen: 'mine', seg: 'tarot', tarotSample: false }),")
r("btn('Задать вопрос', () => this.setState({ popup: null, seg: 'ask' }), 'link')", "btn('Задать вопрос', () => this.toAsk(), 'link')")
r("mine: [who.over, who.title],", "mine: s.seg === 'tarot' ? ['Расклады на любой вопрос', 'Таро'] : [who.over, who.title],")

# the «Моя карта» tour names the new tab
r("['wheel', 'Карта, матрица, числа, вопросы', 'Четыре способа посмотреть на себя, всё по твоей дате рождения.',",
  "['wheel', 'Карта, матрица, числа, таро', 'Карта, матрица и числа считаются по дате рождения. Таро ответит на любой вопрос.',")

# scrolling to the questions block (board «Вопросы о карте» and «Задать вопрос» after buying)
r("  askNow(q) {",
  "  scrollToAsk(smooth) { const el = this.el_askBox, sc = this.scroller; if (!el || !sc) return; const k = this.rootEl ? (this.rootEl.getBoundingClientRect().width / 390 || 1) : 1; const top = Math.max(0, Math.round((el.getBoundingClientRect().top - sc.getBoundingClientRect().top) / k + sc.scrollTop - 64)); if (smooth) { try { sc.scrollTo({ top, behavior: 'smooth' }); return; } catch (e) { /* old browsers jump */ } } sc.scrollTop = top; }\n"
  "  toAsk() { this.setState({ popup: null, screen: 'mine', seg: 'natal' }); clearTimeout(this.askScT); this.askScT = setTimeout(() => this.scrollToAsk(true), 120); }\n"
  "  askNow(q) {")
r("    if (sc && this.scroller) this.scroller.scrollTop = sc;\n",
  "    if (sc && this.scroller) this.scroller.scrollTop = sc;\n"
  "    if (this.props.start === 'ask') { this.scrollToAsk(false); this.askMt = setTimeout(() => this.scrollToAsk(false), 450); }\n")
r("[this.mt, this.flipT,", "[this.mt, this.askMt, this.askScT, this.flipT,")
r("tarotDeck: mkRef('tarotDeck'),", "askBox: mkRef('askBox'), tarotDeck: mkRef('tarotDeck'),")
r("mx, replayMatrix: () => this.runMatrix(), pyth, askChips,",
  "mx, replayMatrix: () => this.runMatrix(), pyth, askChips, askHead: isMe ? 'Спроси про свою карту' : 'Спроси про ' + who.acc,")

open(path, 'w', encoding='utf-8').write(s)
print('patch Q applied')
