import React, { useEffect, useRef, useState } from 'react';
import chrome from './NeboChrome.module.css';
import { ArrowRight, ArrowLeft, X, Bookmark, Orbit, UsersRound, BookOpen, Settings2, Sun, Search, Moon, Menu, Plus, Bell, CalendarDays, LockKeyhole, Home, ShieldCheck, MessageCircle, Crown, FolderHeart, History, UserRound, Sparkles, BriefcaseBusiness, type LucideIcon } from 'lucide-react';

export const ART_NAMES = ['today','week','month','zodiac','natal-chart','compatibility','matrix-destiny','saved-cards','people','history','premium','encyclopedia','settings','support','notifications','search','profile','security','aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces','welcome','premium-wide','saved-wide','support-wide'] as const;
export type ArtName = typeof ART_NAMES[number] | 'sun' | 'rings' | 'matrix' | 'natal-pages' | 'flower' | 'work-pages' | 'home-heart' | 'home-notebook' | 'home-flower' | 'home-briefcase' | 'home-sprout' | 'home-stones' | 'home-olive';
const aliases: Partial<Record<ArtName, typeof ART_NAMES[number]>> = {sun:'today', rings:'compatibility', matrix:'matrix-destiny', 'natal-pages':'natal-chart', flower:'zodiac', 'work-pages':'saved-cards'};
const artwork: Partial<Record<ArtName, string>> = {
  today:'today', welcome:'today', month:'horizon', 'natal-chart':'natal-chart', compatibility:'compatibility-rings',
  'matrix-destiny':'matrix', 'saved-cards':'saved-cards', 'saved-wide':'saved-cards', premium:'premium', 'premium-wide':'premium',
  'home-heart':'home-heart-v1', 'home-notebook':'home-notebook-v1', 'home-flower':'home-flower-v1',
  'home-briefcase':'home-briefcase-v1', 'home-sprout':'home-sprout-v1', 'home-stones':'home-stones-v1', 'home-olive':'home-olive-branch-v1',
};
const utilityArt: Partial<Record<ArtName, LucideIcon>> = {week:CalendarDays, zodiac:Sparkles, people:UsersRound, history:History, encyclopedia:BookOpen, settings:Settings2, support:MessageCircle, 'support-wide':MessageCircle, notifications:Bell, search:Search, profile:UserRound, security:ShieldCheck};
const signs = new Set<string>(ART_NAMES.slice(18, 30));

type ArtMotion = 'orbit' | 'float' | 'lift';

