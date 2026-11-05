import './globals.css';
import type {Metadata,Viewport} from 'next';
import Nav from '../components/Nav';
import Launch from '../components/Launch';
export const metadata:Metadata={title:'Lockbox · lock tokens and LP on BOT Chain',description:'Lock ERC-20 tokens, BDEX V2 LP tokens and BDEX V3 positions with a public, verifiable lock page.',openGraph:{title:'Lockbox · lock tokens and LP on BOT Chain',description:'Lock ERC-20 tokens, BDEX V2 LP tokens and BDEX V3 positions with a public, verifiable lock page.',type:'website',siteName:'Lockbox'},twitter:{card:'summary',title:'Lockbox · lock tokens and LP on BOT Chain'},icons:{icon:'/icon.svg'}};
export const viewport:Viewport={themeColor:'#0e1013',colorScheme:'dark'};
export default function Root({children}:{children:React.ReactNode}){
 return (<html lang="en"><body><a className="skip" href="#main">Skip to content</a>
  <div className="shell"><Nav/><main id="main"><Launch/>{children}</main></div></body></html>);
}
