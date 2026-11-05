'use client';
import {useEffect,useState} from 'react';
import LockList from '../../components/LockList';
import {useAccount} from '../../components/Wallet';
import {LOCKBOX,client,lockboxAbi,getLocks,Lock,errText} from '../../lib/chain';
export default function Mine(){
 const a=useAccount();const [locks,setLocks]=useState<Lock[]>([]);const [err,setErr]=useState('');
 useEffect(()=>{(async()=>{if(!a||!LOCKBOX)return;try{
  const ids=await client.readContract({address:LOCKBOX,abi:lockboxAbi,functionName:'idsByOwner',args:[a as `0x${string}`]});
  const all=await getLocks([...new Set(ids.map(Number))]);setLocks(all.filter(l=>l.owner.toLowerCase()===a.toLowerCase()).reverse());}catch(e){setErr(errText(e));}})();},[a]);
 return (<><h1>My locks</h1>{!a&&<p className="lead">Connect your wallet to see the locks you own.</p>}{err&&<p className="status err">{err}</p>}
  {a&&<section className="card"><LockList locks={locks} empty="You do not own any locks."/></section>}</>);
}
