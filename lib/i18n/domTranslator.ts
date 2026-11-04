/**
 * Translates what is on screen when the app is not in Russian. Screens written only in Russian, and tables of text
 * built when a file loads, all end up as text in the page, so this is the one place that covers them.
 * It never runs in Russian. Text that is not in the dictionaries, such as generated readings, stays as it is.
 */
const ATTRIBUTES = ['placeholder', 'aria-label', 'title', 'alt'] as const;
const LETTERS = /\p{L}/u;

export type Translate = (source: string) => string | null;

type Pattern = { regex: RegExp; template: string; order: number[] };

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const normaliseKey = (text: string) => text.replace(/\s+/g, ' ').trim();

/** Exact phrases, plus phrases with values inside such as «Осталось {0}». */
export function buildTranslate(table: Record<string, string>): Translate {
  const exact = new Map<string, string>();
  const patterns: Pattern[] = [];
  Object.entries(table).forEach(([source, target]) => {
    if (!/\{\d+\}/.test(source)) {
      exact.set(normaliseKey(source), target);
      return;
    }
    const order: number[] = [];
    // A frame with few words of its own («{0} из {1}») must not catch a generated sentence, so its values have to be numbers.
    const ownLetters = source.replace(/\{\d+\}/g, '').replace(/[^\p{L}]/gu, '').length;
    const value = ownLetters < 5 ? '(\\d[\\d\\s.,]*)' : '(.{1,40}?)';
    const body = normaliseKey(source).split(/(\{\d+\})/).map((part) => {
      const slot = part.match(/^\{(\d+)\}$/);
      if (!slot) return escapeRegex(part);
      order.push(Number(slot[1]));
      return value;
    }).join('');
    // The longest phrases first, so that a short one does not take over a longer one.
    patterns.push({ regex: new RegExp(`^${body}$`, 'u'), template: target, order });
  });
  patterns.sort((a, b) => b.regex.source.length - a.regex.source.length);
  const translate = (source: string, depth = 0): string | null => {
    const key = normaliseKey(source);
    const found = exact.get(key);
    if (found !== undefined) return found;
    if (depth > 1) return null;
    for (const { regex, template, order } of patterns) {
      const match = key.match(regex);
      if (!match) continue;
      return template.replace(/\{(\d+)\}/g, (_, index) => {
        const at = order.indexOf(Number(index));
        if (at < 0) return '';
        // Values inside a phrase can be translated too: «Луна в Деве» is «Луна в {0}» with «Деве».
        return translate(match[at + 1], depth + 1) ?? match[at + 1];
      });
    }
    return null;
  };
  return (source) => translate(source);
}

/** Keeps the spaces around a phrase: «Осталось », «3», « дней» are separate pieces of text in the page. */
function withSpacing(source: string, target: string): string {
  const lead = source.match(/^\s*/)?.[0] ?? '';
  const trail = source.match(/\s*$/)?.[0] ?? '';
  return `${lead}${target}${trail}`;
}

export function startDomTranslator(root: HTMLElement, translate: Translate): { retranslate: (next: Translate) => void; stop: () => void } {
  let active = translate;
  const textSource = new WeakMap<Text, { source: string; shown: string }>();
  const attributeSource = new WeakMap<Element, Map<string, string>>();
  const seen = new Set<WeakRef<Text>>();

  const translatable = (value: string) => LETTERS.test(value) && value.trim().length > 0;

  const translateText = (node: Text) => {
    const value = node.nodeValue ?? '';
    if (textSource.get(node)?.shown === value) return;
    textSource.delete(node);
    if (!translatable(value)) return;
    const parent = node.parentElement;
    if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE' || parent.closest('[data-no-translate]'))) return;
    const target = active(value);
    if (target === null) return;
    const next = withSpacing(value, target);
    if (next === value) return;
    textSource.set(node, { source: value, shown: next });
    seen.add(new WeakRef(node));
    node.nodeValue = next;
  };

  const translateAttributes = (element: Element) => {
    ATTRIBUTES.forEach((name) => {
      const value = element.getAttribute(name);
      if (!value || !translatable(value)) return;
      const target = active(value);
      if (target === null || target === value) return;
      const stored = attributeSource.get(element) ?? new Map<string, string>();
      stored.set(name, value);
      attributeSource.set(element, stored);
      element.setAttribute(name, target);
    });
  };

  const translateTree = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      translateText(node as Text);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    translateAttributes(element);
    element.querySelectorAll('[placeholder],[aria-label],[title],[alt]').forEach(translateAttributes);
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();
    while (current) {
      translateText(current as Text);
      current = walker.nextNode();
    }
  };

  // Runs before the browser paints, so the Russian text is never seen.
  const observer = new MutationObserver((records) => {
    records.forEach((record) => {
      if (record.type === 'characterData') translateText(record.target as Text);
      else if (record.type === 'attributes') translateAttributes(record.target as Element);
      else record.addedNodes.forEach(translateTree);
    });
    observer.takeRecords();
  });
  const observe = () => observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRIBUTES] });

  /** Puts the original text back in the page, so that another language can start from it. */
  const restore = () => {
    seen.forEach((ref) => {
      const node = ref.deref();
      if (!node) {
        seen.delete(ref);
        return;
      }
      const stored = textSource.get(node);
      if (stored && node.nodeValue === stored.shown) node.nodeValue = stored.source;
      textSource.delete(node);
    });
    seen.clear();
    root.querySelectorAll('[placeholder],[aria-label],[title],[alt]').forEach((element) => {
      attributeSource.get(element)?.forEach((value, name) => element.setAttribute(name, value));
      attributeSource.delete(element);
    });
  };

  translateTree(root);
  observer.takeRecords();
  observe();

  return {
    retranslate(next) {
      observer.disconnect();
      restore();
      active = next;
      translateTree(root);
      observer.takeRecords();
      observe();
    },
    stop() {
      observer.disconnect();
      restore();
    },
  };
}
