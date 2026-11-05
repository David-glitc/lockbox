'use client';
import {useEffect,useState} from 'react';
import {formatEther} from 'viem';
import {LOCKBOX,EXPLORER,client,lockboxAbi} from '../lib/chain';
export const LAUNCHED='2026-11-05';
export default function Launch(){
 const [fee,setFee]=useState<string>('…');
 useEffect(()=>{if(!LOCKBOX)return;client.readContract({address:LOCKBOX,abi:lockboxAbi,functionName:'fee'}).then(f=>setFee(formatEther(f as bigint)),()=>setFee('unavailable'));},[]);
 if(!LOCKBOX)return null;
 return (<aside className="launch" aria-label="Launch announcement"><strong>Officially launched on BOT Chain Mainnet</strong>
  <span>{LAUNCHED} · Lockbox <a href={`${EXPLORER}/address/${LOCKBOX}`} target="_blank" rel="noopener noreferrer">{LOCKBOX}</a> · Lock fee <span data-testid="fee">{fee} BOT</span></span></aside>);
}
