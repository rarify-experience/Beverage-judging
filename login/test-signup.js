export function workspaceForRoles(roles=[]){return roles.includes('admin')?'/admin/':roles.includes('moderator')?'/moderator/':'/judges/';}
export async function createTestAccount(client,call,email,password){
  const normalized=email.trim().toLowerCase();
  if(password.length<6)throw Error('Use at least 6 characters.');
  if(!await call('activation_email_eligible',{p_email:normalized}))throw Error('This email is not on the judge roster or approved staff list. Contact the event administrator.');
  const {data,error}=await client.auth.signUp({email:normalized,password});
  if(error){if(error.code==='user_already_exists'||/already registered/i.test(error.message))throw Error('This email already has an account. Go back and sign in with its existing password.');throw error;}
  if(!data?.session)throw Error('No sign-in session was returned. If you already created this account, choose Sign in and use its existing password. If sign-in reports an unconfirmed email, ask the event administrator to confirm that test account.');
  try{return await call('activate_event_account');}catch(error){throw Error('Your account was created, but event access was not confirmed. Go back and sign in to retry. '+error.message);}
}
