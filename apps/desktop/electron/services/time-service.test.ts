import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it } from 'vitest'

const require=createRequire(import.meta.url)
const {DatabaseService}=require('./database.cjs')
const {TimeService,buildPrintBatchHtml,filterBenefitsByPolicy}=require('./time-service.cjs')
const {HrWorkspaceService}=require('./hr-workspace-service.cjs')
const {parseEmployeeIdentity}=require('./import-service.cjs')
const created:Array<{dir:string,db:any}>=[]

function setup(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'obra-comercial-ponto-'))
  const db=new DatabaseService({dataDir:dir,migrationsDir:path.resolve(import.meta.dirname,'../../database/migrations')})
  db.open();created.push({dir,db})
  const company=db.save('empresas',{razao_social:'Empresa Teste LTDA',cnpj:'50.733.669/0001-60',status:'ativa'})
  const cargo=db.save('cargos',{nome:'Cargo Teste Mensal',salario_base_centavos:250000,ativo:1})
  const employee=db.save('funcionarios',{empresa_id:company.id,cargo_id:cargo.id,nome:'Pessoa Teste Completa',cpf:'123.456.789-01',status:'ativo',jornada_inicio:'07:00',intervalo_inicio:'11:00',intervalo_fim:'12:00',jornada_fim:'17:00'})
  const base=path.join(dir,'docs','Pessoa Teste Completa - 12345678901')
  const fileService={employeeFolders:()=>({base})}
  const time=new TimeService({db,fileService})
  return {dir,db,company,cargo,employee,base,time}
}

afterEach(()=>{for(const item of created.splice(0)){item.db.close();fs.rmSync(item.dir,{recursive:true,force:true})}})

