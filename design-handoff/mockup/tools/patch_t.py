"""Patch T: the English and Spanish screens lose the Russian leftovers: the «Есть в NEBO»
card, the people on Today, the account chip and the screen-reader labels.
Every replacement must match exactly once."""
import sys

path = sys.argv[1]
s = open(path, encoding='utf-8').read()


def r(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        raise SystemExit('expected %d match(es), found %d for: %r' % (count, n, old[:90]))
    s = s.replace(old, new)


# words used in markup
r("tarotLbl: 'ТАРО',", "tarotLbl: 'ТАРО', promoOver: 'Есть в NEBO', ariaInbox: 'Входящие', ariaTabs: 'Разделы',")
r("cardOfDay: 'Card of the day', tarotLbl: 'TAROT',", "cardOfDay: 'Card of the day', tarotLbl: 'TAROT', promoOver: 'In NEBO', ariaInbox: 'Inbox', ariaTabs: 'Sections',")
r("cardOfDay: 'Carta del día', tarotLbl: 'TAROT',", "cardOfDay: 'Carta del día', tarotLbl: 'TAROT', promoOver: 'En NEBO', ariaInbox: 'Bandeja de entrada', ariaTabs: 'Secciones',")
r('color: {{ ink.fg2 }}">Есть в NEBO</span>', 'color: {{ ink.fg2 }}">{{ t.promoOver }}</span>')
r('onClick="{{ openInbox }}" aria-label="Входящие"', 'onClick="{{ openInbox }}" aria-label="{{ t.ariaInbox }}"')
r('<nav ref="{{ refs.tabs }}" aria-label="Разделы"', '<nav ref="{{ refs.tabs }}" aria-label="{{ t.ariaTabs }}"')

# account chip
r("    const chip = acc === 'guest'\n",
  "    const CHIP_TX = { en: { me: 'Mikhail', guestLong: 'Guest · not signed in', plusLong: 'Plus until November 21', freeLong: 'Free', guestAria: 'Account: guest. Sign in', plusAria: 'Account: Mikhail, Plus', freeAria: 'Account: Mikhail, free' }, es: { me: 'Mijaíl', guestLong: 'Invitado · sin cuenta', plusLong: 'Plus hasta el 21 de noviembre', freeLong: 'Gratis', guestAria: 'Cuenta: invitado. Entrar', plusAria: 'Cuenta: Mijaíl, Plus', freeAria: 'Cuenta: Mijaíl, gratis' } }[L];\n"
  "    const chip = acc === 'guest'\n")
r("statusLong: 'Гость · без входа',", "statusLong: CHIP_TX ? CHIP_TX.guestLong : 'Гость · без входа',")
r("aria: 'Аккаунт: гость. Войти' }", "aria: CHIP_TX ? CHIP_TX.guestAria : 'Аккаунт: гость. Войти' }")
r("letter: 'М', name: 'Михаил', fullName: 'Михаил', status: 'Plus', statusLong: 'Plus до 21 ноября',",
  "letter: CHIP_TX ? 'M' : 'М', name: CHIP_TX ? CHIP_TX.me : 'Михаил', fullName: CHIP_TX ? CHIP_TX.me : 'Михаил', status: 'Plus', statusLong: CHIP_TX ? CHIP_TX.plusLong : 'Plus до 21 ноября',")
r("aria: 'Аккаунт: Михаил, Plus' }", "aria: CHIP_TX ? CHIP_TX.plusAria : 'Аккаунт: Михаил, Plus' }")
r("letter: 'М', name: 'Михаил', fullName: 'Михаил', status: 'Free', statusLong: 'Бесплатный',",
  "letter: CHIP_TX ? 'M' : 'М', name: CHIP_TX ? CHIP_TX.me : 'Михаил', fullName: CHIP_TX ? CHIP_TX.me : 'Михаил', status: 'Free', statusLong: CHIP_TX ? CHIP_TX.freeLong : 'Бесплатный',")
r("aria: 'Аккаунт: Михаил, бесплатный' };", "aria: CHIP_TX ? CHIP_TX.freeAria : 'Аккаунт: Михаил, бесплатный' };")

# people on Today
r("    const todayAvatars = [['Д', 'Дария', 'тёплый день',",
  "    const AV_TX = { en: [['D', 'Daria', 'warm day'], ['K', 'Katya', 'text tonight'], ['A', 'Artyom', 'busy']], es: [['D', 'Daria', 'día cálido'], ['K', 'Katia', 'escribir esta noche'], ['A', 'Artiom', 'ocupado']] }[L];\n"
  "    const todayAvatars = [['Д', 'Дария', 'тёплый день',")
r(".map((a) => ({ letter: a[0], name: a[1], status: a[2], bg: a[3], ring: a[4], open: () => this.setState({ screen: 'person' }) }));",
  ".map((a, i) => ({ letter: AV_TX ? AV_TX[i][0] : a[0], name: AV_TX ? AV_TX[i][1] : a[1], status: AV_TX ? AV_TX[i][2] : a[2], bg: a[3], ring: a[4], open: () => this.setState({ screen: 'person' }) }));")

# «Есть в NEBO» card
r("    const promo = { stk: pr0[0], title: pr0[1], text: pr0[2], go: pr0[3] };",
  "    const PROMO_TX = { en: { gift: ['Gift Plus to a friend', 'A card arrives on the day you pick and opens all of NEBO for them'], guide: ['Sky guide', 'What planets, houses and aspects mean, in plain words'], poster: ['Poster: your birthday sky', 'The stars over your city at the minute you were born, to print and as a wallpaper'], year: ['Year ahead', 'Your year by your chart, month by month'] }, es: { gift: ['Regala Plus a un amigo', 'La tarjeta llega el día que elijas y le abre todo NEBO'], guide: ['Guía del cielo', 'Qué significan planetas, casas y aspectos, en palabras sencillas'], poster: ['Póster: el cielo de tu cumpleaños', 'Las estrellas sobre tu ciudad en el minuto en que naciste, para imprimir y de fondo'], year: ['El año por delante', 'Tu año según tu carta, mes a mes'] } }[L];\n"
  "    const prTx = PROMO_TX ? PROMO_TX[PROMO[s.promo] ? s.promo : 'guide'] : null;\n"
  "    const promo = { stk: pr0[0], title: prTx ? prTx[0] : pr0[1], text: prTx ? prTx[1] : pr0[2], go: pr0[3] };")

open(path, 'w', encoding='utf-8').write(s)
print('patch T applied')
