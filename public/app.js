
const $=s=>document.querySelector(s),msg=s=>$('#message').textContent=s;
const api=async(u,o={})=>{const r=await fetch(u,{...o,headers:{'Content-Type':'application/json'}});const d=await r.json();if(!r.ok)throw Error(d.error||'Error');return d};
const post=(u,d)=>api(u,{method:'POST',body:JSON.stringify(d)});
const node=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e};
async function load(){try{const me=await api('/api/me');$('#login').classList.add('hidden');$('#app').classList.remove('hidden');$('#logout').classList.remove('hidden');$('#who').textContent=me.name;await accesses();if(me.role==='admin'){$('#admin').classList.remove('hidden');await users();await managedAccesses()}}catch(e){$('#login').classList.remove('hidden');$('#app').classList.add('hidden')}}
async function accesses(){const items=await api('/api/accesses'),root=$('#cards');root.replaceChildren();if(!items.length)root.append(node('p','No tenés accesos asignados.'));for(const a of items){const c=node('div','');c.className='card';c.append(node('h3',a.title),node('p','Usuario: '+a.username));const link=node('a','Abrir enlace');link.href=a.url;link.target='_blank';link.rel='noopener noreferrer';link.className='action';const copy=node('button','Copiar usuario');copy.className='secondary';copy.onclick=()=>navigator.clipboard.writeText(a.username).then(()=>msg('Usuario copiado'));const show=node('button','Ver contraseña');show.onclick=async()=>{try{const p=await api('/api/accesses/'+a.id+'/password');c.querySelector('.secret')?.remove();const area=node('div','');area.className='secret';area.append(node('p',p.password));const b=node('button','Copiar contraseña');b.onclick=()=>navigator.clipboard.writeText(p.password).then(()=>msg('Contraseña copiada'));area.append(b);c.append(area);setTimeout(()=>area.remove(),30000)}catch(e){msg(e.message)}};c.append(link,copy,show);root.append(c)}}
async function users(){const list=await api('/api/users'),select=$('#userId'),root=$('#users');select.replaceChildren();root.replaceChildren();for(const u of list){if(u.role!=='admin'){const opt=node('option',u.name+' — '+u.email);opt.value=u.id;select.append(opt)}const line=node('div','');line.className='user';line.append(node('strong',u.name+' — '+u.email+' ('+(u.active?'Activo':'Inactivo')+')'));if(u.role!=='admin'){const b=node('button',u.active?'Desactivar':'Activar');b.className='secondary';b.onclick=async()=>{try{await api('/api/users/'+u.id+'/status',{method:'PATCH',body:JSON.stringify({active:!u.active})});await users()}catch(e){msg(e.message)}};line.append(b)}root.append(line)}}

async function managedAccesses(){
 const items=await api('/api/admin/accesses'),root=$('#managedAccesses');
 root.replaceChildren();
 if(!items.length){root.append(node('p','Todavía no hay accesos asignados.'));return}
 for(const a of items){
  const form=document.createElement('form');form.className='managed-access';
  const heading=node('strong',a.employee_name+' — '+a.title);
  const fields=[['title','Plataforma',a.title,'text'],['url','Enlace',a.url,'url'],['username','Usuario',a.username,'text']];
  form.append(heading);
  for(const [name,label,value,type] of fields){
   const wrapper=document.createElement('label');wrapper.textContent=label;
   const input=document.createElement('input');input.name=name;input.type=type;input.required=true;input.value=value;
   wrapper.append(input);form.append(wrapper);
  }
  const actions=document.createElement('div');actions.className='managed-actions';
  const save=node('button','Guardar cambios');save.type='submit';
  const feedback=node('span','');feedback.className='muted';feedback.setAttribute('role','status');
  actions.append(save,feedback);form.append(actions);
  form.addEventListener('submit',async e=>{
   e.preventDefault();save.disabled=true;feedback.textContent='Guardando...';
   try{
    const data=Object.fromEntries(new FormData(form));
    const updated=await api('/api/admin/accesses/'+a.id,{method:'PATCH',body:JSON.stringify(data)});
    a.title=updated.title;a.url=updated.url;a.username=updated.username;
    heading.textContent=a.employee_name+' — '+a.title;
    feedback.textContent='✓ Cambios guardados';
    await accesses();
   }catch(err){feedback.textContent='Error: '+err.message}
   finally{save.disabled=false}
  });
  root.append(form);
 }
}
$('#loginForm').onsubmit=async e=>{e.preventDefault();try{await post('/api/login',Object.fromEntries(new FormData(e.target)));e.target.reset();msg('');await load()}catch(err){msg(err.message)}};
$('#pairExtension').onclick=async()=>{try{const r=await post('/api/extension/pair',{});$('#pairCode').textContent=r.code;$('#pairResult').classList.remove('hidden');msg('Código generado. Vence en 5 minutos.')}catch(e){msg(e.message)}};
$('#copyPairCode').onclick=()=>navigator.clipboard.writeText($('#pairCode').textContent).then(()=>msg('Código copiado')).catch(()=>msg('Seleccioná y copiá el código manualmente'));
$('#logout').onclick=async()=>{await post('/api/logout',{});location.reload()};
$('#newUser').onsubmit=async e=>{e.preventDefault();try{await post('/api/users',Object.fromEntries(new FormData(e.target)));e.target.reset();msg('Funcionario creado');await users()}catch(err){msg(err.message)}};

const platformUrls={
 'CRM MONETY':'https://crm.monetytrade.com/',
 'CRM MERCADOS':'https://mercadosinvest.tradingcrm.com/',
 'CRM VENTURY':'https://venturyfx.tradingcrm.com/',
 'SHARKWPP':'https://sharkwpp.linetechlabs.com/',
 'VOISO':'https://cc-dal01.voiso.com/',
 'VOICESPIN':'',
 'CLOUD':'https://cloud.clickwa.tech/',
 'FEROZO':'https://ferozo.email/',
 'COMIDAS LANSEL':'https://comidalansel.vercel.app/'
};
$('#platformPreset').addEventListener('change',e=>{
 const name=e.target.value;
 $('#platformTitle').value=name;
 $('#newAccess').elements.url.value=platformUrls[name]||'';
});
$('#newAccess').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));await post('/api/users/'+d.userId+'/accesses',d);e.target.reset();msg('Acceso asignado');await managedAccesses()}catch(err){msg(err.message)}};
load();