describe('folha de ponto mensal comercial',()=>{
  it('preenche todos os dias com variações estáveis e preserva fins de semana',()=>{
    const {employee,time}=setup()
    const first=time.autoFill({funcionario_id:employee.id,competencia:'2026-08'})
    const second=time.autoFill({funcionario_id:employee.id,competencia:'2026-08'})
    expect(first.marks).toHaveLength(31)
    expect(second.marks.map((x:any)=>x.entrada)).toEqual(first.marks.map((x:any)=>x.entrada))
    expect(first.marks.filter((x:any)=>/sabado|domingo/.test(x.tipo)).every((x:any)=>!x.entrada&&!x.saida)).toBe(true)
  })

  it('bloqueia documentos sem marcações revisadas e não inventa jornada',()=>{
    const {employee,time}=setup()
    expect(()=>time.validatedData(employee.id,'2026-08')).toThrow(/Registre e confira/)
    const simulated=time.autoFill({funcionario_id:employee.id,competencia:'2026-08'})
    expect(()=>time.validatedData(employee.id,'2026-08')).toThrow(/simuladas precisam de revisão/)
    expect(()=>time.save({funcionario_id:employee.id,competencia:'2026-08',marks:simulated.marks})).toThrow(/Confirme/)
    time.save({funcionario_id:employee.id,competencia:'2026-08',marks:simulated.marks,confirmado_real:true})
    expect(time.validatedData(employee.id,'2026-08').data.marks).toHaveLength(31)
  })

  it('respeita férias aprovadas no pré-preenchimento, sem criar batidas nesses dias',()=>{
    const {db,employee,time,company}=setup()
    const hr=new HrWorkspaceService({db})
    hr.save({empresa_id:company.id,funcionario_id:employee.id,tipo:'ferias',titulo:'Férias agosto',inicio:'2026-08-10',fim:'2026-08-14',estado:'aprovado'})
    const result=time.autoFill({funcionario_id:employee.id,competencia:'2026-08'})
    const onLeave=result.marks.find((r:any)=>r.data==='2026-08-10')
    expect(onLeave.tipo).toBe('ferias')
    expect(onLeave.entrada).toBeNull()
  })

  it('identifica cargo no nome da planilha sem mantê-lo no nome do funcionário',()=>{
    expect(parseEmployeeIdentity('Adenir encanador')).toEqual({name:'Adenir',roleHint:'Encanador'})
    expect(parseEmployeeIdentity('Carlos - ajudante')).toEqual({name:'Carlos',roleHint:'Ajudante de Encanador'})
  })

  it('filtra benefícios pela política específica da empresa sem valores hardcoded',()=>{
    const rows=[
      {descricao:'Vale-alimentação',valor_centavos:43750},
      {descricao:'Vale-transporte',valor_centavos:21990},
      {descricao:'Auxílio combustível',valor_centavos:35000},
    ]
    expect(filterBenefitsByPolicy(rows,'Vale-alimentação, Auxílio combustível')).toEqual([
      {descricao:'Vale-alimentação',valor_centavos:43750},
      {descricao:'Auxílio combustível',valor_centavos:35000},
    ])
    expect(filterBenefitsByPolicy(rows,'')).toEqual(rows)
  })

  it('gera recibos com vários benefícios juntos e respeita a política da empresa',async()=>{
    const {db,company,employee,time}=setup()
    db.save('empresas',{...company,politica_recibos:'Café, Vale-alimentação'})
    time.autoFill({funcionario_id:employee.id,competencia:'2026-08'})
    const reviewed=time.get({funcionario_id:employee.id,competencia:'2026-08'})
    time.save({funcionario_id:employee.id,competencia:'2026-08',marks:reviewed.marks,confirmado_real:true})
    const folha=db.save('folhas_pagamento',{empresa_id:employee.empresa_id,competencia:'2026-08',status:'aberta'})
    db.save('folha_lancamentos',{folha_id:folha.id,funcionario_id:employee.id,tipo:'beneficio_cafe',descricao:'Café',natureza:'credito',quinzena:1,valor_centavos:18000})
    db.save('folha_lancamentos',{folha_id:folha.id,funcionario_id:employee.id,tipo:'beneficio_vale_alimentacao',descricao:'Vale-alimentação',natureza:'credito',quinzena:1,valor_centavos:51000})
    db.save('folha_lancamentos',{folha_id:folha.id,funcionario_id:employee.id,tipo:'beneficio_vale_transporte',descricao:'Vale-transporte',natureza:'credito',quinzena:1,valor_centavos:22000})
    time.printHtml=async(html:string,destination:string)=>{fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,html,'utf8')}
    const result=await time.generateDocuments({funcionario_id:employee.id,competencia:'2026-08',paymentDate:'2026-08-15',point:false,receipts:true})
    expect(result.point).toBeUndefined()
    expect(result.receipt?.path).toBeTruthy()
    expect(result.receipt.path).toContain(path.join('08 - agosto','Não assinados'))
    expect(fs.existsSync(result.signedFolder)).toBe(true)
    const receipt=fs.readFileSync(result.receipt.path,'utf8')
    expect(receipt).toContain('Café')
    expect(receipt).toContain('Vale-alimentação')
    expect(receipt).not.toContain('Vale-transporte')
    expect((receipt.match(/assinatura/g)||[]).length).toBe(1)
  })

  it('gera somente o tipo de documento selecionado',async()=>{
    const {employee,time}=setup()
    time.autoFill({funcionario_id:employee.id,competencia:'2026-08'})
    const reviewed=time.get({funcionario_id:employee.id,competencia:'2026-08'})
    time.save({funcionario_id:employee.id,competencia:'2026-08',marks:reviewed.marks,confirmado_real:true})
    time.printHtml=async(html:string,destination:string)=>{fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,html,'utf8')}
    const result=await time.generateDocuments({funcionario_id:employee.id,competencia:'2026-08',paymentDate:'2026-08-15',point:true,receipts:false})
    expect(result.point?.path).toBeTruthy()
    expect(result.point.path).toContain(path.join('08 - agosto','Não assinados'))
    expect(result.unsignedFolder).toContain(path.join('08 - agosto','Não assinados'))
    expect(result.signedFolder).toContain(path.join('08 - agosto','Assinados'))
    expect(result.receipt).toBeUndefined()
  })

  it('monta HTML imprimível real em vez de imprimir visualizador PDF oculto',()=>{
    const html=buildPrintBatchHtml([
      {ok:true,nome:'A',pointHtml:'<html><body><div>FICHA A</div></body></html>',receiptHtml:'<html><body><div>RECIBO A</div></body></html>'},
      {ok:true,nome:'B',pointHtml:'<html><body><div>FICHA B</div></body></html>',receiptHtml:null},
    ],{point:true,receipts:true})
    expect(html).toContain('FICHA A')
    expect(html).toContain('RECIBO A')
    expect(html).toContain('FICHA B')
    expect(html.indexOf('FICHA A')).toBeLessThan(html.indexOf('RECIBO A'))
    expect(html.indexOf('RECIBO A')).toBeLessThan(html.indexOf('FICHA B'))
    expect(html).not.toContain('<embed')
    expect(html).not.toContain('<iframe')
  })
  it('não mistura empresas ao gerar ou preparar impressão em lote',async()=>{
    const {db,company,cargo,employee,time}=setup()
    const otherCompany=db.save('empresas',{razao_social:'Empresa Separada',cnpj:'11.222.333/0001-81',status:'ativa'})
    const other=db.save('funcionarios',{empresa_id:otherCompany.id,cargo_id:cargo.id,nome:'Colaborador Outra Empresa',cpf:'987.654.321-00',status:'ativo'})
    const calls:number[]=[]
    time.generateDocuments=async(input:any)=>{calls.push(input.funcionario_id);return {point:null}}
    const results=await time.generateForAll({empresa_id:company.id,competencia:'2026-08',point:true,receipts:false})
    expect(results.map((row:any)=>row.funcionario_id)).toEqual([employee.id])
    expect(calls).toEqual([employee.id])
    time.printableEntry=(id:number)=>({funcionario_id:id,nome:'Teste',ok:true,pointHtml:'<body>Teste</body>'})
    expect(time.preparePrintableEntries({empresa_id:company.id,competencia:'2026-08'},null).map((row:any)=>row.funcionario_id)).toEqual([employee.id])
    expect(time.preparePrintableEntries({empresa_id:otherCompany.id,competencia:'2026-08'},null).map((row:any)=>row.funcionario_id)).toEqual([other.id])
    await expect(time.generateForAll({competencia:'2026-08'})).rejects.toThrow(/empresa/i)
  })

})
