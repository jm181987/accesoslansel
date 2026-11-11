
const $=s=>document.querySelector(s);
let toastTimer;
function msg(message,type='info'){
 const toast=$('#toast'),content=$('#toastText');
 if(!toast||!content){$('#message').textContent=message;return}
 clearTimeout(toastTimer);
 const value=String(message||'').trim();
 if(!value){toast.classList.remove('show');toast.hidden=true;return}
 content.textContent=value;
 toast.dataset.type=type==='error'||/^(error|no se pudo|credenciales incorrectas|este correo ya existe|vinculación vencida)/i.test(value)?'error':type==='success'||/^(✓|acceso asignado|funcionario creado|código generado|cambios guardados)/i.test(value)?'success':'info';
 toast.hidden=false;
 requestAnimationFrame(()=>toast.classList.add('show'));
 toastTimer=setTimeout(()=>{toast.classList.remove('show');setTimeout(()=>{if(!toast.classList.contains('show'))toast.hidden=true},250)},6500);
}
$('#toastClose')?.addEventListener('click',()=>{clearTimeout(toastTimer);$('#toast').classList.remove('show');$('#toast').hidden=true});
let activeCompanyId='';
const api=async(u,o={})=>{if(activeCompanyId&&/^\/api\/(?:admin\/|users(?:\/|$))/.test(u))u+=(u.includes('?')?'&':'?')+'company_id='+encodeURIComponent(activeCompanyId);const r=await fetch(u,{...o,headers:{'Content-Type':'application/json'}});const d=await r.json();if(!r.ok){const err=new Error(d.error||'Error');err.status=r.status;err.details=d;throw err}return d};
const post=(u,d)=>api(u,{method:'POST',body:JSON.stringify(d)});
const node=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e};
async function load(){try{const me=await api('/api/me');$('#login').classList.add('hidden');$('#app').classList.remove('hidden');$('#logout').classList.remove('hidden');$('#who').textContent=me.name;await accesses();if(['admin','superadmin'].includes(me.role)){$('#adminPersonalWorkspace').append($('#personalWorkspace'));$('#personalWorkspace').querySelector('.dashboard-heading')?.classList.add('hidden');$('#admin').classList.remove('hidden');showAdminTab('overview');await initCompanies(me);await users();await managedAccesses();await loadExtensionVersions();await loadOverview();await refreshAdminData()}}catch(e){$('#login').classList.remove('hidden');$('#app').classList.add('hidden')}}

async function initCompanies(me){
 const companies=await api('/api/admin/companies');
 const bar=$('#companyScopeBar'),scope=$('#companyScope');
 bar.classList.remove('hidden');
 $('#companiesTab').classList.toggle('hidden',me.role!=='superadmin');
 scope.replaceChildren();
 if(me.role==='superadmin'){
  scope.append(new Option('Todas las empresas',''));
  for(const c of companies)scope.append(new Option(c.name,String(c.id)));
  $('#companyScopeHint').textContent='Superadministrador · elegí una empresa para limitar la vista.';
 }else{
  for(const c of companies)scope.append(new Option(c.name,String(c.id)));
  $('#companyScopeHint').textContent='Administración limitada a tu empresa.';
  scope.disabled=true;
 }
 scope.value=activeCompanyId;
 scope.onchange=async()=>{activeCompanyId=scope.value;await users();await managedAccesses();await loadExtensionVersions();await loadOverview();await refreshAdminData();};
 if(me.role==='superadmin')renderCompanies(companies);
}
function renderCompanies(companies){
 const list=$('#companiesList');list.replaceChildren();
 const table=document.createElement('table');table.className='matrix-table';
 for(const c of companies){const row=document.createElement('tr');row.append(node('td',c.name),node('td','Empresa #'+c.id));table.append(row)}
 list.append(table);
 const select=$('#companyAdminCompany');select.replaceChildren();
 for(const c of companies)select.append(new Option(c.name,String(c.id)));
}
$('#companyCreate').onsubmit=async e=>{
 e.preventDefault();
 try{await post('/api/admin/companies',Object.fromEntries(new FormData(e.target)));e.target.reset();await initCompanies({role:'superadmin'});msg('Empresa creada','success')}catch(err){msg(err.message,'error')}
};
$('#companyAdminCreate').onsubmit=async e=>{
 e.preventDefault();const d=Object.fromEntries(new FormData(e.target));
 try{await post('/api/admin/companies/'+d.company_id+'/admins',d);e.target.reset();msg('Administrador de empresa creado','success')}catch(err){msg(err.message,'error')}
};

