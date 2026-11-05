'use client';
import {Suspense,useCallback,useEffect,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import Link from 'next/link';
import {status,Amount} from '../../components/LockList';
import {useAccount} from '../../components/Wallet';
import {LOCKBOX,client,lockboxAbi,getLock,Lock,tokenInfo,TokenInfo,label,fmt,when,left,short,send,errText,parseAddr,EXPLORER,need,connectedAccount,connect,nowSec,syncClock} from '../../lib/chain';
function View(){
 const id=Number(useSearchParams().get('id')||0);const me=useAccount();
 const [l,setL]=useState<Lock|null>(null);const [t,setT]=useState<TokenInfo>();const [msg,setMsg]=useState('');const [err,setErr]=useState(false);const [now,setNow]=useState(0);
 const [ext,setExt]=useState('30');const [to,setTo]=useState('');
 const load=useCallback(async()=>{try{if(!LOCKBOX||!id)return;await syncClock();setNow(nowSec());const x=await getLock(id);setL(x);if(x.kind===0)setT(await tokenInfo(x.token));}catch(e){setMsg(errText(e));setErr(true);}},[id]);
 useEffect(()=>{load();const i=setInterval(()=>setNow(nowSec()),1000);return()=>clearInterval(i);},[load]);
 async function act(fn:()=>Promise<any>){setErr(false);setMsg('');try{await fn();await load();}catch(e){setMsg(errText(e));setErr(true);}}
 if(!id)return <p className="lead">Open this page as /lock/?id=1.</p>;
 if(!l)return <p className="status" role="status">{msg||'Loading lock…'}</p>;
 const [s,c]=status({...l});const mine=(me||'').toLowerCase()===l.owner.toLowerCase();const open=!l.withdrawn&&now>=l.unlockAt;
 const call=(fn:string,args:any[])=>act(async()=>{if(!connectedAccount())await connect();await send(need(),lockboxAbi,fn,args,0n,m=>{setMsg(m);setErr(false);});});
 return (<>
  <h1>Lock #{l.id}{l.label&&<span className="tiny"> · {l.label}</span>}</h1>
  <section className="card" aria-labelledby="facts">
   <h2 id="facts"><span className={`pill ${c}`}>{s}</span> <Amount l={l} t={t}/></h2>
   {!l.withdrawn&&<p><strong>{open?'Unlock date has passed.':`Unlocks in ${left(l.unlockAt,now)}`}</strong></p>}
   <dl className="facts">
    <dt>Type</dt><dd>{l.kind===1?'V3 position NFT':t?.pair?'V2 LP token':'Token'}</dd>
    <dt>{l.kind===1?'Manager':'Token'}</dt><dd><a href={`${EXPLORER}/${l.kind===1?'address':'token'}/${l.token}`} target="_blank" rel="noopener noreferrer">{t?label(t)+' · ':''}{short(l.token)}</a>{l.kind===0&&<> · <Link href={`/token/?address=${l.token}`}>all locks</Link></>}</dd>
    <dt>Unlock date</dt><dd>{when(l.unlockAt)}</dd><dt>Created</dt><dd>{when(l.createdAt)}</dd>
    <dt>Owner</dt><dd><a href={`${EXPLORER}/address/${l.owner}`} target="_blank" rel="noopener noreferrer">{l.owner}</a></dd>
    <dt>Lockbox</dt><dd><a href={`${EXPLORER}/address/${LOCKBOX}`} target="_blank" rel="noopener noreferrer">{LOCKBOX}</a></dd></dl>
   <p className="tiny">Anyone can check this on BOTScan. The contract has no function that lets anyone, including its deployer, move locked funds before the date.</p>
  </section>
  {mine&&!l.withdrawn&&<section className="card" style={{marginTop:16}} aria-labelledby="own"><h2 id="own">Owner actions</h2>
   <div className="actions">
    {open&&<button className="primary" onClick={()=>call(l.kind===1?'withdrawPosition':'withdraw',l.kind===1?[BigInt(l.id)]:[BigInt(l.id),2n**256n-1n])}>Withdraw</button>}
    {l.kind===1&&<button onClick={()=>call('collect',[BigInt(l.id)])}>Collect trading fees</button>}</div>
   <label htmlFor="ext">Extend by (days)</label><input id="ext" value={ext} onChange={e=>setExt(e.target.value)} inputMode="numeric"/>
   <div className="actions"><button onClick={()=>call('extend',[BigInt(l.id),BigInt(l.unlockAt+Number(ext)*86400)])}>Extend</button></div>
   <label htmlFor="to">Transfer this lock to</label><input id="to" value={to} onChange={e=>setTo(e.target.value)} placeholder="0x…"/>
   <div className="actions"><button onClick={()=>act(async()=>{await call('transferLock',[BigInt(l.id),parseAddr(to)]);})}>Transfer</button></div>
  </section>}
  {msg&&<div className={`status${err?' err':''}`} role="status" aria-live="polite">{msg}</div>}</>);
}
export default function Page(){return <Suspense fallback={<p>Loading…</p>}><View/></Suspense>;}
