// Rank the selected flight scope before applying a wine-name search.
// Equal unrounded averages share a competition rank (1, 1, 3).
export function rankWineResults(entries,submissions){
  const groups=new Map();
  for(const score of submissions){const key=score.flight_id+':'+score.wine_id;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(score);}
  const ranked=entries.map(entry=>{const cards=groups.get(entry.f.id+':'+entry.w.id)||[];const total=cards.reduce((n,s)=>n+s.total,0);return {...entry,cards,count:cards.length,total,average:cards.length?total/cards.length:null,rank:null,tied:false};});
  const compare=(a,b)=>b.total*a.count-a.total*b.count;
  ranked.sort((a,b)=>{if(!a.count||!b.count){if(a.count!==b.count)return a.count?-1:1;}else{const difference=compare(a,b);if(difference)return difference;}return a.f.number-b.f.number||a.fw.position-b.fw.position||a.w.id.localeCompare(b.w.id);});
  for(let i=0;i<ranked.length;i++){const row=ranked[i];if(!row.count)continue;const previous=ranked[i-1];if(previous?.count&&compare(previous,row)===0){row.rank=previous.rank;row.tied=previous.tied=true;}else row.rank=i+1;}
  return ranked;
}
