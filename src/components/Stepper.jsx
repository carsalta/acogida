
import React from 'react';
export default function Stepper({steps=[], current=0}){
  const li = (s,i)=> (
    <li key={s} style={{display:'flex',alignItems:'center',gap:8}}>
      <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:24,height:24,borderRadius:999,color:'#fff',background:i<=current?'#0284c7':'#94a3b8'}}>{i+1}</span>
      <span style={{fontWeight:i===current?600:400,color:i===current?'#0369a1':'#475569'}}>{s}</span>
      {i<steps.length-1 && <span style={{width:32,height:1,background:'#cbd5e1',margin:'0 8px'}}/>}
    </li>
  );
  return (<ol style={{display:'flex',alignItems:'center',gap:12}} aria-label="progress">{steps.map(li)}</ol>);
}
