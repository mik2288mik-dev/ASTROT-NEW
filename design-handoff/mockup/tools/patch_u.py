"""Patch U: the main button colour can be switched per board (prop cta-variant) to compare
options: flow (current), ultra, night, ink, violet, gold, tint. Text colour follows the
variant, so light buttons get dark text. Every replacement must match exactly once."""
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


# every element with the CTA class takes its text colour from the variant
def fix_tag(m):
    tag = m.group(0)
    assert tag.count('color: #ffffff') == 1, tag[:120]
    return tag.replace('color: #ffffff', 'color: {{ ctaTheme.fg }}')


s, n = re.subn(r'<[a-z]+[^>]*nbCta[^>]*>', fix_tag, s)
assert n == 26, n

# variants
STARS = ("radial-gradient(1.3px 1.3px at 14% 34%, rgba(255,255,255,.8), rgba(255,255,255,0)), "
         "radial-gradient(1px 1px at 31% 72%, rgba(255,255,255,.55), rgba(255,255,255,0)), "
         "radial-gradient(1.6px 1.6px at 47% 22%, rgba(255,231,170,.9), rgba(255,231,170,0)), "
         "radial-gradient(1px 1px at 63% 64%, rgba(255,255,255,.6), rgba(255,255,255,0)), "
         "radial-gradient(1.2px 1.2px at 79% 30%, rgba(255,255,255,.7), rgba(255,255,255,0)), "
         "radial-gradient(1px 1px at 91% 70%, rgba(255,255,255,.5), rgba(255,255,255,0)), ")
r("    const ctaTheme = { cta: th[0], shadow: '0 14px 28px -16px rgba(67,56,202,.6)' };",
  "    const CTA_V = {\n"
  "      ultra: ['#2E46D8', '0 14px 28px -16px rgba(46,70,216,.55)', '#ffffff'],\n"
  "      night: ['" + STARS + "linear-gradient(180deg,#1C2662 0%,#0F1640 100%)', '0 14px 28px -16px rgba(15,22,64,.65)', '#ffffff'],\n"
  "      ink: dark ? ['#F2F3F5', 'none', '#111216'] : ['#16171C', '0 14px 28px -16px rgba(10,10,20,.5)', '#ffffff'],\n"
  "      violet: ['#40249A', '0 14px 28px -16px rgba(64,36,154,.55)', '#ffffff'],\n"
  "      gold: ['linear-gradient(180deg,#F4CD74 0%,#E2AC43 100%)', '0 14px 28px -16px rgba(170,110,20,.55)', '#2A1C02'],\n"
  "      tint: dark ? ['rgba(165,180,252,.18)', 'none', '#C7D2FE'] : ['#E7ECFF', 'none', '#2B3CC8'],\n"
  "    }[this.props.ctaVariant];\n"
  "    const ctaTheme = CTA_V ? { cta: CTA_V[0], shadow: CTA_V[1], fg: CTA_V[2] } : { cta: th[0], shadow: '0 14px 28px -16px rgba(67,56,202,.6)', fg: '#ffffff' };")
# buttons inside pop-ups
r("fg: kind === 'primary' || kind === 'danger' ? '#ffffff' :", "fg: kind === 'primary' ? ctaTheme.fg : kind === 'danger' ? '#ffffff' :")
# the «Войти» badge in the account chip
r("badgeBg: ctaTheme.cta, badgeFg: '#ffffff',", "badgeBg: ctaTheme.cta, badgeFg: ctaTheme.fg,")
# editor prop
r('"posterTheme":{"editor":"enum","options":["light","dark"],"default":"light"}',
  '"posterTheme":{"editor":"enum","options":["light","dark"],"default":"light"},"ctaVariant":{"editor":"enum","options":["flow","ultra","night","ink","violet","gold","tint"],"default":"flow"}')

open(path, 'w', encoding='utf-8').write(s)
print('patch U applied')
