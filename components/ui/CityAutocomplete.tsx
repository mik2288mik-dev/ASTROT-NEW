import React, { useEffect, useRef, useState } from 'react';

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
};

export const CityAutocomplete: React.FC<Props> = ({ value, onChange, placeholder, inputRef, language = 'ru' }) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<City[]>([]);
  const debounceRef = useRef<number | null>(null);
  const justSelectedRef = useRef(false);

  useEffect(() => {
    if (justSelectedRef.current) { justSelectedRef.current = false; return; }
    const q = value.trim();
    if (q.length < 2) { setItems([]); setOpen(false); return; }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=${language}&format=json`;
        const res = await fetch(url);
        const data = await res.json();
        const results: City[] = Array.isArray(data?.results) ? data.results : [];
        setItems(results);
        setOpen(results.length > 0);
      } catch {
        setItems([]);
        setOpen(false);
      }
    }, 280);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [value, language]);

  const label = (c: City) => [c.name, c.admin1, c.country].filter(Boolean).join(', ');

  const select = (c: City) => {
    justSelectedRef.current = true;
    onChange(label(c), { lat: c.latitude, lon: c.longitude, timezone: c.timezone });
    setItems([]);
    setOpen(false);
  };

  return (
    <div className="city-ac">
      <input
        ref={inputRef}
        type="text"
        className="fresh-input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => { if (items.length) setOpen(true); }}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {open && items.length ? (
        <div className="city-ac-list">
          {items.map((c, i) => (
            <button
              type="button"
              key={`${c.name}-${c.latitude}-${c.longitude}-${i}`}
              className="city-ac-item"
              onMouseDown={(e) => { e.preventDefault(); select(c); }}
            >
              {label(c)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
