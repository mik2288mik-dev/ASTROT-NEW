import React from 'react';
import { ZodiacIcon, type ZodiacSignKey } from '../icons/ZodiacIcon';

const GOLD = '#be8757';
const GOLD_LIGHT = '#e8c9aa';
const INK = '#202020';

export const MeouSpark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={`meou-spark${className ? ` ${className}` : ''}`} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <path d="M16 0C16.8 10.2 21.8 15.2 32 16C21.8 16.8 16.8 21.8 16 32C15.2 21.8 10.2 16.8 0 16C10.2 15.2 15.2 10.2 16 0Z" />
  </svg>
);

export const DayClockArtwork: React.FC = () => (
  <svg className="meou-day-art" viewBox="0 0 360 338" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="meou-clock-shell" x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#fffdfa" />
        <stop offset="0.45" stopColor="#eee9e1" />
        <stop offset="1" stopColor="#cbc3b9" />
      </linearGradient>
      <linearGradient id="meou-clock-bevel" x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#fdfbf7" />
        <stop offset="1" stopColor="#aaa39b" />
      </linearGradient>
      <linearGradient id="meou-clock-screen" x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#101010" />
        <stop offset="1" stopColor="#020202" />
      </linearGradient>
      <filter id="meou-clock-shadow" x="-30%" y="-30%" width="160%" height="190%">
        <feDropShadow dx="0" dy="16" stdDeviation="12" floodColor="#6e6358" floodOpacity="0.24" />
      </filter>
    </defs>
    <path d="M-14 274C58 342 258 342 382 135" fill="none" stroke={GOLD_LIGHT} strokeWidth="1" />
    <path d="M159 53L374-67" fill="none" stroke={GOLD_LIGHT} strokeWidth="1" />
    <circle cx="165" cy="50" r="3" fill={GOLD} />
    <circle cx="308" cy="286" r="3.5" fill={GOLD} />
    <g filter="url(#meou-clock-shadow)" transform="translate(42 92)">
      <path d="M19 15L32 5H259L273 17V156L259 170H29L16 157Z" fill="#c8c0b7" />
      <rect x="24" y="0" width="248" height="166" rx="28" fill="url(#meou-clock-shell)" transform="rotate(-1 148 83)" />
      <path d="M40 20L54 11H250L261 23V142L250 154H50L37 142Z" fill="url(#meou-clock-bevel)" />
      <rect x="45" y="18" width="207" height="126" rx="13" fill="#1b1b1b" />
      <rect x="51" y="24" width="195" height="114" rx="9" fill="url(#meou-clock-screen)" stroke="#4e4e4e" strokeWidth="1.2" />
      <path d="M57 30H238" stroke="#868686" strokeOpacity="0.42" />
      <text x="109" y="66" fill="#f2f0ed" fontFamily="Arial, sans-serif" fontSize="22" fontWeight="300" letterSpacing="1">18</text>
      <text x="150" y="66" fill="#f2f0ed" fontFamily="Arial, sans-serif" fontSize="22" fontWeight="300" letterSpacing="1">АВГ</text>
      <text x="92" y="112" fill="#f2f0ed" fontFamily="Arial, sans-serif" fontSize="25" fontWeight="300" letterSpacing="0.5">ПН / 09:41</text>
      <rect x="56" y="162" width="13" height="18" rx="3" fill="#9e9992" />
      <rect x="226" y="162" width="13" height="18" rx="3" fill="#9e9992" />
      <rect x="69" y="160" width="159" height="5" rx="2.5" fill="#cdc6be" />
    </g>
  </svg>
);

const signs: ZodiacSignKey[] = [
  'aries', 'pisces', 'aquarius', 'capricorn', 'sagittarius', 'scorpio',
  'libra', 'virgo', 'leo', 'cancer', 'gemini', 'taurus',
];

const radialPoint = (index: number, radius: number) => {
  const angle = (index * 30 - 90) * (Math.PI / 180);
  return { x: 180 + Math.cos(angle) * radius, y: 180 + Math.sin(angle) * radius };
};

