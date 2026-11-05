'use client';
import {useEffect,useState} from 'react';
import {connect,short,errText} from '../lib/chain';
export const ACCOUNT_EVENT='lockbox:account';
export default function Wallet(){
 const [acct,setAcct]=useState<string|null>(null);const [err,setErr]=useState('');
 useEffect(()=>{const h=(e:any)=>setAcct(e.detail);window.addEventListener(ACCOUNT_EVENT,h);return()=>window.removeEventListener(ACCOUNT_EVENT,h);},[]);
 return (<span><button className="primary" onClick={async()=>{try{setErr('');const a=await connect();setAcct(a);window.dispatchEvent(new CustomEvent(ACCOUNT_EVENT,{detail:a}));}catch(e){setErr(errText(e));}}}>{acct?short(acct):'Connect wallet'}</button>{err&&<span role="alert" className="tiny"> {err}</span>}</span>);
}
export function useAccount(){
 const [a,setA]=useState<string|null>(null);
 useEffect(()=>{const h=(e:any)=>setA(e.detail);window.addEventListener(ACCOUNT_EVENT,h);return()=>window.removeEventListener(ACCOUNT_EVENT,h);},[]);
 return a;
}
