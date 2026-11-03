"""Generate dark-theme overrides (canvas palette) from the app's light CSS.

Run from the repository root after changing styles: python scripts/generate-dark-theme.py
It rewrites styles/neboDark.css and the generated block at the end of each *.module.css.
Hand-tuned dark rules live in styles/neboDarkTuned.css and are never overwritten.

Every rule that sets a light-theme colour gets an override under html[data-theme='dark'].
Canvas dark tokens: page #1C1D21, paper #27282E, label #F4F5F8, label2 rgba(235,235,245,.64),
label3 rgba(235,235,245,.38), sep rgba(255,255,255,.08), segOn rgba(255,255,255,.18), CTA #F2F3F5 on #111216.
"""
import colorsys
import io
import os
import re
import subprocess
import sys
import tempfile

ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'styles', 'neboDark.css')
P = "html[data-theme='dark']"

PAGE = (28, 29, 33)
PAPER = (39, 40, 46)

# ---------- CSS parsing ----------

def strip_comments(s):
    return re.sub(r'/\*.*?\*/', '', s, flags=re.S)


def parse(s):
    """Returns a list of nodes: ('rule', selector, body) or ('at', prelude, children|None)."""
    nodes = []
    i, n = 0, len(s)
    while i < n:
        while i < n and s[i] in ' \t\r\n;':
            i += 1
        if i >= n:
            break
        j = i
        depth = 0
        quote = None
        while j < n:
            c = s[j]
            if quote:
                if c == quote and s[j - 1] != '\\':
                    quote = None
            elif c in '"\'':
                quote = c
            elif c == '(':
                depth += 1
            elif c == ')':
                depth -= 1
            elif depth == 0 and c in '{;':
                break
            j += 1
        prelude = s[i:j].strip()
        if j >= n:
            break
        if s[j] == ';':
            i = j + 1
            continue
        # find the matching close brace
        k = j + 1
        depth = 1
        quote = None
        while k < n and depth:
            c = s[k]
            if quote:
                if c == quote and s[k - 1] != '\\':
                    quote = None
            elif c in '"\'':
                quote = c
            elif c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
            k += 1
        body = s[j + 1:k - 1]
        if prelude.startswith('@'):
            name = prelude.split()[0].lower()
            if name in ('@media', '@supports', '@layer', '@container'):
                nodes.append(('at', prelude, parse(body)))
            # keyframes, font-face, property, page: skip
        else:
            nodes.append(('rule', prelude, body))
        i = k
    return nodes


def split_decls(body):
    out = []
    depth = 0
    quote = None
    cur = ''
    for c in body:
        if quote:
            if c == quote:
                quote = None
        elif c in '"\'':
            quote = c
        elif c == '(':
            depth += 1
        elif c == ')':
            depth -= 1
        if c == ';' and depth == 0 and not quote:
            out.append(cur)
            cur = ''
        else:
            cur += c
    out.append(cur)
    decls = []
    for d in out:
        if ':' not in d or '{' in d:
            continue
        prop, val = d.split(':', 1)
        prop = prop.strip().lower()
        val = val.strip()
        if prop and val:
            decls.append((prop, val))
    return decls

# ---------- colours ----------

NAMED = {'white': (255, 255, 255, 1.0), 'black': (0, 0, 0, 1.0)}
COLOR_RE = re.compile(r'#[0-9a-fA-F]{3,8}\b|rgba?\((?:[^()]|\([^()]*\))*\)|\b(?:white|black)\b')


def parse_color(tok):
    t = tok.lower()
    if t in NAMED:
        return NAMED[t]
    if t.startswith('#'):
        h = t[1:]
        if len(h) in (3, 4):
            h = ''.join(c * 2 for c in h)
        if len(h) not in (6, 8):
            return None
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        a = int(h[6:8], 16) / 255 if len(h) == 8 else 1.0
        return (r, g, b, a)
    m = re.match(r'rgba?\((.*)\)$', t)
    if m:
        # Tailwind writes rgb(255 255 255 / var(--tw-bg-opacity, 1)): the variable alpha counts as 1.
        parts = re.split(r'[\s,/]+', re.sub(r'var\([^)]*\)', 'var', m.group(1).strip()))
        if len(parts) < 3 or any('var' in p for p in parts[:3]):
            return None
        if len(parts) >= 4 and 'var' in parts[3]:
            parts = parts[:3]
        try:
            vals = []
            for p in parts[:3]:
                vals.append(float(p[:-1]) * 2.55 if p.endswith('%') else float(p))
            a = 1.0
            if len(parts) >= 4:
                a = float(parts[3][:-1]) / 100 if parts[3].endswith('%') else float(parts[3])
            return (vals[0], vals[1], vals[2], a)
        except ValueError:
            return None
    return None


