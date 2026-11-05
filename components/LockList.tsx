'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {Lock,TokenInfo,tokenInfo,label,fmt,left,when,nowSec,syncClock} from '../lib/chain';
export function status(l:Lock){const now=nowSec();return l.withdrawn?['Released','done']:l.unlockAt>now?['Locked','locked']:['Unlockable','open'];}
export function Amount({l,t}:{l:Lock;t?:TokenInfo}){return <>{l.kind===1?`Position #${l.amount}`:t?`${fmt(l.amount,t.decimals)} ${label(t)}`:'…'}</>;}
export default function LockList({locks,empty}:{locks:Lock[];empty:string}){
 const [info,setInfo]=useState<Record<string,TokenInfo>>({});
 useEffect(()=>{let live=true;(async()=>{await syncClock();const m:Record<string,TokenInfo>={};for(const l of locks){if(l.kind===0&&!m[l.token])m[l.token]=await tokenInfo(l.token).catch(()=>undefined as any);}if(live)setInfo(m);})();return()=>{live=false;};},[locks]);
 if(!locks.length)return <p className="tiny">{empty}</p>;
 return (<div>{locks.map(l=>{const [s,c]=status(l);return (
  <div className="row" key={l.id}><div><Link href={`/lock/?id=${l.id}`}><strong>Lock #{l.id}</strong></Link> {l.label&&<span className="tiny">· {l.label}</span>}<br/><span className="tiny"><Amount l={l} t={info[l.token]}/></span></div>
   <div style={{textAlign:'right'}}><span className={`pill ${c}`}>{s}</span><br/><span className="tiny">{l.withdrawn?'—':l.unlockAt>nowSec()?`unlocks in ${left(l.unlockAt)}`:`unlocked ${when(l.unlockAt)}`}</span></div></div>);})}</div>);
}
