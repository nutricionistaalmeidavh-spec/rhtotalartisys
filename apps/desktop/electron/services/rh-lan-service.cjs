const crypto=require('node:crypto')
const http=require('node:http')
const https=require('node:https')
const fs=require('node:fs')
const {URL}=require('node:url')
const {HrWorkspaceService}=require('./hr-workspace-service.cjs')
const ROLES=new Set(['admin','rh','gestor','contador','colaborador'])
const PUBLIC_ROLES={admin:'Administrador',rh:'Recursos humanos',gestor:'Gestor',contador:'Contador',colaborador:'Colaborador'}
const LIMITED={gestor:new Set(['vaga','candidato','onboarding','treinamento','matricula','avaliacao','feedback','meta','pdi']),contador:new Set(['rubrica','vencimento']),colaborador:new Set(['onboarding','treinamento','matricula','feedback','meta','pdi','resposta'])}
const hashToken=token=>crypto.createHash('sha256').update(token).digest('hex')
function safeAccount(row){if(!row)return null;const{senha_hash,...safe}=row;return safe}
class LocalAccessService{
 constructor({db}){this.db=db;this.loginAttempts=new Map()}
 createAccount(data={},options={}){
  const user=String(data.usuario||'').trim().toLowerCase()
  const nome=String(data.nome||'').trim()
  const pass=String(data.senha||'')
  if(!/^[a-z0-9._-]{3,64}$/.test(user)||nome.length<2||!ROLES.has(data.perfil))throw Error('Usuário, nome ou perfil inválido.')
  if(pass.length<12||pass.length>128)throw Error('Use uma senha de 12 a 128 caracteres.')
  if(!options.trustedDesktop){
   const actor=options.actor
   if(!actor||actor.perfil!=='admin')throw Error('A criação de contas exige ação administrativa local.')
   if(actor.empresa_id&&Number(actor.empresa_id)!==Number(data.empresa_id))throw Error('Usuário pertence a outra empresa.')
  }
  const total=this.db.db.prepare('SELECT COUNT(*) n FROM rh_contas_locais').get().n
  if(!total&&(!options.trustedDesktop||data.perfil!=='admin'))throw Error('A primeira conta deve ser administrador criado localmente.')
  const companyId=data.empresa_id?Number(data.empresa_id):null
  if(companyId&&!this.db.get('empresas',companyId))throw Error('Empresa inexistente.')
  if(data.perfil!=='admin'&&!companyId)throw Error('Defina uma empresa para este perfil.')
  const employeeId=data.funcionario_id?Number(data.funcionario_id):null
  if(data.perfil==='colaborador'&&!employeeId)throw Error('Associe o colaborador ao seu cadastro.')
  if(employeeId){
   const employee=this.db.get('funcionarios',employeeId)
   if(!employee||Number(employee.empresa_id)!==companyId)throw Error('Colaborador pertence a outra empresa.')
  }
  const salt=crypto.randomBytes(16).toString('hex')
  const digest=crypto.scryptSync(pass,salt,64).toString('hex')
  const result=this.db.db.prepare('INSERT INTO rh_contas_locais(empresa_id,usuario,nome,perfil,senha_hash,funcionario_id) VALUES (?,?,?,?,?,?)')
   .run(companyId,user,nome,data.perfil,salt+':'+digest,employeeId)
  this.db.audit('rh_contas_locais',Number(result.lastInsertRowid),'criar',{perfil:data.perfil,empresa_id:companyId})
  return safeAccount(this.db.db.prepare('SELECT * FROM rh_contas_locais WHERE id=?').get(Number(result.lastInsertRowid)))
 }
 listAccounts(){
  return this.db.db.prepare('SELECT id,empresa_id,funcionario_id,usuario,nome,perfil,ativo,criado_em FROM rh_contas_locais ORDER BY usuario').all()
 }
 login(data={}){
  const user=String(data.usuario||'').trim().toLowerCase(),password=String(data.senha||'')
  const now=Date.now(),attempt=this.loginAttempts.get(user)
  if(attempt&&attempt.count>=6&&now-attempt.since<15*60*1000)throw Error('Muitas tentativas. Tente novamente mais tarde.')
  const row=this.db.db.prepare('SELECT * FROM rh_contas_locais WHERE usuario=? AND ativo=1').get(user)
  let ok=false
  if(row&&typeof row.senha_hash==='string'){
   const [salt,original]=row.senha_hash.split(':')
   if(salt&&original&&original.length===128&&password.length<=128){
    const calculated=crypto.scryptSync(password,salt,64)
    ok=crypto.timingSafeEqual(calculated,Buffer.from(original,'hex'))
   }
  }
  if(!ok){
   this.loginAttempts.set(user,{count:(attempt&&now-attempt.since<15*60*1000?attempt.count:0)+1,since:attempt&&now-attempt.since<15*60*1000?attempt.since:now})
   throw Error('Credenciais inválidas.')
  }
  this.loginAttempts.delete(user)
  const token=crypto.randomBytes(32).toString('hex')
  const expires=Math.floor(now/1000)+8*3600
  this.db.db.prepare('INSERT INTO rh_sessoes_locais(token_hash,conta_id,expira_em) VALUES (?,?,?)').run(hashToken(token),row.id,expires)
  return{token,expires_at:new Date(expires*1000).toISOString(),account:safeAccount(row)}
 }
 logout(token){this.db.db.prepare('DELETE FROM rh_sessoes_locais WHERE token_hash=?').run(hashToken(String(token||'')));return true}
 requireSession(token,{empresa_id,action='read',tipo,funcionario_id}={}){
  const row=this.db.db.prepare('SELECT a.* FROM rh_sessoes_locais s JOIN rh_contas_locais a ON a.id=s.conta_id WHERE s.token_hash=? AND s.expira_em>? AND a.ativo=1')
   .get(hashToken(String(token||'')),Math.floor(Date.now()/1000))
  if(!row)throw Error('Sessão inválida ou expirada.')
  if(empresa_id&&row.empresa_id&&Number(row.empresa_id)!==Number(empresa_id))throw Error('Acesso negado: outra empresa.')
  if(row.perfil!=='admin'){
   if(!row.empresa_id)throw Error('Perfil sem empresa.')
   if(action==='admin')throw Error('Permissão administrativa necessária.')
   if(action==='write'&&['contador','colaborador'].includes(row.perfil))throw Error('Perfil sem permissão de escrita.')
   if(tipo&&LIMITED[row.perfil]&&!LIMITED[row.perfil].has(tipo))throw Error('Perfil sem acesso a este módulo.')
  }
  if(row.perfil==='colaborador'&&Number(row.funcionario_id)!==Number(funcionario_id))throw Error('Acesso restrito ao próprio colaborador.')
  return safeAccount(row)
 }
}
function createHrLanServer({db,access,host='127.0.0.1',port=0,tlsKey,tlsCert}={}){
 const loopback=['127.0.0.1','localhost','::1'].includes(host)
 if(!loopback&&(!tlsKey||!tlsCert))throw Error('TLS é obrigatório para expor o servidor RH fora do loopback.')
 if(!Number.isInteger(Number(port))||Number(port)<0||Number(port)>65535)throw Error('Porta inválida.')
 const hr=new HrWorkspaceService({db})
 function respond(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body))}
 function bearer(req){const match=/^Bearer ([0-9a-f]{64})$/i.exec(String(req.headers.authorization||''));return match?match[1]:''}
 async function receive(req){let data='';for await(const chunk of req){data+=chunk.toString();if(data.length>32768)throw Error('Corpo excede 32 KB.')}return data?JSON.parse(data):{}}
 const listener=async(req,res)=>{
  try{
   const url=new URL(req.url||'/', 'http://localhost')
   if(req.method==='GET'&&url.pathname==='/v1/health')return respond(res,200,{status:'ok',product:'RH Total ArtiSys',apiVersion:'1',cloudRequired:false})
   if(req.method==='POST'&&url.pathname==='/v1/auth/login'){const data=await receive(req);return respond(res,200,access.login(data))}
   const token=bearer(req)
   if(!token)return respond(res,401,{error:'Autenticação obrigatória.'})
   if(req.method==='POST'&&url.pathname==='/v1/auth/logout'){access.requireSession(token);return respond(res,200,{ok:access.logout(token)})}
   if(req.method==='GET'&&url.pathname==='/v1/me'){return respond(res,200,access.requireSession(token))}
   if(req.method==='GET'&&url.pathname==='/v1/records'){
    const emp=Number(url.searchParams.get('empresa_id')||0),tipo=url.searchParams.get('tipo')||undefined
    const caller=access.requireSession(token,{empresa_id:emp||undefined,tipo})
    if(LIMITED[caller.perfil]&&!tipo)throw Error('Selecione um módulo autorizado para este perfil.')
    const companyId=caller.empresa_id||emp
    if(!companyId)throw Error('Informe a empresa.')
    const own=caller.perfil==='colaborador'?caller.funcionario_id:undefined
    return respond(res,200,hr.list({empresa_id:companyId,tipo,funcionario_id:own}))
   }
   if(req.method==='POST'&&url.pathname==='/v1/records'){
    const data=await receive(req)
    const caller=access.requireSession(token,{empresa_id:data.empresa_id,action:'write',tipo:data.tipo,funcionario_id:data.funcionario_id})
    if(caller.empresa_id)data.empresa_id=caller.empresa_id
    return respond(res,200,hr.save(data))
   }
   if(req.method==='POST'&&url.pathname==='/v1/users'){
    const data=await receive(req)
    const actor=access.requireSession(token,{empresa_id:data.empresa_id,action:'admin'})
    return respond(res,201,access.createAccount(data,{actor}))
   }
   if(req.method==='GET'&&url.pathname==='/v1/indicators'){
    const emp=Number(url.searchParams.get('empresa_id')||0)
    const actor=access.requireSession(token,{empresa_id:emp||undefined})
    if(actor.perfil==='colaborador')throw Error('Indicadores não disponíveis para colaborador.')
    return respond(res,200,hr.indicators({empresa_id:actor.empresa_id||emp}))
   }
   return respond(res,404,{error:'Rota não encontrada.'})
  }catch(error){
   const message=String(error?.message||error)
   const unauthorized=/Sessão|Credenciais/.test(message)
   const forbidden=/outra empresa|permissão|Acesso|Perfil|colaborador/i.test(message)
   respond(res,unauthorized?401:forbidden?403:400,{error:message})
  }
 }
 const server=loopback?http.createServer((req,res)=>{void listener(req,res)}):https.createServer({key:fs.readFileSync(tlsKey),cert:fs.readFileSync(tlsCert)},(req,res)=>{void listener(req,res)})
 let running=false
 return{
  async start(){if(running)throw Error('Servidor já iniciado.');await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(Number(port),host,()=>{server.off('error',reject);resolve()})});running=true;const address=server.address();const actual=typeof address==='object'?address.port:port;return{running:true,host,port:actual,url:(loopback?'http':'https')+'://'+(host==='0.0.0.0'?'localhost':host)+':'+actual}},
  async stop(){if(!running)return;await new Promise(resolve=>server.close(resolve));running=false},
  get running(){return running}
 }
}
module.exports={LocalAccessService,createHrLanServer,PUBLIC_ROLES}
