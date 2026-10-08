const fs=require('node:fs')
const path=require('node:path')
const Database=require('better-sqlite3')
class HrBackupService{
 constructor({db,dataDir}){this.db=db;this.base=path.join(dataDir,'backups');fs.mkdirSync(this.base,{recursive:true})}
 checkedPath(file){
  const root=fs.realpathSync(this.base)
  const source=fs.realpathSync(String(file||''))
  if(!source.startsWith(root+path.sep)||!source.endsWith('.sqlite'))throw Error('Selecione um SQLite da pasta de backups.')
  return source
 }
 list(){return fs.readdirSync(this.base).filter(n=>/^rh-total-[0-9-]+\.sqlite$/.test(n)).map(name=>{const file=path.join(this.base,name),stat=fs.statSync(file);return{name,path:file,size:stat.size,created_at:stat.mtime.toISOString()}}).sort((a,b)=>b.created_at.localeCompare(a.created_at))}
 verify(file){
  const source=this.checkedPath(file)
  const sample=new Database(source,{readonly:true,fileMustExist:true})
  try{
   const check=sample.pragma('quick_check',{simple:true})
   const tables=sample.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('funcionarios','empresas','migrations')").all()
   if(check!=='ok'||tables.length!==3)throw Error('Backup inválido ou incompleto.')
   return {valid:true,path:source,schema_version:sample.pragma('user_version',{simple:true}),size:fs.statSync(source).size}
  }finally{sample.close()}
 }
 async create(){
  fs.mkdirSync(this.base,{recursive:true})
  const target=path.join(this.base,'rh-total-'+Date.now()+'-'+Math.random().toString(16).slice(2,8)+'.sqlite')
  await this.db.db.backup(target)
  try{return this.verify(target)}catch(e){fs.rmSync(target,{force:true});throw e}
 }
 async restore({path:source,confirm}={}){
  if(confirm!==true)throw Error('Confirme a restauração antes de substituir o banco.')
  const candidate=this.verify(source)
  const rollback=await this.create()
  const tmp=this.db.dbPath+'.restoring'
  const old=this.db.dbPath+'.before-restore'
  this.db.close()
  try{
   fs.copyFileSync(candidate.path,tmp)
   fs.renameSync(this.db.dbPath,old)
   fs.renameSync(tmp,this.db.dbPath)
   this.db.open()
   const integrity=this.db.db.pragma('quick_check',{simple:true})
   if(integrity!=='ok')throw Error('Banco restaurado não passou na verificação.')
   fs.rmSync(old,{force:true})
   return{restored:true,path:candidate.path,previous_snapshot:rollback.path}
  }catch(error){
   this.db.close()
   if(fs.existsSync(old)){fs.rmSync(this.db.dbPath,{force:true});fs.renameSync(old,this.db.dbPath)}
   else fs.copyFileSync(rollback.path,this.db.dbPath)
   this.db.open()
   throw error
  }finally{fs.rmSync(tmp,{force:true});fs.rmSync(old,{force:true})}
 }
}
module.exports={HrBackupService}
