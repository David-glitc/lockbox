'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {Lock,TokenInfo,tokenInfo,label,fmt,left,when,nowSec,syncClock} from '../lib/chain';
export function status(l:Lock){const now=nowSec();return l.withdrawn?['Released','done']:l.unlockAt>now?['Locked','locked']:['Unlockable','open'];}
export function progress(l:Lock,now=nowSec()){if(l.withdrawn)return 1;const span=l.unlockAt-l.createdAt;return span<=0?1:Math.max(0,Math.min(1,(now-l.createdAt)/span));}
export function Amount({l,t}:{l:Lock;t?:TokenInfo}){return <>{l.kind===1?`Position #${l.amount}`:t?`${fmt(l.amount,t.decimals)} ${label(t)}`:'…'}</>;}
export function Progress({l}:{l:Lock}){const p=Math.round(progress(l)*100);return (<div className="prog"><div className="bar" role="img" aria-label={`${p} percent of the lock period elapsed`}><i style={{width:`${p}%`}}/></div><span className="num">{p}%</span></div>);}
export default function LockList({locks,empty}:{locks:Lock[];empty:string}){
 const [info,setInfo]=useState<Record<string,TokenInfo>>({});
 useEffect(()=>{let live=true;(async()=>{await syncClock();const m:Record<string,TokenInfo>={};for(const l of locks){if(l.kind===0&&!m[l.token])m[l.token]=await tokenInfo(l.token).catch(()=>undefined as any);}if(live)setInfo(m);})();return()=>{live=false;};},[locks]);
 if(!locks.length)return (<div className="ledger-wrap"><table className="ledger"><caption className="sr">Locks</caption><thead><tr><th scope="col">Token</th><th scope="col" className="r">Amount</th><th scope="col">Unlock date</th><th scope="col">Progress to unlock</th></tr></thead><tbody><tr><td colSpan={4} className="tiny empty">{empty}</td></tr></tbody></table></div>);
 return (<div className="ledger-wrap"><table className="ledger"><caption className="sr">Locks, newest first</caption>
  <thead><tr><th scope="col">Token</th><th scope="col" className="r">Amount</th><th scope="col">Unlock date</th><th scope="col">Progress to unlock</th></tr></thead>
  <tbody>{locks.map(l=>{const [s,c]=status(l);const t=info[l.token];const open=!l.withdrawn&&l.unlockAt<=nowSec();return (
   <tr key={l.id}>
    <td data-l="Token"><Link href={`/lock/?id=${l.id}`}><strong>{l.kind===1?'V3 position':t?label(t):'…'}</strong> <span className="num dim">#{l.id}</span></Link>{l.label&&<span className="tiny"> · {l.label}</span>}</td>
    <td data-l="Amount" className="r num"><Amount l={l} t={t}/></td>
    <td data-l="Unlock date" className="num">{when(l.unlockAt)}<br/><span className="tiny">{l.withdrawn?'withdrawn':open?'ready to withdraw':`in ${left(l.unlockAt)}`}</span></td>
    <td data-l="Progress"><span className={`pill ${c}`}>{s}</span><Progress l={l}/></td></tr>);})}</tbody></table></div>);
}
