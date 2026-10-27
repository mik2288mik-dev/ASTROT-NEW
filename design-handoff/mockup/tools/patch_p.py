"""Patch P: the birthday-sky poster shows a real small sample (light or dark), a note
that screenshots are blocked on that window, and a framed view on a wall."""
import sys

path = sys.argv[1]
s = open(path, encoding='utf-8').read()


def r(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        raise SystemExit('expected %d match(es), found %d for: %r' % (count, n, old[:90]))
    s = s.replace(old, new)


THUMB = {'light': '/_blob/7770e07ef2adf2c6e6c3cd770bba1c6e', 'dark': '/_blob/7383a627409f5dbb4ff38b1650c92a61'}
WALL = {'light': '/_blob/b6c514d29f3b291cd44f8255fe9691a4', 'dark': '/_blob/6a872886606f45df3a7c5e1ffa4664cd'}

# markup: replace the drawn placeholder poster with the real sample
start = s.index('<sc-if value="{{ pop.hasPoster }}" hint-placeholder-val="{{ false }}">')
end = s.index('</sc-if>', start) + len('</sc-if>')
old = s[start:end]
assert 'linear-gradient(135deg,#FFD27A,#C2821C)' in old, 'unexpected poster block'
SHIELD = 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM9 12l2 2 4-4'
new = (
    '<sc-if value="{{ pop.hasPoster }}" hint-placeholder-val="{{ false }}"><div style="display: flex; flex-direction: column; align-items: center; gap: 12px; align-self: stretch">'
    '<div style="position: relative; width: 164px; height: 232px; padding: 7px; box-sizing: border-box; background: linear-gradient(135deg,#2A2A30,#141417); box-shadow: 0 22px 36px -18px rgba(10,10,40,.55); animation: nbFloat 7s ease-in-out infinite">'
    '<div style="width: 100%; height: 100%; padding: 8px; box-sizing: border-box; background: #FBFAF7"><img src="{{ pop.posterImg }}" alt="Образец постера" style="display: block; width: 100%; height: 100%; object-fit: cover"></div>'
    '<span aria-hidden="true" style="position: absolute; left: 50%; top: 42%; transform: translate(-50%,-50%) rotate(-28deg); padding: 3px 10px; border: 1px solid rgba(255,255,255,.6); border-radius: 6px; background: rgba(10,14,40,.28); color: rgba(255,255,255,.82); font-size: 11px; font-weight: 700; letter-spacing: 0.28em">ОБРАЗЕЦ</span></div>'
    '<div style="display: inline-flex; padding: 3px; border-radius: 999px; background: {{ c.fill }}"><sc-for list="{{ pop.posterThemes }}" as="ptv" hint-placeholder-count="2"><button type="button" onClick="{{ ptv.pick }}" style="height: 32px; padding: 0 16px; border: 0; border-radius: 999px; background: {{ ptv.bg }}; box-shadow: {{ ptv.sh }}; color: {{ c.label }}; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer">{{ ptv.label }}</button></sc-for></div>'
    '<span style="display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: 14px; background: {{ c.fill }}; font-size: 12.5px; line-height: 1.4; color: {{ c.label2 }}; text-align: left"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none; margin-top: 1px"><path d="' + SHIELD + '"></path></svg><span>{{ pop.posterSecure }}</span></span>'
    '</div></sc-if>\n'
    '<sc-if value="{{ pop.hasWall }}" hint-placeholder-val="{{ false }}"><img src="{{ pop.wallImg }}" alt="Постер в рамке на стене" style="display: block; align-self: stretch; width: 100%; aspect-ratio: 9 / 10; object-fit: cover; border-radius: 20px"></sc-if>'
)
s = s[:start] + new + s[end:]

# defaults for every popup
r("const base = { on: true, hasPlusCard: false,",
  "const base = { on: true, hasWall: false, wallImg: '', posterImg: '', posterThemes: [], posterSecure: '', hasPlusCard: false,")

buy = "btn('Купить постер', () => (acc === 'guest' ? this.setState({ popup: 'signin' }) : this.pay('poster', 'Постер «Небо в день рождения»', '349 ₽')), 'primary', '349 ₽')"
r("    if (p === 'poster') pop = Object.assign({}, base, { hasPoster: true, hasOver: true, over: 'Постер · 349 ₽', title: 'Небо в день рождения', hasText: true, text: 'Так выглядело небо над Сергиевым Посадом 6 марта 1989 в 23:15. Файл для печати A3 и обои на телефон.', buttons: [" + buy + ", btn('Сделать для другого человека', () => this.toast('Выбери человека в «Моих картах»'), 'link')] });",
  "    const posterTh = s.posterTheme === 'dark' ? 'dark' : 'light';\n"
  "    if (p === 'poster') pop = Object.assign({}, base, { hasPoster: true, posterImg: posterTh === 'dark' ? '" + THUMB['dark'] + "' : '" + THUMB['light'] + "', posterThemes: [['light', 'Светлый'], ['dark', 'Тёмный']].map((x) => ({ label: x[1], bg: posterTh === x[0] ? c.page : 'transparent', sh: posterTh === x[0] ? '0 1px 4px rgba(11,13,18,.14)' : 'none', pick: () => this.setState({ posterTheme: x[0] }) })), posterSecure: 'Скриншот этого окна сделать нельзя. Файл для печати придёт сразу после покупки.', hasOver: true, over: 'Постер · A3', title: 'Небо в день рождения', hasText: true, text: 'Настоящее небо над Сергиевым Посадом 6 марта 1989 в 23:15: звёзды, созвездия, Юпитер и Марс на своих местах. Файл для печати A3 и обои на телефон.', buttons: [" + buy + ", btn('Посмотреть в рамке на стене', () => this.setState({ popup: 'posterWall' }), 'link'), btn('Сделать для другого человека', () => this.toast('Выбери человека в «Моих картах»'), 'link')] });\n"
  "    if (p === 'posterWall') pop = Object.assign({}, base, { hasWall: true, wallImg: posterTh === 'dark' ? '" + WALL['dark'] + "' : '" + WALL['light'] + "', hasOver: true, over: 'Постер · A3 в рамке', title: 'Так он будет смотреться на стене', hasText: true, text: 'Подойдёт любая рамка формата A3. Печатай на плотной матовой бумаге, так звёзды выглядят чётче.', buttons: [" + buy + ", btn('Назад к постеру', () => this.setState({ popup: 'poster' }), 'link')] });")

# state and editor prop
r("payPack: 10, paidWhat: props.paidWhat || 'poster',", "payPack: 10, paidWhat: props.paidWhat || 'poster', posterTheme: props.posterTheme || 'light',")
r('"paidWhat":{"editor":"enum","options":["poster","tips","year"],"default":"poster"}',
  '"paidWhat":{"editor":"enum","options":["poster","tips","year"],"default":"poster"},"posterTheme":{"editor":"enum","options":["light","dark"],"default":"light"}')

# the new popup in the editor's list
r('"options":["none","rustore","paidPlus","paid","giftDone","deleteAccount","poster","tips",', '"options":["none","rustore","paidPlus","paid","giftDone","deleteAccount","poster","posterWall","tips",')

open(path, 'w', encoding='utf-8').write(s)
print('patch P applied')
