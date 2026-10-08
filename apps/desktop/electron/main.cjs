const path=require('node:path')
const {app,BrowserWindow,ipcMain,dialog,shell}=require('electron')
const {DatabaseService}=require('./services/database.cjs')
const {FileService}=require('./services/file-service.cjs')
const {CatalogService}=require('./services/catalog-service.cjs')
const {PayrollService}=require('./services/payroll-service.cjs')
const {PayrollExportService}=require('./services/payroll-export-service.cjs')
const {PayrollImportFileService}=require('./services/payroll-import-file-service.cjs')
const {TimeService}=require('./services/time-service.cjs')
const {DocumentService}=require('./services/document-service.cjs')

let db,mainWindow

function registerServices(){
  const dataDir=process.env.RH_TOTAL_DATA_DIR||app.getPath('userData')
  db=new DatabaseService({dataDir,migrationsDir:path.join(__dirname,'..','database','migrations')})
  db.open()
  const fileService=new FileService({documentsDir:path.join(dataDir,'documentos'),db})
  const payroll=new PayrollService({db})
  const time=new TimeService({db,fileService})
  const documents=new DocumentService({db,fileService,dialog})
  const catalog=new CatalogService({db})
  const payrollExports=new PayrollExportService({payroll,dialog})
  const importFiles=new PayrollImportFileService()
  const handlers=new Map()
  const register=(name,fn)=>handlers.set(name,fn)
  const entities=new Set(['empresas','obras','funcionarios','cargos','beneficios','epis','funcionario_epis','documentos'])

  register('entity:list',({table,filters})=>{if(!entities.has(table))throw Error('Entidade indisponível');return db.list(table,filters)})
  register('entity:get',({table,id})=>{if(!entities.has(table))throw Error('Entidade indisponível');return db.get(table,id)})
  register('entity:save',({table,data})=>{if(!entities.has(table))throw Error('Entidade indisponível');return db.save(table,data)})
  register('entity:remove',({table,id})=>{if(!entities.has(table))throw Error('Entidade indisponível');return db.remove(table,id)})

  register('app:bootstrap',()=>({dataPath:dataDir,databasePath:db.dbPath,firstRun:db.list('empresas').length===0,version:app.getVersion()}))
  register('catalog:list',()=>catalog.list())
  register('catalog:save-cargo',data=>catalog.saveCargo(data))
  register('catalog:save-benefit',data=>catalog.saveBenefit(data))
  register('catalog:save-link',data=>catalog.saveLink(data))
  register('catalog:save-compensation-policy',data=>catalog.saveCompensationPolicy(data))
  register('catalog:deactivate',({type,id})=>catalog.deactivate(type,id))

  register('payroll:overview',data=>payroll.overview(data))
  register('payroll:employee',data=>payroll.getEmployee(data))
  register('payroll:pending',({competencia})=>payroll.pending(competencia))
  register('payroll:save-variable',data=>payroll.saveVariable(data))
  register('payroll:remove-variable',({id})=>payroll.removeVariable(id))
  register('payroll:export-overview',data=>payrollExports.export(data))
  register('payroll:confirm',async data=>{
    const payment=payroll.confirm(data)
    let documentsResult=null,documentError=null
    if(Number(data.quinzena)===1){
      try{documentsResult=await time.generateDocuments({funcionario_id:data.funcionario_id,competencia:data.competencia,paymentDate:data.data})}
      catch(error){documentError=error instanceof Error?error.message:String(error)}
    }
    return {...payment,documents:documentsResult,documentError}
  })

  register('payroll-import:choose',()=>importFiles.choose())
  register('payroll-import:file-preview',({token,options})=>importFiles.preview(token,options))
  register('payroll-import:template',()=>importFiles.saveTemplate())
  register('payroll-import:release',({token})=>importFiles.release(token))
  register('payroll-import:preview',data=>payroll.importPreview(data))
  register('payroll-import:commit',data=>payroll.importCommit(data))
  register('payroll-import:history',({limit})=>payroll.importHistory(limit))
  register('payroll-import:undo',({id})=>payroll.importUndo(id))

  register('time:get',data=>time.get(data))
  register('time:auto-fill',data=>time.autoFill(data))
  register('time:save',data=>time.save(data))
  register('time:generate',data=>time.generateDocuments(data))
  register('time:generate-all',data=>time.generateForAll(data))

  register('documents:generate',data=>documents.generate(data))
  register('documents:templates',()=>documents.listTemplates())
  register('documents:save-template',data=>documents.saveTemplate(data))
  register('documents:choose-local-template',()=>documents.chooseLocalTemplate())
  register('documents:set-default-template',data=>documents.setDefaultTemplate(data))
  register('files:open-folder',()=>shell.openPath(fileService.documentsDir))
  register('files:open',({path:filePath})=>fileService.open(filePath))
  register('files:reveal',({path:filePath})=>fileService.reveal(filePath))

  register('backup:create',async()=>{
    const fs=require('node:fs')
    const dir=path.join(dataDir,'backups')
    fs.mkdirSync(dir,{recursive:true})
    const dest=path.join(dir,'rh-total-'+Date.now()+'.sqlite')
    await db.db.backup(dest)
    return {path:dest}
  })

  for(const [name,fn] of handlers)ipcMain.handle(name,async(_event,payload)=>{
    try{return {ok:true,data:await fn(payload||{})}}
    catch(error){return {ok:false,error:{message:error instanceof Error?error.message:String(error)}}}
  })
}

async function createWindow(){
  mainWindow=new BrowserWindow({
    width:1440,height:900,minWidth:800,minHeight:540,backgroundColor:'#f5f6f9',show:false,
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}
  })
  mainWindow.once('ready-to-show',()=>mainWindow.show())
  if(process.env.VITE_DEV_SERVER_URL)await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  else await mainWindow.loadFile(path.join(__dirname,'..','dist','index.html'))
}

app.whenReady().then(async()=>{
  try{registerServices();await createWindow()}
  catch(error){console.error('RH Total falhou na inicialização:',error);dialog.showErrorBox('RH Total ArtiSys',String(error.message||error));app.quit()}
})
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()})
app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)void createWindow()})
app.on('before-quit',()=>db?.close())