def fmt(r, g, b, a=1.0):
    r, g, b = (int(round(max(0, min(255, x)))) for x in (r, g, b))
    if a >= 0.999:
        return '#%02X%02X%02X' % (r, g, b)
    return 'rgba(%d, %d, %d, %s)' % (r, g, b, ('%.3f' % a).rstrip('0').rstrip('.'))


def hls(c):
    return colorsys.rgb_to_hls(c[0] / 255, c[1] / 255, c[2] / 255)


def is_neutral(c):
    h, l, s = hls(c)
    return s < 0.16 or max(c[:3]) - min(c[:3]) < 22


def lum(c):
    return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255


def text_color(c):
    r, g, b, a = c
    L = lum(c)
    if a < 0.999 and L < 0.3:
        # translucent dark ink (e.g. rgba(11,13,18,.6)) -> translucent light ink
        return fmt(235, 235, 245, min(1, a * 1.05 + 0.05))
    if is_neutral(c):
        if L < 0.16:
            return fmt(244, 245, 248, a)
        if L < 0.3:
            return fmt(235, 235, 245, 0.72 * a)
        if L < 0.55:
            return fmt(235, 235, 245, 0.5 * a)
        if L < 0.75:
            return fmt(235, 235, 245, 0.42 * a)
        return None  # light text stays
    # coloured text: lift dark shades so they read on graphite
    h, l, s = hls(c)
    if l < 0.25:
        return fmt(244, 245, 248, a)
    if l < 0.55:
        r2, g2, b2 = colorsys.hls_to_rgb(h, max(0.68, l + 0.3), min(1, s))
        return fmt(r2 * 255, g2 * 255, b2 * 255, a)
    return None


def bg_color(c, role):
    r, g, b, a = c
    L = lum(c)
    if is_neutral(c):
        if L > 0.97 and a >= 0.999:
            if role == 'seg':
                return fmt(255, 255, 255, 0.18)
            if role == 'pop':
                return fmt(*PAPER)
            return fmt(*PAGE)
        if L > 0.97:
            # translucent white glass
            if a <= 0.3:
                return fmt(255, 255, 255, max(0.06, a * 0.5))
            return fmt(39, 40, 46, min(0.94, a))
        if L > 0.8:
            return fmt(*PAPER, a) if a >= 0.999 else fmt(255, 255, 255, min(0.12, a * 0.4 + 0.04))
        if L > 0.55:
            return fmt(58, 60, 68, a)
        if L < 0.12 and a >= 0.999:
            return '#F2F3F5' if role == 'cta' else None
        if L < 0.3 and a < 0.999:
            # dark scrims / dark translucent fills -> light translucent fills (except scrims)
            return None if a >= 0.3 else fmt(255, 255, 255, a * 1.4)
        return None
    h, l, s = hls(c)
    if l > 0.82:
        # pastel tint card -> deep tint of the same hue
        r2, g2, b2 = colorsys.hls_to_rgb(h, 0.2, min(0.45, s))
        return fmt(r2 * 255, g2 * 255, b2 * 255, a)
    return None


def border_color(c):
    r, g, b, a = c
    L = lum(c)
    if is_neutral(c):
        if L < 0.3:
            return fmt(255, 255, 255, min(0.16, max(0.06, a)))
        if L > 0.97 and a < 0.999:
            return fmt(255, 255, 255, 0.08)
        if L > 0.6:
            return fmt(255, 255, 255, 0.1 if a >= 0.999 else min(0.1, a))
    return None


def map_value(val, kind, role):
    changed = False

    def sub(m):
        nonlocal changed
        c = parse_color(m.group(0))
        if c is None:
            return m.group(0)
        if kind == 'text':
            out = text_color(c)
        elif kind == 'bg':
            out = bg_color(c, role)
        elif kind == 'border':
            out = border_color(c)
        elif kind == 'shadow':
            out = None
            if is_neutral(c) and lum(c) > 0.9:
                out = fmt(255, 255, 255, min(0.06, c[3] * 0.1))
            elif is_neutral(c) and lum(c) < 0.3:
                out = fmt(0, 0, 0, min(0.6, c[3] * 1.6 + 0.1))
        else:
            out = None
        if out is None:
            return m.group(0)
        changed = True
        return out

    if 'url(' in val:
        # keep images; only map plain colour layers after them
        parts = re.split(r'(url\([^)]*\))', val)
        new = ''.join(p if p.startswith('url(') else COLOR_RE.sub(sub, p) for p in parts)
    else:
        new = COLOR_RE.sub(sub, val)
    if kind == 'bg' and 'gradient' in val:
        # a decorative gradient (several saturated stops) keeps its look
        cols = [parse_color(t) for t in COLOR_RE.findall(val)]
        cols = [c for c in cols if c]
        if sum(1 for c in cols if not is_neutral(c)) >= 2:
            return None
    return new if changed else None


