import './globals.css';
import type {Metadata} from 'next';
import Link from 'next/link';
import Wallet from '../components/Wallet';
import Launch from '../components/Launch';
export const metadata:Metadata={title:'Lockbox · lock tokens and LP on BOT Chain',description:'Lock ERC-20 tokens, BDEX V2 LP tokens and BDEX V3 positions with a public, verifiable lock page.',openGraph:{title:'Lockbox · lock tokens and LP on BOT Chain',description:'Lock ERC-20 tokens, BDEX V2 LP tokens and BDEX V3 positions with a public, verifiable lock page.',type:'website',siteName:'Lockbox'},twitter:{card:'summary',title:'Lockbox · lock tokens and LP on BOT Chain'},icons:{icon:'/icon.svg'}};
export default function Root({children}:{children:React.ReactNode}){
 return (<html lang="en"><body>
  <header className="top"><Link className="brand" href="/">🔒 Lockbox</Link>
   <nav aria-label="Main"><Link href="/">Lock</Link><Link href="/me/">My locks</Link><Wallet/></nav></header>
  <main><Launch/>{children}</main></body></html>);
}
