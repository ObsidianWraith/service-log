import React, { useEffect, useRef, useState } from 'react';
import { addPhoto, readPhoto, photoGroups } from './media';
function Photo({ photo, onRemove }) {
  const [src,setSrc]=useState(''); const [error,setError]=useState(false); const [open,setOpen]=useState(false);
  useEffect(()=>{let active=true;readPhoto(photo.id).then(data=>{if(active)setSrc('data:image/jpeg;base64,'+data)}).catch(()=>{if(active)setError(true)});return()=>{active=false}},[photo.id]);
  return <div style={{width:96}}>
    <button type="button" onClick={()=>setOpen(true)} disabled={!src} aria-label={`View ${photo.name}`} style={{padding:0,border:'1px solid #3A362F',background:'#222',color:'#aaa',width:96,height:80,borderRadius:6,overflow:'hidden'}}>
      {src?<img src={src} alt={photo.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:error?'Unavailable':'Loading…'}
    </button>
    {onRemove&&<button type="button" onClick={onRemove} style={{color:'#D4695A',background:'none',border:0,padding:6}}>Remove</button>}
    {open&&<div role="dialog" aria-label="Photo viewer" style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,.96)',display:'flex',flexDirection:'column',padding:16}}>
      <button type="button" onClick={()=>setOpen(false)} style={{alignSelf:'flex-end',padding:14,marginBottom:12}}>Close photo</button>
      <img src={src} alt={photo.name} style={{width:'100%',height:'85%',objectFit:'contain'}}/>
    </div>}
  </div>;
}
export function PhotoEditor({ photos = {}, onChange, onBusy }) {
  const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const active=useRef(true);
  useEffect(()=>{active.current=true;return()=>{active.current=false;onBusy(false)}},[]);
  async function choose(key,event) {
    const files=Array.from(event.target.files||[]);event.target.value=''; if(!files.length)return;
    setBusy(true);onBusy(true);setError(''); const added=[];
    try {for(const file of files)added.push(await addPhoto(file));}
    catch {if(active.current)setError('A photo could not be added. Try a JPG or PNG image.');}
    finally {if(active.current){if(added.length)onChange({...photos,[key]:[...(photos[key]||[]),...added]});setBusy(false);onBusy(false);}}
  }
  return <div style={{marginTop:20}}>
    {photoGroups.map(([key,label])=><section key={key} style={{marginBottom:16}}>
      <label style={{display:'block',fontSize:13,color:'#C97A2B',marginBottom:8}}>{label}
        <input type="file" accept="image/*" multiple disabled={busy} onChange={e=>choose(key,e)} style={{display:'block',maxWidth:'100%',marginTop:8,fontSize:12}}/>
      </label>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{(photos[key]||[]).map((p,i)=><Photo key={p.id} photo={p} onRemove={busy?null:()=>onChange({...photos,[key]:photos[key].filter((_,j)=>j!==i)})}/>)}</div>
    </section>)}
    {busy&&<p role="status">Adding photos…</p>}{error&&<p role="alert">{error}</p>}
  </div>;
}
export function PhotoGallery({ photos = {} }) {
  return <>{photoGroups.map(([key,label])=>photos[key]?.length?<section key={key} style={{marginTop:12}}><p style={{fontSize:11,color:'#C97A2B'}}>{label}</p><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{photos[key].map(p=><Photo key={p.id} photo={p}/>)}</div></section>:null)}</>;
}