TEXT_PROPS = {'color', 'fill', 'stroke', 'caret-color', '-webkit-text-fill-color', 'text-decoration-color', 'column-rule-color'}
BG_PROPS = {'background', 'background-color', 'background-image'}
BORDER_PROPS = {'border', 'border-color', 'border-top', 'border-bottom', 'border-left', 'border-right',
                'border-top-color', 'border-bottom-color', 'border-left-color', 'border-right-color',
                'outline', 'outline-color', 'border-block', 'border-inline', 'border-block-start', 'border-block-end',
                'border-inline-start', 'border-inline-end'}
SHADOW_PROPS = {'box-shadow'}


def var_kind(name):
    n = name.lower()
    if re.search(r'shadow', n):
        return 'shadow'
    if re.search(r'(^|-)(ink|text|fg|label|muted|title|copy|color-text|on)(-|$)', n):
        return 'text'
    if re.search(r'(bg|surface|paper|card|page|fill|panel|sheet|backdrop|background|canvas)', n):
        return 'bg'
    if re.search(r'(line|border|sep|stroke|hairline|divider)', n):
        return 'border'
    if re.search(r'shadow', n):
        return 'shadow'
    return None


def selector_role(sel, decls):
    s = sel.lower()
    if re.search(r'is-active|is-on|aria-selected|aria-pressed|aria-checked|is-selected|\.active\b|is-current', s):
        return 'seg'
    if re.search(r'pop|sheet|modal|dialog|why|menu|toast|tooltip|overlay|drawer|coach|scrim', s):
        return 'pop'
    for p, v in decls:
        if p == 'color':
            c = next((parse_color(t) for t in COLOR_RE.findall(v) if parse_color(t)), None)
            if c and is_neutral(c) and lum(c) > 0.95:
                return 'cta'
    return 'page'


# ---------- selectors ----------

def prefix_selector(sel):
    out = []
    for part in split_selector_list(sel):
        p = part.strip()
        if not p:
            continue
        low = p.lower()
        if 'data-theme' in low or 'theme-light' in low or re.search(r'(^|\s)\.dark\b|html\.dark', low) or 'prefers-color-scheme' in low:
            return None
        if low.startswith(':root'):
            out.append(P + p[5:])
        elif low.startswith('html'):
            out.append(P + p[4:])
        else:
            out.append(P + ' ' + p)
    return ', '.join(out) if out else None


def split_selector_list(sel):
    parts, depth, cur = [], 0, ''
    for c in sel:
        if c in '([':
            depth += 1
        elif c in ')]':
            depth -= 1
        if c == ',' and depth == 0:
            parts.append(cur)
            cur = ''
        else:
            cur += c
    parts.append(cur)
    return parts


def module_prefix(sel):
    out = []
    for part in split_selector_list(sel):
        p = part.strip()
        if not p:
            continue
        if ':global' in p or 'data-theme' in p:
            return None
        out.append(":global(html[data-theme='dark']) " + p)
    return ', '.join(out) if out else None


# ---------- live-class filter ----------

def code_words():
    words = set()
    for base in ('App.tsx', 'views', 'components', 'pages', 'lib', 'services'):
        path = os.path.join(ROOT, base)
        files = [path] if os.path.isfile(path) else [os.path.join(d, f) for d, _, fs in os.walk(path) for f in fs]
        for f in files:
            if f.endswith(('.tsx', '.ts')) and 'node_modules' not in f:
                words.update(re.findall(r'[A-Za-z_][\w-]*', io.open(f, encoding='utf-8', errors='ignore').read()))
    return words


WORDS = None
PREFIXES = []


def known(c):
    if c in WORDS:
        return True
    return any(c.startswith(pre) for pre in PREFIXES)


def live(sel):
    for part in split_selector_list(sel):
        cls = re.findall(r'\.(-?[_a-zA-Z][\w-]*)', re.sub(r':not\([^)]*\)', '', part))
        if all(known(c) for c in cls):
            return True
    return False


# ---------- generation ----------

