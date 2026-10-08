import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createRequire} from 'node:module'
import {afterEach,describe,it,expect} from 'vitest'
const require=createRequire(import.meta.url)
const {DatabaseService}=require('./database.cjs')
const {HrBackupService}=require('./rh-backup-service.cjs')
const fixtures:any[]=[]
afterEach(()=>{for(const f of fixtures.splice(0)){f.db.close();fs.rmSync(f.dir,{recursive:true,force:true})}})
describe('P0 backup e restauracao confiavel',()=>{
 it('cria snapshot SQLite, verifica integridade e recupera dados canonicos',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rh-total-backup-'))
  const db=new DatabaseService({dataDir:dir,migrationsDir:path.resolve(import.meta.dirname,'../../database/migrations')})
  db.open();fixtures.push({dir,db})
  const backups=new HrBackupService({db,dataDir:dir})
  const company=db.save('empresas',{razao_social:'Snapshot Empresa',status:'ativa'})
  const snapshot=await backups.create()
  expect(snapshot.valid).toBe(true)
  expect(backups.list().some((item:any)=>item.path===snapshot.path)).toBe(true)
  db.remove('empresas',company.id)
  expect(db.list('empresas')).toEqual([])
  const result=await backups.restore({path:snapshot.path,confirm:true})
  expect(result.restored).toBe(true)
  expect(db.list('empresas').map((item:any)=>item.razao_social)).toEqual(['Snapshot Empresa'])
 })
 it('impede restaurar arquivo fora da pasta de backups',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rh-total-backup-'))
  const db=new DatabaseService({dataDir:dir,migrationsDir:path.resolve(import.meta.dirname,'../../database/migrations')})
  db.open();fixtures.push({dir,db})
  const backups=new HrBackupService({db,dataDir:dir})
  await expect(backups.restore({path:db.dbPath,confirm:true})).rejects.toThrow(/pasta de backups/)
 })
})
