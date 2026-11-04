import 'dotenv/config';
import express from 'express';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
const app=express(),db=new pg.Pool({connectionString:process.env.DATABASE_URL,max:3,connectionTimeoutMillis:10000,idleTimeoutMillis:10000,ssl:process.env.DATABASE_SSL==='true'?{rejectUnauthorized:true}:undefined});
app.use(helmet());app.use(express.json());app.use(cookieParser());app.use(express.static('public'));
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
app.get('/api/users',auth,admin,run(async(req,res)=>{const r=await db.query('SELECT id,name,email,role,active FROM employees ORDER BY name');res.json(r.rows)}));
app.post('/api/users',auth,admin,run(async(req,res)=>{const {name,email,password}=req.body;if(!name?.trim()||!email?.includes('@')||typeof password!=='string'||password.length<12)return res.status(400).json({error:'Datos inválidos; contraseña mínimo 12 caracteres'});const r=await db.query("INSERT INTO employees(name,email,password_hash,role) VALUES($1,$2,$3,'user') RETURNING id,name,email",[name.trim(),email.trim().toLowerCase(),await bcrypt.hash(password,12)]);res.status(201).json(r.rows[0])}));
app.post('/api/users/:id/accesses',auth,admin,run(async(req,res)=>{const {title,url,username,password}=req.body;let u;try{u=new URL(url);if(!['http:','https:'].includes(u.protocol))throw Error()}catch{return res.status(400).json({error:'URL inválida'})}if(!title?.trim()||!username?.trim()||!password)return res.status(400).json({error:'Completá los campos'});const r=await db.query('INSERT INTO accesses(employee_id,title,url,username,secret) VALUES($1,$2,$3,$4,$5) RETURNING id,title,url,username',[req.params.id,title.trim(),u.href,username.trim(),enc(password)]);res.status(201).json(r.rows[0])}));
app.patch('/api/users/:id/status',auth,admin,run(async(req,res)=>{if(String(req.user.id)===req.params.id)return res.status(400).json({error:'No podés desactivarte'});await db.query('UPDATE employees SET active=$1 WHERE id=$2',[req.body.active===true,req.params.id]);res.json({ok:true})}));
app.use((err,req,res,next)=>{console.error(err);res.status(err.code==='23505'?409:500).json({error:err.code==='23505'?'Correo ya registrado':'Error interno'})});
async function init(){
await db.query("CREATE TABLE IF NOT EXISTS employees(id BIGSERIAL PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'user',active BOOLEAN NOT NULL DEFAULT true)");
await db.query("CREATE TABLE IF NOT EXISTS accesses(id BIGSERIAL PRIMARY KEY,employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,title TEXT NOT NULL,url TEXT NOT NULL,username TEXT NOT NULL,secret TEXT NOT NULL)");
await db.query("CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,expires TIMESTAMPTZ NOT NULL)");
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

