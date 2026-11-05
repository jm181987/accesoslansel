const API='https://accesoslansel.vercel.app';const $=id=>document.getElementById(id);const say=t=>$('status').textContent=t;async function request(path,token,body){const r=await fetch(API+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok)throw Error(d.error||'Error');return d}async function current(){const [tab]=await chrome.tabs.query({active:true,currentWindow:true});if(!tab||!tab.url)throw Error('Abrí una plataforma');const u=new URL(tab.url);if(u.protocol!=='https:')throw Error('Solo sitios HTTPS');return {tab,origin:u.origin,host:u.hostname}}async function load(){
 const {token}=await chrome.storage.local.get('token');
 $('pairSetup').hidden=!!token;$('linkedNotice').hidden=!token;
 $('accesses').replaceChildren();
 if(!token)return say('Solicitá al administrador un código de vinculación y pegalo aquí');
 try{
  const account=await request('/api/extension/me',token);
  const platforms=await request('/api/extension/platforms',token);
  let origin=null;
  try{origin=(await current()).origin}catch{}
  say('Vinculado como '+account.name+' · '+platforms.length+' plataformas asignadas');
  if(!platforms.length){$('accesses').append(Object.assign(document.createElement('p'),{textContent:'No tenés plataformas asignadas. Contactá al administrador.'}));return}
  for(const item of platforms){
   const row=document.createElement('div');row.className='platform-row';
   const title=document.createElement('strong');title.textContent=item.title;
   const open=document.createElement('button');open.type='button';open.textContent='Abrir '+item.title;
   open.onclick=()=>{
    const title=String(item.title||'').trim().toUpperCase();
    const url=title==='CRM VENTURY'?'https://venturyfx.tradingcrm.com/':title==='CRM MERCADOS'?'https://mercadosinvest.tradingcrm.com/':item.url;
    chrome.tabs.create({url});
   };
   row.append(title,open);
   if(origin&&(new URL(item.url).origin===origin||(String(item.title||'').trim().toUpperCase()==='CRM VENTURY'&&new URL(item.url).origin==='https://adfs365.stg-tradingcrm.com'&&origin==='https://venturyfx.tradingcrm.com'))){
    const fillButton=document.createElement('button');fillButton.type='button';fillButton.textContent='Completar credenciales';
    fillButton.onclick=()=>fill(item.id);row.append(fillButton);
   }
   $('accesses').append(row);
  }
 }catch(e){
  if(/vencid|inválid|vinculá la extensión/i.test(e.message)){
   await chrome.storage.local.remove('token');$('pairSetup').hidden=false;$('linkedNotice').hidden=true;
   $('accesses').replaceChildren();say('Vinculación vencida o revocada. Solicitá un código nuevo al administrador.');
  }else say(e.message);
 }
}
async function fill(id){try{const {token}=await chrome.storage.local.get('token');const {tab,origin}=await current();const c=await request('/api/extension/fill',token,{id,origin});const results=await chrome.scripting.executeScript({target:{tabId:tab.id},func:(username,password,origin)=>{if(location.origin!==origin)return false;const p=[...document.querySelectorAll('input[type=password]')].find(e=>e.getClientRects().length);if(!p)return false;const root=p.form||document;const u=[...root.querySelectorAll('input')].find(e=>e!==p&&['text','email',''].includes(e.type)&&e.getClientRects().length);if(!u)return false;for(const [el,value] of [[u,username],[p,password]]){Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}return true},args:[c.username,c.password,origin]});say(results[0]?.result?'Campos completados; iniciá sesión manualmente':'No se encontraron campos compatibles')}catch(e){say(e.message)}}$('connect').onclick=async()=>{try{const {token:existing}=await chrome.storage.local.get('token');if(existing)throw Error('Ya existe una vinculación. Solicitá al administrador que la revoque.');const code=$('code').value.trim();const d=await request('/api/extension/exchange',null,{code});await chrome.storage.local.set({token:d.token});$('code').value='';await load()}catch(e){say(e.message)}};load();