async function accesses(){const items=await api('/api/accesses'),root=$('#cards');root.replaceChildren();if(!items.length)root.append(node('p','No tenés accesos asignados.'));for(const a of items){const c=node('div','');c.className='card';c.append(node('h3',a.title),node('p','Usuario: '+a.username));const link=node('a','Abrir enlace');link.href=a.url;link.target='_blank';link.rel='noopener noreferrer';link.className='action';const copy=node('button','Copiar usuario');copy.className='secondary';copy.onclick=()=>navigator.clipboard.writeText(a.username).then(()=>msg('Usuario copiado'));const show=node('button','Ver contraseña');show.onclick=async()=>{try{const p=await api('/api/accesses/'+a.id+'/password');c.querySelector('.secret')?.remove();const area=node('div','');area.className='secret';area.append(node('p',p.password));const b=node('button','Copiar contraseña');b.onclick=()=>navigator.clipboard.writeText(p.password).then(()=>msg('Contraseña copiada'));area.append(b);c.append(area);setTimeout(()=>area.remove(),30000)}catch(e){msg(e.message)}};c.append(link,copy,show);root.append(c)}}
let employeeCache=[];
async function users(){
 const list=await api('/api/users');employeeCache=list;
 const select=$('#userId'),pairSelect=$('#adminPairUser'),root=$('#users');
 const oldSelect=select.value,oldPair=pairSelect.value;
 select.replaceChildren();pairSelect.replaceChildren();root.replaceChildren();
 const table=document.createElement('table');table.className='employee-table';
 const thead=document.createElement('thead'),tr=document.createElement('tr');
 for(const label of ['Funcionario','Correo','Estado','Acciones'])tr.append(node('th',label));
 thead.append(tr);table.append(thead);
 const tbody=document.createElement('tbody');
 for(const u of list){
  if(u.role==='user'){
   const opt=new Option(u.name+' — '+u.email,String(u.id));select.append(opt);
   if(u.active)pairSelect.append(new Option(u.name+' — '+u.email,String(u.id)));
  }
  const line=document.createElement('tr');line.className='user';
  line.dataset.email=u.email.toLowerCase();line.dataset.search=(u.name+' '+u.email).toLowerCase();
  line.dataset.active=String(u.active);
  line.append(node('td',u.name),node('td',u.email));
  const status=node('td',u.active?'Activo':'Inactivo');status.className=u.active?'employee-active':'employee-inactive';line.append(status);
  const actionCell=document.createElement('td');const actions=document.createElement('div');actions.className='employee-actions';
  if(u.role==='user'){
   const profile=node('button','Ficha');profile.type='button';profile.className='secondary';profile.onclick=()=>openEmployeeProfile(u);actions.append(profile);
   const edit=node('button','Editar');edit.type='button';edit.className='secondary';edit.onclick=()=>editEmployee(u);actions.append(edit);
   const accessesButton=node('button','Accesos');accessesButton.type='button';accessesButton.className='secondary';
   accessesButton.onclick=async()=>{showAdminTab('edit');await managedAccesses(undefined,String(u.id))};actions.append(accessesButton);
   const toggle=node('button',u.active?'Desactivar':'Activar');toggle.type='button';toggle.className='secondary';
   toggle.onclick=async()=>{try{await api('/api/users/'+u.id+'/status',{method:'PATCH',body:JSON.stringify({active:!u.active})});await users();await loadOverview();await refreshAdminData();msg('Estado actualizado','success')}catch(e){msg(e.message,'error')}};actions.append(toggle);
  }else actions.append(node('span','Administrador'));
  actionCell.append(actions);line.append(actionCell);tbody.append(line);
 }
 table.append(tbody);root.append(table);
 if(oldSelect&&[...select.options].some(o=>o.value===oldSelect))select.value=oldSelect;
 if(oldPair&&[...pairSelect.options].some(o=>o.value===oldPair))pairSelect.value=oldPair;
 filterUsers();
}
function filterUsers(){
 const q=($('#userSearch')?.value||'').trim().toLowerCase(),state=$('#userStatusFilter')?.value||'all';let shown=0;
 document.querySelectorAll('#users .user').forEach(row=>{
  const visible=row.dataset.search.includes(q)&&(state==='all'||row.dataset.active===String(state==='active'));
  row.classList.toggle('hidden',!visible);if(visible)shown++;
 });
 const counter=$('#userSearchResult');if(counter)counter.textContent=shown+' funcionario(s) encontrados'+(shown===0?' · Revisá el correo o los filtros.':'');
}
$('#userStatusFilter').addEventListener('change',filterUsers);
$('#userSearch').addEventListener('input',filterUsers);
function showAdminTab(tab){document.querySelectorAll('.admin-section').forEach(el=>el.classList.toggle('hidden',el.dataset.section!==tab));document.querySelectorAll('[data-admin-tab]').forEach(btn=>{const active=btn.dataset.adminTab===tab;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active))});}
document.querySelectorAll('[data-admin-tab]').forEach(btn=>btn.addEventListener('click',async()=>{showAdminTab(btn.dataset.adminTab);if(btn.dataset.adminTab==='audit')await loadAudit();if(['matrix','alerts','bulk'].includes(btn.dataset.adminTab))await refreshAdminData()}));
showAdminTab('overview');

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
  filterExtensionRows(currentExtensionFilter);
 }catch(e){root.textContent='No se pudo cargar: '+e.message}
}
$('#refreshExtensionVersions').addEventListener('click',loadExtensionVersions);
async function loadOverview(){
 const root=$('#overviewStats');root.textContent='Actualizando indicadores…';
 try{
  const [people,accessList,extensions]=await Promise.all([api('/api/users'),api('/api/admin/accesses'),api('/api/admin/extensions')]);
  const linked=extensions.filter(e=>e.expires&&new Date(e.expires)>new Date()).length;
  const nonAdmins=people.filter(u=>u.role==='user');
  const linkedIds=new Set(extensions.filter(e=>e.expires&&new Date(e.expires)>new Date()).map(e=>String(e.id)));
  const stats=[
   {label:'Funcionarios',value:nonAdmins.length,tab:'people',filter:'all'},
   {label:'Activos',value:nonAdmins.filter(u=>u.active).length,tab:'people',filter:'active'},
   {label:'Inactivos',value:nonAdmins.filter(u=>!u.active).length,tab:'people',filter:'inactive'},
   {label:'Accesos asignados',value:accessList.length,tab:'edit'},
   {label:'Vinculaciones vigentes',value:linkedIds.size,tab:'extension',filter:'linked'},
   {label:'Sin vinculación vigente',value:nonAdmins.filter(u=>!linkedIds.has(String(u.id))).length,tab:'extension',filter:'unlinked'}
  ];
  root.replaceChildren();
  for(const item of stats){
   const card=document.createElement('button');card.type='button';card.className='overview-stat overview-stat-link';
   card.append(node('strong',String(item.value)),node('span',item.label));
   const hint=node('small','Ver y gestionar →');hint.className='overview-stat-hint';card.append(hint);
   card.setAttribute('aria-label',item.label+': '+item.value+'. Ver y gestionar');
   card.onclick=()=>{
    if(item.tab==='people'){$('#userStatusFilter').value=item.filter;$('#userSearch').value='';filterUsers()}
    if(item.tab==='extension')filterExtensionRows(item.filter);
    showAdminTab(item.tab);
    document.querySelector('.admin-nav')?.scrollIntoView({behavior:'smooth',block:'start'});
   };
   root.append(card);
  }
 }catch(e){root.textContent='No se pudieron cargar los indicadores: '+e.message;msg(e.message,'error')}
}
let currentExtensionFilter='all';
function filterExtensionRows(mode){
 currentExtensionFilter=mode;
 const rows=[...document.querySelectorAll('#extensionVersions tbody tr')];
 const list=adminExtensionCache;
 for(let i=0;i<rows.length;i++){
  const e=list[i],linked=!!(e?.expires&&new Date(e.expires)>new Date());
  const expiring=linked&&new Date(e.expires).getTime()-Date.now()<=7*86400000;
  rows[i].classList.toggle('hidden',mode==='linked'?!linked:mode==='unlinked'?linked:mode==='expiring'?!expiring:false);
 }
 const title=$('#extensionFilterNote');if(title)title.textContent=mode==='linked'?'Mostrando vinculaciones vigentes':mode==='unlinked'?'Mostrando funcionarios sin vinculación vigente':mode==='expiring'?'Mostrando vinculaciones que vencen en 7 días':'Mostrando todas las extensiones';
}
$('#clearExtensionFilter').addEventListener('click',()=>filterExtensionRows('all'));
$('#refreshOverview').addEventListener('click',loadOverview);
let adminAccessCache=[],adminExtensionCache=[];
async function refreshAdminData(){
 try{[adminAccessCache,adminExtensionCache]=await Promise.all([api('/api/admin/accesses'),api('/api/admin/extensions')]);renderMatrix();renderAlerts();refreshGlobalSearch();showExpiryWarnings()}catch(e){msg('No se pudieron actualizar los datos administrativos: '+e.message,'error')}
 const bulk=$('#bulkEmployee'),previous=bulk.value;bulk.replaceChildren(new Option('Seleccioná un funcionario',''));
 for(const u of employeeCache.filter(x=>x.role==='user'&&x.active))bulk.append(new Option(u.name+' — '+u.email,String(u.id)));
 if(previous)bulk.value=previous;
}
function openEmployeeProfile(u){
 const current=employeeCache.find(x=>String(x.id)===String(u.id))||u;
 const accesses=adminAccessCache.filter(a=>String(a.employee_id)===String(u.id));
 const ext=adminExtensionCache.find(e=>String(e.id)===String(u.id));
 dialogBody.replaceChildren();$('#dialogTitle').textContent='Ficha de '+current.name;
 const wrap=document.createElement('div');wrap.className='profile-card';
 wrap.append(node('p','Correo: '+current.email),node('p','Estado: '+(current.active?'Activo':'Inactivo')),node('p','Accesos asignados: '+accesses.length));
 wrap.append(node('p',ext?.expires?'Vinculación hasta: '+new Date(ext.expires).toLocaleString('es-UY'):'Sin vinculación vigente'));
 wrap.append(node('p','Versión reportada: '+(ext?.version||'Sin reporte')));
 const heading=node('h3','Plataformas asignadas');wrap.append(heading);
 if(!accesses.length)wrap.append(node('p','Sin accesos asignados.'));
 for(const a of accesses){const line=node('p',a.title+' · '+a.username);wrap.append(line)}
 const actions=document.createElement('div');actions.className='profile-actions';
 const edit=node('button','Editar funcionario');edit.type='button';edit.onclick=()=>{closeDialog();editEmployee(current)};
 const view=node('button','Administrar accesos');view.type='button';view.className='secondary';view.onclick=async()=>{closeDialog();showAdminTab('edit');await managedAccesses(undefined,String(current.id))};
 actions.append(edit,view);wrap.append(actions);dialogBody.append(wrap);dialog.showModal();
}
function renderMatrix(){
 const root=$('#accessMatrix');root.replaceChildren();
 const people=employeeCache.filter(x=>x.role==='user');
 const titles=[...new Set(adminAccessCache.map(a=>a.title.trim()))].sort((a,b)=>a.localeCompare(b));
 if(!people.length||!titles.length){root.textContent='No hay asignaciones para mostrar.';return}
 const table=document.createElement('table');table.className='matrix-table';
 const head=document.createElement('tr');head.append(node('th','Funcionario'));
 for(const title of titles)head.append(node('th',title));table.append(head);
 for(const u of people){const tr=document.createElement('tr');tr.append(node('th',u.name));
  for(const title of titles){const count=adminAccessCache.filter(a=>String(a.employee_id)===String(u.id)&&a.title.trim()===title).length;
   const cell=node('td',count?'✓ '+count:'—');cell.className=count?'matrix-yes':'matrix-no';tr.append(cell)}
  table.append(tr)}
 root.append(table);
}
function renderAlerts(){
 const root=$('#adminAlerts');root.replaceChildren();
 const now=Date.now(),seen=new Set(),alerts=[];
 for(const u of employeeCache.filter(x=>x.role==='user')){
  const own=adminAccessCache.filter(a=>String(a.employee_id)===String(u.id));
  if(u.active&&!own.length)alerts.push(['Sin accesos',u.name+' ('+u.email+') no tiene plataformas asignadas.']);
  const ext=adminExtensionCache.find(e=>String(e.id)===String(u.id));
  if(ext?.expires){const left=new Date(ext.expires).getTime()-now;if(left>0&&left<=7*86400000)alerts.push(['Vinculación próxima a vencer',u.name+' vence el '+new Date(ext.expires).toLocaleDateString('es-UY')+'.'])}
  for(const a of own){const key=[a.title.toLowerCase().trim(),a.url.toLowerCase().trim(),a.username.toLowerCase().trim()].join('|');if(seen.has(u.id+'|'+key))alerts.push(['Posible duplicado',u.name+' tiene más de una asignación de '+a.title+'.']);seen.add(u.id+'|'+key)}
 }
 if(!alerts.length){root.append(node('p','No hay alertas detectadas.'));return}
 for(const [title,description] of alerts){const row=document.createElement('div');row.className='alert-item';row.append(node('strong',title),node('p',description));root.append(row)}
}
$('#refreshAlerts').onclick=refreshAdminData;
const expiryDialog=$('#expiryDialog');
function dismissExpiry(){if(expiryDialog.open)expiryDialog.close()}
$('#expiryClose').onclick=dismissExpiry;
$('#expiryLater').onclick=dismissExpiry;
$('#expiryManage').onclick=()=>{
 dismissExpiry();filterExtensionRows('expiring');showAdminTab('extension');
 document.querySelector('.admin-nav')?.scrollIntoView({behavior:'smooth',block:'start'});
};
function showExpiryWarnings(){
 if($('#admin').classList.contains('hidden')||expiryDialog.open)return;
 const now=Date.now(),sevenDays=7*86400000;
 const upcoming=adminExtensionCache.filter(e=>e.active&&e.expires&&new Date(e.expires).getTime()>now&&new Date(e.expires).getTime()-now<=sevenDays);
 if(!upcoming.length)return;
 // Mostrar una vez por pestaña y conjunto de vencimientos; volver a avisar en una nueva visita.
 const signature=upcoming.map(e=>String(e.id)+':'+e.expires).sort().join('|');
 if(sessionStorage.getItem('lansel-expiry-notified')===signature)return;
 sessionStorage.setItem('lansel-expiry-notified',signature);
 const list=$('#expiryList');list.replaceChildren();
 for(const e of upcoming){
  const remaining=Math.max(1,Math.ceil((new Date(e.expires).getTime()-now)/86400000));
  const row=document.createElement('div');row.className='expiry-item';
  row.append(node('strong',e.name+' · '+e.email),node('span','Vence en '+remaining+' día'+(remaining===1?'':'s')+' · '+new Date(e.expires).toLocaleString('es-UY')));
  list.append(row);
 }
 expiryDialog.showModal();
}

