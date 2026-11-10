import {db,eventId,$,esc,rpc,unwrap,rows,requireUser,toolbar,attributes,guard,message,watch} from '/shared/app.js';
import {criteria} from './criteria.js';
import {createBookmarks} from './bookmarks.js';
let bookmarks;
let account,flights=[],flightWines=[],assignments=[],panels=[],submissions=[],drafts=new Map(),currentFlight=null,currentWine=null,openCriterion='sight',queue=Promise.resolve(),submitting=false;
const draftKey=(f,w)=>f+':'+w;
const storageKey=()=>`rarify-pending-drafts:${account.user.id}:${eventId}`;
function cache(){const pending=Object.fromEntries([...drafts].filter(([,d])=>d.dirty));try{localStorage.setItem(storageKey(),JSON.stringify(pending));}catch{message('Browser backup unavailable. Keep this screen open until drafts are saved.',true);}}
const receipt=(f,w)=>submissions.find(s=>s.flight_id===f&&s.wine_id===w);
const flightItems=f=>flightWines.filter(w=>w.flight_id===f).sort((a,b)=>a.position-b.position);
const complete=s=>attributes.every(([id,,max])=>Number.isInteger(s?.[id])&&s[id]>=0&&s[id]<=max);
function scoresFor(f,w){const key=draftKey(f,w);if(!drafts.has(key))drafts.set(key,{scores:{},dirty:false});return drafts.get(key);}
function screen(name){for(const element of document.querySelectorAll('.screen'))element.classList.toggle('active',element.id===name+'-screen');}
async function refresh(){const [fs,ws,as,ps,ss,ds]=await Promise.all([rows('flights'),rows('flight_wines'),rows('flight_panels'),rows('panels'),rows('score_submissions',q=>q.eq('judge_id',account.user.id).order('flight_id').order('wine_id')),rows('score_drafts',q=>q.eq('judge_id',account.user.id).order('flight_id').order('wine_id'))]);await bookmarks.refresh();flights=fs.sort((a,b)=>a.number-b.number);flightWines=ws;assignments=as;panels=ps;submissions=ss;for(const d of ds){const key=draftKey(d.flight_id,d.wine_id);if(!drafts.has(key)||!drafts.get(key).dirty)drafts.set(key,{scores:Object.fromEntries(attributes.filter(([k])=>d[k]!==null).map(([k])=>[k,d[k]])),dirty:false});}for(const s of submissions)drafts.delete(draftKey(s.flight_id,s.wine_id));cache();renderWaiting();if(currentFlight)renderFlight();if(currentWine&&receipt(currentFlight,currentWine))renderWine();}
function renderWaiting(){$('#judge-name').textContent=account.profile.display_name;$('#panel-name').textContent=panels.map(p=>'Panel '+p.letter).join(' · ')||'Awaiting panel assignment';const pending=flights.filter(f=>flightItems(f.id).some(w=>!receipt(f.id,w.wine_id)));$('#waiting-status').textContent=pending.length?'Your next flight is ready':'Awaiting your next flight';$('#waiting-flights').innerHTML=flights.map(f=>{const wines=flightItems(f.id),n=wines.filter(w=>receipt(f.id,w.wine_id)).length;return `<button class="flight-choice" data-flight="${f.id}"><strong>${esc(f.name)} ${n===wines.length?'✓':'→'}</strong><small>${wines.length} wines · ${n} submitted${n===wines.length?' · View receipts':''}</small></button>`;}).join('');document.querySelectorAll('[data-flight]').forEach(b=>b.onclick=()=>{currentFlight=b.dataset.flight;currentWine=null;renderFlight();screen('flight');});}
function renderFlight(){const f=flights.find(f=>f.id===currentFlight);if(!f)return;$('#flight-title').textContent=f.name;$('#flight-description').textContent=f.description;const wines=flightItems(f.id),n=wines.filter(w=>receipt(f.id,w.wine_id)).length;$('#progress-fill').style.width=(wines.length?n/wines.length*100:0)+'%';$('#progress-copy').textContent=`${n} of ${wines.length} wines submitted`;$('#wine-list').innerHTML=wines.map(w=>{const s=receipt(f.id,w.wine_id),draft=scoresFor(f.id,w.wine_id);return `<button class="wine-tile" data-wine="${w.wine_id}"><span class="list-number">${w.position}</span><span class="wine-main"><strong>Wine ${esc(w.blind_code)}</strong><span>${bookmarks.has(f.id,w.wine_id)?'★ Noteworthy · ':''}${s?'Submission confirmed':complete(draft.scores)?'Draft complete · ready to submit':Object.keys(draft.scores).length?'Draft in progress':'Not scored'}</span></span><span class="wine-state"><span class="score">${s?s.total+'/20':'›'}</span></span></button>`;}).join('');document.querySelectorAll('[data-wine]').forEach(b=>b.onclick=()=>{currentWine=b.dataset.wine;const draft=scoresFor(currentFlight,currentWine);openCriterion=attributes.find(([id])=>draft.scores[id]===undefined)?.[0]||'sight';renderWine();screen('wine');scrollAttributeIntoView(false);});}
function renderWine(){
  const wine=flightItems(currentFlight).find(w=>w.wine_id===currentWine);
  if(!wine)return;
  renderBookmark();
  const submitted=receipt(currentFlight,currentWine),draft=scoresFor(currentFlight,currentWine),scores=submitted||draft.scores;
  const flight=flights.find(f=>f.id===currentFlight);
  const panelIds=new Set(assignments.filter(a=>a.flight_id===currentFlight).map(a=>a.panel_id));
  const panelLabels=panels.filter(p=>panelIds.has(p.id)).map(p=>'Panel '+p.letter);
  $('#wine-focus-name').textContent='Wine '+wine.blind_code;
  $('#wine-focus-description').textContent=flight.description||flight.name;
  $('#wine-context').textContent=['Flight '+flight.number,...panelLabels].join(' · ');
  $('#wine-number').textContent=wine.position;
  $('#wine-name').textContent='Wine '+wine.blind_code;
  $('#wine-status').textContent=submitted?'Submitted · '+submitted.total+'/20':'Private draft';
  $('#draft-status').textContent=submitted?'Receipt: '+new Date(submitted.submitted_at).toLocaleString():draft.dirty?'Changes waiting to save':Object.keys(scores).length?'Draft saved · private to you':'Draft scores save to your account as you work.';
  const filled=criteria.filter(c=>Number.isInteger(scores[c.id])).length;
  $('#attribute-track').innerHTML=criteria.map(c=>`<span class="${Number.isInteger(scores[c.id])?'is-scored':''}"></span>`).join('');
  $('#attribute-track').setAttribute('aria-valuenow',String(filled));
  $('#attribute-progress-copy').textContent=filled+' / '+criteria.length;
  $('#wine-total').textContent=submitted?submitted.total:attributes.reduce((sum,[id])=>sum+(scores[id]??0),0);
  $('#wine-total-label').textContent=submitted||filled===criteria.length?'Wine total':'Draft total';
  $('#criteria-list').innerHTML=criteria.map((c,i)=>`<section class="criterion ${c.id===openCriterion?'open':''}"><button type="button" class="criterion-summary" data-criterion="${c.id}" aria-expanded="${c.id===openCriterion}" aria-controls="criterion-body-${c.id}"><span><span class="title">${esc(c.title)}</span>${c.subtitle?`<span class="subtitle">${esc(c.subtitle)}</span>`:''}</span><span class="criterion-right"><span class="criterion-score">${scores[c.id]??'—'} / ${c.max}</span><span class="criterion-chevron" aria-hidden="true"></span></span></button><div id="criterion-body-${c.id}" class="criterion-body" ${c.id===openCriterion?'':'hidden'}><div class="score-buttons" style="--score-count:${c.max+1}">${Array.from({length:c.max+1},(_,v)=>`<button type="button" class="score-btn ${scores[c.id]===v?'selected':''}" data-score="${v}" data-attribute="${c.id}" aria-pressed="${scores[c.id]===v}" aria-label="${esc(c.title)} score ${v}" ${submitted||submitting?'disabled':''}>${v}</button>`).join('')}</div><div class="guide"><strong>Scoring guide</strong>${c.guide.map(line=>`<div>${esc(line)}</div>`).join('')}</div><button class="complete-criterion" data-next="${c.id}" ${scores[c.id]===undefined?'disabled':''}>${submitted?'View next attribute':i===criteria.length-1?'Review wine':'Complete attribute'}</button></div></section>`).join('');
  $('#submit-wine').disabled=!!submitted||!complete(draft.scores)||submitting;
  $('#submit-wine').textContent=submitted?'Wine submitted':submitting?'Submitting…':'Submit wine';
  document.querySelectorAll('[data-criterion]').forEach(b=>b.onclick=()=>{openCriterion=openCriterion===b.dataset.criterion?null:b.dataset.criterion;renderWine();if(openCriterion)scrollAttributeIntoView();});
  document.querySelectorAll('[data-next]').forEach(b=>b.onclick=()=>{const i=criteria.findIndex(c=>c.id===b.dataset.next);openCriterion=criteria[i+1]?.id||null;renderWine();scrollAttributeIntoView();});
  document.querySelectorAll('[data-score]').forEach(b=>b.onclick=()=>{draft.scores[b.dataset.attribute]=Number(b.dataset.score);draft.dirty=true;cache();renderWine();persistDraft(currentFlight,currentWine);});
}

