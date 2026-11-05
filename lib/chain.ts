import {createPublicClient,createWalletClient,custom,defineChain,http,parseAbi,getAddress,isAddress,formatUnits,parseUnits,type Address} from 'viem';

export const CHAIN_ID=Number(process.env.NEXT_PUBLIC_CHAIN_ID||677);
export const RPC=process.env.NEXT_PUBLIC_RPC||'https://rpc.botchain.ai';
export const EXPLORER='https://scan.botchain.ai';
export const LOCKBOX=(process.env.NEXT_PUBLIC_LOCKBOX||'0x199b0d037775c892897a0f873c8a037de7f6cb70') as Address|'';
export const NPM=(process.env.NEXT_PUBLIC_NPM||'0xDAc3FcFF004d8a8675b94E44941A1a2e3b240090') as Address; // BDEX "B DEX Positions NFT-V1"
export const chain=defineChain({id:CHAIN_ID,name:'BOT Chain',nativeCurrency:{name:'BOT',symbol:'BOT',decimals:18},rpcUrls:{default:{http:[RPC]}},blockExplorers:{default:{name:'BOTScan',url:EXPLORER}}});
export const client=createPublicClient({chain,transport:http(RPC,{timeout:20000,retryCount:1}),batch:{multicall:{batchSize:2048}}});

export const lockboxAbi=parseAbi([
 'function fee() view returns (uint256)',
 'function lockCount() view returns (uint256)',
 'function getLock(uint256 id) view returns ((uint8 kind,address token,address owner,uint256 amount,uint64 unlockAt,uint64 createdAt,bool withdrawn,string label))',
 'function idsByToken(address) view returns (uint256[])',
 'function idsByOwner(address) view returns (uint256[])',
 'function latest(uint256 offset,uint256 limit) view returns (uint256[])',
 'function lockedAmount(address) view returns (uint256)',
 'function lockedShareBps(address) view returns (uint256)',
 'function lockToken(address token,uint256 amount,uint64 unlockAt,string label) payable returns (uint256)',
 'function lockPosition(address manager,uint256 tokenId,uint64 unlockAt,string label) payable returns (uint256)',
 'function extend(uint256 id,uint64 newUnlockAt)',
 'function topUp(uint256 id,uint256 amount)',
 'function withdraw(uint256 id,uint256 amount)',
 'function withdrawPosition(uint256 id)',
 'function collect(uint256 id) returns (uint256,uint256)',
 'function transferLock(uint256 id,address to)',
]);
export const erc20Abi=parseAbi(['function symbol() view returns (string)','function name() view returns (string)','function decimals() view returns (uint8)','function balanceOf(address) view returns (uint256)','function totalSupply() view returns (uint256)','function allowance(address,address) view returns (uint256)','function approve(address,uint256) returns (bool)','function token0() view returns (address)','function token1() view returns (address)']);
export const nftAbi=parseAbi(['function ownerOf(uint256) view returns (address)','function getApproved(uint256) view returns (address)','function isApprovedForAll(address,address) view returns (bool)','function approve(address,uint256)','function positions(uint256) view returns (uint96,address,address,address,uint24,int24,int24,uint128,uint256,uint256,uint128,uint128)']);

