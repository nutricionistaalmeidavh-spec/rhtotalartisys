import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createRequire} from 'node:module'
import {afterEach,describe,it,expect} from 'vitest'
const require=createRequire(import.meta.url)
const {DatabaseService}=require('./database.cjs')
const {LocalAccessService,createHrLanServer}=require('./rh-lan-service.cjs')
const fixtures:any[]=[]
function setup(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rh-lan-auth-'))
 const db=new DatabaseService({dataDir:dir,migrationsDir:path.resolve(import.meta.dirname,'../../database/migrations')})
 db.open();fixtures.push({dir,db})
 const company=db.save('empresas',{razao_social:'Empregador A',status:'ativa'})
 const other=db.save('empresas',{razao_social:'Empregador B',status:'ativa'})
 return {db,company,other,access:new LocalAccessService({db})}
}
afterEach(async()=>{for(const f of fixtures.splice(0)){await f.server?.stop();f.db.close();fs.rmSync(f.dir,{recursive:true,force:true})}})
describe('P3 servidor LAN independente',()=>{
 it('não permite conta inicial sem ação administrativa local e exige senha forte',()=>{
  const {access}=setup()
  expect(()=>access.createAccount({usuario:'admin',nome:'Admin',senha:'123',perfil:'admin'})).toThrow()
  expect(()=>access.createAccount({usuario:'admin',nome:'Admin',senha:'123456789012',perfil:'admin'})).toThrow(/administrativa local/)
  expect(access.createAccount({usuario:'admin',nome:'Admin',senha:'senha-segura-de-teste-123',perfil:'admin'},{trustedDesktop:true}).perfil).toBe('admin')
 })
 it('autentica com scrypt, escopa por empresa e revoga sessão',()=>{
  const {access,company,other}=setup()
  access.createAccount({usuario:'root',nome:'Admin',senha:'senha-segura-de-teste-123',perfil:'admin'},{trustedDesktop:true})
  const local=access.createAccount({usuario:'rh-a',nome:'RH A',senha:'senha-segura-de-teste-456',perfil:'rh',empresa_id:company.id},{trustedDesktop:true})
  expect(local.senha_hash).toBeUndefined()
  expect(()=>access.login({usuario:'rh-a',senha:'incorreta'})).toThrow(/inválid/)
  const session=access.login({usuario:'rh-a',senha:'senha-segura-de-teste-456'})
  expect(access.requireSession(session.token,{empresa_id:company.id}).usuario).toBe('rh-a')
  expect(()=>access.requireSession(session.token,{empresa_id:other.id})).toThrow(/outra empresa/)
  access.logout(session.token)
  expect(()=>access.requireSession(session.token)).toThrow(/Sessão/)
 })
 it('só serve sem TLS em loopback e disponibiliza health',async()=>{
  const {db,access}=setup()
  expect(()=>createHrLanServer({db,access,host:'0.0.0.0',port:0})).toThrow(/TLS/)
  const server=createHrLanServer({db,access,host:'127.0.0.1',port:0});fixtures[fixtures.length-1].server=server
  const status=await server.start()
  const response=await fetch(status.url+'/v1/health')
  expect(response.status).toBe(200)
  expect((await response.json()).product).toBe('RH Total ArtiSys')
  expect((await fetch(status.url+'/v1/records')).status).toBe(401)
 })
})
