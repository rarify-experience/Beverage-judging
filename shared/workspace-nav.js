export function mountWorkspaceNav(account,current){
  const root=document.querySelector('#workspace-nav');
  if(!root)return;
  const admin=account.roles.includes('admin');
  const moderator=admin||account.roles.includes('moderator');
  root.replaceChildren();
  for(const [id,label,href,visible] of [['admin','Admin','/admin/',admin],['moderator','Moderator','/moderator/',moderator]]){
    if(!visible)continue;
    const link=document.createElement('a');link.href=href;link.textContent=label;
    if(id===current)link.setAttribute('aria-current','page');
    root.append(link);
  }
  root.hidden=false;
}
// This is a preparation action only. Delivery needs a configured email service.
export function showEmailDeliveryNotice({kind,count}){
  let dialog=document.querySelector('#email-delivery-notice');
  if(!dialog){
    dialog=document.createElement('dialog');dialog.id='email-delivery-notice';
    dialog.setAttribute('aria-labelledby','email-delivery-title');
    dialog.innerHTML='<h2 id="email-delivery-title"></h2><p id="email-delivery-count"></p><p>Email delivery is not connected yet. No emails have been sent.</p><p id="email-delivery-next"></p><form method="dialog"><button autofocus>Close</button></form>';
    document.body.append(dialog);
  }
  dialog.querySelector('h2').textContent=kind==='setup'?'Send setup emails to all judges':'Send recap emails to all judges';
  dialog.querySelector('#email-delivery-count').textContent=`${count} ${count===1?'judge':'judges'} ${kind==='setup'?'on the event roster':'with submitted scores or noteworthy wines'}.`;
  dialog.querySelector('#email-delivery-next').textContent=count===0?'There are no recipients yet.':kind==='setup'?'This will invite judges to set up their event accounts once email delivery is connected.':'Review each judge’s email using Preview email. You can copy or download individual drafts now.';
  dialog.showModal();
}
