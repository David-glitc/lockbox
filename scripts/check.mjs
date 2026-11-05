// End-to-end rehearsal on a local anvil fork of BOT Chain mainnet: deploy Lockbox, build the static export against it, then drive it in
// headless Chromium with an injected wallet (anvil's public dev account): lock WBOT, read the lock page, time-travel, withdraw.
import {spawn,execFileSync} from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),PORT=8678,SITE=8779,RPC=`http://127.0.0.1:${PORT}`;
const DEV='0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',DEVKEY='0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const WBOT='0xD5452816194a3784dBa983426cCe7c122F4abd30';
const sh=(c,a,o={})=>execFileSync(c,a,{cwd:root,encoding:'utf8',...o}).trim();
const rpc=(method,params=[])=>fetch(RPC,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}).then(r=>r.json());
const anvil=spawn('anvil',['--fork-url',process.env.BOT_FORK_URL||'https://rpc.botchain.ai','--port',String(PORT),'--silent'],{stdio:'ignore'});
let server,browser;
try{
 for(let i=0;i<60;i++){try{if((await rpc('eth_chainId')).result)break;}catch{}await new Promise(r=>setTimeout(r,1000));}
 const out=sh('forge',['create','src/Lockbox.sol:Lockbox','--rpc-url',RPC,'--private-key',DEVKEY,'--broadcast','--constructor-args','50000000000000000',DEV]);
 const box=out.match(/Deployed to: (0x[0-9a-fA-F]{40})/)[1];
 sh('cast',['send',WBOT,'deposit()','--value','5ether','--rpc-url',RPC,'--private-key',DEVKEY]);
 console.log('Lockbox',box);
 if(!process.env.SKIP_BUILD||!fs.existsSync(path.join(root,'site')))
  execFileSync('npx',['next','build'],{cwd:root,stdio:'inherit',env:{...process.env,NEXT_PUBLIC_RPC:RPC,NEXT_PUBLIC_LOCKBOX:box,NEXT_PUBLIC_CHAIN_ID:'677'}});
 const dist=path.join(root,'out');
 server=http.createServer((q,r)=>{let f=path.join(dist,decodeURIComponent(q.url.split('?')[0]));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)){r.statusCode=404;return r.end();}
  r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.txt':'text/plain'}[path.extname(f)]||'application/octet-stream');r.end(fs.readFileSync(f));}).listen(SITE);
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await (await browser.newContext({viewport:{width:390,height:900}})).newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({rpc,dev})=>{const call=(method,params=[])=>fetch(rpc,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}).then(r=>r.json()).then(j=>{if(j.error)throw Object.assign(new Error(j.error.message),{code:j.error.code});return j.result;});
  window.ethereum={request:async({method,params})=>method==='eth_requestAccounts'||method==='eth_accounts'?[dev]:method==='wallet_switchEthereumChain'?null:call(method,params)};},{rpc:RPC,dev:DEV});
 const base=`http://127.0.0.1:${SITE}`;
 await page.goto(base+'/',{waitUntil:'networkidle'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'overflow at 390px');
 await page.getByRole('button',{name:'Connect wallet'}).click();
 await page.getByLabel('Token or LP address').fill(WBOT);await page.getByLabel('Amount').fill('2');
 await page.getByLabel('Label (optional, 64 characters)').fill('e2e lock');
 await page.getByRole('button',{name:'Lock',exact:true}).click();
 try{await page.waitForFunction(()=>document.body.textContent.includes('Your lock page: /lock/?id=1'),null,{timeout:60000});}
 catch(e){console.error('STATUS:',await page.locator('.status').allInnerTexts(),'ERRORS:',errors);throw e;}
 await page.goto(`${base}/lock/?id=1`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.body.textContent.includes('Locked')&&document.body.textContent.includes('2 WBOT'),null,{timeout:30000});
 assert.match(await page.locator('h1').innerText(),/Lock #1/);
 await page.goto(`${base}/token/?address=${WBOT}`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.body.textContent.includes('of supply locked'),null,{timeout:30000});
 // time travel past the unlock date and withdraw
 await rpc('evm_increaseTime',[181*86400]);await rpc('evm_mine');
 await page.goto(`${base}/lock/?id=1`,{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'Connect wallet'}).click();
 await page.getByRole('button',{name:'Withdraw'}).click();
 await page.waitForFunction(()=>document.body.textContent.includes('Released'),null,{timeout:60000});
 assert.deepEqual(errors,[],'page errors');
 console.log('lockbox web check: connect, lock, lock page, token page, withdraw all passed');
}finally{await browser?.close();server?.close();anvil.kill();}
