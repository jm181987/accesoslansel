import 'dotenv/config';
import express from 'express';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const app=express(),db=new pg.Pool({connectionString:process.env.DATABASE_URL,max:3,connectionTimeoutMillis:10000,idleTimeoutMillis:10000,ssl:process.env.DATABASE_SSL==='true'?{rejectUnauthorized:true}:undefined});
app.use(helmet());app.use(express.json());app.use(cookieParser());const publicDir=path.join(path.dirname(fileURLToPath(import.meta.url)),'public');
app.use(express.static(publicDir));
app.get('/',(req,res)=>res.sendFile(path.join(publicDir,'index.html')));
const missing=['DATABASE_URL','APP_ENCRYPTION_KEY','SESSION_SECRET'].filter(k=>!process.env[k]);
const key=Buffer.from(process.env.APP_ENCRYPTION_KEY||'','hex');
const configError=missing.length?'Missing required environment variables':key.length!==32?'Invalid encryption key length':null;
const h=x=>crypto.createHmac('sha256',process.env.SESSION_SECRET).update(x).digest('hex');
function enc(s){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key,iv);return Buffer.concat([iv,c.update(s,'utf8'),c.final(),c.getAuthTag()]).toString('base64')}
function dec(s){const b=Buffer.from(s,'base64'),c=crypto.createDecipheriv('aes-256-gcm',key,b.subarray(0,12));c.setAuthTag(b.subarray(b.length-16));return Buffer.concat([c.update(b.subarray(12,b.length-16)),c.final()]).toString()}
const run=f=>(req,res,next)=>Promise.resolve(f(req,res,next)).catch(next);
const auth=run(async(req,res,next)=>{const t=req.cookies.session;if(!t)return res.status(401).json({error:'Iniciá sesión'});const r=await db.query('SELECT u.id,u.name,u.role FROM sessions s JOIN employees u ON u.id=s.user_id WHERE s.token=$1 AND s.expires>now() AND u.active=true',[h(t)]);if(!r.rowCount)return res.status(401).json({error:'Sesión inválida'});req.user=r.rows[0];next()});
const admin=(req,res,next)=>req.user.role==='admin'?next():res.status(403).json({error:'No autorizado'});
app.post('/api/login',run(async(req,res)=>{const r=await db.query('SELECT * FROM employees WHERE email=$1 AND active=true',[String(req.body.email||'').toLowerCase()]);if(!r.rowCount||!await bcrypt.compare(String(req.body.password||''),r.rows[0].password_hash))return res.status(401).json({error:'Credenciales incorrectas'});const token=crypto.randomBytes(32).toString('hex');await db.query("INSERT INTO sessions(token,user_id,expires) VALUES($1,$2,now()+interval '12 hours')",[h(token),r.rows[0].id]);res.cookie('session',token,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',maxAge:43200000});res.json({ok:true})}));
app.post('/api/logout',auth,run(async(req,res)=>{await db.query('DELETE FROM sessions WHERE token=$1',[h(req.cookies.session)]);res.clearCookie('session');res.json({ok:true})}));
app.get('/api/me',auth,(req,res)=>res.json(req.user));
app.get('/api/accesses',auth,run(async(req,res)=>{const r=await db.query('SELECT id,title,url,username FROM accesses WHERE employee_id=$1 ORDER BY title',[req.user.id]);res.json(r.rows)}));
app.get('/api/accesses/:id/password',auth,run(async(req,res)=>{const r=await db.query('SELECT secret FROM accesses WHERE id=$1 AND employee_id=$2',[req.params.id,req.user.id]);if(!r.rowCount)return res.status(404).json({error:'No encontrado'});res.set('Cache-Control','no-store');res.json({password:dec(r.rows[0].secret)})}));

const extensionAuth=run(async(req,res,next)=>{
 const match=/^Bearer ([a-f0-9]{64})$/.exec(req.get('Authorization')||'');
 if(!match)return res.status(401).json({error:'Vinculá la extensión con LANSEL'});
 const r=await db.query("SELECT u.id,u.name FROM extension_tokens t JOIN employees u ON u.id=t.user_id WHERE t.token=$1 AND t.expires>now() AND u.active=true",[h(match[1])]);
 if(!r.rowCount)return res.status(401).json({error:'Vinculación vencida. Volvé a vincular la extensión'});
 req.extensionUser=r.rows[0];next();
});
app.post('/api/extension/pair',auth,run(async(req,res)=>{
 const code=crypto.randomBytes(24).toString('hex');
 await db.query("INSERT INTO extension_pair_codes(code,user_id,expires) VALUES($1,$2,now()+interval '5 minutes')",[h(code),req.user.id]);
 res.set('Cache-Control','no-store').json({code,expiresInSeconds:300});
}));
app.post('/api/admin/users/:id/extension/pair',auth,admin,run(async(req,res)=>{
 const id=String(req.params.id);
 if(!/^[0-9]+$/.test(id))return res.status(400).json({error:'Funcionario inválido'});
 const user=await db.query('SELECT id,name,email FROM employees WHERE id=$1 AND active=true',[id]);
 if(!user.rowCount)return res.status(404).json({error:'Funcionario inexistente o inactivo'});
 const code=crypto.randomBytes(24).toString('hex');
 await db.query("INSERT INTO extension_pair_codes(code,user_id,expires) VALUES($1,$2,now()+interval '5 minutes')",[h(code),user.rows[0].id]);
 res.set('Cache-Control','no-store').json({code,expiresInSeconds:300,user:user.rows[0]});
}));
app.post('/api/admin/users/:id/extension/revoke',auth,admin,run(async(req,res)=>{
 const id=String(req.params.id);
 if(!/^[0-9]+$/.test(id))return res.status(400).json({error:'Funcionario inválido'});
 const user=await db.query('SELECT id FROM employees WHERE id=$1',[id]);
 if(!user.rowCount)return res.status(404).json({error:'Funcionario inexistente'});
 const tokens=await db.query('DELETE FROM extension_tokens WHERE user_id=$1',[id]);
 await db.query('DELETE FROM extension_pair_codes WHERE user_id=$1',[id]);
 await audit(req.user.id,'extension.revoke',id,{count:tokens.rowCount});res.set('Cache-Control','no-store').json({ok:true,revoked:tokens.rowCount});
}));
app.post('/api/extension/exchange',run(async(req,res)=>{
 const code=String(req.body?.code||'').trim().toLowerCase();
 if(!/^[a-f0-9]{48}$/.test(code))return res.status(400).json({error:'Código inválido'});
 const client=await db.connect();
 try{
  await client.query('BEGIN');
  const r=await client.query("DELETE FROM extension_pair_codes WHERE code=$1 AND expires>now() RETURNING user_id",[h(code)]);
  if(!r.rowCount){await client.query('ROLLBACK');return res.status(401).json({error:'Código vencido o utilizado'})}
  const u=await client.query('SELECT id FROM employees WHERE id=$1 AND active=true',[r.rows[0].user_id]);
  if(!u.rowCount){await client.query('ROLLBACK');return res.status(403).json({error:'Usuario inactivo'})}
  const token=crypto.randomBytes(32).toString('hex');
  await client.query("INSERT INTO extension_tokens(token,user_id,expires) VALUES($1,$2,now()+interval '30 days')",[h(token),u.rows[0].id]);
  await client.query('COMMIT');
  res.set('Cache-Control','no-store').json({token,expiresInSeconds:2592000});
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}));
app.post('/api/extension/heartbeat',extensionAuth,run(async(req,res)=>{
 const version=String(req.body?.version||'');
 if(!/^\d{1,3}\.\d{1,3}\.\d{1,3}(?:\.\d{1,3})?$/.test(version))return res.status(400).json({error:'Versión inválida'});
 const token=/^Bearer ([a-f0-9]{64})$/.exec(req.get('Authorization')||'')?.[1];
 await db.query('UPDATE extension_tokens SET version=$1,last_seen=now() WHERE token=$2',[version,h(token)]);
 res.set('Cache-Control','no-store').json({ok:true});
}));
app.get('/api/admin/extensions',auth,admin,run(async(req,res)=>{
 const r=await db.query("SELECT u.id,u.name,u.email,u.active,t.version,t.last_seen,t.expires FROM employees u LEFT JOIN LATERAL (SELECT version,last_seen,expires FROM extension_tokens WHERE user_id=u.id AND expires>now() ORDER BY last_seen DESC NULLS LAST LIMIT 1) t ON true WHERE u.role<>'admin' ORDER BY u.name");
 res.set('Cache-Control','no-store').json(r.rows);
}));
app.get('/api/extension/me',extensionAuth,run(async(req,res)=>{
 const reportedVersion=String(req.get('X-LANSEL-Extension-Version')||'');
 if(/^\d{1,3}\.\d{1,3}\.\d{1,3}(?:\.\d{1,3})?$/.test(reportedVersion)){
  const match=/^Bearer ([a-f0-9]{64})$/.exec(req.get('Authorization')||'');
  await db.query('UPDATE extension_tokens SET version=$1,last_seen=now() WHERE token=$2',[reportedVersion,h(match[1])]);
 }
 const result=await db.query('SELECT COUNT(*)::int AS total FROM accesses WHERE employee_id=$1',[req.extensionUser.id]);
 res.set('Cache-Control','no-store').json({name:req.extensionUser.name,assignedAccessCount:result.rows[0].total});
}));
app.get('/api/extension/platforms',extensionAuth,run(async(req,res)=>{
 const r=await db.query('SELECT id,title,url,username FROM accesses WHERE employee_id=$1 ORDER BY title,id',[req.extensionUser.id]);
 const platforms=r.rows.filter(a=>{try{const u=new URL(a.url);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}});
 res.set('Cache-Control','no-store').json(platforms);
}));
function crmKind(title){
 const t=String(title||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
 if(/\bVENTURY\b/.test(t))return 'ventury';
 if(/\bMERCADOS\b/.test(t))return 'mercados';
 return null;
}
function allowedAccessOrigin(access,origin){
 let saved;try{const u=new URL(access.url);if(u.protocol!=='https:')return false;saved=u.origin}catch{return false}
 if(saved===origin)return true;
 const kind=crmKind(access.title);
 const allowed=kind==='ventury'?['https://adfs365.stg-tradingcrm.com','https://venturyfx.tradingcrm.com']:kind==='mercados'?['https://mercadosinvest.tradingcrm.com','https://adfs365.stg-tradingcrm.com']:null;
 return !!allowed&&allowed.includes(saved)&&allowed.includes(origin);
}
app.get('/api/extension/accesses',extensionAuth,run(async(req,res)=>{
 let origin;try{origin=new URL(String(req.query.origin||''));if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw Error()}catch{return res.status(400).json({error:'Origen inválido'})}
 const r=await db.query('SELECT id,title,url,username FROM accesses WHERE employee_id=$1',[req.extensionUser.id]);
 res.set('Cache-Control','no-store').json(r.rows.filter(a=>{try{const u=new URL(a.url);return u.protocol==='https:'&&allowedAccessOrigin(a,origin.origin)}catch{return false}}));
}));
app.post('/api/extension/fill',extensionAuth,run(async(req,res)=>{
 const id=String(req.body?.id||'');
 let origin;try{origin=new URL(String(req.body?.origin||''));if(origin.protocol!=='https:'||origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password)throw Error()}catch{return res.status(400).json({error:'Origen inválido'})}
 if(!/^[0-9]+$/.test(id))return res.status(400).json({error:'Acceso inválido'});
 const r=await db.query('SELECT title,url,username,secret FROM accesses WHERE id=$1 AND employee_id=$2',[id,req.extensionUser.id]);
 if(!r.rowCount)return res.status(403).json({error:'Acceso no autorizado para este sitio'});
 const access=r.rows[0];
 if(!allowedAccessOrigin(access,origin.origin))return res.status(403).json({error:'Acceso no autorizado para este sitio'});
 res.set('Cache-Control','no-store').json({username:r.rows[0].username,password:dec(r.rows[0].secret)});
}));
app.post('/api/extension/revoke',extensionAuth,run(async(req,res)=>{
 const token=req.get('Authorization').slice(7);
 await db.query('DELETE FROM extension_tokens WHERE token=$1',[h(token)]);
 res.json({ok:true});
}));
app.get('/api/users',auth,admin,run(async(req,res)=>{const r=await db.query('SELECT id,name,email,role,active FROM employees ORDER BY name');res.json(r.rows)}));
app.post('/api/users',auth,admin,run(async(req,res)=>{const {name,email,password}=req.body;if(!name?.trim()||!email?.includes('@')||typeof password!=='string'||password.length<12)return res.status(400).json({error:'Datos inválidos; contraseña mínimo 12 caracteres'});const r=await db.query("INSERT INTO employees(name,email,password_hash,role) VALUES($1,$2,$3,'user') RETURNING id,name,email",[name.trim(),email.trim().toLowerCase(),await bcrypt.hash(password,12)]);await audit(req.user.id,'user.create',r.rows[0].id,{email:r.rows[0].email});res.status(201).json(r.rows[0])}));
app.patch('/api/admin/users/:id',auth,admin,run(async(req,res)=>{
 const id=String(req.params.id);
 if(!/^\d+$/.test(id))return res.status(400).json({error:'Funcionario inválido'});
 const {name,email,password}=req.body||{};
 if(typeof name!=='string'||!name.trim()||name.trim().length>150||typeof email!=='string'||!/^\S+@\S+\.\S+$/.test(email.trim())||email.length>254)return res.status(400).json({error:'Nombre o correo inválidos'});
 if(password!==undefined&&(typeof password!=='string'||(password.length>0&&password.length<12)||password.length>4096))return res.status(400).json({error:'La nueva contraseña debe tener al menos 12 caracteres'});
 const normalized=email.trim().toLowerCase();
 const existing=await db.query('SELECT id,role FROM employees WHERE id=$1',[id]);
 if(!existing.rowCount)return res.status(404).json({error:'Funcionario no encontrado'});
 if(existing.rows[0].role==='admin'&&String(req.user.id)!==id)return res.status(403).json({error:'No se permite editar otro administrador'});
 const hashed=password?await bcrypt.hash(password,12):null;
 const updated=await db.query('UPDATE employees SET name=$1,email=$2,password_hash=COALESCE($3,password_hash) WHERE id=$4 RETURNING id,name,email,role,active',[name.trim(),normalized,hashed,id]);
 if(hashed){await db.query('DELETE FROM sessions WHERE user_id=$1',[id]);await db.query('DELETE FROM extension_tokens WHERE user_id=$1',[id]);await db.query('DELETE FROM extension_pair_codes WHERE user_id=$1',[id]);}
 await audit(req.user.id,hashed?'user.password_reset':'user.update',id,{email:normalized});
 res.set('Cache-Control','no-store').json(updated.rows[0]);
}));

app.post('/api/users/:id/accesses',auth,admin,run(async(req,res)=>{const {title,url,username,password}=req.body;let u;try{u=new URL(url);if(!['http:','https:'].includes(u.protocol))throw Error()}catch{return res.status(400).json({error:'URL inválida'})}if(!title?.trim()||!username?.trim()||!password)return res.status(400).json({error:'Completá los campos'});const existing=await db.query('SELECT id FROM accesses WHERE employee_id=$1 AND lower(trim(title))=lower($2) AND lower(trim(username))=lower($3) AND url=$4 LIMIT 1',[req.params.id,title.trim(),username.trim(),u.href]);if(existing.rowCount)return res.status(409).json({error:'Este acceso ya está asignado al funcionario. Editá el registro existente en lugar de duplicarlo'});const r=await db.query('INSERT INTO accesses(employee_id,title,url,username,secret) VALUES($1,$2,$3,$4,$5) RETURNING id,title,url,username',[req.params.id,title.trim(),u.href,username.trim(),enc(password)]);await audit(req.user.id,'access.create',r.rows[0].id,{employee_id:req.params.id,title:title.trim()});await audit(req.user.id,'access.create',r.rows[0].id,{employee_id:req.params.id,title:title.trim()});res.status(201).json(r.rows[0])}));

// Auditoría administrativa: solo metadatos, nunca credenciales ni tokens.
async function audit(actor,action,target,details={}){await db.query('INSERT INTO admin_audit(actor_id,action,target,details) VALUES($1,$2,$3,$4)',[actor,action,String(target),JSON.stringify(details)]);}
app.get('/api/admin/audit',auth,admin,run(async(req,res)=>{
 const r=await db.query('SELECT a.id,a.action,a.target,a.details,a.created_at,e.name AS actor FROM admin_audit a LEFT JOIN employees e ON e.id=a.actor_id ORDER BY a.id DESC LIMIT 150');
 res.set('Cache-Control','no-store').json(r.rows);
}));
app.post('/api/admin/accesses/bulk',auth,admin,run(async(req,res)=>{
 const {employee_id,accesses}=req.body||{};
 if(!/^\d+$/.test(String(employee_id||''))||!Array.isArray(accesses)||accesses.length<1||accesses.length>20)return res.status(400).json({error:'Seleccioná un funcionario y entre 1 y 20 accesos'});
 const employee=await db.query("SELECT id FROM employees WHERE id=$1 AND role='user' AND active=true",[employee_id]);
 if(!employee.rowCount)return res.status(404).json({error:'Funcionario no encontrado o inactivo'});
 const prepared=[];
 for(const a of accesses){
  if(!a||typeof a.title!=='string'||!a.title.trim()||typeof a.username!=='string'||!a.username.trim()||typeof a.password!=='string'||!a.password||a.password.length>4096)return res.status(400).json({error:'Completá todos los campos de cada acceso'});
  let u;try{u=new URL(a.url);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error()}catch{return res.status(400).json({error:'URL inválida en uno de los accesos'})}
  prepared.push({title:a.title.trim(),url:u.href,username:a.username.trim(),secret:enc(a.password)});
 }
 const client=await db.connect();let inserted=0;
 try{
  await client.query('BEGIN');
  for(const a of prepared){
   const exists=await client.query('SELECT id FROM accesses WHERE employee_id=$1 AND lower(trim(title))=lower($2) AND lower(trim(username))=lower($3) AND url=$4 LIMIT 1',[employee_id,a.title,a.username,a.url]);
   if(exists.rowCount)throw Object.assign(new Error('Acceso duplicado: '+a.title),{status:409});
   await client.query('INSERT INTO accesses(employee_id,title,url,username,secret) VALUES($1,$2,$3,$4,$5)',[employee_id,a.title,a.url,a.username,a.secret]);inserted++;
  }
  await client.query('INSERT INTO admin_audit(actor_id,action,target,details) VALUES($1,$2,$3,$4)',[req.user.id,'access.bulk_create',String(employee_id),JSON.stringify({count:inserted})]);
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');if(e.status)return res.status(e.status).json({error:e.message});throw e}finally{client.release()}
 res.status(201).json({ok:true,count:inserted});
}));
app.get('/api/admin/accesses',auth,admin,run(async(req,res)=>{
 const result=await db.query('SELECT a.id,a.employee_id,a.title,a.url,a.username,e.name AS employee_name,e.email AS employee_email FROM accesses a JOIN employees e ON e.id=a.employee_id ORDER BY e.name,a.title');
 res.set('Cache-Control','no-store').json(result.rows);
}));
app.patch('/api/admin/accesses/:id',auth,admin,run(async(req,res)=>{
 const id=String(req.params.id);
 if(!/^\d+$/.test(id))return res.status(400).json({error:'Identificador inválido'});
 const {title,url,username,password}=req.body||{};
 if(password!==undefined&&(typeof password!=='string'||password.length>4096))return res.status(400).json({error:'Contraseña inválida'});
 if(typeof title!=='string'||!title.trim()||typeof username!=='string'||!username.trim()||typeof url!=='string')return res.status(400).json({error:'Completá nombre, enlace y usuario'});
 let parsed;
 try{parsed=new URL(url);if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password)throw Error()}catch{return res.status(400).json({error:'Enlace inválido. Usá una URL http o https'})}
 const changePassword=typeof password==='string'&&password.length>0;
 const result=await db.query('UPDATE accesses SET title=$1,url=$2,username=$3,secret=CASE WHEN $5::boolean THEN $6 ELSE secret END WHERE id=$4 RETURNING id,employee_id,title,url,username',[title.trim(),parsed.href,username.trim(),id,changePassword,changePassword?enc(password):null]);
 if(!result.rowCount)return res.status(404).json({error:'Acceso no encontrado'});
 await audit(req.user.id,'access.update',id,{title:title.trim()});
 res.set('Cache-Control','no-store').json(result.rows[0]);
}));
app.delete('/api/admin/accesses/:id',auth,admin,run(async(req,res)=>{
 const id=String(req.params.id);
 if(!/^[0-9]+$/.test(id))return res.status(400).json({error:'Identificador inválido'});
 const result=await db.query('DELETE FROM accesses WHERE id=$1 RETURNING id,title,employee_id',[id]);
 if(!result.rowCount)return res.status(404).json({error:'Acceso no encontrado'});
 await audit(req.user.id,'access.delete',id,{title:result.rows[0].title,employee_id:result.rows[0].employee_id});
 res.set('Cache-Control','no-store').json({ok:true,id:result.rows[0].id});
}));
app.patch('/api/users/:id/status',auth,admin,run(async(req,res)=>{if(String(req.user.id)===req.params.id)return res.status(400).json({error:'No podés desactivarte'});await db.query('UPDATE employees SET active=$1 WHERE id=$2',[req.body.active===true,req.params.id]);await audit(req.user.id,'user.status',req.params.id,{active:req.body.active===true});res.json({ok:true})}));
app.use((err,req,res,next)=>{console.error(err);res.status(err.code==='23505'?409:500).json({error:err.code==='23505'?'Correo ya registrado':'Error interno'})});
async function init(){
await db.query("CREATE TABLE IF NOT EXISTS employees(id BIGSERIAL PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'user',active BOOLEAN NOT NULL DEFAULT true)");
await db.query("CREATE TABLE IF NOT EXISTS accesses(id BIGSERIAL PRIMARY KEY,employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,title TEXT NOT NULL,url TEXT NOT NULL,username TEXT NOT NULL,secret TEXT NOT NULL)");
await db.query("CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,expires TIMESTAMPTZ NOT NULL)");
await db.query("CREATE TABLE IF NOT EXISTS extension_pair_codes(code TEXT PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,expires TIMESTAMPTZ NOT NULL)");
await db.query("CREATE TABLE IF NOT EXISTS extension_tokens(token TEXT PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,expires TIMESTAMPTZ NOT NULL)");
await db.query('ALTER TABLE extension_tokens ADD COLUMN IF NOT EXISTS version TEXT');
await db.query('ALTER TABLE extension_tokens ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ');
await db.query('CREATE TABLE IF NOT EXISTS admin_audit(id BIGSERIAL PRIMARY KEY,actor_id BIGINT REFERENCES employees(id) ON DELETE SET NULL,action TEXT NOT NULL,target TEXT NOT NULL,details JSONB NOT NULL DEFAULT \'{}\'::jsonb,created_at TIMESTAMPTZ NOT NULL DEFAULT now())');
if(process.env.ADMIN_EMAIL&&process.env.ADMIN_PASSWORD){if(process.env.ADMIN_PASSWORD.length<12)throw Error('Admin password too short');const email=process.env.ADMIN_EMAIL.toLowerCase();const r=await db.query('SELECT id FROM employees WHERE email=$1',[email]);if(!r.rowCount)await db.query("INSERT INTO employees(name,email,password_hash,role) VALUES('Administrador',$1,$2,'admin')",[email,await bcrypt.hash(process.env.ADMIN_PASSWORD,12)])}
}
let ready;
app.get('/api/health',async(req,res)=>{if(configError)return res.status(503).json({status:'configuration_error'});try{await db.query('SELECT 1');res.json({status:'ok',database:'connected'})}catch(e){console.error('Database health check failed',e.code||e.message);res.status(503).json({status:'database_unavailable'})}});
export default function handler(req,res){
 if(configError){console.error('Accesos LANSEL configuration error:',configError);return res.status(503).json({error:'Configuración del servidor incompleta'});}
 ready??=init().catch(err=>{ready=undefined;throw err});
 return ready.then(()=>app(req,res)).catch(err=>{console.error(err);if(!res.headersSent)res.status(503).json({error:'Servicio no disponible'})});
}
if(!process.env.VERCEL && !configError) init().then(()=>app.listen(process.env.PORT||3000)).catch(e=>{console.error(e);process.exit(1)});

