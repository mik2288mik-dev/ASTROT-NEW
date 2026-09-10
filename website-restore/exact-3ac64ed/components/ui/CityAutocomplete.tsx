import React, { useEffect, useId, useRef, useState } from 'react';

/**
 * Автодополнение города через Open-Meteo Geocoding (бесплатно, без ключа, CORS-ok).
 * Подсказывает реальные города по мере ввода — это и UX, и страховка от кривого
 * названия, из-за которого серверный геокодинг падал и карта не строилась.
 * При выборе отдаёт чистую строку "Город, Регион, Страна" (+ координаты, если нужны).
 */

type City = {
  name: string;
  country?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

type Props = {
  value: string;
  onChange: (value: string, coords?: { lat: number; lon: number; timezone?: string }) => void;
  placeholder?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  language?: 'ru' | 'en';
  id?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
};

export const CityAutocomplete: React.FC<Props> = ({
  value,
  onChange,
  placeholder,
  inputRef,
  language = 'ru',
  id,
  ariaLabel,
  ariaDescribedBy,
  ariaInvalid,
}) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<City[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);
  const justSelectedRef = useRef(false);
  const generatedId = useId().replace(/:/g, '');
  const inputId = id || `city-autocomplete-${generatedId}`;
  const listboxId = `${inputId}-listbox`;

  useEffect(() => {
    if (justSelectedRef.current) { justSelectedRef.current = false; return; }
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    const q = value.trim();
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (q.length < 2) {
      setItems([]);
      setOpen(false);
      setActiveIndex(-1);
      return () => controller.abort();
    }
    debounceRef.current = window.setTimeout(async () => {
      try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=${language}&format=json`;
        const res = await fetch(url, { signal: controller.signal });
        const data = await res.json();
        if (controller.signal.aborted || requestId !== requestIdRef.current) return;
        const results: City[] = Array.isArray(data?.results) ? data.results : [];
        setItems(results);
        setOpen(results.length > 0);
        setActiveIndex(results.length > 0 ? 0 : -1);
      } catch (requestError) {
        if (controller.signal.aborted || requestId !== requestIdRef.current) return;
        if ((requestError as { name?: string })?.name === 'AbortError') return;
        setItems([]);
        setOpen(false);
        setActiveIndex(-1);
      }
    }, 280);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      controller.abort();
    };
  }, [value, language]);

  const label = (c: City) => [c.name, c.admin1, c.country].filter(Boolean).join(', ');

  const select = (c: City) => {
    requestIdRef.current += 1;
    justSelectedRef.current = true;
    onChange(label(c), { lat: c.latitude, lon: c.longitude, timezone: c.timezone });
    setItems([]);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (!items.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => index < items.length - 1 ? index + 1 : 0);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => index > 0 ? index - 1 : items.length - 1);
      return;
    }
    if (event.key === 'Home' && open) {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === 'End' && open) {
      event.preventDefault();
      setActiveIndex(items.length - 1);
      return;
    }
    if (event.key === 'Enter' && open && activeIndex >= 0) {
      event.preventDefault();
      select(items[activeIndex]);
    }
  };

  return (
    <div className="city-ac">
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        className="fresh-input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          requestIdRef.current += 1;
          setActiveIndex(-1);
          onChange(e.target.value);
        }}
        onFocus={() => {
          if (items.length) {
            setOpen(true);
            setActiveIndex((index) => index >= 0 ? index : 0);
          }
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        role="combobox"
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid || undefined}
      />
      {open && items.length ? (
        <div className="city-ac-list" id={listboxId} role="listbox">
          {items.map((c, i) => (
            <button
              type="button"
              key={`${c.name}-${c.latitude}-${c.longitude}-${i}`}
              className="city-ac-item"
              id={`${listboxId}-option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              tabIndex={-1}
              style={i === activeIndex ? { background: 'var(--fresh-surface)' } : undefined}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(c)}
            >
              {label(c)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
