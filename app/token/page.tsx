'use client';
import {Suspense,useEffect,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import LockList from '../../components/LockList';
import {LOCKBOX,client,lockboxAbi,getLocks,Lock,tokenInfo,TokenInfo,label,fmt,isAddr,errText,EXPLORER} from '../../lib/chain';
function View(){
 const q=useSearchParams().get('address')||'';const [locks,setLocks]=useState<Lock[]>([]);const [t,setT]=useState<TokenInfo|null>(null);
 const [bps,setBps]=useState(0n);const [err,setErr]=useState('');
 useEffect(()=>{(async()=>{if(!isAddr(q)||!LOCKBOX)return;try{
  const a=q as `0x${string}`;setT(await tokenInfo(a));
  setBps(await client.readContract({address:LOCKBOX,abi:lockboxAbi,functionName:'lockedShareBps',args:[a]}));
  const ids=await client.readContract({address:LOCKBOX,abi:lockboxAbi,functionName:'idsByToken',args:[a]});setLocks((await getLocks(ids.map(Number))).reverse());}catch(e){setErr(errText(e));}})();},[q]);
 if(!isAddr(q))return <p className="lead">Open this page as /token/?address=0x… to see every lock for a token.</p>;
 return (<><h1>{t?label(t):'Token'}</h1><p className="tiny"><a href={`${EXPLORER}/token/${q}`} target="_blank" rel="noopener noreferrer">{q}</a></p>
  {err&&<p className="status err">{err}</p>}
  <section className="card"><h2>{Number(bps)/100}% of supply locked</h2><div className="bar" role="img" aria-label={`${Number(bps)/100} percent locked`}><i style={{width:`${Math.min(100,Number(bps)/100)}%`}}/></div>
   {t&&<p className="tiny">Total supply {fmt(t.supply,t.decimals)}. Only counts tokens locked in Lockbox; V3 positions are listed below but have no share figure.</p>}</section>
  <section className="card" style={{marginTop:16}}><h2>Locks</h2><LockList locks={locks} empty="No locks for this token."/></section></>);
}
export default function Page(){return <Suspense fallback={<p>Loading…</p>}><View/></Suspense>;}