/** Artwork is separate from text and interactive controls; source images retain their alpha. */
export function Art({name, className='', size, alt='', motion}: {name:ArtName;className?:string;size?:number;alt?:string;motion?:ArtMotion}) {
  const element = useRef<HTMLSpanElement>(null);
  const [moving, setMoving] = useState(false);
  useEffect(() => {
    if (!motion || !element.current || typeof IntersectionObserver === 'undefined') return;
    let visible = false;
    const update = () => setMoving(visible && document.visibilityState === 'visible');
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= .35;
      update();
    }, { threshold: [0, .35] });
    observer.observe(element.current);
    document.addEventListener('visibilitychange', update);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, [motion]);
  const canonical = aliases[name] || name;
  const source = artwork[canonical];
  const src = source ? `/assets/nebo-refined/${source}.webp` : signs.has(canonical) ? `/zodiac/sign_illustration_${canonical}.png` : null;
  const Icon = utilityArt[canonical] || Orbit;
  return <span ref={element} className={`nebo-art${src ? '' : ' nebo-art-symbol'} ${className}`} data-motion={motion} data-moving={motion ? moving : undefined} style={size ? {width:size,height:size} : undefined} aria-hidden={!alt || undefined} role={alt ? 'img' : undefined} aria-label={alt || undefined}>
    {src ? <img src={src} width={512} height={512} alt="" draggable={false} decoding="async"/> : <Icon strokeWidth={1.5} aria-hidden="true"/>}
  </span>;
}
export type GlyphName = 'next'|'back'|'close'|'bookmark'|'chart'|'people'|'book'|'settings'|'sun'|'search'|'moon'|'menu'|'plus'|'bell'|'calendar'|'lock'|'home'|'shield'|'message'|'crown'|'saved'|'history'|'work';
const glyphs: Record<GlyphName, LucideIcon> = {next:ArrowRight,back:ArrowLeft,close:X,bookmark:Bookmark,chart:Orbit,people:UsersRound,book:BookOpen,settings:Settings2,sun:Sun,search:Search,moon:Moon,menu:Menu,plus:Plus,bell:Bell,calendar:CalendarDays,lock:LockKeyhole,home:Home,shield:ShieldCheck,message:MessageCircle,crown:Crown,saved:FolderHeart,history:History,work:BriefcaseBusiness};
export function Glyph({name='book',size=22}: {name?:GlyphName;size?:number}) { const Icon=glyphs[name]; return <Icon size={size} strokeWidth={1.7} aria-hidden="true"/>; }
export function Header({name='',title,onBack,onPeople,onProfile,onNotifications}: {name?:string;title?:string;onBack?:()=>void;onPeople?:()=>void;onProfile?:()=>void;onNotifications?:()=>void;onEscape?:()=>void}) {
  const back = () => {
    const detail = { handled: false };
    window.dispatchEvent(new CustomEvent('lumia:native-back', { detail }));
    if (!detail.handled) onBack?.();
  };
  return <header className={`nebo-header ${chrome.header}`} data-back={Boolean(onBack)}>
    {onBack ? <button type="button" className="nebo-icon-button" onClick={back} aria-label="Назад"><Glyph name="back" size={19}/></button> : null}
    <span className="nebo-wordmark" aria-label="NEBO">NEBO</span>
    {title ? <span className="nebo-header-title">{title}</span> : <span className="nebo-header-spacer"/>}
    {onNotifications ? <button type="button" className="nebo-header-bell" onClick={onNotifications} aria-label="Уведомления"><Glyph name="bell"/></button> : null}
    {onPeople || onProfile ? <button type="button" className="nebo-avatar" onClick={onPeople || onProfile} aria-label={onPeople ? 'Мои карты и люди' : 'Открыть профиль'} title={onPeople ? 'Твоя карта и сохранённые люди' : name}><Glyph name="people" size={21}/></button> : null}
  </header>;
}
export function birthLine(p:{birthDate?:string;birthTime?:string;birthTimeMode?:string|null;birthPlace?:string;language?:string}):string {
  const date = p.birthDate ? new Date(`${p.birthDate.slice(0,10)}T12:00:00Z`) : null;
  const text = date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat(p.language === 'en' ? 'en-GB' : 'ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(date).replace(' г.','') : p.birthDate || '';
  const time = p.birthTimeMode === 'unknown' ? '' : p.birthTime?.slice(0,5);
  return [text,time,p.birthPlace].filter(Boolean).join(', ');
}
export function ProductCard({title,subtitle,art,tone='lilac',label,onClick,motion}: {title:string;subtitle?:string;art:ArtName;tone?:string;label?:string;onClick:()=>void;motion?:ArtMotion}) {
  return <button type="button" className={`nebo-product nebo-tone-${tone}`} onClick={onClick}>
    <span className="nebo-product-copy"><span className="nebo-product-title">{title}</span>{subtitle ? <span className="nebo-product-caption">{subtitle}</span> : null}</span>
    <Art name={art} motion={motion}/><span className="nebo-product-arrow"><Glyph name="next" size={19}/></span>
    {label ? <span className="nebo-product-badge">{label}</span> : null}
  </button>;
}
export function ActionRow({title,subtitle,onClick,icon='book'}:{title:string;subtitle?:string|null;onClick:()=>void;icon?:GlyphName}) {
  return <button type="button" className="nebo-action-row" onClick={onClick}><Glyph name={icon}/><span><strong>{title}</strong>{subtitle ? <small>{subtitle}</small> : null}</span><Glyph name="next" size={18}/></button>;
}
