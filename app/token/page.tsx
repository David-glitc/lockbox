'use client';
import {Suspense,useEffect,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import LockList from '../../components/LockList';
import {LOCKBOX,client,lockboxAbi,getLocks,Lock,tokenInfo,TokenInfo,label,fmt,isAddr,errText,EXPLORER} from '../../lib/chain';
function Lookup({bad}:{bad:boolean}){
 const r=useRouter();const [v,setV]=useState('');
 return (<><p className="eyebrow">Token pages</p><h1 className="h1s">Find a token</h1><p className="lead">Paste a token or LP address to see how much of its supply is locked and every lock behind it.</p>
  <form className="panel" onSubmit={e=>{e.preventDefault();r.push(`/token/?address=${v.trim()}`);}} aria-label="Find a token"><label htmlFor="ta">Token or LP address</label><input id="ta" className="mono" value={v} onChange={e=>setV(e.target.value)} placeholder="0x…" required spellCheck={false} autoComplete="off"/>
   {bad&&<p className="status err" role="alert">That is not a valid 0x address.</p>}<div className="actions"><button className="primary">Open token page</button></div></form></>);
}
function View(){
 const q=useSearchParams().get('address')||'';const [locks,setLocks]=useState<Lock[]>([]);const [t,setT]=useState<TokenInfo|null>(null);
 const [bps,setBps]=useState(0n);const [err,setErr]=useState('');
 useEffect(()=>{(async()=>{if(!isAddr(q)||!LOCKBOX)return;try{
  const a=q as `0x${string}`;setT(await tokenInfo(a));
  setBps(await client.readContract({address:LOCKBOX,abi:lockboxAbi,functionName:'lockedShareBps',args:[a]}));
  const ids=await client.readContract({address:LOCKBOX,abi:lockboxAbi,functionName:'idsByToken',args:[a]});setLocks((await getLocks(ids.map(Number))).reverse());}catch(e){setErr(errText(e));}})();},[q]);
 if(!isAddr(q))return <Lookup bad={!!q}/>;
 return (<><p className="eyebrow">Token page</p><h1 className="h1s">{t?label(t):'Token'}</h1><p className="tiny mono"><a href={`${EXPLORER}/token/${q}`} target="_blank" rel="noopener noreferrer">{q}</a></p>
  {err&&<p className="status err">{err}</p>}
  <section className="panel"><h2 className="num">{Number(bps)/100}% of supply locked</h2><div className="bar" role="img" aria-label={`${Number(bps)/100} percent locked`}><i style={{width:`${Math.min(100,Number(bps)/100)}%`}}/></div>
   {t&&<p className="tiny">Total supply {fmt(t.supply,t.decimals)}. Only counts tokens locked in Lockbox; V3 positions are listed below but have no share figure.</p>}</section>
  <section className="panel gap"><h2>Locks</h2><LockList locks={locks} empty="No locks for this token."/></section></>);
}
export default function Page(){return <Suspense fallback={<p>Loading…</p>}><View/></Suspense>;}
