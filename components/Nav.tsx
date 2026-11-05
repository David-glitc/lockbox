'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import Wallet from './Wallet';
import {Logo} from './Dial';
const ITEMS=[['/','Lock','M7 11V8a5 5 0 0 1 10 0v3M5 11h14v9H5z'],['/me/','My locks','M4 6h16M4 12h16M4 18h10'],['/token/','Token pages','M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z']] as const;
export default function Nav(){
 const p=(usePathname()||'/').replace(/\/?$/,'/');
 return (<aside className="side"><Link className="brand" href="/"><Logo/><span>Lockbox</span></Link>
  <nav aria-label="Main">{ITEMS.map(([h,t,d])=>{const on=h==='/'?p==='/'||p.startsWith('/lock/'):p.startsWith(h);return <Link key={h} href={h} aria-current={on?'page':undefined}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d}/></svg><span>{t}</span></Link>;})}</nav>
  <div className="wallet"><Wallet/></div>
  <p className="side-note">Custody-grade locks on BOT Chain</p></aside>);
}