export type Lock={id:number;kind:number;token:Address;owner:Address;amount:bigint;unlockAt:number;createdAt:number;withdrawn:boolean;label:string};
// Chain time, not device time: the contract compares against block.timestamp, so a skewed clock must not decide what the UI offers.
let skew=0;
export async function syncClock(){try{const b=await client.getBlock();skew=Number(b.timestamp)-Date.now()/1000;}catch{}}
export const nowSec=()=>Date.now()/1000+skew;
export const isAddr=(s:string)=>isAddress(s);
export const need=():Address=>{if(!LOCKBOX)throw Error('Lockbox is not deployed yet. Set NEXT_PUBLIC_LOCKBOX and rebuild.');return LOCKBOX;};
export async function getLock(id:number):Promise<Lock>{
 const l=await client.readContract({address:need(),abi:lockboxAbi,functionName:'getLock',args:[BigInt(id)]});
 return {id,kind:Number(l.kind),token:l.token,owner:l.owner,amount:l.amount,unlockAt:Number(l.unlockAt),createdAt:Number(l.createdAt),withdrawn:l.withdrawn,label:l.label};
}
export async function getLocks(ids:number[]):Promise<Lock[]>{return Promise.all(ids.map(getLock));}
export type TokenInfo={address:Address;symbol:string;name:string;decimals:number;supply:bigint;pair?:[TokenInfo|null,TokenInfo|null]};
const cache=new Map<string,TokenInfo>();
export async function tokenInfo(address:Address,deep=true):Promise<TokenInfo>{
 const k=address.toLowerCase();const hit=cache.get(k);if(hit)return hit;
 const rd=(fn:any)=>client.readContract({address,abi:erc20Abi,functionName:fn}).catch(()=>undefined) as Promise<any>;
 const [symbol,name,decimals,supply,t0,t1]=await Promise.all([rd('symbol'),rd('name'),rd('decimals'),rd('totalSupply'),rd('token0'),rd('token1')]);
 const info:TokenInfo={address,symbol:symbol||'?',name:name||symbol||'Token',decimals:Number(decimals??18),supply:supply??0n};
 // V2 LP tokens expose token0/token1: show them as "WBOT / USDT".
 if(deep&&t0&&t1){const [a,b]=await Promise.all([tokenInfo(t0,false).catch(()=>null),tokenInfo(t1,false).catch(()=>null)]);info.pair=[a,b];}
 cache.set(k,info);return info;
}
export const label=(t:TokenInfo)=>t.pair?`${t.pair[0]?.symbol||'?'} / ${t.pair[1]?.symbol||'?'} LP`:t.symbol;
export const short=(a:string)=>`${a.slice(0,6)}…${a.slice(-4)}`;
export const fmt=(n:bigint,d=18,dp=4)=>{const v=Number(formatUnits(n,d));return v.toLocaleString('en-US',{maximumFractionDigits:v>=1000?2:dp});};
export const parseAmount=(s:string,d:number)=>{if(!/^\d+(\.\d+)?$/.test(s.trim()))throw Error('Enter a positive number.');return parseUnits(s.trim(),d);};
export const parseAddr=(s:string):Address=>{if(!isAddress(s.trim()))throw Error('Enter a valid 0x address.');return getAddress(s.trim());};
export const when=(t:number)=>new Date(t*1000).toLocaleString('en-US',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
export const left=(t:number,now=nowSec())=>{let s=Math.max(0,Math.floor(t-now));const d=Math.floor(s/86400);s%=86400;const h=Math.floor(s/3600);s%=3600;const m=Math.floor(s/60);return d?`${d}d ${h}h`:h?`${h}h ${m}m`:`${m}m ${s%60}s`;};

// -------- wallet
declare global{interface Window{ethereum?:any}}
let account:Address|null=null;
export const connectedAccount=()=>account;
export async function connect():Promise<Address>{
 const p=window.ethereum;if(!p)throw Error('No wallet found. Install a browser wallet such as BO Wallet, MetaMask or Rabby.');
 const [a]=await p.request({method:'eth_requestAccounts'});account=getAddress(a);
 const hex='0x'+CHAIN_ID.toString(16);
 try{await p.request({method:'wallet_switchEthereumChain',params:[{chainId:hex}]});}
 catch(e:any){if(e.code!==4902&&e?.data?.originalError?.code!==4902)throw e;await p.request({method:'wallet_addEthereumChain',params:[{chainId:hex,chainName:chain.name,nativeCurrency:chain.nativeCurrency,rpcUrls:[RPC],blockExplorerUrls:[EXPLORER]}]});}
 return account;
}
/** Simulate, then send, then wait. Returns the receipt; throws readable errors. */
export async function send(address:Address,abi:any,functionName:string,args:any[]=[],value=0n,onStatus:(s:string)=>void=()=>{}){
 if(!account)await connect();
 const w=createWalletClient({account:account!,chain,transport:custom(window.ethereum)});
 onStatus('Checking transaction…');
 const {request}=await client.simulateContract({account:account!,address,abi,functionName,args,value} as any);
 const gas=await client.estimateContractGas({account:account!,address,abi,functionName,args,value} as any);
 onStatus('Confirm in your wallet…');
 const hash=await w.writeContract({...(request as any),gas:gas*125n/100n});
 onStatus(`Waiting for confirmation: ${hash}`);
 const r=await client.waitForTransactionReceipt({hash,timeout:180000});
 if(r.status!=='success')throw Error(`Transaction reverted: ${hash}`);
 onStatus(`Confirmed: ${hash}`);return r;
}
export const errText=(e:any)=>e?.shortMessage||e?.message||'Something went wrong.';
