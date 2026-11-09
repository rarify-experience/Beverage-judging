import {showEmailDeliveryNotice} from '/shared/workspace-nav.js';
const escapeHtml=(value='')=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key=row=>row.flight_id+':'+row.wine_id;

export function assembleRecaps(snapshot){
  const wines=new Map(snapshot.wines.map(w=>[w.id,w]));
  const flights=new Map(snapshot.flights.map(f=>[f.id,f]));
  const positions=new Map(snapshot.flightWines.map(w=>[key(w),w]));
  return snapshot.judges.map(judge=>{
    const scores=snapshot.scores.filter(s=>judge.userId&&s.judge_id===judge.userId);
    const bookmarks=snapshot.bookmarks.filter(b=>judge.userId&&b.judge_id===judge.userId);
    const marked=new Set(bookmarks.map(key));
    const entries=new Map(scores.map(s=>[key(s),{...s,submitted:true}]));
    for(const bookmark of bookmarks)if(!entries.has(key(bookmark)))entries.set(key(bookmark),{...bookmark,submitted:false});
    const items=[...entries.values()].map(row=>({
      ...row,wine:wines.get(row.wine_id),flight:flights.get(row.flight_id),
      position:positions.get(key(row)),noteworthy:marked.has(key(row))
    })).sort((a,b)=>(a.flight?.number??Infinity)-(b.flight?.number??Infinity)||(a.position?.position??Infinity)-(b.position?.position??Infinity)||a.wine_id.localeCompare(b.wine_id));
    return {...judge,items,submittedCount:scores.length,noteworthyCount:bookmarks.length};
  }).sort((a,b)=>a.name.localeCompare(b.name));
}
const wineName=item=>[item.wine?.producer,item.wine?.name,item.wine?.vintage].filter(Boolean).join(' · ')||'Wine '+(item.position?.blind_code||item.wine_id);
const flightName=item=>item.flight?.name||'Flight';
const scoreLabel=item=>item.submitted?`${item.total}/20`:'Not submitted';
export function recapContent(recap,snapshot){
  const event=snapshot.eventName||'Wine judging';
  const subject=`${event} — your judging recap`;
  const date=new Date(snapshot.generatedAt).toLocaleString('en-US');
  const intro=`Thank you for judging at ${event}. Here are your submitted scores and the wines you marked as noteworthy.`;
  const scored=recap.items.filter(i=>i.submitted),marked=recap.items.filter(i=>i.noteworthy);
  const describe=i=>`${wineName(i)} — ${flightName(i)}${i.position?.blind_code?' · Wine '+i.position.blind_code:''} — ${scoreLabel(i)}`;
  const text=[`Hello ${recap.name},`,'',intro,'',`YOUR SUBMITTED SCORES (${scored.length})`,...scored.map(i=>describe(i)+(i.noteworthy?' · ★ Noteworthy':'')),...(!scored.length?['No submitted scores yet.']:[]),'',`YOUR NOTEWORTHY WINES (${marked.length})`,...marked.map(describe),...(!marked.length?['No wines marked as noteworthy.']:[]),'',`Scores and bookmarks as of ${date}. Draft scores are excluded.`,'','Thank you,','Cincinnati International Wine Festival'].join('\n');
  const row=i=>`<tr><td style="padding:12px 8px;border-bottom:1px solid #e6e0d8"><strong>${escapeHtml(wineName(i))}</strong><br><span style="color:#70685f;font-size:12px">${escapeHtml(flightName(i))}${i.position?.blind_code?' · Wine '+escapeHtml(i.position.blind_code):''}</span>${i.noteworthy?'<br><span style="color:#a44e28;font-size:12px">★ Noteworthy</span>':''}</td><td style="padding:12px 8px;border-bottom:1px solid #e6e0d8;text-align:right;white-space:nowrap">${escapeHtml(scoreLabel(i))}</td></tr>`;
  const table=list=>`<table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr><th style="text-align:left;padding:8px">Wine</th><th style="text-align:right;padding:8px">Your score</th></tr></thead><tbody>${list.map(row).join('')}</tbody></table>`;
  const html=`<div style="max-width:640px;margin:auto;background:#fffdf9;color:#302c27;font-family:Arial,sans-serif;padding:28px;line-height:1.6"><div style="color:#b6522c;font-size:30px;font-weight:bold">rarify</div><h1 style="font-size:24px;margin:18px 0">Your judging recap</h1><p>${escapeHtml(event)}</p><p>Hello ${escapeHtml(recap.name)},</p><p>${escapeHtml(intro)}</p><h2 style="font-size:18px;margin-top:28px">Your submitted scores · ${scored.length}</h2>${scored.length?table(scored):'<p>No submitted scores yet.</p>'}<h2 style="font-size:18px;margin-top:28px">Your noteworthy wines · ${marked.length}</h2>${marked.length?table(marked):'<p>No wines marked as noteworthy.</p>'}<p style="font-size:12px;color:#70685f;margin-top:28px">Scores and bookmarks as of ${escapeHtml(date)}. Draft scores are excluded.</p><p>Thank you,<br>Cincinnati International Wine Festival</p></div>`;
  return {subject,text,html};
}
const base64=value=>{const bytes=new TextEncoder().encode(value);let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary);};
export function emailDraft(recap,content){
  // Never allow user-entered names/email addresses to introduce MIME headers.
  const email=String(recap.email||'').replace(/[\r\n]/g,'');
  if(!/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(email))throw Error('A valid judge email is required to download a draft.');
  const boundary='rarify-recap-multipart';
  const part=(type,value)=>`Content-Type: ${type}; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64(value).match(/.{1,76}/g)?.join('\r\n')||''}`;
  return [`To: ${email}`,`Subject: =?UTF-8?B?${base64(content.subject)}?=`,'X-Unsent: 1','MIME-Version: 1.0',`Content-Type: multipart/alternative; boundary="${boundary}"`,'',`--${boundary}`,part('text/plain',content.text),`--${boundary}`,part('text/html',content.html),`--${boundary}--`,''].join('\r\n');
}

