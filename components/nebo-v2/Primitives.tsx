import React from 'react';
export const ART_NAMES = ['today','week','month','zodiac','natal-chart','compatibility','matrix-destiny','saved-cards','people','history','premium','encyclopedia','settings','support','notifications','search','profile','security','aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces','welcome','premium-wide','saved-wide','support-wide'] as const;
export type ArtName = typeof ART_NAMES[number] | 'sun' | 'rings' | 'matrix' | 'natal-pages' | 'flower' | 'work-pages';
const aliases: Partial<Record<ArtName, typeof ART_NAMES[number]>> = {sun:'today',rings:'compatibility',matrix:'matrix-destiny','natal-pages':'natal-chart',flower:'zodiac','work-pages':'saved-cards'};
/** Artwork only: never rasterize text, navigation or a calculated chart. */
export function Art({name,className='',size,alt=''}: {name:ArtName;className?:string;size?:number;alt?:string}) {
  const canonical = aliases[name] || name;
  const index = ART_NAMES.indexOf(canonical as typeof ART_NAMES[number]);
  if (index < 0) return null;
  const style: React.CSSProperties = {backgroundImage:'url(/nebo-v2/art-atlas.webp)',backgroundSize:'600% 600%',backgroundPosition:`${(index%6)*20}% ${Math.floor(index/6)*20}%`,...(size?{width:size,height:size}:{})};
  return <span className={`nebo-art ${className}`} style={style} role={alt?'img':undefined} aria-label={alt||undefined} aria-hidden={alt?undefined:true}/>;
}
export type GlyphName='next'|'back'|'close'|'bookmark'|'chart'|'people'|'book'|'settings'|'sun'|'search'|'moon'|'menu'|'plus'|'bell';
const paths: Record<GlyphName,React.ReactNode> = {
  next:<path d="m9 5 7 7-7 7"/>,back:<path d="m15 5-7 7 7 7"/>,close:<path d="m6 6 12 12M18 6 6 18"/>,
  bookmark:<path d="M6 4h12v17l-6-4-6 4z"/>,chart:<><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><path d="M12 3v6m0 6v6M3 12h6m6 0h6"/></>,
  people:<><circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v2"/></>,
  book:<path d="M12 6C9 4 5 4 3 5v15c3-1 6-1 9 1 3-2 6-2 9-1V5c-2-1-6-1-9 1zM12 6v15"/>,
  settings:<><circle cx="12" cy="12" r="3"/><path d="m9 3 6 0 1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z"/></>,
  sun:<><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></>,
  search:<><circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/></>,moon:<path d="M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 11z"/>,menu:<path d="M4 6h16M4 12h16M4 18h16"/>,plus:<path d="M12 4v16M4 12h16"/>,
  bell:<><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5zM10 21h4"/></>,
};
export function Glyph({name='book',size=22}: {name?:GlyphName;size?:number}) {return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;}
export function Header({name='',title,onBack,onProfile,onNotifications,onEscape}: {name?:string;title?:string;onBack?:()=>void;onProfile?:()=>void;onNotifications?:()=>void;onEscape?:()=>void}) {
  void onEscape;
  return <header className="nebo-header">
    {onBack?<button type="button" className="nebo-icon-button" onClick={onBack} aria-label="Назад"><Glyph name="back"/></button>:<span className="nebo-wordmark">NEBO</span>}
    {title?<span className="nebo-header-title">{title}</span>:<span className="nebo-header-spacer"/>}
    {onNotifications?<button type="button" className="nebo-header-bell" onClick={onNotifications} aria-label="Уведомления"><Glyph name="bell" size={23}/></button>:<span className="nebo-header-bell" aria-hidden="true"><Glyph name="bell" size={23}/></span>}
    {onProfile?<button type="button" className="nebo-avatar" onClick={onProfile} aria-label="Открыть профиль">{name.trim().slice(0,1).toUpperCase()||<Glyph name="people"/>}</button>:null}
  </header>;
}
export function birthLine(p:{birthDate?:string;birthTime?:string;birthPlace?:string}):string {
  const date=p.birthDate?new Date(`${p.birthDate.slice(0,10)}T12:00:00Z`):null;
  const text=date&&!Number.isNaN(date.getTime())?new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(date).replace(' г.',''):p.birthDate||'';
  return [text,p.birthTime,p.birthPlace].filter(Boolean).join(', ');
}
export function ProductCard({title,subtitle,art,tone='lilac',label,onClick}: {title:string;subtitle?:string;art:ArtName;tone?:string;label?:string;onClick:()=>void}) {return <button type="button" className={`nebo-product nebo-tone-${tone}`} onClick={onClick}><span className="nebo-product-title">{title}</span>{subtitle?<span className="nebo-product-caption">{subtitle}</span>:null}<Art name={art}/>{label?<span className="nebo-product-badge">{label}</span>:null}</button>;}
export function ActionRow({title,subtitle,onClick,icon='book'}:{title:string;subtitle?:string|null;onClick:()=>void;icon?:GlyphName}) {return <button type="button" className="nebo-action-row" onClick={onClick}><Glyph name={icon}/><span><strong>{title}</strong>{subtitle?<small>{subtitle}</small>:null}</span><Glyph name="next" size={18}/></button>;}
