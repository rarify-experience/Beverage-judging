const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export const wineFilters=[['varietals','All varietals'],['region','All regions'],['label1','All classifications']];
export function filterWines(wines,{query='',varietals='',region='',label1=''}={}){const terms=normalize(query).split(/\s+/).filter(Boolean);return wines.filter(w=>{const searchable=normalize([w.entry_number,w.producer,w.name,w.distributor,w.vintage,w.varietals,w.country,w.region,w.subregion].join(' '));return terms.every(term=>searchable.includes(term))&&(!varietals||w.varietals===varietals)&&(!region||w.region===region)&&(!label1||w.label1===label1);});}
export function wineFilterOptions(wines,key){return [...new Set(wines.map(w=>w[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b));}
export function setupFlightWinePicker(root,wines){
  const search=root.querySelector('#flight-wine-search'),count=root.querySelector('#flight-wine-count'),empty=root.querySelector('#flight-wine-empty'),boxes=[...root.querySelectorAll('input[name="wineIds"]')];
  const filters=Object.fromEntries(wineFilters.map(([key])=>[key,root.querySelector('#flight-filter-'+key)]));
  let matches=new Set();
  const update=()=>{matches=new Set(filterWines(wines,{query:search.value,...Object.fromEntries(Object.entries(filters).map(([key,input])=>[key,input.value]))}).map(w=>w.id));let shown=0;for(const box of boxes){const visible=matches.has(box.value);box.closest('label').hidden=!visible;if(visible)shown++;}count.textContent=`${shown} of ${wines.length} wines shown · ${boxes.filter(b=>b.checked).length} selected`;empty.hidden=shown>0||wines.length===0;root.querySelector('#select-matching-wines').disabled=shown===0;root.querySelector('#clear-matching-wines').disabled=shown===0;};
  search.addEventListener('input',update);for(const input of Object.values(filters))input.addEventListener('change',update);for(const box of boxes)box.addEventListener('change',update);
  root.querySelector('#select-matching-wines').onclick=()=>{for(const box of boxes)if(matches.has(box.value))box.checked=true;update();};
  root.querySelector('#clear-matching-wines').onclick=()=>{for(const box of boxes)if(matches.has(box.value))box.checked=false;update();};
  root.querySelector('#reset-flight-wine-filters').onclick=()=>{search.value='';for(const input of Object.values(filters))input.value='';update();};
  update();
}
