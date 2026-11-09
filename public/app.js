
const $=s=>document.querySelector(s),msg=s=>$('#message').textContent=s;
const api=async(u,o={})=>{const r=await fetch(u,{...o,headers:{'Content-Type':'application/json'}});const d=await r.json();if(!r.ok)throw Error(d.error||'Error');return d};
const post=(u,d)=>api(u,{method:'POST',body:JSON.stringify(d)});
const node=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e};
async function load(){try{const me=await api('/api/me');$('#login').classList.add('hidden');$('#app').classList.remove('hidden');$('#logout').classList.remove('hidden');$('#who').textContent=me.name;await accesses();if(me.role==='admin'){$('#admin').classList.remove('hidden');await users();await managedAccesses();await loadExtensionVersions()}}catch(e){$('#login').classList.remove('hidden');$('#app').classList.add('hidden')}}
async function accesses(){const items=await api('/api/accesses'),root=$('#cards');root.replaceChildren();if(!items.length)root.append(node('p','No tenés accesos asignados.'));for(const a of items){const c=node('div','');c.className='card';c.append(node('h3',a.title),node('p','Usuario: '+a.username));const link=node('a','Abrir enlace');link.href=a.url;link.target='_blank';link.rel='noopener noreferrer';link.className='action';const copy=node('button','Copiar usuario');copy.className='secondary';copy.onclick=()=>navigator.clipboard.writeText(a.username).then(()=>msg('Usuario copiado'));const show=node('button','Ver contraseña');show.onclick=async()=>{try{const p=await api('/api/accesses/'+a.id+'/password');c.querySelector('.secret')?.remove();const area=node('div','');area.className='secret';area.append(node('p',p.password));const b=node('button','Copiar contraseña');b.onclick=()=>navigator.clipboard.writeText(p.password).then(()=>msg('Contraseña copiada'));area.append(b);c.append(area);setTimeout(()=>area.remove(),30000)}catch(e){msg(e.message)}};c.append(link,copy,show);root.append(c)}}
async function users(){const list=await api('/api/users'),select=$('#userId'),pairSelect=$('#adminPairUser'),root=$('#users');const oldSelect=select.value,oldPair=pairSelect.value;select.replaceChildren();pairSelect.replaceChildren();root.replaceChildren();for(const u of list){if(u.role!=='admin'){const opt=node('option',u.name+' — '+u.email);opt.value=u.id;select.append(opt);if(u.active)pairSelect.append(new Option(u.name+' — '+u.email,String(u.id)))}const line=node('div','');line.className='user';line.dataset.search=(u.name+' '+u.email).toLowerCase();line.append(node('strong',u.name+' — '+u.email+' ('+(u.active?'Activo':'Inactivo')+')'));if(u.role!=='admin'){const b=node('button',u.active?'Desactivar':'Activar');b.className='secondary';b.onclick=async()=>{try{await api('/api/users/'+u.id+'/status',{method:'PATCH',body:JSON.stringify({active:!u.active})});await users()}catch(e){msg(e.message)}};line.append(b)}root.append(line)}if(oldSelect&&[...select.options].some(o=>o.value===oldSelect))select.value=oldSelect;if(oldPair&&[...pairSelect.options].some(o=>o.value===oldPair))pairSelect.value=oldPair;filterUsers()}
function filterUsers(){const q=($('#userSearch')?.value||'').trim().toLowerCase();document.querySelectorAll('#users .user').forEach(row=>row.classList.toggle('hidden',!row.dataset.search.includes(q)))}
$('#userSearch').addEventListener('input',filterUsers);
function showAdminTab(tab){document.querySelectorAll('.admin-section').forEach(el=>el.classList.toggle('hidden',el.dataset.section!==tab));document.querySelectorAll('[data-admin-tab]').forEach(btn=>{const active=btn.dataset.adminTab===tab;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active))});}
document.querySelectorAll('[data-admin-tab]').forEach(btn=>btn.addEventListener('click',()=>showAdminTab(btn.dataset.adminTab)));
showAdminTab('assign');

