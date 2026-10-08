import {test as base,expect,_electron as electron,ElectronApplication,Page} from '@playwright/test'
import {mkdtemp,rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

// Pattern reused from Obra na Mão QA: real Electron + isolated data + traces + telemetry.
const test=base.extend<{app:ElectronApplication;page:Page;dataDir:string;runtimeErrors:string[]}>({
 dataDir:async({},use)=>{const dir=await mkdtemp(path.join(os.tmpdir(),'rh-total-qa-'));try{await use(dir)}finally{await rm(dir,{recursive:true,force:true})}},
 app:async({dataDir},use)=>{const app=await electron.launch({args:['.', '--no-sandbox',...(process.env.RH_QA_HEADLESS?['--ozone-platform=headless','--disable-gpu']:[])],cwd:process.cwd(),env:{...process.env,RH_TOTAL_DATA_DIR:dataDir}});await app.context().tracing.start({screenshots:true,snapshots:true,sources:true});try{await use(app)}finally{await app.context().tracing.stop({path:test.info().outputPath('trace.zip')});await app.close()}},
 runtimeErrors:async({},use)=>{const errors:string[]=[];await use(errors);expect(errors,'Renderer must not throw').toEqual([])},
 page:async({app,runtimeErrors},use)=>{const page=await app.firstWindow();page.on('pageerror',e=>runtimeErrors.push(e.message));await page.getByRole('heading',{name:'RH',exact:true}).waitFor();try{await use(page)}finally{await page.screenshot({path:test.info().outputPath('final-screen.png'),fullPage:true});await test.info().attach('runtime-errors',{body:JSON.stringify(runtimeErrors),contentType:'application/json'})}},
})
async function go(page:Page,route:string){await page.evaluate(route=>{location.hash=route},route)}
async function shot(page:Page,name:string){const file=test.info().outputPath(name+'.png');await page.screenshot({path:file,fullPage:true});await test.info().attach(name,{path:file,contentType:'image/png'})}
async function seed(page:Page){return page.evaluate(async()=>{
 const company=await window.fluxoDre.empresas.save({razao_social:'Empresa QA Fictícia',nome_fantasia:'Empresa QA',cnpj:'11222333000181'})
 const cargo=await window.fluxoDre.catalogo.saveCargo({nome:'Assistente QA',salario_base_centavos:250000,ativo:1})
 const employee=await window.fluxoDre.funcionarios.save({nome:'Maria Teste',cpf:'52998224725',empresa_id:company.id,cargo_id:cargo.id,status:'ativo',admissao:'2026-10-01',jornada_inicio:'08:00',intervalo_inicio:'12:00',intervalo_fim:'13:00',jornada_fim:'17:00'})
 return {company,cargo,employee}
})}

test('primeiro uso: empresa, cadastro com rascunho e salvamento sem emissão',async({page})=>{
 await page.getByRole('link',{name:'Empresas',exact:true}).click();await page.getByRole('button',{name:'Nova empresa'}).click()
 await page.getByLabel('Razão social').fill('Empresa de Teste');await page.getByRole('button',{name:'Salvar empresa'}).click()
 await expect(page.getByText('Empresa salva.',{exact:true})).toBeVisible();await shot(page,'01-empresa')
 await page.getByRole('link',{name:'Admissões',exact:true}).click();await page.getByLabel('Nome completo').fill('Joana Teste');await page.getByLabel(/^CPF/).fill('52998224725')
 await page.getByRole('button',{name:'Continuar',exact:true}).click();await page.getByLabel('RG',{exact:true}).fill('123456')
 await page.getByRole('link',{name:'Empresas',exact:true}).click();await page.getByRole('link',{name:'Admissões',exact:true}).click()
 await expect(page.getByLabel('RG',{exact:true})).toHaveValue('123456');await shot(page,'02-rascunho-retomado')
 await page.reload();await expect(page.getByLabel('RG',{exact:true})).toHaveValue('123456')
 await page.getByRole('button',{name:'Salvar cadastro',exact:true}).click();await expect(page.getByText('Cadastro salvo. A documentação pode ser gerada depois.')).toBeVisible()
 const state=await page.evaluate(async()=>({employees:await window.fluxoDre.funcionarios.list(),docs:await window.fluxoDre.documentos.list()}));expect(state.employees).toHaveLength(1);expect(state.employees[0].nome).toBe('Joana Teste');expect(state.docs).toHaveLength(0)
 await shot(page,'03-cadastro-salvo')
})

test('atalhos abrem etapas corretas e conferência abre documentos',async({page})=>{
 await page.getByRole('link',{name:'2. Contrato',exact:true}).click();await expect(page.getByRole('heading',{name:'Vínculo, jornada e remuneração'})).toBeVisible()
 await page.getByRole('link',{name:'Visão geral',exact:true}).click();await page.getByRole('link',{name:'5. Conferência'}).click();await expect(page.getByRole('heading',{name:'Documentos dos funcionários'})).toBeVisible();await shot(page,'04-documentos')
})

test('folha: origem, pagamento com data/forma e confirmação canônica sem duplicação',async({page})=>{
 const {employee}=await seed(page);await go(page,'/rh/folha');await page.getByLabel('Competência').fill('2026-10')
 await page.getByRole('button',{name:'Maria Teste',exact:false}).click();await expect(page.getByText('Lançamentos já salvos · pagamento pendente')).toBeVisible();await shot(page,'05-folha-individual')
 await page.getByRole('button',{name:'Confirmar pagamento',exact:true}).first().click();await page.getByLabel('Data do pagamento').fill('2026-10-05');await page.getByLabel('Forma de pagamento',{exact:true}).selectOption('Dinheiro');await shot(page,'06-revisao-pagamento')
 await page.getByRole('button',{name:'Registrar pagamento',exact:true}).click();await expect(page.getByRole('dialog',{name:'Registrar pagamento realizado'})).toBeHidden();await expect(page.getByText('Pago em 2026-10-05')).toBeVisible()
 const stored=await page.evaluate(async(id)=>({payroll:await window.fluxoDre.folha.employee({funcionario_id:id,competencia:'2026-10'}),accounts:await window.fluxoDre.contas.list({competencia:'2026-10'}),dre:await window.fluxoDre.relatorios.dre({competencia:'2026-10'})}),employee.id)
 expect(stored.payroll.payments).toHaveLength(1);expect(stored.payroll.payments[0]).toMatchObject({data:'2026-10-05',forma_pagamento:'Dinheiro',valor_centavos:250000})
 expect(stored.accounts.find((x:any)=>x.origem_tipo==='folha_pagamento')?.pago_centavos).toBe(250000);expect(stored.dre.reduce((sum:number,x:any)=>sum+x.valor_realizado,0)).toBe(250000)
 const duplicate=await page.evaluate(async(id)=>{try{await window.fluxoDre.folha.confirm({funcionario_id:id,competencia:'2026-10',quinzena:1,data:'2026-10-05',forma_pagamento:'Dinheiro'});return ''}catch(e:any){return e.message}},employee.id);expect(duplicate).toContain('já foi confirmada')
 await page.reload();await page.getByRole('button',{name:'Maria Teste',exact:false}).click();await expect(page.getByText('Pago em 2026-10-05')).toBeVisible();await shot(page,'07-pagamento-persistido')
})

test('ponto: mês na própria tela, aviso de simulação e persistência das marcações',async({page})=>{
 const {employee}=await seed(page);await go(page,'/rh/ponto');await page.getByLabel('Competência').fill('2026-09');await page.getByLabel('Funcionário',{exact:true}).selectOption(String(employee.id))
 await expect(page.getByText('O preenchimento automático cria horários simulados. Confira e ajuste conforme a jornada real.')).toBeVisible()
 let warning='';page.once('dialog',async d=>{warning=d.message();await d.accept()});await page.getByRole('button',{name:'Preencher mês',exact:true}).click();await expect(page.locator('.time-table tbody tr')).toHaveCount(30);expect(warning).toContain('horários simulados')
 await page.getByRole('button',{name:'Salvar',exact:true}).click();await expect(page.getByText('Ficha de ponto salva.')).toBeVisible();await page.reload();await page.getByLabel('Funcionário',{exact:true}).selectOption(String(employee.id));await expect(page.locator('.time-table tbody tr')).toHaveCount(30);await shot(page,'08-ponto')
})

test('contas e DRE: novo lançamento aparece na folha e origem permanece protegida',async({page})=>{
 const {company}=await seed(page);await go(page,'/rh/folha');await page.getByLabel('Competência').fill('2026-10');await page.getByRole('button',{name:'Encargos da empresa',exact:true}).click();await page.getByRole('link',{name:'Abrir contas a pagar',exact:true}).click();await expect(page.getByRole('heading',{name:'Contas da empresa'})).toBeVisible()
 await page.getByRole('button',{name:'Nova conta'}).click();const dialog=page.getByRole('dialog',{name:'Nova conta'});await dialog.getByLabel('Empresa',{exact:false}).selectOption(String(company.id));await dialog.getByLabel('Descrição').fill('Internet QA');await dialog.getByLabel('Valor',{exact:false}).fill('150,00');await dialog.getByRole('button',{name:'Salvar',exact:true}).click();await expect(page.getByText('Internet QA', {exact:true})).toBeVisible();await shot(page,'09-contas')
 await page.getByRole('link',{name:'Consultar DRE'}).click();await expect(page.getByRole('heading',{name:'DRE por competência'})).toBeVisible();await shot(page,'10-dre')
 const rows=await page.evaluate(()=>window.fluxoDre.relatorios.dre({competencia:'2026-10'}));expect(rows.reduce((sum:number,x:any)=>sum+x.valor,0)).toBe(265000)
 await go(page,'/rh/folha');await expect(page.getByText('Internet QA',{exact:true})).toBeVisible()
})

test('modelos: edição visual salva e reabre sem exigir HTML',async({page})=>{
 await go(page,'/rh/modelos');await page.getByRole('button',{name:'Novo modelo',exact:false}).click();await page.getByLabel('Nome do modelo').fill('Modelo visual QA');await page.getByRole('textbox',{name:'Texto do documento'}).fill('Orientações para {{nome_funcionario}}');await page.getByRole('button',{name:'Salvar modelo'}).click()
 const templates=await page.evaluate(()=>window.fluxoDre.documentos.templates());expect(templates.templates.find((x:any)=>x.nome==='Modelo visual QA')?.conteudo_html).toContain('Orientações para {{nome_funcionario}}');await shot(page,'11-modelos')
})

test('falha real de IPC apresenta erro e permite tentar novamente',async({app,page})=>{
 await app.evaluate(({ipcMain})=>{(globalThis as any).__rhQaCatalog=(ipcMain as any)._invokeHandlers.get('catalog:list');ipcMain.removeHandler('catalog:list');ipcMain.handle('catalog:list',()=>({ok:false,error:{message:'Falha de leitura QA'}}))})
 await go(page,'/rh/remuneracao');await expect(page.getByText('Falha de leitura QA',{exact:true})).toBeVisible();await expect(page.getByText('Nenhum registro encontrado')).toBeHidden();await shot(page,'12-erro-recuperavel')
 await app.evaluate(({ipcMain})=>{ipcMain.removeHandler('catalog:list');ipcMain.handle('catalog:list',(globalThis as any).__rhQaCatalog)})
 await page.getByRole('button',{name:'Tentar novamente'}).click();await expect(page.getByRole('heading',{name:'Cargos e remuneração'})).toBeVisible()
})

test('cadastro: EPIs exigem seleção explícita e botões de funcionário têm nomes acessíveis',async({page})=>{
 const {employee}=await seed(page);await page.evaluate(()=>window.fluxoDre.epis.save({nome:'Capacete QA',ca:'12345'}));await go(page,'/rh/admissoes?step=3');await expect(page.getByLabel('Capacete QA', {exact:false})).not.toBeChecked();await shot(page,'13-epi-sem-entrega-presumida')
 await go(page,'/rh/funcionarios');await expect(page.getByRole('button',{name:'Editar funcionário Maria Teste'})).toBeVisible();await expect(page.getByRole('button',{name:'Inativar funcionário Maria Teste'})).toBeVisible()
 await page.getByPlaceholder('Buscar por nome ou CPF...').fill('inexistente');await expect(page.getByText('Maria Teste',{exact:true})).toBeHidden()
})

test('pagamento parcial: registro permanece salvo quando os documentos falham',async({page})=>{
 const {employee}=await seed(page)
 await page.evaluate(employee=>window.fluxoDre.funcionarios.save({...employee,cpf:''}),employee)
 await go(page,'/rh/folha');await page.getByLabel('Competência').fill('2026-10');await page.getByRole('button',{name:'Maria Teste',exact:false}).click();await page.getByRole('button',{name:'Confirmar pagamento',exact:true}).first().click();await page.getByRole('button',{name:'Registrar pagamento',exact:true}).click()
 await expect(page.getByRole('link',{name:'Tentar gerar documentos no Ponto'})).toBeVisible()
 const result=await page.evaluate(id=>window.fluxoDre.folha.employee({funcionario_id:id,competencia:'2026-10'}),employee.id);expect(result.payments).toHaveLength(1)
 await shot(page,'14-pagamento-salvo-documentos-pendentes')
 await page.getByRole('link',{name:'Tentar gerar documentos no Ponto'}).click();await expect(page.getByRole('heading',{name:'Folhas de ponto',exact:true})).toBeVisible();await expect(page.getByLabel('Funcionário',{exact:true})).toHaveValue(String(employee.id))
})

test('telas em janela compacta mantêm navegação e captura de todos os módulos',async({app,page})=>{
 await seed(page)
 await app.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows()[0];win.setSize(800,720)})
 for(const [name,route,title] of [['visao-geral','/rh','RH'],['funcionarios','/rh/funcionarios','Funcionários'],['admissao','/rh/admissoes','Registro funcionário'],['remuneracao','/rh/remuneracao','Cargos e remuneração'],['folha','/rh/folha','Controle de pagamento'],['ponto','/rh/ponto','Folhas de ponto'],['documentos','/documentos','Documentos dos funcionários'],['modelos','/rh/modelos','RH · Modelos e regras admissionais'],['empresas','/empresas','Empresas']]){
  await go(page,route);await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();await expect(page.getByRole('navigation',{name:'Navegação do RH'})).toBeVisible();await shot(page,'compacta-'+name)
 }
})