export const NatalWheelArtwork: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const polygon = [radialPoint(10.1, 77), radialPoint(1.9, 77), radialPoint(4.1, 77), radialPoint(6.9, 77), radialPoint(8.4, 77), radialPoint(11.2, 77)];
  const markerIndexes = [10.1, 1.9, 4.1, 6.9, 8.4];

  return (
    <svg className={`meou-natal-wheel${compact ? ' meou-natal-wheel--compact' : ''}`} viewBox="0 0 360 360" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="meou-natal-node" cx="32%" cy="25%" r="70%">
          <stop stopColor="#fffaf2" />
          <stop offset="0.45" stopColor="#ddc3aa" />
          <stop offset="1" stopColor="#9e6e49" />
        </radialGradient>
        <filter id="meou-natal-node-shadow" x="-60%" y="-60%" width="220%" height="240%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.2" floodColor="#815331" floodOpacity="0.3" />
        </filter>
      </defs>
      <g fill="none" stroke={GOLD} strokeOpacity="0.46">
        <circle cx="180" cy="180" r="169" />
        <circle cx="180" cy="180" r="157" />
        <circle cx="180" cy="180" r="139" />
        <circle cx="180" cy="180" r="106" />
        <circle cx="180" cy="180" r="88" strokeOpacity="0.28" />
        {signs.map((sign, index) => {
          const outer = radialPoint(index, 157);
          const inner = radialPoint(index, 106);
          return <line key={`spoke-${sign}`} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} strokeOpacity="0.36" />;
        })}
        {Array.from({ length: 60 }).map((_, index) => {
          const outer = radialPoint(index / 5, 156);
          const inner = radialPoint(index / 5, index % 5 === 0 ? 150 : 153);
          return <line key={`tick-${index}`} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} strokeOpacity="0.32" />;
        })}
        <polygon points={polygon.map((point) => `${point.x},${point.y}`).join(' ')} strokeOpacity="0.56" />
        <line x1={polygon[0].x} y1={polygon[0].y} x2={polygon[2].x} y2={polygon[2].y} strokeOpacity="0.48" />
        <line x1={polygon[1].x} y1={polygon[1].y} x2={polygon[4].x} y2={polygon[4].y} strokeOpacity="0.48" />
        <line x1={polygon[2].x} y1={polygon[2].y} x2={polygon[5].x} y2={polygon[5].y} strokeOpacity="0.48" />
      </g>
      {signs.map((sign, index) => {
        const point = radialPoint(index + 0.5, 130);
        return (
          <g key={sign} transform={`translate(${point.x - 11} ${point.y - 11})`} color="#a5683f">
            <ZodiacIcon sign={sign} size={22} stroke="currentColor" strokeWidth={1.35} />
          </g>
        );
      })}
      <path d="M180 167C181 175 185 179 193 180C185 181 181 185 180 193C179 185 175 181 167 180C175 179 179 175 180 167Z" fill={GOLD} fillOpacity="0.82" />
      {markerIndexes.map((index) => {
        const point = radialPoint(index, 77);
        return <circle key={index} cx={point.x} cy={point.y} r={index === 4.1 ? 9 : 6.5} fill="url(#meou-natal-node)" filter="url(#meou-natal-node-shadow)" />;
      })}
      <g fill={GOLD} opacity="0.72">
        <circle cx="12" cy="108" r="2" /><circle cx="335" cy="71" r="2" /><circle cx="349" cy="284" r="2.5" />
        <circle cx="28" cy="304" r="2" /><circle cx="317" cy="326" r="1.7" />
      </g>
    </svg>
  );
};

export const PeopleArtwork: React.FC = () => (
  <svg className="meou-people-art" viewBox="0 0 360 300" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="meou-person-left" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f5dfc5" stopOpacity="0.54" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
      <linearGradient id="meou-person-right" x1="1" y1="0" x2="0" y2="1"><stop stopColor="#e8ebed" stopOpacity="0.58" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
    </defs>
    <path d="M-18 274C63 318 270 317 382 248" fill="none" stroke={GOLD_LIGHT} />
    <circle cx="117" cy="137" r="91" fill="url(#meou-person-left)" stroke={GOLD} strokeOpacity="0.48" />
    <circle cx="243" cy="137" r="91" fill="url(#meou-person-right)" stroke="#9ca0a3" strokeOpacity="0.48" />
    <circle cx="180" cy="137" r="104" fill="none" stroke={GOLD} strokeOpacity="0.23" />
    <g fill="none" stroke="#54575a" strokeWidth="1.5">
      <circle cx="105" cy="126" r="9" />
      <path d="M89 153C90 140 97 135 105 135C113 135 120 140 121 153Z" />
      <circle cx="255" cy="126" r="9" />
      <path d="M239 153C240 140 247 135 255 135C263 135 270 140 271 153Z" />
    </g>
    <path d="M180 122C181 131 186 136 195 137C186 138 181 143 180 152C179 143 174 138 165 137C174 136 179 131 180 122Z" fill={GOLD} />
    <circle cx="315" cy="280" r="3" fill={GOLD} />
  </svg>
);

export const ChoiceOrbitArtwork: React.FC = () => (
  <svg className="meou-choice-art" viewBox="0 0 360 188" aria-hidden="true" focusable="false">
    <ellipse cx="176" cy="76" rx="135" ry="67" transform="rotate(-11 176 76)" fill="none" stroke={GOLD_LIGHT} />
    <ellipse cx="178" cy="78" rx="41" ry="29" transform="rotate(-11 178 78)" fill="none" stroke={GOLD_LIGHT} />
    <ellipse cx="178" cy="78" rx="30" ry="21" transform="rotate(-11 178 78)" fill="none" stroke={GOLD_LIGHT} />
    <ellipse cx="178" cy="78" rx="18" ry="13" transform="rotate(-11 178 78)" fill="none" stroke={GOLD_LIGHT} />
    <path d="M178 65C179 72 183 77 191 78C183 79 179 84 178 91C177 84 173 79 165 78C173 77 177 72 178 65Z" fill={GOLD} />
    <circle cx="71" cy="117" r="3" fill={GOLD} /><circle cx="289" cy="45" r="3.5" fill={GOLD} />
    <path d="M289 45L382-38" stroke={GOLD_LIGHT} />
  </svg>
);

export const BirthOrbitArtwork: React.FC = () => (
  <svg className="meou-birth-art" viewBox="0 0 220 126" aria-hidden="true" focusable="false">
    <path d="M4 120C82 107 136 72 218 0" fill="none" stroke={GOLD_LIGHT} />
    <path d="M34 124C105 102 156 60 220 6" fill="none" stroke={GOLD_LIGHT} />
    <path d="M66 125C129 96 172 55 220 13" fill="none" stroke={GOLD_LIGHT} />
    <circle cx="3" cy="120" r="3" fill={GOLD} /><circle cx="164" cy="57" r="2.5" fill={GOLD} />
    <circle cx="105" cy="45" r="11" fill="none" stroke={GOLD_LIGHT} /><circle cx="94" cy="53" r="2" fill={GOLD} />
    <path d="M47 98C47.5 103 50 105.5 55 106C50 106.5 47.5 109 47 114C46.5 109 44 106.5 39 106C44 105.5 46.5 103 47 98Z" fill={GOLD} />
  </svg>
);
