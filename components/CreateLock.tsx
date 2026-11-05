'use client';
import {useEffect,useState} from 'react';
import {LOCKBOX,NPM,client,erc20Abi,nftAbi,lockboxAbi,need,send,connect,connectedAccount,tokenInfo,label,nowSec,short,when,isAddr,syncClock,parseAmount,parseAddr,errText,fmt} from '../lib/chain';

const DAYS=[[30,'30 days'],[90,'90 days'],[180,'6 months'],[365,'1 year'],[730,'2 years'],[3650,'10 years']] as const;
export default function CreateLock(){
 const [mode,setMode]=useState<'token'|'position'>('token');
 const [addr,setAddr]=useState('');const [amount,setAmount]=useState('');const [nft,setNft]=useState(NPM as string);const [tokenId,setTokenId]=useState('');
 const [days,setDays]=useState(180);const [tag,setTag]=useState('');const [msg,setMsg]=useState('');const [err,setErr]=useState(false);const [busy,setBusy]=useState(false);const [info,setInfo]=useState('');const [now,setNow]=useState(0);
 useEffect(()=>{syncClock().then(()=>setNow(nowSec()));const i=setInterval(()=>setNow(nowSec()),30000);return()=>clearInterval(i);},[]);
 const say=(m:string,e=false)=>{setMsg(m);setErr(e);};
 async function peek(){try{const a=parseAddr(addr);const t=await tokenInfo(a);const me=connectedAccount();const bal=me?await client.readContract({address:a,abi:erc20Abi,functionName:'balanceOf',args:[me]}):0n;setInfo(`${label(t)} · you hold ${fmt(bal,t.decimals)}`);}catch(e){setInfo(errText(e));}}
 async function submit(ev:React.FormEvent){
  ev.preventDefault();setBusy(true);say('');
  try{
   const box=need();if(!connectedAccount())await connect();const me=connectedAccount()!;
   const fee=await client.readContract({address:box,abi:lockboxAbi,functionName:'fee'});
   await syncClock();const unlockAt=BigInt(Math.floor(nowSec())+days*86400);
   if(mode==='token'){
    const a=parseAddr(addr);const t=await tokenInfo(a,false);const amt=parseAmount(amount,t.decimals);
    const allowed=await client.readContract({address:a,abi:erc20Abi,functionName:'allowance',args:[me,box]});
    if(allowed<amt)await send(a,erc20Abi,'approve',[box,amt],0n,say);
    const r=await send(box,lockboxAbi,'lockToken',[a,amt,unlockAt,tag],fee,say);
    const id=await client.readContract({address:box,abi:lockboxAbi,functionName:'lockCount'});
    say(`Locked. Your lock page: /lock/?id=${id}`);
   }else{
    const m=parseAddr(nft);const id=BigInt(tokenId||'-1');
    const owner=await client.readContract({address:m,abi:nftAbi,functionName:'ownerOf',args:[id]}).catch(()=>{throw Error('That position does not exist.');});
    if(owner.toLowerCase()!==me.toLowerCase())throw Error('Your connected wallet does not own that position.');
    const ap=await client.readContract({address:m,abi:nftAbi,functionName:'getApproved',args:[id]});
    if(ap.toLowerCase()!==box.toLowerCase())await send(m,nftAbi,'approve',[box,id],0n,say);
    await send(box,lockboxAbi,'lockPosition',[m,id,unlockAt,tag],fee,say);
    const n=await client.readContract({address:box,abi:lockboxAbi,functionName:'lockCount'});
    say(`Locked. Your lock page: /lock/?id=${n}`);
   }
  }catch(e){say(errText(e),true);}finally{setBusy(false);}
 }
 const addrOk=isAddr(addr.trim());const amtOk=/^\d+(\.\d+)?$/.test(amount.trim())&&Number(amount)>0;const posOk=/^\d+$/.test(tokenId.trim())&&isAddr(nft.trim());
 const s1=mode==='token'?addrOk:isAddr(nft.trim()),s2=mode==='token'?amtOk:posOk;
 const unlock=now?when(now+days*86400):'…';
 const Step=({n,title,ok,children}:{n:number;title:string;ok:boolean;children:React.ReactNode})=>(<fieldset className={`step${ok?' ok':''}`}><legend><span className="n" aria-hidden="true">{ok?'✓':n}</span>{title}</legend>{children}</fieldset>);
 return (<form className="panel create" onSubmit={submit} aria-label="Create a lock">
  <h2>Create a lock</h2>
  <Step n={1} title="Asset" ok={s1}>
   <div className="tabs" role="group" aria-label="What to lock">
    <button type="button" aria-pressed={mode==='token'} onClick={()=>setMode('token')}>Token or V2 LP</button>
    <button type="button" aria-pressed={mode==='position'} onClick={()=>setMode('position')}>V3 position</button></div>
   {mode==='token'?<>
    <label htmlFor="addr">Token or LP address</label><input id="addr" className="mono" value={addr} onChange={e=>setAddr(e.target.value)} onBlur={peek} placeholder="0x…" required autoComplete="off" spellCheck={false}/>
    {info&&<p className="tiny num">{info}</p>}
   </>:<>
    <label htmlFor="nft">Position manager (BDEX by default)</label><input id="nft" className="mono" value={nft} onChange={e=>setNft(e.target.value)} required spellCheck={false}/>
   </>}
  </Step>
  <Step n={2} title={mode==='token'?'Amount':'Position'} ok={s2}>
   {mode==='token'?<><label htmlFor="amount">Amount</label><input id="amount" className="mono" value={amount} onChange={e=>setAmount(e.target.value)} inputMode="decimal" placeholder="1000" required autoComplete="off"/></>
   :<><label htmlFor="tid">Position ID</label><input id="tid" className="mono" value={tokenId} onChange={e=>setTokenId(e.target.value)} inputMode="numeric" required/>
    <p className="tiny">The position stays yours to earn from: you can collect trading fees while it is locked.</p></>}
  </Step>
  <Step n={3} title="Duration" ok={true}>
   <label htmlFor="dur">Lock for</label><select id="dur" value={days} onChange={e=>setDays(Number(e.target.value))}>{DAYS.map(([d,l])=><option key={d} value={d}>{l}</option>)}</select>
   <div className="preview" aria-live="polite"><span className="tiny">Unlock date preview</span><strong className="num" data-testid="unlock-preview">{unlock}</strong></div>
   <label htmlFor="tag">Label (optional, 64 characters)</label><input id="tag" value={tag} onChange={e=>setTag(e.target.value)} maxLength={64}/>
  </Step>
  <Step n={4} title="Confirm" ok={false}>
   <dl className="sum"><dt>Lock</dt><dd className="num">{mode==='token'?(amtOk?amount.trim():'amount')+' of '+(addrOk?short(addr.trim()):'asset'):'V3 position '+(tokenId.trim()?'#'+tokenId.trim():'')}</dd><dt>Until</dt><dd className="num">{unlock}</dd></dl>
   <p className="tiny">Locks can only be extended. Nobody can release them early. The lock fee is read from the chain and sent with the transaction.</p>
   <div className="actions"><button className="primary" disabled={busy||!LOCKBOX}>{busy?'Working…':'Lock'}</button></div>
  </Step>
  {!LOCKBOX&&<p className="tiny">Lockbox is not deployed yet, so locking is disabled. See LAUNCH.md.</p>}
  {msg&&<div className={`status${err?' err':''}`} role="status" aria-live="polite">{msg}</div>}
 </form>);
}