function persistDraft(f,w){const draft=scoresFor(f,w);const snapshot={...draft.scores};const assignment=assignments.find(a=>a.flight_id===f);queue=queue.then(async()=>{if(receipt(f,w)||!draft.dirty)return;try{if(!assignment)throw Error('No released panel assignment');await unwrap(db.from('score_drafts').upsert({event_id:eventId,flight_id:f,panel_id:assignment.panel_id,wine_id:w,judge_id:account.user.id,...Object.fromEntries(attributes.map(([k])=>[k,snapshot[k]??null]))},{onConflict:'event_id,flight_id,wine_id,judge_id'}));if(JSON.stringify(draft.scores)===JSON.stringify(snapshot))draft.dirty=false;cache();if(currentFlight===f&&currentWine===w)$('#draft-status').textContent=draft.dirty?'Saving latest change…':'Draft saved · private to you';}catch(e){if(currentFlight===f&&currentWine===w)$('#draft-status').textContent='Draft not synced · reconnect and retry';message('Draft is backed up in this browser. '+e.message,true);}});return queue;}
async function submit(){if(submitting||receipt(currentFlight,currentWine))return;const draft=scoresFor(currentFlight,currentWine);if(!complete(draft.scores))return;if(!confirm('Submit this wine? Its scores will be final and visible to the moderator.'))return;const f=currentFlight,w=currentWine,a=assignments.find(a=>a.flight_id===f);submitting=true;renderWine();try{await queue;const result=await rpc('submit_wine',{p_flight_id:f,p_panel_id:a.panel_id,p_wine_id:w,p_scores:{...draft.scores}});const confirmed=Array.isArray(result)?result[0]:result;if(!confirmed?.submitted_at)throw Error('No submission receipt returned');submissions=submissions.filter(s=>!(s.flight_id===f&&s.wine_id===w));submissions.push(confirmed);drafts.delete(draftKey(f,w));cache();currentFlight=f;currentWine=null;renderFlight();screen('flight');message('Wine submitted. Receipt confirmed.');}catch(e){message('Submission was not confirmed. Please retry. '+e.message,true);}finally{submitting=false;renderWine();}}
$('#submit-wine').onclick=submit;$('#back-flight').onclick=$('#save-back').onclick=()=>{renderFlight();screen('flight');};$('#back-waiting').onclick=()=>{currentFlight=null;currentWine=null;renderWaiting();screen('waiting');};
window.addEventListener('online',()=>{for(const [key,d] of drafts)if(d.dirty){const [f,w]=key.split(':');persistDraft(f,w);}});
window.addEventListener('beforeunload',e=>{if([...drafts.values()].some(d=>d.dirty)){e.preventDefault();e.returnValue='';}});
guard(async()=>{account=await requireUser(['judge']);toolbar(account);bookmarks=createBookmarks({db,eventId,userId:account.user.id});try{const pending=JSON.parse(localStorage.getItem(storageKey())||'{}');for(const [key,d] of Object.entries(pending))if(d.dirty)drafts.set(key,d);}catch{message('Unable to restore browser drafts.',true);}await refresh();for(const [key,d] of drafts)if(d.dirty){const [f,w]=key.split(':');persistDraft(f,w);}watch(['flight_panels','score_submissions'],refresh);})();

