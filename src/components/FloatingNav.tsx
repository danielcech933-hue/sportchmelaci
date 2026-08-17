import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType } from "react";
import {
  Home,
  CalendarDays,
  Users,
  Trophy,
  History as HistoryIcon,
  UserRound,
  ShieldCheck,
  Coins,
  MessagesSquare,
  HeartHandshake,
  MapPin,
  Beer,
  Layers,
  Dices,
  Spade,
  PackageOpen,
  ChevronUp,
  BarChart3,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { IncomingCallPrompt } from "@/components/IncomingCallPrompt";

export type NavItem = { to:string; label:string; icon:ComponentType<{className?:string}>; exact?:boolean; admin?:boolean; authOnly?:boolean; privilegedOnly?:boolean; fx?:"trophy" };
type NavGroup = { label:string; icon:ComponentType<{className?:string}>; items:NavItem[] }; type NavEntry=NavItem|NavGroup;
const RESULTS_ITEMS:NavItem[]=[{to:"/rankings",label:"Scoreboard",icon:Trophy,fx:"trophy"},{to:"/bets",label:"Sázky",icon:Coins},{to:"/history",label:"Historie",icon:HistoryIcon}];
const SPORT_ITEMS:NavItem[]=[{to:"/schedule",label:"Plán",icon:CalendarDays},{to:"/tournaments",label:"Turnaje",icon:Trophy},{to:"/teams",label:"Týmy",icon:Users},{to:"/venues",label:"Sportoviště",icon:MapPin}];
const GAME_ITEMS:NavItem[]=[{to:"/games/poker",label:"Poker",icon:Spade},{to:"/games/roulette",label:"Ruleta",icon:Dices},{to:"/games/ultimate",label:"Ultimate",icon:Layers},{to:"/slots",label:"Sloty",icon:Beer},{to:"/games/roll",label:"Roll",icon:Dices,authOnly:true},{to:"/games/case-opening",label:"Case Opening",icon:PackageOpen,privilegedOnly:true}];
const COMMUNITY_ITEMS:NavItem[]=[{to:"/chat",label:"Chat",icon:MessagesSquare},{to:"/support",label:"Podpoř nás",icon:HeartHandshake},{to:"/profile",label:"Profil",icon:UserRound,authOnly:true},{to:"/admin",label:"Admin",icon:ShieldCheck,admin:true}];
export const NAV_ITEMS:NavEntry[]=[{to:"/",label:"Lobby",icon:Home,exact:true},{label:"Sport",icon:Trophy,items:SPORT_ITEMS},{label:"Výsledky",icon:BarChart3,items:RESULTS_ITEMS},{label:"Hry",icon:Dices,items:GAME_ITEMS},{label:"Komunita",icon:Users,items:COMMUNITY_ITEMS}];
const PRIVILEGED_NAMES=new Set(["danko","chlaďar","chladar","midas","m1das"]);
export function matchesRoute(pathname:string,item:NavItem){if(item.exact)return pathname===item.to;return pathname===item.to||pathname.startsWith(item.to+"/");}
function itemIsVisible(item:NavItem,user:ReturnType<typeof useAuth>["user"],isAdmin:boolean,nickname:string|null|undefined){if(item.admin)return !!user&&isAdmin;if(item.authOnly&&!user)return false;if(item.privilegedOnly&&!PRIVILEGED_NAMES.has((nickname??"").trim().toLocaleLowerCase("cs-CZ")))return false;return true;}
function entryIsVisible(entry:NavEntry,user:ReturnType<typeof useAuth>["user"],isAdmin:boolean,nickname:string|null|undefined){if("items" in entry)return entry.items.some(i=>itemIsVisible(i,user,isAdmin,nickname));return itemIsVisible(entry,user,isAdmin,nickname);}
function groupIsActive(pathname:string,group:NavGroup){return group.items.some(i=>matchesRoute(pathname,i));}
export function FloatingNav(){const {user,nickname,isAdmin,loading}=useAuth();const pathname=useRouterState({select:s=>s.location.pathname});const [hidden,setHidden]=useState(false);const [openGroup,setOpenGroup]=useState<string|null>(null);useEffect(()=>{let last=window.scrollY;let frame=0;const onScroll=()=>{if(frame)return;frame=window.requestAnimationFrame(()=>{frame=0;const y=window.scrollY,delta=y-last;if(Math.abs(delta)<6)return;if(delta>0&&y>120)setHidden(true);else if(delta<0)setHidden(false);last=y;});};window.addEventListener("scroll",onScroll,{passive:true});return()=>{window.removeEventListener("scroll",onScroll);if(frame)window.cancelAnimationFrame(frame);};},[]);useEffect(()=>{setHidden(false);setOpenGroup(null);},[pathname]);if(loading)return null;const visible=NAV_ITEMS.filter(e=>entryIsVisible(e,user,isAdmin,nickname));return <><>{user&&<IncomingCallPrompt/>}</><nav aria-label="Hlavní navigace" className={`pointer-events-none fixed inset-x-0 bottom-3 z-[9999] flex justify-center px-2 transition-[transform,opacity] duration-300 ease-out will-change-transform sm:bottom-5 ${hidden?"translate-y-[150%] opacity-0":"translate-y-0 opacity-100"}`}><div className="nav-dock pointer-events-auto relative isolate flex max-w-[min(78rem,97vw)] items-center gap-1 overflow-x-auto rounded-[1.35rem] px-1.5 py-1.5 shadow-2xl sm:gap-1.5 sm:px-2 md:overflow-visible" onWheel={e=>{const el=e.currentTarget;if(el.scrollWidth<=el.clientWidth)return;e.preventDefault();el.scrollLeft+=e.deltaY+e.deltaX;}} onPointerDown={e=>e.stopPropagation()}><span aria-hidden className="pointer-events-none absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent opacity-80"/>{visible.map(entry=>{"items" in entry?null: null})}{visible.map((entry)=>{"items" in entry?(()=>{const Icon=entry.icon,active=groupIsActive(pathname,entry),open=openGroup===entry.label;return <div key={entry.label} className="relative shrink-0"><button type="button" onClick={()=>setOpenGroup(c=>c===entry.label?null:entry.label)} onPointerDown={e=>e.stopPropagation()} aria-expanded={open} aria-haspopup="menu" title={entry.label} className={`nav-chip group relative flex min-w-[3.4rem] shrink-0 touch-manipulation flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 transition sm:min-w-[3.8rem] ${active||open?"nav-chip-active text-primary":"text-muted-foreground hover:text-foreground"}`}><span className="relative inline-flex h-4 items-center justify-center"><Icon className={`h-4 w-4 ${active||open?"scale-110":""}`}/>{(active||open)&&<span className="absolute -bottom-1 h-0.5 w-3 rounded-full bg-primary"/>}</span><span className="flex items-center gap-0.5 whitespace-nowrap text-[7px] font-semibold uppercase sm:text-[8px]">{entry.label}<ChevronUp className={`h-2 w-2 ${open?"rotate-180":""}`}/></span></button>{open&&<div role="menu" className="absolute bottom-[calc(100%+0.55rem)] left-1/2 z-[10000] min-w-[11rem] -translate-x-1/2 rounded-2xl border border-primary/25 bg-background/95 p-1.5 shadow-2xl backdrop-blur-xl"><div className="relative grid gap-1">{entry.items.map(item=>{if(!itemIsVisible(item,user,isAdmin,nickname))return null;const ItemIcon=item.icon,itemActive=matchesRoute(pathname,item);return <Link key={item.to} to={item.to} onClick={()=>setOpenGroup(null)} role="menuitem" className={`flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${itemActive?"bg-primary/15 text-primary":"text-muted-foreground hover:bg-primary/8 hover:text-foreground"}`}><ItemIcon className="h-4 w-4"/><span className="flex-1">{item.label}</span></Link>;})}</div></div>}</div>})():(()=>{const active=matchesRoute(pathname,entry),Icon=entry.icon;return <Link key={entry.to} to={entry.to} activeOptions={entry.exact?{exact:true}:undefined} aria-current={active?"page":undefined} title={entry.label} onPointerDown={e=>e.stopPropagation()} className={`nav-chip group relative flex min-w-[3.4rem] shrink-0 touch-manipulation flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 transition sm:min-w-[3.8rem] ${active?"nav-chip-active text-primary":"text-muted-foreground hover:text-foreground"}`}><span className="relative inline-flex h-4 items-center justify-center"><Icon className={`h-4 w-4 ${active?"scale-110":""}`}/>{active&&<span className="absolute -bottom-1 h-0.5 w-3 rounded-full bg-primary"/>}</span><span className="whitespace-nowrap text-[7px] font-semibold uppercase sm:text-[8px]">{entry.label}</span></Link>;})()})}</div></nav></>;
}
