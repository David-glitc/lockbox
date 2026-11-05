'use client';
import {useEffect,useState} from 'react';
import CreateLock from '../components/CreateLock';
import LockList from '../components/LockList';
import {LOCKBOX,client,lockboxAbi,getLocks,Lock,errText} from '../lib/chain';
export default function Home(){
 const [locks,setLocks]=useState<Lock[]>([]);const [total,setTotal]=useState<number|null>(null);const [err,setErr]=useState('');
 useEffect(()=>{(async()=>{
  if(!LOCKBOX)return;
  try{const n=await client.readContract({address:LOCKBOX,abi:lockboxAbi,functionName:'lockCount'});setTotal(Number(n));
   const ids=await client.readContract({address:LOCKBOX,abi:lockboxAbi,functionName:'latest',args:[0n,12n]});setLocks(await getLocks(ids.map(Number)));}
  catch(e){setErr(errText(e));}})();},[]);
 return (<>
  <h1>Prove the liquidity is not going anywhere.</h1>
  <p className="lead">Lock a token, a BDEX V2 LP token or a BDEX V3 position until a date. Every lock gets a public page anyone can check. Locks can only be extended, and nobody, including us, can unlock early.</p>
  <div className="grid two">
   <CreateLock/>
   <section className="card" aria-labelledby="latest"><h2 id="latest">Latest locks{total!==null&&<span className="tiny"> · {total} total</span>}</h2>
    {err&&<p className="status err">{err}</p>}
    <LockList locks={locks} empty={LOCKBOX?'No locks yet.':'Lockbox is not deployed yet.'}/></section>
  </div></>);
}