function renderBookmark(){
  const button=$('#noteworthy');
  const saved=bookmarks.has(currentFlight,currentWine);
  button.setAttribute('aria-pressed',String(saved));
  const label=saved?'Remove noteworthy bookmark':'Mark wine as noteworthy';
  button.setAttribute('aria-label',label);
  button.title=label;
  button.disabled=bookmarks.busy(currentFlight,currentWine);
}
$('#noteworthy').onclick=async()=>{
  const flight=currentFlight,wine=currentWine;
  const saving=bookmarks.toggle(flight,wine);
  renderBookmark();
  try{await saving;renderFlight();message(bookmarks.has(flight,wine)?'Saved to your noteworthy wines.':'Noteworthy bookmark removed.');}
  catch(error){message('Bookmark could not be saved. Please retry. '+error.message,true);}
  finally{if(currentFlight&&currentWine)renderBookmark();}
};

// Scroll only the wine's content area, leaving the account bar and footer alone.
// Run after layout so the expanded card and sticky wine description are measured.
let attributeScrollFrame;
function scrollAttributeIntoView(animate=true){
  cancelAnimationFrame(attributeScrollFrame);
  attributeScrollFrame=requestAnimationFrame(()=>{
    const scroller=$('#wine-screen');
    if(!scroller.classList.contains('active'))return;
    const target=openCriterion?scroller.querySelector('.criterion.open'):scroller.querySelector('.wine-total');
    if(!target)return;
    const context=$('#wine-focus-context');
    const top=scroller.scrollTop+target.getBoundingClientRect().top-scroller.getBoundingClientRect().top-context.offsetHeight-12;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scroller.scrollTo({top:Math.max(0,top),behavior:animate&&!reduced?'smooth':'instant'});
  });
}
