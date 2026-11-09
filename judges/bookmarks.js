// Bookmarks are separate from scores and remain editable after submission.
export function createBookmarks({db,eventId,userId}) {
  let saved=new Set();
  const pending=new Set();
  let revision=0;
  const key=(flight,wine)=>flight+':'+wine;
  return {
    has:(flight,wine)=>saved.has(key(flight,wine)),
    busy:(flight,wine)=>pending.has(key(flight,wine)),
    async refresh(){
      const started=revision;
      const next=new Set();
      for(let offset=0;;offset+=500){
        const {data,error}=await db.from('judge_bookmarks').select('flight_id,wine_id').eq('event_id',eventId).eq('judge_id',userId).range(offset,offset+499);
        if(error)throw error;
        for(const row of data)next.add(key(row.flight_id,row.wine_id));
        if(data.length<500)break;
      }
      // A refresh started before a write must not replace its result.
      if(!pending.size && started===revision)saved=next;
    },
    async toggle(flight,wine){
      const id=key(flight,wine);
      if(pending.has(id))return;
      pending.add(id);revision++;
      try{
        const remove=saved.has(id);
        const result=remove
          ? await db.from('judge_bookmarks').delete().eq('event_id',eventId).eq('judge_id',userId).eq('flight_id',flight).eq('wine_id',wine)
          : await db.from('judge_bookmarks').insert({event_id:eventId,judge_id:userId,flight_id:flight,wine_id:wine});
        if(result.error)throw result.error;
        if(remove)saved.delete(id);else saved.add(id);
      }finally{pending.delete(id);revision++;}
    }
  };
}
