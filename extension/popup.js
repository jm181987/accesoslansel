const API='https://accesoslansel.vercel.app';const $=id=>document.getElementById(id);const say=t=>$('status').textContent=t;async function request(path,token,body){const r=await fetch(API+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok)throw Error(d.error||'Error');return d}async function current(){const [tab]=await chrome.tabs.query({active:true,currentWindow:true});if(!tab||!tab.url)throw Error('Abrí una plataforma');const u=new URL(tab.url);if(u.protocol!=='https:')throw Error('Solo sitios HTTPS');return {tab,origin:u.origin,host:u.hostname}}function crmKind(title){const t=String(title||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();return t.includes('VENTURY')?'ventury':t.includes('MERCADOS')?'mercados':null}
function permittedOrigin(item,origin){try{const saved=new URL(item.url).origin;if(saved===origin)return true;const k=crmKind(item.title);return k==='ventury'?['https://adfs365.stg-tradingcrm.com','https://venturyfx.tradingcrm.com'].includes(saved)&&['https://adfs365.stg-tradingcrm.com','https://venturyfx.tradingcrm.com'].includes(origin):k==='mercados'?['https://mercadosinvest.tradingcrm.com','https://adfs365.stg-tradingcrm.com'].includes(saved)&&['https://mercadosinvest.tradingcrm.com','https://adfs365.stg-tradingcrm.com'].includes(origin):false}catch{return false}}
async function load(){
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
    const kind=crmKind(item.title);
    const url=kind==='ventury'?'https://venturyfx.tradingcrm.com/':kind==='mercados'?'https://mercadosinvest.tradingcrm.com/':item.url;
    chrome.tabs.create({url});
   };
   row.append(title,open);
   if(origin&&permittedOrigin(item,origin)){
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
async function fill(id){
 try{
  const {token}=await chrome.storage.local.get('token');
  const {tab,origin}=await current();
  const platforms=await request('/api/extension/platforms',token);
  const item=platforms.find(a=>String(a.id)===String(id));
  if(!item)throw Error('Acceso no asignado');
  const c=await request('/api/extension/fill',token,{id,origin});
  const voiceSpin=/\\bVOICE\\s*SPIN\\b|\\bVOICESPIN\\b/i.test(String(item.title||''));
  const results=await chrome.scripting.executeScript({
   target:{tabId:tab.id},
   func:(username,password,expectedOrigin,isVoiceSpin)=>{
    if(location.origin!==expectedOrigin)return 'origin';
    const visible=el=>el.getClientRects().length>0&&!el.disabled&&!el.readOnly;
    const inputs=[...document.querySelectorAll('input')].filter(visible);
    const set=(el,value)=>{
     const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
     if(!setter)return false;
     setter.call(el,String(value));
     el.dispatchEvent(new Event('input',{bubbles:true}));
     el.dispatchEvent(new Event('change',{bubbles:true}));
     return true;
    };
    if(isVoiceSpin){
     const fields=inputs.filter(el=>!['hidden','submit','button','checkbox','radio','file'].includes(el.type));
     if(fields.length<3)return 'fields';
     const firstThree=fields.slice(0,3);
     if(!firstThree.every(el=>['text','email','tel','number','password',''].includes(el.type)))return 'fields';
     for(const [el,value] of [[firstThree[0],username],[firstThree[1],username],[firstThree[2],password]])set(el,value);
     return 'ok';
    }
    const p=inputs.find(e=>e.type==='password');
    if(!p)return 'fields';
    const root=p.form||document;
    const u=[...root.querySelectorAll('input')].find(e=>e!==p&&['text','email','tel',''].includes(e.type)&&visible(e))||inputs.find(e=>e!==p&&['text','email','tel',''].includes(e.type));
    if(!u)return 'fields';
    set(u,username);set(p,password);return 'ok';
   },
   args:[c.username,c.password,origin,voiceSpin]
  });
  const result=results[0]?.result;
  say(result==='ok'?'Campos completados; iniciá sesión manualmente':result==='fields'?'No se encontraron los campos de inicio de sesión esperados':'No se pudo completar el formulario en este dominio');
 }catch(e){say(e.message)}
}
$('connect').onclick=async()=>{try{const {token:existing}=await chrome.storage.local.get('token');if(existing)throw Error('Ya existe una vinculación. Solicitá al administrador que la revoque.');const code=$('code').value.trim();const d=await request('/api/extension/exchange',null,{code});await chrome.storage.local.set({token:d.token});$('code').value='';await load()}catch(e){say(e.message)}};load();