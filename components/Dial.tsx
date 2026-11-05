// Combination-dial motif: tick ring, optional progress arc, and a hand. Decorative (aria-hidden).
export default function Dial({size=120,progress,spin=false}:{size?:number;progress?:number;spin?:boolean}){
 const ticks=Array.from({length:60},(_,i)=>i);const R=46,C=2*Math.PI*R;const p=progress==null?null:Math.max(0,Math.min(1,progress));
 return (<svg className={`dial${spin?' spin':''}`} width={size} height={size} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
  <circle cx="60" cy="60" r="57" className="d-rim"/>
  {ticks.map(i=>{const a=i*6*Math.PI/180,big=i%5===0,r1=big?48:51,r2=54;return <line key={i} x1={60+r1*Math.sin(a)} y1={60-r1*Math.cos(a)} x2={60+r2*Math.sin(a)} y2={60-r2*Math.cos(a)} className={big?'d-tick big':'d-tick'}/>;})}
  {p!==null&&<><circle cx="60" cy="60" r={R-8} className="d-track"/><circle cx="60" cy="60" r={R-8} className="d-arc" strokeDasharray={`${(C-50)*p} ${C}`} transform="rotate(-90 60 60)"/></>}
  <g className="d-hand"><line x1="60" y1="60" x2="60" y2="22"/><circle cx="60" cy="60" r="6"/></g>
  <circle cx="60" cy="60" r="2.2" className="d-pin"/>
 </svg>);
}
export function Logo(){
 return (<svg width="28" height="28" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><rect width="64" height="64" rx="14" fill="#101318"/><circle cx="32" cy="32" r="22" fill="none" stroke="#8fd3f4" strokeWidth="3"/><circle cx="32" cy="32" r="14" fill="none" stroke="#5b6574" strokeWidth="2" strokeDasharray="2 4.4"/><path d="M32 32L32 15" stroke="#8fd3f4" strokeWidth="4" strokeLinecap="round"/><circle cx="32" cy="32" r="5" fill="#8fd3f4"/><circle cx="32" cy="32" r="1.8" fill="#101318"/></svg>);
}
