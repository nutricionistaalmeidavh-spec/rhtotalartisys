import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const { DatabaseService }=require('./database.cjs')
const { HrWorkspaceService }=require('./hr-workspace-service.cjs')
const fixtures:any[]=[]
function setup(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rh-total-p0-p4-'))
 const db=new DatabaseService({dataDir:dir,migrationsDir:path.resolve(import.meta.dirname,'../../database/migrations')})
 db.open(); fixtures.push({dir,db})
 const a=db.save('empresas',{razao_social:'Empresa A',status:'ativa'})
 const b=db.save('empresas',{razao_social:'Empresa B',status:'ativa'})
 const employee=db.save('funcionarios',{empresa_id:a.id,nome:'Colaboradora A',status:'ativo',salario_centavos:315000})
 return {db,a,b,employee,service:new HrWorkspaceService({db})}
}
afterEach(()=>{for(const f of fixtures.splice(0)){f.db.close();fs.rmSync(f.dir,{recursive:true,force:true})}})
describe('RH P0-P4 canônico local',()=>{
 it('cria férias, consulta apenas empresa correspondente e aplica revisão otimista',()=>{
  const {a,b,employee,service}=setup()
  const row=service.save({empresa_id:a.id,funcionario_id:employee.id,tipo:'ferias',titulo:'Férias julho',inicio:'2027-07-01',fim:'2027-07-30',estado:'aprovado'})
  expect(service.list({empresa_id:a.id,tipo:'ferias'}).map((r:any)=>r.id)).toEqual([row.id])
  expect(service.list({empresa_id:b.id,tipo:'ferias'})).toEqual([])
  expect(()=>service.save({...row,revisao:999,estado:'concluido'})).toThrow(/alterado por outra sessão/)
  expect(service.save({...row,estado:'concluido'}).revisao).toBe(2)
 })
 it('bloqueia empregado de outra empresa e datas invertidas',()=>{
  const {a,b,employee,service}=setup()
  expect(()=>service.save({empresa_id:b.id,funcionario_id:employee.id,tipo:'afastamento',titulo:'Atestado',inicio:'2027-01-02'})).toThrow(/outra empresa/)
  expect(()=>service.save({empresa_id:a.id,funcionario_id:employee.id,tipo:'ferias',titulo:'Datas ruins',inicio:'2027-05-03',fim:'2027-05-01'})).toThrow(/anterior/)
 })
 it('impede férias aprovadas sobrepostas para mesmo funcionário',()=>{
  const {a,employee,service}=setup()
  service.save({empresa_id:a.id,funcionario_id:employee.id,tipo:'ferias',titulo:'Primeiras férias',inicio:'2027-05-01',fim:'2027-05-20',estado:'aprovado'})
  expect(()=>service.save({empresa_id:a.id,funcionario_id:employee.id,tipo:'ferias',titulo:'Segundas férias',inicio:'2027-05-19',fim:'2027-06-01',estado:'aprovado'})).toThrow(/sobreposi/)
 })
 it('mantém trilha de auditoria e exclusão lógica sem apagar dados',()=>{
  const {a,employee,service,db}=setup()
  const record=service.save({empresa_id:a.id,funcionario_id:employee.id,tipo:'pdi',titulo:'Plano de desenvolvimento'})
  expect(service.remove({id:record.id,empresa_id:a.id,revisao:record.revisao})).toBe(true)
  expect(service.list({empresa_id:a.id,tipo:'pdi'})).toEqual([])
  expect(db.db.prepare('SELECT deleted_at FROM rh_registros WHERE id=?').get(record.id).deleted_at).toBeTruthy()
 })
 it('não modifica funcionário ao registrar intenção de desligamento',()=>{
  const {a,employee,service,db}=setup()
  service.save({empresa_id:a.id,funcionario_id:employee.id,tipo:'desligamento',titulo:'Checklist desligamento',estado:'pendente'})
  expect(db.get('funcionarios',employee.id).status).toBe('ativo')
 })
 it('resume indicadores por empresa sem incluir outra organização',()=>{
  const {a,b,employee,service}=setup()
  service.save({empresa_id:a.id,funcionario_id:employee.id,tipo:'treinamento',titulo:'Segurança',estado:'concluido'})
  service.save({empresa_id:b.id,tipo:'vaga',titulo:'Desenvolvedor',estado:'pendente'})
  const stats=service.indicators({empresa_id:a.id})
  expect(stats.funcionarios).toBe(1)
  expect(stats.registros.treinamento).toBe(1)
  expect(stats.registros.vaga||0).toBe(0)
 })
})