async function loadAudit(){
 const root=$('#auditEntries');root.textContent='Cargando…';
 try{const rows=await api('/api/admin/audit');root.replaceChildren();if(!rows.length){root.textContent='Todavía no hay eventos registrados.';return}
 const table=document.createElement('table');table.className='matrix-table';
 const head=document.createElement('tr');for(const x of ['Fecha','Administrador','Acción','Referencia'])head.append(node('th',x));table.append(head);
 for(const a of rows){const tr=document.createElement('tr');for(const x of [new Date(a.created_at).toLocaleString('es-UY'),a.actor||'Cuenta eliminada',a.action,a.target])tr.append(node('td',String(x)));table.append(tr)}root.append(table)
 }catch(e){root.textContent='Error: '+e.message}
}
$('#refreshAudit').onclick=loadAudit;
function addBulkRow(){
 const root=$('#bulkRows');if(root.children.length>=20){msg('Máximo 20 plataformas','error');return}
 const row=document.createElement('div');row.className='bulk-row';
 const preset=document.createElement('select');preset.append(new Option('Seleccionar plataforma',''));
 for(const title of Object.keys(platformUrls))preset.append(new Option(title,title));
 const title=document.createElement('input');title.placeholder='Nombre de plataforma';title.required=true;
 const url=document.createElement('input');url.type='url';url.placeholder='https://...';url.required=true;
 const username=document.createElement('input');username.placeholder='Usuario';username.required=true;
 const password=document.createElement('input');password.type='password';password.placeholder='Contraseña';password.required=true;
 preset.onchange=()=>{title.value=preset.value;url.value=platformUrls[preset.value]||''};
 const remove=node('button','Quitar');remove.type='button';remove.className='secondary';remove.onclick=()=>row.remove();
 for(const el of [preset,title,url,username,password,remove])row.append(el);
 root.append(row);
}
$('#bulkAddRow').onclick=addBulkRow;
$('#bulkAccessForm').onsubmit=async e=>{
 e.preventDefault();const rows=[...document.querySelectorAll('#bulkRows .bulk-row')];
 const accesses=rows.map(row=>{const els=row.querySelectorAll('input');return {title:els[0].value,url:els[1].value,username:els[2].value,password:els[3].value}});
 const button=e.target.querySelector('[type=submit]');button.disabled=true;
 try{const r=await post('/api/admin/accesses/bulk',{employee_id:$('#bulkEmployee').value,accesses});
 $('#bulkRows').replaceChildren();addBulkRow();msg(r.count+' accesos asignados','success');await managedAccesses();await loadOverview();await refreshAdminData();await loadAudit()
 }catch(err){msg(err.message,'error')}finally{button.disabled=false}
};
function refreshGlobalSearch(){
 const input=$('#globalSearch'),root=$('#globalResults'),q=input.value.trim().toLowerCase();root.replaceChildren();
 if(q.length<2){root.classList.add('hidden');return}
 const people=employeeCache.filter(u=>(u.name+' '+u.email).toLowerCase().includes(q)).slice(0,8);
 const platforms=adminAccessCache.filter(a=>(a.title+' '+a.username+' '+a.employee_name).toLowerCase().includes(q)).slice(0,8);
 for(const u of people){const b=node('button','Funcionario: '+u.name+' · '+u.email);b.type='button';b.onclick=()=>{root.classList.add('hidden');openEmployeeProfile(u)};root.append(b)}
 for(const a of platforms){const b=node('button','Acceso: '+a.title+' · '+a.employee_name);b.type='button';b.onclick=async()=>{root.classList.add('hidden');showAdminTab('edit');await managedAccesses(String(a.id),String(a.employee_id))};root.append(b)}
 if(!root.children.length)root.append(node('p','Sin resultados.'));
 root.classList.remove('hidden');
}
$('#globalSearch').addEventListener('input',refreshGlobalSearch);
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&!$('#admin').classList.contains('hidden')){e.preventDefault();$('#globalSearch').focus()}if(e.key==='Escape')$('#globalResults').classList.add('hidden')});