async function loadExtensionVersions(){
 const root=$('#extensionVersions');root.textContent='Cargando versiones...';
 try{
  const list=await api('/api/admin/extensions');root.replaceChildren();
  if(!list.length){root.textContent='No hay funcionarios registrados.';return}
  const table=document.createElement('table');table.className='extension-table';
  const head=document.createElement('thead'),hr=document.createElement('tr');
  for(const title of ['Funcionario','Versión reportada','Última conexión','Estado'])hr.append(node('th',title));head.append(hr);table.append(head);
  const body=document.createElement('tbody');
  for(const u of list){
   const tr=document.createElement('tr');
   const last=u.last_seen?new Date(u.last_seen):null;
   const status=!u.expires?'Sin vinculación vigente':!u.version?'Vinculado · sin reporte':last&&Date.now()-last.getTime()>7*86400000?'Sin actividad reciente':'Reportado';
   for(const value of [u.name+' · '+u.email,u.version||'No informada',last?last.toLocaleString('es-UY'):'Nunca',status])tr.append(node('td',value));
   body.append(tr);
  }
  table.append(body);root.append(table);
 }catch(e){root.textContent='No se pudo cargar: '+e.message}
}
$('#refreshExtensionVersions').addEventListener('click',loadExtensionVersions);
$('#adminPairUser').addEventListener('change',()=>{$('#adminPairResult').classList.add('hidden');$('#adminPairCode').textContent=''});
$('#adminPairGenerate').onclick=async()=>{
 const select=$('#adminPairUser'),id=select.value,button=$('#adminPairGenerate');
 if(!id){msg('Seleccioná un funcionario activo');return}
 button.disabled=true;$('#adminPairResult').classList.add('hidden');$('#adminPairCode').textContent='';
 try{
  const r=await post('/api/admin/users/'+encodeURIComponent(id)+'/extension/pair',{});
  $('#adminPairFor').textContent='Código para '+r.user.name+' ('+r.user.email+') · vence en 5 minutos';
  $('#adminPairCode').textContent=r.code;
  $('#adminPairResult').classList.remove('hidden');
  msg('Código generado para '+r.user.name);
 }catch(e){msg(e.message)}finally{button.disabled=false}
};
$('#adminPairRevoke').onclick=async()=>{
 const id=$('#adminPairUser').value;
 if(!id){msg('Seleccioná un funcionario');return}
 const name=$('#adminPairUser').selectedOptions[0]?.textContent||'el funcionario';
 if(!confirm('¿Revocar las vinculaciones de '+name+'? La extensión dejará de funcionar y necesitará un nuevo código.'))return;
 const button=$('#adminPairRevoke');button.disabled=true;
 try{await post('/api/admin/users/'+encodeURIComponent(id)+'/extension/revoke',{});$('#adminPairResult').classList.add('hidden');$('#adminPairCode').textContent='';msg('Vinculación revocada. Generá un código nuevo si necesitás volver a vincular.')}catch(e){msg(e.message)}finally{button.disabled=false}
};
$('#adminPairCopy').onclick=()=>navigator.clipboard.writeText($('#adminPairCode').textContent).then(()=>msg('Código copiado')).catch(()=>msg('Seleccioná y copiá el código manualmente'));
async function managedAccesses(selectedId, preferredEmployeeId){
 const items=await api('/api/admin/accesses'),root=$('#managedAccesses');
 const previousEmployeeId=preferredEmployeeId||root.querySelector('select')?.value||'';
 root.replaceChildren();
 if(!items.length){root.append(node('p','Todavía no hay accesos asignados.'));return}
 const filterLabel=document.createElement('label');filterLabel.textContent='Seleccionar funcionario';
 const employeeSelect=document.createElement('select');
 const employees=[...new Map(items.map(a=>[String(a.employee_id),{id:String(a.employee_id),name:a.employee_name,email:a.employee_email}])).values()];
 const emptyEmployee=new Option('Elegí un funcionario','');employeeSelect.append(emptyEmployee);
 for(const u of employees)employeeSelect.append(new Option(u.name+' — '+u.email,u.id));
 filterLabel.append(employeeSelect);
 const accessLabel=document.createElement('label');accessLabel.textContent='Seleccionar plataforma';
 const accessSelect=document.createElement('select');accessSelect.disabled=true;
 accessLabel.append(accessSelect);
 const editor=document.createElement('div');
 root.append(filterLabel,accessLabel,editor);
 function renderEditor(){
  editor.replaceChildren();
  const a=items.find(x=>String(x.id)===accessSelect.value);
  if(!a)return;
  const form=document.createElement('form');form.className='managed-access';
  const heading=node('strong',a.employee_name+' — '+a.title);form.append(heading);
  for(const [name,label,value,type] of [['title','Plataforma',a.title,'text'],['url','Enlace',a.url,'url'],['username','Usuario',a.username,'text']]){
   const wrapper=document.createElement('label');wrapper.textContent=label;
   const input=document.createElement('input');input.name=name;input.type=type;input.required=true;input.value=value;
   wrapper.append(input);form.append(wrapper);
  }
  const passwordLabel=document.createElement('label');passwordLabel.textContent='Nueva contraseña (opcional)';
  const passwordInput=document.createElement('input');passwordInput.name='password';passwordInput.type='password';passwordInput.autocomplete='new-password';passwordInput.placeholder='Dejar vacío para conservar la actual';
  passwordLabel.append(passwordInput);const eye=node('button','👁 Mostrar');eye.type='button';eye.className='secondary';eye.onclick=()=>{const show=passwordInput.type==='password';passwordInput.type=show?'text':'password';eye.textContent=show?'Ocultar':'👁 Mostrar'};passwordLabel.append(eye);form.append(passwordLabel);
  const actions=document.createElement('div');actions.className='managed-actions';
  const save=node('button','Guardar cambios');save.type='submit';
  const feedback=node('span','');feedback.className='muted';feedback.setAttribute('role','status');
  const remove=node('button','Eliminar acceso');remove.type='button';remove.className='secondary';
  remove.onclick=async()=>{
   if(!confirm('¿Eliminar el acceso «'+a.title+'» de '+a.employee_name+'? Esta acción es permanente y también elimina la contraseña guardada.'))return;
   remove.disabled=true;feedback.textContent='Eliminando...';
   try{
    await api('/api/admin/accesses/'+a.id,{method:'DELETE'});
    msg('Acceso eliminado');await managedAccesses();await accesses();
   }catch(err){feedback.textContent='Error: '+err.message;remove.disabled=false}
  };
  actions.append(save,remove,feedback);form.append(actions);
  form.addEventListener('submit',async e=>{
   e.preventDefault();save.disabled=true;feedback.textContent='Guardando...';
   try{
    const updated=await api('/api/admin/accesses/'+a.id,{method:'PATCH',body:JSON.stringify(Object.fromEntries(new FormData(form)))});
    a.title=updated.title;a.url=updated.url;a.username=updated.username;
    heading.textContent=a.employee_name+' — '+a.title;
    const opt=[...accessSelect.options].find(o=>o.value===String(a.id));if(opt)opt.textContent=a.title+' — '+a.username;
    passwordInput.value='';
    feedback.textContent='✓ Cambios guardados';
    await accesses();
   }catch(err){feedback.textContent='Error: '+err.message}
   finally{save.disabled=false}
  });
  editor.append(form);
 }
 function updatePlatforms(preferred){
  accessSelect.replaceChildren(new Option('Elegí una plataforma',''));
  const available=items.filter(a=>String(a.employee_id)===employeeSelect.value);
  const counts=new Map();
  for(const a of available){
   const key=[a.title.trim().toLowerCase(),a.url.trim().toLowerCase(),a.username.trim().toLowerCase()].join('|');
   counts.set(key,(counts.get(key)||0)+1);
  }
  for(const a of available){
   const key=[a.title.trim().toLowerCase(),a.url.trim().toLowerCase(),a.username.trim().toLowerCase()].join('|');
   const repeated=counts.get(key)>1;
   accessSelect.append(new Option(a.title+' — '+a.username+(repeated?' (POSIBLE DUPLICADO · ID '+a.id+')':''),String(a.id)));
  }
  accessSelect.disabled=!available.length;
  accessSelect.value=available.some(a=>String(a.id)===preferred)?preferred:'';
  renderEditor();
 }
 employeeSelect.addEventListener('change',()=>updatePlatforms(''));
 accessSelect.addEventListener('change',renderEditor);
 const selected=items.find(a=>String(a.id)===String(selectedId));
 if(selected){employeeSelect.value=String(selected.employee_id);updatePlatforms(String(selected.id))}
 else if(previousEmployeeId&&employees.some(u=>u.id===String(previousEmployeeId))){employeeSelect.value=String(previousEmployeeId);updatePlatforms('')}
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
 'VOISO':'https://cc-dal01.voiso.com/users/sign_in',
 'VOICESPIN':'https://work-and-media.pbx.voicespin.com/panel/',
 'CLOUD':'https://cloud.clickwa.tech/',
 'FEROZO':'https://ferozo.email/',
 'COMIDAS LANSEL':'https://comidalansel.vercel.app/'
};
function syncVoiceSpinLabels(){const isVoiceSpin=$('#platformTitle').value.trim().toUpperCase()==='VOICESPIN';$('#newAccessUsernameLabel').firstChild.textContent=isVoiceSpin?'Agente / Extensión':'Usuario';$('#newAccessPasswordLabel').firstChild.textContent=isVoiceSpin?'Extension Secret':'Contraseña';if(isVoiceSpin){$('#newAccessUsername').placeholder='Ej.: 2797';$('#newAccessPassword').placeholder='Aa123456!';}else{$('#newAccessUsername').placeholder='';$('#newAccessPassword').placeholder='';}}
$('#platformTitle').addEventListener('input',syncVoiceSpinLabels);
$('#platformPreset').addEventListener('change',e=>{
 const name=e.target.value;
 $('#platformTitle').value=name;
 $('#newAccess').elements.url.value=platformUrls[name]||'';syncVoiceSpinLabels();
});
$('#newAccessPasswordEye').onclick=()=>{const el=$('#newAccessPassword');const show=el.type==='password';el.type=show?'text':'password';$('#newAccessPasswordEye').textContent=show?'Ocultar':'👁 Mostrar'};
$('#newAccess').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));await post('/api/users/'+d.userId+'/accesses',d);const selectedEmployee=d.userId;e.target.reset();$('#userId').value=selectedEmployee;$('#newAccessPassword').type='password';$('#newAccessPasswordEye').textContent='👁 Mostrar';syncVoiceSpinLabels();msg('Acceso asignado. Funcionario seleccionado conservado.');await managedAccesses(undefined,selectedEmployee)}catch(err){msg(err.message)}};
load();