export function setupRecapView({rpc,message}){
  const $=selector=>document.querySelector(selector);
  let snapshot,recaps=[],selectedId=null,request=0;
  const dialog=$('#recap-preview');
  function renderList(){
    const query=$('#recap-search').value.trim().toLowerCase();
    const filtered=recaps.filter(r=>`${r.name} ${r.email||''}`.toLowerCase().includes(query));
    $('#recap-count').textContent=`${filtered.length} ${filtered.length===1?'judge':'judges'} · Preview only · No emails sent`;
    $('#recap-list').innerHTML=filtered.map(r=>`<article class="recap-row"><div><strong>${escapeHtml(r.name)}</strong><p>${escapeHtml(r.email||'Email missing')}</p><small>${r.submittedCount} submitted wines · ${r.noteworthyCount} noteworthy${!r.userId?' · Login not linked':''}</small></div><button class="secondary" data-recap="${escapeHtml(r.id)}">Preview email →</button></article>`).join('')||'<div class="empty">No judges match.</div>';
    $('#recap-list').querySelectorAll('[data-recap]').forEach(button=>button.onclick=()=>open(button.dataset.recap));
  }
  function open(id){
    const recap=recaps.find(r=>r.id===id);if(!recap)return;
    selectedId=id;
    const content=recapContent(recap,snapshot);
    $('#recap-recipient').textContent=recap.email||'Email missing';
    $('#recap-subject').textContent=content.subject;
    // Only escaped text and our own static markup enter this preview.
    $('#recap-email').innerHTML=content.html;
    $('#recap-download').disabled=!recap.email;
    $('#recap-preview-title').textContent=`Email preview · ${recap.name}`;
    if(!dialog.open)dialog.showModal();
  }
  async function load(){
    const token=++request;
    $('#recap-load-status').textContent='Loading judge recaps…';
    $('#recap-reload').disabled=true;
    $('#recap-send-all').disabled=true;
    $('#recap-list').innerHTML='';
    $('#recap-count').textContent='';
    try{
      const fresh=await rpc('judge_recap_data');
      if(token!==request)return;
      snapshot=fresh;recaps=assembleRecaps(snapshot);renderList();
      $('#recap-send-all').disabled=false;
      $('#recap-load-status').textContent='Snapshot updated '+new Date(snapshot.generatedAt).toLocaleString();
      if(dialog.open)open(selectedId);
    }catch(error){
      if(token!==request)return;
      $('#recap-load-status').textContent=error.code==='PGRST202'?'Judge recaps need the database update installed first.':'Unable to load judge recaps. '+error.message;
    }finally{if(token===request)$('#recap-reload').disabled=false;}
  }
  $('#recap-send-all').onclick=()=>showEmailDeliveryNotice({kind:'recap',count:recaps.filter(r=>r.email&&r.items.length).length});
  $('#recap-search').oninput=renderList;
  $('#recap-reload').onclick=load;
  $('#recap-close').onclick=()=>dialog.close();
  $('#recap-copy').onclick=async()=>{
    const recap=recaps.find(r=>r.id===selectedId);if(!recap)return;
    try{const content=recapContent(recap,snapshot);await navigator.clipboard.writeText(`Subject: ${content.subject}\n\n${content.text}`);message('Email text copied.');}
    catch{message('Unable to copy. Select the preview text and copy it manually.',true);}
  };
  $('#recap-download').onclick=()=>{
    const recap=recaps.find(r=>r.id===selectedId);if(!recap)return;
    try{
      const content=recapContent(recap,snapshot);
      const url=URL.createObjectURL(new Blob([emailDraft(recap,content)],{type:'message/rfc822'}));
      const link=document.createElement('a');link.href=url;link.download=`judge-recap-${recap.id.replace(/[^a-z0-9-]/gi,'')}.eml`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(error){message(error.message,true);}
  };
  return {load};
}