document.querySelectorAll('[data-go-tab]').forEach(b=>b.addEventListener('click',()=>showAdminTab(b.dataset.goTab)));
const dialog=$('#adminDialog'),dialogBody=$('#dialogBody');
const formHomes=new Map();
let editorHome=null;
function openEditorModal(form){editorHome=form.parentNode;dialogBody.replaceChildren();dialogBody.append(form);form.classList.remove('hidden');$('#dialogTitle').textContent='Editar acceso';if(!dialog.open)dialog.showModal();}
function openFormModal(id,title){
 const form=$('#'+id);if(!form)return;
 if(!formHomes.has(id))formHomes.set(id,{parent:form.parentNode,next:form.nextSibling});
 dialogBody.replaceChildren();dialogBody.append(form);
 $('#dialogTitle').textContent=title;
 if(!dialog.open)dialog.showModal();
 form.querySelector('input,select')?.focus();
}
function closeDialog(){
 if(dialog.open)dialog.close();
 for(const [id,home] of formHomes){const form=$('#'+id);if(form&&form.parentNode===dialogBody)home.parent.insertBefore(form,home.next)}
 if(editorHome){const form=dialogBody.querySelector('.managed-access');if(form){form.classList.add('hidden');editorHome.append(form)}editorHome=null}
 dialogBody.replaceChildren();
}
$('#dialogClose').addEventListener('click',closeDialog);
dialog.addEventListener('cancel',e=>{e.preventDefault();closeDialog()});
dialog.addEventListener('click',e=>{if(e.target===dialog)closeDialog()});
document.querySelectorAll('[data-open-modal]').forEach(b=>b.addEventListener('click',()=>openFormModal(b.dataset.openModal,b.dataset.openModal==='newUser'?'Crear funcionario':'Asignar acceso')));
function editEmployee(u){
 dialogBody.replaceChildren();$('#dialogTitle').textContent='Editar funcionario';
 const form=document.createElement('form');form.className='employee-edit-form';
 const fields=[['name','Nombre',u.name,'text'],['email','Correo',u.email,'email'],['password','Nueva contraseña (opcional)','','password']];
 for(const [name,label,value,type] of fields){const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement('input');input.name=name;input.type=type;input.value=value;input.required=name!=='password';if(name==='password'){input.minLength=12;input.autocomplete='new-password';input.placeholder='Dejar vacío para conservar la actual'}wrap.append(input);form.append(wrap)}
 const note=node('p','Cambiar la contraseña cerrará las sesiones y desvinculará la extensión de este funcionario por seguridad.');note.className='muted';form.append(note);
 const save=node('button','Guardar cambios');save.type='submit';form.append(save);
 form.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{
  const data=Object.fromEntries(new FormData(form));if(!data.password)delete data.password;
  await api('/api/admin/users/'+u.id,{method:'PATCH',body:JSON.stringify(data)});
  closeDialog();await users();await loadOverview();await refreshAdminData();msg('Funcionario actualizado','success');
 }catch(err){msg(err.message,'error')}finally{save.disabled=false}};
 dialogBody.append(form);dialog.showModal();
}

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
    closeDialog();msg('Acceso eliminado');await managedAccesses();await loadOverview();await accesses();
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
    feedback.textContent='✓ Cambios guardados';closeDialog();msg('Acceso actualizado','success');
    await accesses();
   }catch(err){feedback.textContent='Error: '+err.message}
   finally{save.disabled=false}
  });
  const open=node('button','Editar acceso en ventana');open.type='button';open.className='secondary';open.onclick=()=>openEditorModal(form);editor.append(open,form);form.classList.add('hidden');
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
$('#newUser').onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));try{await post('/api/users',data);e.target.reset();closeDialog();msg('Funcionario creado','success');await users();await loadOverview();await refreshAdminData()}catch(err){if(err.status===409){showAdminTab('people');$('#userSearch').value=data.email.trim().toLowerCase();await users();const match=[...document.querySelectorAll('#users .user')].find(row=>row.dataset.email===data.email.trim().toLowerCase());if(match){msg('Este correo ya está registrado. Encontré el funcionario existente y lo mostré en la lista.')}else{msg('El correo ya existe en la base de datos, pero no aparece en el listado. Verificá que estés usando la misma base de datos y consultá al administrador.')}}else msg(err.message)}};

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
addBulkRow();
function syncVoiceSpinLabels(){const isVoiceSpin=$('#platformTitle').value.trim().toUpperCase()==='VOICESPIN';$('#newAccessUsernameLabel').firstChild.textContent=isVoiceSpin?'Agente / Extensión':'Usuario';$('#newAccessPasswordLabel').firstChild.textContent=isVoiceSpin?'Extension Secret':'Contraseña';if(isVoiceSpin){$('#newAccessUsername').placeholder='Ej.: 2797';$('#newAccessPassword').placeholder='Aa123456!';}else{$('#newAccessUsername').placeholder='';$('#newAccessPassword').placeholder='';}}
$('#platformTitle').addEventListener('input',syncVoiceSpinLabels);
$('#platformPreset').addEventListener('change',e=>{
 const name=e.target.value;
 $('#platformTitle').value=name;
 $('#newAccess').elements.url.value=platformUrls[name]||'';syncVoiceSpinLabels();
});
$('#newAccessPasswordEye').onclick=()=>{const el=$('#newAccessPassword');const show=el.type==='password';el.type=show?'text':'password';$('#newAccessPasswordEye').textContent=show?'Ocultar':'👁 Mostrar'};
$('#newAccess').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));await post('/api/users/'+d.userId+'/accesses',d);const selectedEmployee=d.userId;e.target.reset();$('#userId').value=selectedEmployee;$('#newAccessPassword').type='password';$('#newAccessPasswordEye').textContent='👁 Mostrar';syncVoiceSpinLabels();closeDialog();msg('Acceso asignado. Funcionario seleccionado conservado.','success');await managedAccesses(undefined,selectedEmployee);await loadOverview();await refreshAdminData()}catch(err){msg(err.message)}};
load();
