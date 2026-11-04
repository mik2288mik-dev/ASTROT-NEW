import React from 'react';
import template from './template.json';

/** Runs the canvas source as it is: its template tree and its logic class. */
type TreeNode = string | [string, Record<string, string | true>, TreeNode[]];
type Scope = Record<string, unknown>;

const HOLE = /\{\{\s*([^{}]+?)\s*\}\}/g;
const WHOLE_HOLE = /^\{\{\s*([^{}]+?)\s*\}\}$/;

function lookup(path: string, scope: Scope): unknown {
  if (path === 'true') return true;
  if (path === 'false') return false;
  if (path === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
  if (/^(['"]).*\1$/.test(path)) return path.slice(1, -1);
  let value: unknown = scope;
  for (const key of path.split('.')) {
    if (value === null || value === undefined) return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

function interpolate(text: string, scope: Scope): string {
  return text.replace(HOLE, (_, path: string) => {
    const value = lookup(path, scope);
    return value === null || value === undefined || value === false ? '' : String(value);
  });
}

const styleCache = new Map<string, React.CSSProperties>();
const LIGHT_GLASS = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

function parseStyle(css: string): React.CSSProperties {
  const cached = styleCache.get(css);
  if (cached) return cached;
  const style: Record<string, string> = {};
  let depth = 0;
  let quote = '';
  let start = 0;
  const add = (chunk: string) => {
    const colon = chunk.indexOf(':');
    if (colon < 0) return;
    const name = chunk.slice(0, colon).trim();
    const value = chunk.slice(colon + 1).trim();
    if (!name || !value) return;
    const key = name.startsWith('--') ? name : name.replace(/^-(webkit|moz|ms)-/, (_, vendor: string) => `${vendor[0].toUpperCase()}${vendor.slice(1)}-`).replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    // SVG refraction inside backdrop-filter costs a repaint per frame on Android phones.
    style[key] = key === 'backdropFilter' && LIGHT_GLASS ? value.replace(/url\([^)]*\)\s*/g, '').replace(/blur\(\d+(\.\d+)?px\)/, 'blur(10px)') || 'blur(10px)' : value;
  };
  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i];
    if (quote) { if (ch === quote) quote = ''; continue; }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (ch === ';' && depth === 0) { add(css.slice(start, i)); start = i + 1; }
  }
  add(css.slice(start));
  if (styleCache.size > 20000) styleCache.clear();
  styleCache.set(css, style as React.CSSProperties);
  return style as React.CSSProperties;
}

const ATTR_NAMES: Record<string, string> = {
  class: 'className', for: 'htmlFor', tabindex: 'tabIndex', autoplay: 'autoPlay', playsinline: 'playsInline', maxlength: 'maxLength',
  readonly: 'readOnly', autocomplete: 'autoComplete', inputmode: 'inputMode', crossorigin: 'crossOrigin', colspan: 'colSpan', rowspan: 'rowSpan',
  srcset: 'srcSet', autofocus: 'autoFocus', spellcheck: 'spellCheck', enterkeyhint: 'enterKeyHint', 'xlink:href': 'xlinkHref',
};

function propName(name: string): string {
  if (ATTR_NAMES[name]) return ATTR_NAMES[name];
  if (name.startsWith('data-') || name.startsWith('aria-')) return name;
  return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function renderNodes(nodes: TreeNode[], scope: Scope): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  nodes.forEach((node, index) => {
    const rendered = renderNode(node, scope, index);
    if (Array.isArray(rendered)) out.push(...rendered);
    else if (rendered !== null) out.push(rendered);
  });
  return out;
}

function renderNode(node: TreeNode, scope: Scope, key: number): React.ReactNode {
  if (typeof node === 'string') {
    if (!node.includes('{{')) return node;
    return interpolate(node, scope);
  }
  const [tag, attrs, children] = node;
  if (tag === 'sc-if') {
    const raw = String(attrs.value ?? '');
    const whole = raw.match(WHOLE_HOLE);
    if (!(whole ? lookup(whole[1], scope) : raw)) return null;
    return <React.Fragment key={key}>{renderNodes(children, scope)}</React.Fragment>;
  }
  if (tag === 'sc-for') {
    const whole = String(attrs.list ?? '').match(WHOLE_HOLE);
    const list = whole ? lookup(whole[1], scope) : null;
    if (!Array.isArray(list)) return null;
    const as = String(attrs.as ?? 'item');
    return (
      <React.Fragment key={key}>
        {list.map((item, index) => (
          <React.Fragment key={index}>{renderNodes(children, { ...scope, [as]: item, $index: index })}</React.Fragment>
        ))}
      </React.Fragment>
    );
  }
  const props: Record<string, unknown> = { key };
  for (const name of Object.keys(attrs)) {
    const raw = attrs[name];
    if (raw === true) { props[propName(name)] = true; continue; }
    if (name === 'style') {
      props.style = parseStyle(raw.includes('{{') ? interpolate(raw, scope) : raw);
      continue;
    }
    const whole = raw.match(WHOLE_HOLE);
    props[propName(name)] = whole ? lookup(whole[1], scope) : raw.includes('{{') ? interpolate(raw, scope) : raw;
  }
  if (tag === 'style') {
    return <style key={key} dangerouslySetInnerHTML={{ __html: children.filter((c) => typeof c === 'string').join('') }} />;
  }
  const kids = renderNodes(children, scope);
  return React.createElement(tag, props, ...(kids.length ? kids : []));
}

/** The base class the canvas logic extends: a React class whose view is the template. */
async function shareText(text: string): Promise<void> {
  const message = `${text}\n\nNEBO`;
  try {
    if (navigator.share) { await navigator.share({ text: message }); return; }
    await navigator.clipboard?.writeText(message);
  } catch { /* the person closed the share sheet */ }
}

/** Screens that still hold examples: for a real account they open the working old screens. */
const HANDOFF_SCREENS: Record<string, string> = {
  person: 'synastry',

};
const HANDOFF_SEGMENTS: Record<string, string> = {};
const HANDOFF_POPUPS: Record<string, string> = {};

export class DCLogic<P = Record<string, unknown>, S = Record<string, unknown>> extends React.Component<P, S> {
  setState(patch: never, callback?: () => void): void {
    const handoff = (this.props as { handoff?: (flow: string) => void }).handoff;
    const next = patch as Record<string, unknown> | null;
    if (handoff && next && typeof next === 'object') {
      // Sold only as part of Plus.
      if (next.popup === 'buyMatrix' || next.popup === 'buyOther') {
        super.setState({ popup: null, screen: 'plus' } as never, callback);
        return;
      }
      const flow = HANDOFF_SCREENS[String(next.screen)] ?? HANDOFF_SEGMENTS[String(next.seg)]
        ?? HANDOFF_POPUPS[String(next.popup)];
      if (flow) { handoff(flow); return; }
      if (next.popup === 'share') {
        const from = String(next.shareFrom ?? (this.state as { shareFrom?: string }).shareFrom ?? 'day');
        const text = (this as unknown as { shareTexts?: Record<string, string> }).shareTexts?.[from];
        if (text) void shareText(text);
        return;
      }
    }
    if (next && typeof next === 'object' && (typeof next.theme === 'string' || typeof next.lang === 'string')) {
      (this.props as { onPrefs?: (prefs: { theme?: string; lang?: string }) => void }).onPrefs?.({
        theme: typeof next.theme === 'string' ? next.theme : undefined,
        lang: typeof next.lang === 'string' ? next.lang : undefined,
      });
    }
    super.setState(patch, callback);
  }

  renderVals(): Scope {
    return {};
  }

  render() {
    return <>{renderNodes(template as unknown as TreeNode[], this.renderVals())}</>;
  }
}
