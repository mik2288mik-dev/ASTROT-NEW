import React, { useEffect, useState } from 'react';
import { ChevronRight, LifeBuoy, Sparkles } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Dashboard as ClassicDashboard } from '../../views/Dashboard';
import { Settings as ClassicSettings } from '../../views/Settings';
import { MyCharts as ClassicMyCharts } from '../../views/MyCharts';
import { ServiceScreen as ClassicServiceScreen } from '../../views/v2/ServiceScreen';
import { MatrixRoom as ClassicMatrixRoom } from '../../views/v2/MatrixRoom';
import { UnionRoom as ClassicUnionRoom } from '../../views/v2/UnionRoom';
import { useNeboDesign } from './useNeboDesign';
import { NeboDesignControl } from './NeboDesignControl';
import { NeboScreenBoundary } from './NeboScreenBoundary';
import { ActionRow, birthLine, Header, ProductCard } from './Primitives';
import { NeboMatrixRoom } from './NeboMatrixRoom';
import { NeboUnionRoom } from './NeboUnionRoom';
import { NeboMyCharts } from './NeboMyCharts';
import type { UserProfile } from '../../types';
import type { NatalMagazine as ClassicNatalType } from '../../views/v2/NatalMagazine';
const NewDashboard=dynamic(()=>import('./NeboDashboard').then(m=>m.NeboDashboard),{ssr:false});
const NewNatal=dynamic(()=>import('./NeboNatal').then(m=>m.NeboNatal),{ssr:false});
const ClassicNatal=dynamic(()=>import('../../views/v2/NatalMagazine').then(m=>m.NatalMagazine),{ssr:false});
const ClassicOnboarding=dynamic(()=>import('../../views/Onboarding').then(m=>m.Onboarding),{ssr:false});
const ClassicPaywall=dynamic(()=>import('../../views/Paywall').then(m=>m.Paywall),{ssr:false});
const ClassicEncyclopedia=dynamic(()=>import('../../views/v2/AstrologyEncyclopedia').then(m=>m.AstrologyEncyclopedia),{ssr:false});
function Boundary({profile,children}:{profile:UserProfile;children:React.ReactNode}){const design=useNeboDesign(profile);return <NeboScreenBoundary key={`${profile.id}:${design.active}`} onEscape={design.store.escapeToClassic}>{children}</NeboScreenBoundary>;}
type DashboardProps=React.ComponentProps<typeof ClassicDashboard>&{active?:boolean;onOpenSynastry:()=>void;onOpenMatrix:()=>void;onOpenSettings:()=>void};
export function Dashboard(props:DashboardProps){
  const design=useNeboDesign(props.profile);
  if(!design.active)return <ClassicDashboard {...props}/>;
  return <Boundary profile={props.profile}><NewDashboard {...props} onCreateNatalChart={props.onCreateNatalChart||props.onOpenSettings} onOpenCharts={props.onOpenCharts||props.onOpenSettings} onOpenSynastry={props.onOpenSynastry||props.onOpenSettings}/></Boundary>;
}
type NatalProps=React.ComponentProps<typeof ClassicNatalType>&{onOpenMatrix:()=>void;onOpenSettings:()=>void};
export function NatalMagazine(props:NatalProps){const design=useNeboDesign(props.profile);return design.active?<Boundary profile={props.profile}><NewNatal {...props}/></Boundary>:<ClassicNatal {...props}/>;}
export function MatrixRoom(props:React.ComponentProps<typeof ClassicMatrixRoom>){const design=useNeboDesign(props.profile);return design.active?<Boundary profile={props.profile}><NeboMatrixRoom {...props}/></Boundary>:<ClassicMatrixRoom {...props}/>;}
export function UnionRoom(props:React.ComponentProps<typeof ClassicUnionRoom>){const design=useNeboDesign(props.profile);if(!design.active||props.uiPreview)return <ClassicUnionRoom {...props}/>;return <Boundary profile={props.profile}><NeboUnionRoom {...props} uiPreview={undefined}/></Boundary>;}
export function MyCharts(props:React.ComponentProps<typeof ClassicMyCharts>){const design=useNeboDesign(props.profile);if(!design.active||props.uiPreview)return <ClassicMyCharts {...props}/>;return <Boundary profile={props.profile}><NeboMyCharts {...props}/></Boundary>;}
export function Settings(props:React.ComponentProps<typeof ClassicSettings>){
  const design=useNeboDesign(props.profile);
  return design.active
    ? <ClassicSettings {...props} presentation="nebo" appearanceControl={<NeboDesignControl profile={props.profile}/>}/>
    : <><NeboDesignControl profile={props.profile}/><ClassicSettings {...props}/></>;
}
type ServiceProps=React.ComponentProps<typeof ClassicServiceScreen>&{onOpenMatrix?:()=>void;onOpenEncyclopedia?:()=>void};
export function ServiceScreen(props:ServiceProps){
  const design=useNeboDesign(props.profile);
  const [detail,setDetail]=useState<'knowledge'|'support'|null>(null);
  const [internalTab,setInternalTab]=useState(props.initialTab || 'knowledge');
  const ru=props.profile.language!=='en';
  const tab=props.activeTab ?? internalTab;
  useEffect(() => { setDetail(null); }, [props.activeTab]);
  if(!design.active)return <ClassicServiceScreen {...props}/>;
  const selectTab=(next:typeof tab)=>{setDetail(null);setInternalTab(next);props.onTabChange?.(next);};
  const goHub=()=>selectTab('knowledge');
  if(tab==='settings'||tab==='store'||detail){
    const supportContent=React.isValidElement(props.settingsContent)
      ? React.cloneElement(props.settingsContent as React.ReactElement<{initialScreen?:'feedback';presentation?:'nebo';onBack?:()=>void}>,{key:'support',initialScreen:'feedback',presentation:'nebo',onBack:goHub})
      : props.settingsContent;
    return <div className="nebo-screen nebo-v2-shell nebo-menu-detail">
      <Header name={props.profile.name} title={detail==='support'?(ru?'Поддержка':'Support'):tab==='settings'?(ru?'Настройки':'Settings'):tab==='store'?'Premium':(ru?'Энциклопедия':'Encyclopedia')} onBack={goHub}/>
      <div className="nebo-service-detail-content">{detail==='support'?supportContent:tab==='settings'?props.settingsContent:tab==='store'?props.premiumStoreContent:<ClassicEncyclopedia embedded presentation="nebo" profile={props.profile}/>}</div>
    </div>;
  }
  return <div className="nebo-screen nebo-v2-shell nebo-menu"><Header name={props.profile.name} title={ru?'Меню':'Menu'} onPeople={props.onOpenCharts} onProfile={()=>selectTab('settings')} onEscape={design.store.escapeToClassic}/><div className="nebo-reader-scroll nebo-menu-hub">
    <button className="nebo-person-row" type="button" onClick={()=>selectTab('settings')}><span className="nebo-avatar" aria-hidden="true">{props.profile.name?.slice(0,1)||'Я'}</span><span><strong>{props.profile.name||(ru?'Мой профиль':'My profile')}</strong><small>{birthLine(props.profile)}</small></span><ChevronRight size={20} aria-hidden="true"/></button>
    <div className="nebo-menu-layout"><div className="nebo-product-grid"><ProductCard title={ru?'Сохранённые карты':'Saved charts'} subtitle={ru?'Все твои карты в одном месте':'Your charts in one place'} art="saved-cards" tone="lime" onClick={props.onOpenCharts}/>{props.onOpenMatrix?<ProductCard title={ru?'Матрица судьбы':'Destiny matrix'} subtitle={ru?'Открыть свой разбор':'Open your reading'} art="matrix" tone="blue" onClick={props.onOpenMatrix}/>:null}</div>
    <nav className="nebo-menu-links" aria-label={ru?'Разделы меню':'Menu sections'}>
      <ActionRow title={ru?'Энциклопедия':'Encyclopedia'} subtitle={ru?'Понятные ответы и объяснения':'Clear answers and explanations'} onClick={()=>props.onOpenEncyclopedia?props.onOpenEncyclopedia():setDetail('knowledge')}/>
      <ActionRow title={ru?'Настройки':'Settings'} subtitle={ru?'Профиль, уведомления и оформление':'Profile, notifications and appearance'} icon="settings" onClick={()=>selectTab('settings')}/>
      <button type="button" className="nebo-action-row" onClick={()=>setDetail('support')}><LifeBuoy size={24} strokeWidth={1.7} aria-hidden="true"/><span><strong>{ru?'Поддержка':'Support'}</strong><small>{ru?'Поможем и ответим на вопросы':'Help and answers to your questions'}</small></span><ChevronRight size={18} aria-hidden="true"/></button>
      <button type="button" className="nebo-action-row nebo-menu-premium" onClick={()=>selectTab('store')}><Sparkles size={24} strokeWidth={1.7} aria-hidden="true"/><span><strong>NEBO Premium</strong><small>{ru?'Возможности и подписка':'Features and subscription'}</small></span><ChevronRight size={18} aria-hidden="true"/></button>
    </nav></div>
  </div></div>;
}
type OnboardingProps=React.ComponentProps<typeof ClassicOnboarding>&{designProfile?:UserProfile|null};
export function Onboarding({designProfile,...props}:OnboardingProps){const design=useNeboDesign(designProfile);return design.active?<div className="nebo-v2 nebo-v2-shell nebo-onboarding-skin" data-nebo-theme={design.resolvedTheme}><ClassicOnboarding {...props} presentation="nebo"/><button className="nebo-onboarding-exit" type="button" onClick={design.store.escapeToClassic}>Старый дизайн</button></div>:<ClassicOnboarding {...props}/>;}
export function Paywall(props:React.ComponentProps<typeof ClassicPaywall>){const design=useNeboDesign(props.profile);return design.active?<div className="nebo-v2 nebo-v2-shell nebo-paywall-skin" data-nebo-theme={design.resolvedTheme}><ClassicPaywall {...props} presentation="nebo"/></div>:<ClassicPaywall {...props}/>;}
export function AstrologyEncyclopedia(props:React.ComponentProps<typeof ClassicEncyclopedia>){const design=useNeboDesign(props.profile);return <ClassicEncyclopedia {...props} presentation={design.active?'nebo':'classic'}/>;}
