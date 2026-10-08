const ALLOWED_TYPES=Object.freeze([
 'ferias','afastamento','desligamento','historico_contratual','checklist','vencimento',
 'jornada','ajuste_ponto','rubrica','vaga','candidato','onboarding','departamento',
 'competencia','avaliacao','meta','pdi','treinamento','matricula','pesquisa','resposta','feedback'
])
const ALLOWED_STATES=new Set(['rascunho','pendente','aprovado','concluido','cancelado'])
const yyyyMMdd=/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const competence=/^\d{4}-(0[1-9]|1[0-2])$/
function validDate(value){if(value===null||value===undefined||value==='')return null;const s=String(value);if(!yyyyMMdd.test(s)||Number.isNaN(Date.parse(s))||new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)throw Error('Data inválida.');return s}
function id(value,label){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw Error(label+' inválido.');return n}
function safeJson(value){
 if(value===null||value===undefined||value==='')return '{}'
 const obj=typeof value==='string'?JSON.parse(value):value
 if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error('Dados adicionais precisam ser um objeto.')
 const result=JSON.stringify(obj)
 if(result.length>24000)throw Error('Dados adicionais excedem 24 KB.')
 return result
}
function present(row){if(!row)return null;let dados={};try{dados=JSON.parse(row.dados_json||'{}')}catch{}return {...row,dados}}
class HrWorkspaceService{
 constructor({db}){this.db=db}
 company(empresaId){const company=this.db.get('empresas',id(empresaId,'Empresa'));if(!company||company.deleted_at)throw Error('Empresa não encontrada.');return company}
 employee(funcionarioId,empresaId){if(!funcionarioId)return null;const employee=this.db.get('funcionarios',id(funcionarioId,'Funcionário'));if(!employee||employee.deleted_at)throw Error('Funcionário não encontrado.');if(Number(employee.empresa_id)!==Number(empresaId))throw Error('Funcionário pertence a outra empresa.');return employee}
 list({empresa_id,tipo,funcionario_id,estado,limit=150}={}){
  const company=this.company(empresa_id)
  const clauses=['empresa_id=?','deleted_at IS NULL'],args=[company.id]
  if(tipo){if(!ALLOWED_TYPES.includes(tipo))throw Error('Tipo RH inválido.');clauses.push('tipo=?');args.push(tipo)}
  if(funcionario_id){this.employee(funcionario_id,company.id);clauses.push('funcionario_id=?');args.push(Number(funcionario_id))}
  if(estado){if(!ALLOWED_STATES.has(estado))throw Error('Estado inválido.');clauses.push('estado=?');args.push(estado)}
  const count=Math.max(1,Math.min(500,Math.trunc(Number(limit)||150)))
  return this.db.db.prepare('SELECT * FROM rh_registros WHERE '+clauses.join(' AND ')+' ORDER BY updated_at DESC,id DESC LIMIT ?').all(...args,count).map(present)
 }
 get({id:recordId,empresa_id}){
  const company=this.company(empresa_id)
  const row=this.db.db.prepare('SELECT * FROM rh_registros WHERE id=? AND empresa_id=? AND deleted_at IS NULL').get(id(recordId,'Registro'),company.id)
  if(!row)throw Error('Registro não encontrado nesta empresa.')
  return present(row)
 }
 save(input={}){
  const company=this.company(input.empresa_id)
  const old=input.id?this.get({id:input.id,empresa_id:company.id}):null
  const tipo=String(input.tipo||old?.tipo||'')
  if(!ALLOWED_TYPES.includes(tipo))throw Error('Tipo RH inválido.')
  const funcionarioId=input.funcionario_id===undefined?(old?.funcionario_id||null):(input.funcionario_id?this.employee(input.funcionario_id,company.id).id:null)
  if(old&&(old.tipo!==tipo||Number(old.funcionario_id||0)!==Number(funcionarioId||0)))throw Error('Tipo e funcionário não podem ser modificados em um registro existente.')
  const titulo=String(input.titulo??old?.titulo??'').trim()
  if(titulo.length<2||titulo.length>160)throw Error('Informe um título de 2 a 160 caracteres.')
  const estado=String(input.estado??old?.estado??'rascunho')
  if(!ALLOWED_STATES.has(estado))throw Error('Estado inválido.')
  const inicio=validDate(input.inicio===undefined?old?.inicio:input.inicio)
  const fim=validDate(input.fim===undefined?old?.fim:input.fim)
  if(inicio&&fim&&fim<inicio)throw Error('Data final não pode ser anterior à inicial.')
  const responsavel=String(input.responsavel??old?.responsavel??'').trim().slice(0,160)||null
  const valor=Number(input.valor_centavos??old?.valor_centavos??0)
  if(!Number.isSafeInteger(valor)||valor<0)throw Error('Valor em centavos inválido.')
  const dados=safeJson(input.dados===undefined?(input.dados_json===undefined?old?.dados_json:input.dados_json):input.dados)
  if(tipo==='ferias'&&['aprovado','concluido'].includes(estado)){
   if(!funcionarioId||!inicio||!fim)throw Error('Férias aprovadas exigem funcionário e período completo.')
   const clash=this.db.db.prepare("SELECT id FROM rh_registros WHERE empresa_id=? AND funcionario_id=? AND tipo='ferias' AND estado IN ('aprovado','concluido') AND deleted_at IS NULL AND id!=? AND inicio<=? AND fim>=? LIMIT 1").get(company.id,funcionarioId,old?.id||0,fim,inicio)
   if(clash)throw Error('Há sobreposição com férias aprovadas neste período.')
  }
  return this.db.db.transaction(()=>{
   if(old){
    if(Number(input.revisao)!==Number(old.revisao))throw Error('Registro alterado por outra sessão. Atualize antes de salvar.')
    const changed=this.db.db.prepare('UPDATE rh_registros SET titulo=?,estado=?,inicio=?,fim=?,responsavel=?,valor_centavos=?,dados_json=?,revisao=revisao+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND empresa_id=? AND revisao=? AND deleted_at IS NULL')
      .run(titulo,estado,inicio,fim,responsavel,valor,dados,old.id,company.id,old.revisao)
    if(!changed.changes)throw Error('Registro alterado por outra sessão. Atualize antes de salvar.')
    this.db.audit('rh_registros',old.id,'atualizar',{empresa_id:company.id,tipo,estado,revisao:old.revisao+1})
    return this.get({id:old.id,empresa_id:company.id})
   }
   const inserted=this.db.db.prepare('INSERT INTO rh_registros(empresa_id,funcionario_id,tipo,titulo,estado,inicio,fim,responsavel,valor_centavos,dados_json) VALUES (?,?,?,?,?,?,?,?,?,?)')
     .run(company.id,funcionarioId,tipo,titulo,estado,inicio,fim,responsavel,valor,dados)
   this.db.audit('rh_registros',Number(inserted.lastInsertRowid),'criar',{empresa_id:company.id,tipo,estado})
   return this.get({id:Number(inserted.lastInsertRowid),empresa_id:company.id})
  })()
 }
 remove({id:recordId,empresa_id,revisao}){
  const row=this.get({id:recordId,empresa_id})
  if(Number(row.revisao)!==Number(revisao))throw Error('Registro alterado por outra sessão.')
  const changed=this.db.db.prepare('UPDATE rh_registros SET deleted_at=CURRENT_TIMESTAMP,revisao=revisao+1 WHERE id=? AND empresa_id=? AND revisao=?').run(row.id,row.empresa_id,row.revisao)
  if(!changed.changes)throw Error('Registro alterado por outra sessão.')
  this.db.audit('rh_registros',row.id,'excluir',{empresa_id:row.empresa_id,tipo:row.tipo})
  return true
 }
 indicators({empresa_id}={}){
  const company=this.company(empresa_id)
  const employees=this.db.db.prepare("SELECT COUNT(*) AS total FROM funcionarios WHERE empresa_id=? AND status='ativo' AND deleted_at IS NULL").get(company.id)
  const statuses=this.db.db.prepare('SELECT tipo,estado,COUNT(*) AS total FROM rh_registros WHERE empresa_id=? AND deleted_at IS NULL GROUP BY tipo,estado').all(company.id)
  const registros={}
  for(const row of statuses)registros[row.tipo]=(registros[row.tipo]||0)+row.total
  const current=this.db.db.prepare("SELECT COUNT(*) AS total FROM rh_registros WHERE empresa_id=? AND tipo IN ('ferias','afastamento') AND estado IN ('aprovado','concluido') AND inicio<=date('now') AND fim>=date('now') AND deleted_at IS NULL").get(company.id)
  return{funcionarios:employees.total,ausencias_hoje:current.total,registros,estados:statuses}
 }
 closePayroll({empresa_id,competencia:period}){
  const company=this.company(empresa_id)
  if(!competence.test(String(period||'')))throw Error('Competência inválida.')
  const sheet=this.db.db.prepare('SELECT * FROM folhas_pagamento WHERE empresa_id=? AND competencia=?').get(company.id,period)
  if(!sheet)throw Error('A folha ainda não foi inicializada.')
  if(sheet.status==='fechada')throw Error('Esta folha já está fechada.')
  const pending=this.db.db.prepare("SELECT COUNT(*) AS total FROM folha_lancamentos WHERE folha_id=? AND status='pendente'").get(sheet.id)
  if(pending.total)throw Error('Existem lançamentos pendentes. Confira e confirme os pagamentos antes do fechamento.')
  this.db.db.prepare("UPDATE folhas_pagamento SET status='fechada',fechada_em=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(sheet.id)
  this.db.audit('folhas_pagamento',sheet.id,'fechar',{empresa_id:company.id,competencia:period})
  return this.db.get('folhas_pagamento',sheet.id)
 }
 reopenPayroll({empresa_id,competencia:period,justificativa}){
  const company=this.company(empresa_id)
  if(!competence.test(String(period||'')))throw Error('Competência inválida.')
  const reason=String(justificativa||'').trim()
  if(reason.length<10)throw Error('Informe justificativa de pelo menos 10 caracteres.')
  const sheet=this.db.db.prepare('SELECT * FROM folhas_pagamento WHERE empresa_id=? AND competencia=?').get(company.id,period)
  if(!sheet||sheet.status!=='fechada')throw Error('Não há folha fechada nessa competência.')
  this.db.db.prepare("UPDATE folhas_pagamento SET status='aberta',fechada_em=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(sheet.id)
  this.db.audit('folhas_pagamento',sheet.id,'reabrir',{empresa_id:company.id,competencia:period,justificativa:reason})
  return this.db.get('folhas_pagamento',sheet.id)
 }
 // Um desligamento planejado nao desativa o cadastro: exige acao expressa.
 completeTermination({empresa_id,id:recordId,confirmacao}){
  if(confirmacao!==true)throw Error('Confirme expressamente o desligamento.')
  const row=this.get({empresa_id,id:recordId})
  if(row.tipo!=='desligamento'||!row.funcionario_id)throw Error('Registro de desligamento inválido.')
  if(!row.fim)throw Error('Informe a data de desligamento.')
  return this.db.db.transaction(()=>{
   const employee=this.employee(row.funcionario_id,row.empresa_id)
   const updated=this.save({...row,estado:'concluido'})
   this.db.db.prepare("UPDATE funcionarios SET status='inativo',updated_at=CURRENT_TIMESTAMP WHERE id=? AND empresa_id=?").run(employee.id,row.empresa_id)
   this.db.audit('funcionarios',employee.id,'desligamento',{empresa_id:row.empresa_id,referencia:row.id,datadesligamento:row.fim})
   return updated
  })()
 }
}
module.exports={HrWorkspaceService,ALLOWED_TYPES}
