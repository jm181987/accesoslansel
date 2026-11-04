
const $=s=>document.querySelector(s),msg=s=>$('#message').textContent=s;
const api=async(u,o={})=>{const r=await fetch(u,{...o,headers:{'Content-Type':'application/json'}});const d=await r.json();if(!r.ok)throw Error(d.error||'Error');return d};
const post=(u,d)=>api(u,{method:'POST',body:JSON.stringify(d)});
const node=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e};
async function load(){try{const me=await api('/api/me');$('#login').classList.add('hidden');$('#app').classList.remove('hidden');$('#logout').classList.remove('hidden');$('#who').textContent=me.name;await accesses();if(me.role==='admin'){$('#admin').classList.remove('hidden');await users()}}catch(e){$('#login').classList.remove('hidden');$('#app').classList.add('hidden')}}
async function accesses(){const items=await api('/api/accesses'),root=$('#cards');root.replaceChildren();if(!items.length)root.append(node('p','No tenés accesos asignados.'));for(const a of items){const c=node('div','');c.className='card';c.append(node('h3',a.title),node('p','Usuario: '+a.username));const link=node('a','Abrir enlace');link.href=a.url;link.target='_blank';link.rel='noopener noreferrer';link.className='action';const copy=node('button','Copiar usuario');copy.className='secondary';copy.onclick=()=>navigator.clipboard.writeText(a.username).then(()=>msg('Usuario copiado'));const show=node('button','Ver contraseña');show.onclick=async()=>{try{const p=await api('/api/accesses/'+a.id+'/password');c.querySelector('.secret')?.remove();const area=node('div','');area.className='secret';area.append(node('p',p.password));const b=node('button','Copiar contraseña');b.onclick=()=>navigator.clipboard.writeText(p.password).then(()=>msg('Contraseña copiada'));area.append(b);c.append(area);setTimeout(()=>area.remove(),30000)}catch(e){msg(e.message)}};c.append(link,copy,show);root.append(c)}}
async function users(){const list=await api('/api/users'),select=$('#userId'),root=$('#users');select.replaceChildren();root.replaceChildren();for(const u of list){if(u.role!=='admin'){const opt=node('option',u.name+' — '+u.email);opt.value=u.id;select.append(opt)}const line=node('div','');line.className='user';line.append(node('strong',u.name+' — '+u.email+' ('+(u.active?'Activo':'Inactivo')+')'));if(u.role!=='admin'){const b=node('button',u.active?'Desactivar':'Activar');b.className='secondary';b.onclick=async()=>{try{await api('/api/users/'+u.id+'/status',{method:'PATCH',body:JSON.stringify({active:!u.active})});await users()}catch(e){msg(e.message)}};line.append(b)}root.append(line)}}
$('#loginForm').onsubmit=async e=>{e.preventDefault();try{await post('/api/login',Object.fromEntries(new FormData(e.target)));e.target.reset();msg('');await load()}catch(err){msg(err.message)}};
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
$('#newAccess').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));await post('/api/users/'+d.userId+'/accesses',d);e.target.reset();msg('Acceso asignado')}catch(err){msg(err.message)}};
load();
