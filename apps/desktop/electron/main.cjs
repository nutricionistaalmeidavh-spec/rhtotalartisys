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
const {HrWorkspaceService}=require('./services/hr-workspace-service.cjs')
const {HrBackupService}=require('./services/rh-backup-service.cjs')
const {LocalAccessService,createHrLanServer}=require('./services/rh-lan-service.cjs')

if(process.env.RH_TOTAL_DATA_DIR){
  require('node:fs').mkdirSync(process.env.RH_TOTAL_DATA_DIR,{recursive:true})
  app.setPath('userData',process.env.RH_TOTAL_DATA_DIR)
  app.setPath('sessionData',process.env.RH_TOTAL_DATA_DIR)
}

let db,mainWindow,lanServer

function registerServices(){
  const dataDir=process.env.RH_TOTAL_DATA_DIR||app.getPath('userData')
  db=new DatabaseService({dataDir,migrationsDir:path.join(__dirname,'..','database','migrations')})
  db.open()
  const fileService=new FileService({documentsDir:path.join(dataDir,'documentos'),db})
  const payroll=new PayrollService({db})
  const time=new TimeService({db,fileService})
  const documents=new DocumentService({db,fileService,dialog})
  const catalog=new CatalogService({db})
  const rh=new HrWorkspaceService({db})
  const backups=new HrBackupService({db,dataDir})
  const access=new LocalAccessService({db})
  const payrollExports=new PayrollExportService({payroll,dialog})
  const importFiles=new PayrollImportFileService()
  const handlers=new Map()
  const register=(name,fn)=>handlers.set(name,fn)
  const entities=new Set(['empresas','obras','funcionarios','cargos','beneficios','epis','funcionario_epis','documentos','arquivos','contas','categorias_financeiras'])

  register('entity:list',({table,filters})=>{if(!entities.has(table))throw Error('Entidade indisponível');return db.list(table,filters)})
  register('entity:get',({table,id})=>{if(!entities.has(table))throw Error('Entidade indisponível');return db.get(table,id)})
  register('entity:save',({table,data})=>{if(!entities.has(table))throw Error('Entidade indisponível');if(table==='contas'&&(data.origem_tipo==='folha_pagamento'||(data.id&&db.get(table,data.id)?.origem_tipo==='folha_pagamento')))throw Error('Edite esta conta pela folha de pagamento.');return db.save(table,data)})
  register('entity:remove',({table,id})=>{if(!entities.has(table))throw Error('Entidade indisponível');if(table==='contas'&&db.get(table,id)?.origem_tipo==='folha_pagamento')throw Error('Edite esta conta pela folha de pagamento.');return db.remove(table,id)})

  register('dre:get',data=>db.dre(data))
  register('accounts:payment',({id,payment})=>{if(db.get('contas',id)?.origem_tipo==='folha_pagamento')throw Error('Registre este pagamento pela folha.');return db.accountPayment(id,payment)})
  register('app:bootstrap',()=>({dataPath:dataDir,databasePath:db.dbPath,firstRun:db.list('empresas').length===0,version:app.getVersion()}))
  register('catalog:list',()=>catalog.list())
  register('catalog:save-cargo',data=>catalog.saveCargo(data))
  register('catalog:save-benefit',data=>catalog.saveBenefit(data))
  register('catalog:save-link',data=>catalog.saveLink(data))
  register('catalog:save-compensation-policy',data=>catalog.saveCompensationPolicy(data))
  register('catalog:deactivate',({type,id})=>catalog.deactivate(type,id))

  register('rh:list',data=>rh.list(data))
  register('rh:get',data=>rh.get(data))
  register('rh:save',data=>rh.save(data))
  register('rh:remove',data=>rh.remove(data))
  register('rh:indicators',data=>rh.indicators(data))
  register('rh:close-payroll',data=>rh.closePayroll(data))
  register('rh:reopen-payroll',data=>rh.reopenPayroll(data))
  register('rh:complete-termination',data=>rh.completeTermination(data))

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

  register('backup:create',()=>backups.create())
  register('backup:list',()=>backups.list())
  register('backup:verify',({path:filePath})=>backups.verify(filePath))
  register('backup:restore',async data=>{
    if(lanServer?.running)throw Error('Pare o servidor LAN antes de restaurar o banco.')
    return backups.restore(data)
  })
  register('access:accounts',()=>access.listAccounts())
  register('access:create',data=>access.createAccount(data,{trustedDesktop:true}))
  register('lan-rh:status',()=>({running:Boolean(lanServer?.running)}))
  register('lan-rh:start',async data=>{
    if(lanServer?.running)throw Error('Servidor RH já está em execução.')
    if(!access.listAccounts().length)throw Error('Crie uma conta local de administrador antes de ativar o servidor.')
    const host=String(data.host||'127.0.0.1')
    const port=data.port===undefined?8765:Number(data.port)
    lanServer=createHrLanServer({db,access,host,port,tlsKey:data.tlsKey,tlsCert:data.tlsCert})
    try{return await lanServer.start()}catch(error){lanServer=null;throw error}
  })
  register('lan-rh:stop',async()=>{await lanServer?.stop();lanServer=null;return{running:false}})

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
  try{registerServices();if(process.env.RH_TOTAL_SMOKE==='1'){console.log('RH_TOTAL_SMOKE_OK');app.quit();return}await createWindow()}
  catch(error){console.error('RH Total falhou na inicialização:',error);dialog.showErrorBox('RH Total ArtiSys',String(error.message||error));app.quit()}
})
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()})
app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)void createWindow()})
app.on('before-quit',()=>{void lanServer?.stop();db?.close()})