def gen(nodes, prefixer, filter_live):
    out = []
    for node in nodes:
        if node[0] == 'at':
            inner = gen(node[2], prefixer, filter_live)
            if inner:
                out.append(node[1] + ' {\n' + '\n'.join('  ' + l for l in inner.split('\n')) + '\n}')
            continue
        _, sel, body = node
        if filter_live and not live(sel):
            continue
        decls = split_decls(body)
        role = selector_role(sel, decls)
        has_dark_bg = False
        for p, v in decls:
            if p in BG_PROPS:
                for t in COLOR_RE.findall(v):
                    c = parse_color(t)
                    if c and is_neutral(c) and lum(c) < 0.12 and c[3] >= 0.999 and 'gradient' not in v:
                        has_dark_bg = True
        new = []
        for p, v in decls:
            important = '!important' in v
            vv = v.replace('!important', '').strip()
            kind = None
            if p in TEXT_PROPS:
                kind = 'text'
            elif p in BG_PROPS:
                kind = 'bg'
            elif p in BORDER_PROPS:
                kind = 'border'
            elif p in SHADOW_PROPS:
                kind = 'shadow'
            elif p.startswith('--'):
                kind = var_kind(p)
                if kind == 'bg' and re.search(r'(card|surface|panel|sheet|paper|soft)', p):
                    m = map_value(vv, kind, 'pop')
                    if m is not None:
                        new.append('  %s: %s%s;' % (p, m, ' !important' if important else ''))
                    continue
            if not kind:
                continue
            if kind == 'text' and has_dark_bg and role == 'cta':
                m = None
                c = next((parse_color(t) for t in COLOR_RE.findall(vv) if parse_color(t)), None)
                if c and is_neutral(c) and lum(c) > 0.95:
                    m = '#111216'
            else:
                m = map_value(vv, kind, role)
            if m is None:
                continue
            new.append('  %s: %s%s;' % (p, m, ' !important' if important else ''))
        if not new:
            continue
        psel = prefixer(sel)
        if not psel:
            continue
        out.append(psel + ' {\n' + '\n'.join(new) + '\n}')
    return '\n'.join(out)


def main():
    global WORDS
    WORDS = code_words()
    global PREFIXES
    PREFIXES = sorted(w for w in WORDS if w.endswith('-') and len(w) > 5)
    app = io.open(os.path.join(ROOT, 'pages', '_app.tsx'), encoding='utf-8').read()
    files = [m for m in re.findall(r"import '\.\./styles/([^']+\.css)'", app) if 'admin' not in m and m != 'neboDark.css']
    chunks = ['/* GENERATED by scripts/generate-dark-theme.py: canvas graphite palette over the light styles. Do not edit by hand; hand-tuned rules live in neboDarkTuned.css. */']
    # Tailwind utilities used in the markup (bg-white, text-[#0b0d12] ...)
    with tempfile.TemporaryDirectory() as tmp:
        src_in = os.path.join(tmp, 'in.css')
        src_out = os.path.join(tmp, 'out.css')
        io.open(src_in, 'w', encoding='utf-8').write('@tailwind utilities;\n')
        subprocess.run('npx tailwindcss -c tailwind.config.js -i "%s" -o "%s"' % (src_in, src_out), cwd=ROOT, shell=True, check=True, capture_output=True)
        tw = gen(parse(strip_comments(io.open(src_out, encoding='utf-8').read())), prefix_selector, False)
    if tw:
        chunks.append('/* ── tailwind utilities ── */\n' + tw)
    for f in files:
        src = strip_comments(io.open(os.path.join(ROOT, 'styles', f), encoding='utf-8').read())
        g = gen(parse(src), prefix_selector, True)
        if g:
            chunks.append('/* ── %s ── */\n%s' % (f, g))
    io.open(OUT, 'w', encoding='utf-8', newline='\n').write('\n\n'.join(chunks) + '\n')
    print('wrote', OUT, os.path.getsize(OUT))
    # CSS modules: append a generated block to each module file
    for d, _, fs in os.walk(ROOT):
        if 'node_modules' in d or '.next' in d or '.git' in d:
            continue
        for f in fs:
            if f.endswith('.module.css') and 'admin' not in d and f != 'NeboLanding.module.css':
                path = os.path.join(d, f)
                src = io.open(path, encoding='utf-8').read()
                marker = '/* ── dark theme (generated) ── */'
                base = src.split(marker)[0].rstrip() + '\n'
                g = gen(parse(strip_comments(base)), module_prefix, False)
                if g:
                    io.open(path, 'w', encoding='utf-8', newline='\n').write(base + '\n' + marker + '\n' + g + '\n')
                    print('module', os.path.relpath(path, ROOT), len(g))


main()
