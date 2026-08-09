import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { UserProfile } from '../types';
import { ensureTelegramFullscreen } from '../lib/telegramFullscreen';
import { NatalChartIcon, HeartIcon } from '../components/icons/UiIcons';
import { ZodiacIcon } from '../components/icons/ZodiacIcon';
import { sunSignFromDate } from '../lib/synastry/compatScore';
import { getZodiacSign } from '../constants';
import { CityAutocomplete } from '../components/ui/CityAutocomplete';
import type { BirthTimeMode, BirthTimeUncertaintyMinutes } from '../lib/birthTime';

interface OnboardingProps { onComplete: (profile: UserProfile) => Promise<void>; }
type FieldKey = 'name' | 'date' | 'time' | 'place';
type ErrorField = FieldKey | 'uncertainty' | null;

const SparkIcon = ({ size = 52 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M12 3l1.9 5.3L19 10l-5.1 1.7L12 17l-1.9-5.3L5 10l5.1-1.7L12 3z" fill="currentColor" /><circle cx="18.5" cy="5.5" r="1.4" fill="currentColor" /></svg>
);

type Story = { color: string; icon: React.ReactNode; title: string; text: string };
const STORIES: Story[] = [
  { color:'#1478FF', icon:<NatalChartIcon size={52}/>, title:'Разбор натальной карты', text:'Характер, привычные реакции, сильные и слабые места — по дате, времени и месту рождения.' },
  { color:'#2563EB', icon:<ZodiacIcon sign="leo" size={56} strokeWidth={1.2}/>, title:'Личный гороскоп', text:'Прогнозы на сегодня, неделю и месяц рассчитываются по твоей натальной карте.' },
  { color:'#38BDF8', icon:<HeartIcon size={52}/>, title:'Совместимость', text:'Сравни две карты: что помогает договориться, где чаще начинаются проблемы и что каждый понимает по-своему.' },
  { color:'#64748B', icon:<SparkIcon size={52}/>, title:'Больше в Premium', text:'Подробные разборы отношений, денег и работы, все периоды прогноза и ответы на личные вопросы.' },
];
export const Onboarding:React.FC<OnboardingProps>=({onComplete})=>{
  const [step,setStep]=useState<'stories'|'birth'>('stories');
  const [storyIndex,setStoryIndex]=useState(0);
  const [name,setName]=useState('');
  const [gender,setGender]=useState<'male'|'female'|'unspecified'>('unspecified');
  const [date,setDate]=useState('');
  const [time,setTime]=useState('');
  const [timeMode,setTimeMode]=useState<Exclude<BirthTimeMode,'range'>>('exact');
  const [uncertainty,setUncertainty]=useState<BirthTimeUncertaintyMinutes|null>(null);
  const [place,setPlace]=useState('');
  const [placeCoords,setPlaceCoords]=useState<{lat:number;lon:number;timezone?:string}|null>(null);
  const [notify,setNotify]=useState(true);
  const [error,setError]=useState('');
  const [errorField,setErrorField]=useState<ErrorField>(null);
  const [isSubmitting,setIsSubmitting]=useState(false);
  const submittingRef=useRef(false);
  const nameRef=useRef<HTMLInputElement|null>(null);
  const dateRef=useRef<HTMLInputElement|null>(null);
  const timeRef=useRef<HTMLInputElement|null>(null);
  const placeRef=useRef<HTMLInputElement|null>(null);

  useEffect(()=>{ const tg=(window as any).Telegram?.WebApp; if(tg?.initDataUnsafe?.user)setName(tg.initDataUnsafe.user.first_name||''); ensureTelegramFullscreen(); },[]);

  const signHint=useMemo(()=>{const sign=sunSignFromDate(date);return sign?getZodiacSign('ru',sign):'';},[date]);

  const focusField=(field:FieldKey)=>{const refs:Record<FieldKey,React.RefObject<HTMLInputElement|null>>={name:nameRef,date:dateRef,time:timeRef,place:placeRef};refs[field].current?.focus();};
  const nextStory=()=>storyIndex<STORIES.length-1?setStoryIndex((value)=>value+1):setStep('birth');
  const clearError=()=>{setError('');setErrorField(null);};
  const chooseTimeMode=(mode:Exclude<BirthTimeMode,'range'>)=>{setTimeMode(mode);clearError();if(mode==='unknown'){setTime('');setUncertainty(null);}else if(mode==='exact'){setUncertainty(null);}};

  const handleSubmit=async()=>{
    if(submittingRef.current)return;
    if(!name.trim()){setError('Укажи имя.');setErrorField('name');focusField('name');return;}
    if(!date){setError('Укажи дату рождения.');setErrorField('date');focusField('date');return;}
    if(timeMode!=='unknown'&&!time){setError('Укажи время рождения.');setErrorField('time');focusField('time');return;}
    if(timeMode==='approximate'&&!uncertainty){setError('Укажи погрешность времени.');setErrorField('uncertainty');return;}
    if(!place.trim()){setError('Укажи место рождения.');setErrorField('place');focusField('place');return;}
    submittingRef.current=true;setIsSubmitting(true);clearError();
    try{
      await onComplete({
        name:name.trim(),gender,birthDate:date,birthTime:timeMode==='unknown'?'':time,
        birthTimeMode:timeMode,birthTimeUncertaintyMinutes:timeMode==='approximate'?uncertainty:null,
        birthTimeRangeStart:null,birthTimeRangeEnd:null,birthPlace:place.trim(),
        birthLatitude:placeCoords?.lat??null,birthLongitude:placeCoords?.lon??null,birthTimezone:placeCoords?.timezone??null,
        isSetup:false,language:'ru',theme:'light',isPremium:false,notificationFrequency:notify?'daily':'important',
      });
    }catch(submitError:any){setErrorField(null);setError(submitError?.message||'Не удалось сохранить данные и рассчитать карту. Попробуй ещё раз.');}
    finally{submittingRef.current=false;setIsSubmitting(false);}
  };

  return <div className="fresh-page lumia-main-scroll onboarding-editorial-page" style={{display:'flex',flexDirection:'column',minHeight:'100dvh',paddingBottom:'calc(max(env(safe-area-inset-bottom, 0px), var(--tg-content-safe-area-inset-bottom, 0px)) + 16px)'}}>
    <div style={{padding:'4px 20px 0'}}><p className="lumia-brand-wordmark">Твой Гороскоп</p></div>
    {step==='stories'?<div style={{display:'flex',flex:1,flexDirection:'column',maxWidth:'28rem',width:'100%',margin:'0 auto'}}>
      <div className="onb-dots">{STORIES.map((_,index)=><span key={index} className={`onb-dot ${index===storyIndex?'is-on':''}`}/>)}</div>
      <div className="onb-stage" onClick={nextStory}><AnimatePresence mode="wait"><motion.div key={storyIndex} initial={{opacity:0,x:40}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-40}} transition={{duration:.28,ease:[.22,1,.36,1]}} className="onb-card">
        <div className="onb-hero"><span className="onb-hero-ico">{STORIES[storyIndex].icon}</span></div>
        <h1 className="onb-title">{STORIES[storyIndex].title}</h1><p className="onb-text">{STORIES[storyIndex].text}</p>
      </motion.div></AnimatePresence></div>
      <div style={{padding:'0 20px'}}><button type="button" className="fresh-btn-primary" style={{width:'100%',margin:0}} onClick={nextStory}>{storyIndex<STORIES.length-1?'Дальше':'Ввести данные рождения'}</button><button type="button" className="onb-skip" style={{minHeight:44}} onClick={()=>setStep('birth')}>Перейти к данным</button></div>
    </div>:<div style={{display:'flex',flex:1,flexDirection:'column',maxWidth:'28rem',width:'100%',margin:'0 auto'}}>
      <div style={{padding:'8px 20px 0'}}><h1 className="fresh-page-title" style={{maxWidth:'18rem'}}>Данные для расчёта</h1><p style={{marginTop:12,maxWidth:'21rem',fontSize:14.5,lineHeight:1.55,color:'var(--fresh-muted)'}}>Дата, время и место рождения нужны для точного расчёта. Часовой пояс определим по городу и дате.</p></div>
      <div style={{display:'flex',flexDirection:'column',gap:18,padding:'22px 20px 0'}}>
        <div>
          <label className="fresh-field-label" htmlFor="onboarding-name">Имя</label>
          <input id="onboarding-name" ref={nameRef} type="text" value={name} onChange={(event)=>{setName(event.target.value);clearError();}} className="fresh-input" placeholder="Как к тебе обращаться" aria-invalid={errorField==='name'||undefined} aria-describedby={errorField==='name'?'onboarding-error':undefined}/>
        </div>
        <div><span id="onboarding-gender-label" className="fresh-field-label">Пол</span><div role="group" aria-labelledby="onboarding-gender-label" style={{display:'flex',gap:8,marginTop:6}}>{([['male','Мужской'],['female','Женский'],['unspecified','Не указывать']] as const).map(([value,label])=><button key={value} type="button" onClick={()=>setGender(value)} aria-pressed={gender===value} style={{minHeight:44}} className={`onb-gender ${gender===value?'is-on':''}`}>{label}</button>)}</div></div>
        <div>
          <label className="fresh-field-label" htmlFor="onboarding-birth-date">Дата рождения</label>
          <input id="onboarding-birth-date" ref={dateRef} type="date" value={date} onChange={(event)=>{setDate(event.target.value);clearError();}} className="fresh-input" aria-invalid={errorField==='date'||undefined} aria-describedby={errorField==='date'?'onboarding-error':undefined}/>
        </div>
        <div><span id="onboarding-time-mode-label" className="fresh-field-label">Время рождения</span><div role="group" aria-labelledby="onboarding-time-mode-label" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginTop:6}}>
          {([['exact','Знаю точно'],['approximate','Знаю примерно'],['unknown','Не знаю']] as const).map(([value,label])=><button key={value} type="button" onClick={()=>chooseTimeMode(value)} aria-pressed={timeMode===value} style={{minHeight:44}} className={`onb-gender ${timeMode===value?'is-on':''}`}>{label}</button>)}
        </div></div>
        {timeMode!=='unknown'?<div><label className="fresh-field-label" htmlFor="onboarding-birth-time">Часы и минуты</label><input id="onboarding-birth-time" ref={timeRef} type="time" step={60} value={time} onChange={(event)=>{setTime(event.target.value);clearError();}} className="fresh-input" aria-invalid={errorField==='time'||undefined} aria-describedby={errorField==='time'?'onboarding-error':undefined}/></div>:null}
        {timeMode==='approximate'?<div><span id="onboarding-uncertainty-label" className="fresh-field-label">Погрешность</span><div role="group" aria-labelledby="onboarding-uncertainty-label" aria-describedby={errorField==='uncertainty'?'onboarding-error':undefined} style={{display:'flex',gap:8,marginTop:6}}>{([15,30,60] as const).map((minutes)=><button key={minutes} type="button" onClick={()=>{setUncertainty(minutes);clearError();}} aria-pressed={uncertainty===minutes} style={{minHeight:44}} className={`onb-gender ${uncertainty===minutes?'is-on':''}`}>{minutes===60?'до 1 часа':`до ${minutes} минут`}</button>)}</div></div>:null}
        {timeMode==='unknown'?<p style={{margin:'-6px 0 0',fontSize:13,lineHeight:1.45,color:'var(--fresh-muted)'}}>Время не подставляем. Дома, Асцендент и MC не считаем.</p>:timeMode==='approximate'?<p style={{margin:'-6px 0 0',fontSize:13,lineHeight:1.45,color:'var(--fresh-muted)'}}>Проверим весь диапазон и отметим только то, что в нём не меняется.</p>:null}
        {signHint?<p style={{margin:'-6px 0 0',fontSize:13,fontWeight:700,color:'var(--fresh-link)'}}>Знак зодиака: {signHint}</p>:null}
        <div><label className="fresh-field-label" htmlFor="onboarding-birth-place">Место рождения</label><CityAutocomplete id="onboarding-birth-place" value={place} inputRef={placeRef} placeholder="Начни вводить город…" ariaInvalid={errorField==='place'} ariaDescribedBy={errorField==='place'?'onboarding-error':undefined} onChange={(value,coords)=>{setPlace(value);setPlaceCoords(coords??null);clearError();}}/></div>
        <button type="button" className="onb-notify" role="switch" aria-checked={notify} onClick={()=>setNotify((value)=>!value)}><span className={`onb-check ${notify?'is-on':''}`} aria-hidden>{notify?'✓':''}</span><span className="onb-notify-text">Присылать уведомления о новых прогнозах</span></button>
      </div>
      <div style={{marginTop:'auto',paddingTop:22}}>{error?<p id="onboarding-error" role="alert" style={{margin:'0 20px 12px',fontSize:12.5,lineHeight:1.45,color:'#B91C1C'}}>{error}</p>:null}<button type="button" className="fresh-btn-primary" disabled={isSubmitting} aria-busy={isSubmitting} onClick={()=>void handleSubmit()}>{isSubmitting?'Рассчитываем…':'Рассчитать карту'}</button><p style={{margin:'12px 20px 0',maxWidth:'21rem',fontSize:10.5,lineHeight:1.45,color:'var(--fresh-muted)'}}>Положения считаются по Swiss Ephemeris. Неизвестное время не заменяется выдуманным.</p></div>
    </div>}
  </div>;
};
