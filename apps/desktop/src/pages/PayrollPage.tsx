import { Link, useSearchParams } from 'react-router-dom'
import { useWorkContext } from '../hooks/useWorkContext'
import { CheckCircle2, Clock3, Download, Edit3, FileText, Info, Plus, Trash2, UploadCloud, UserRound } from 'lucide-react'
import { FormEvent, useState, useRef } from 'react'
import { brl, competenceLabel, toCents, today } from '../utils/format'
import { useAsync } from '../hooks/useAsync'
import { ErrorState, Button, Card, Empty, Field, FormActions, Loading, Modal, PageHeader, Segmented, Status } from '../components/ui'
import PayrollImportModal from '../components/PayrollImportModal'

const variables=[
  {tipo:'diaria',descricao:'Diária',natureza:'credito'},
  {tipo:'permuta',descricao:'Permuta',natureza:'credito'},
  {tipo:'vale_salario',descricao:'Vale / adiantamento',natureza:'credito',quinzena:2},
  {tipo:'empreita',descricao:'Empreita',natureza:'credito'},
  {tipo:'ajuste',descricao:'Ajuste',natureza:'credito'},
  {tipo:'falta',descricao:'Falta',natureza:'desconto'},
  {tipo:'outro_desconto',descricao:'Outro desconto',natureza:'desconto'}
]

const overviewGroups=[
  {key:'remuneracao',label:'Remuneração',columns:[
    {key:'remuneracao.salario',label:'Salário',field:'salario_centavos'},
    {key:'remuneracao.vale_adiantamento',label:'Vale / adiant.',field:'vale_adiantamento_centavos'},
    {key:'remuneracao.diarias',label:'Diárias',field:'diarias_centavos'},
    {key:'remuneracao.empreitas',label:'Empreitas',field:'empreitas_centavos'},
    {key:'remuneracao.outros',label:'Outros',field:'outros_centavos'}
  ]},
  {key:'beneficios',label:'Benefícios',columns:[
    {key:'beneficios.alimentacao',label:'Alimentação',field:'alimentacao_centavos'},
    {key:'beneficios.transporte',label:'Transporte',field:'transporte_centavos'},
    {key:'beneficios.outros',label:'Outros',field:'outros_centavos'}
  ]},
  {key:'descontos',label:'Descontos',columns:[
    {key:'descontos.faltas',label:'Faltas',field:'faltas_centavos'},
    {key:'descontos.outros',label:'Outros',field:'outros_centavos'}
  ]},
  {key:'encargos',label:'Encargos',columns:[
    {key:'encargos.inss',label:'INSS',field:'inss_centavos'},
    {key:'encargos.fgts',label:'FGTS',field:'fgts_centavos'},
    {key:'encargos.outros',label:'Outros',field:'outros_centavos'}
  ]}
]
const overviewColumns=overviewGroups.flatMap(group=>group.columns.map(column=>({...column,group:group.key})))
const overviewValue=(row:any,column:any)=>Number(row?.[column.group]?.[column.field]||0)
const overviewMoney=(value:number,group?:string)=>value===0?'—':brl(group==='descontos'?-Math.abs(value):value)

export default function PayrollPage(){
  const operation=useRef(false)
  const [busy,setBusy]=useState(false),[review,setReview]=useState<number|null>(null),[paymentDate,setPaymentDate]=useState(today()),[method,setMethod]=useState('PIX')
  const [params]=useSearchParams()
  const [tab,setTab]=useState(params.get('tab')==='pendentes'?'pendentes':'overview')
  const { competencia, empresaId, obraId, update, setCompetencia } = useWorkContext()
  const [employee,setEmployee]=useState('')
  const [version,setVersion]=useState(0)
  const [modal,setModal]=useState(false)
  const [importModal,setImportModal]=useState(false)
  const [cellDetail,setCellDetail]=useState<any>(null)
  const [message,setMessage]=useState('')
  const [exporting,setExporting]=useState<''|'xlsx'|'pdf'>('')
  const [form,setForm]=useState<any>({tipo:'diaria',descricao:'Diária',natureza:'credito',quinzena:1,valor:''})
  const employees=useAsync(()=>window.fluxoDre.funcionarios.list({status:'ativo'}),[])
  const cargos=useAsync(()=>window.fluxoDre.cargos.list(),[])
  const companies=useAsync(()=>window.fluxoDre.empresas.list({status:'ativa'}),[])
  const works=useAsync(()=>window.fluxoDre.obras.list(empresaId?{empresa_id:Number(empresaId)}:{}),[empresaId])
  const overview=useAsync(()=>['overview','empresa'].includes(tab)?window.fluxoDre.folha.overview({competencia,empresa_id:empresaId?Number(empresaId):null,obra_id:obraId?Number(obraId):null}):Promise.resolve(null),[tab,competencia,empresaId,obraId,version])
  const pending=useAsync(()=>tab==='pendentes'?window.fluxoDre.folha.pending(competencia):Promise.resolve([]),[tab,competencia,version])
  const payroll=useAsync(()=>tab==='funcionarios'&&employee?window.fluxoDre.folha.employee({funcionario_id:Number(employee),competencia}):Promise.resolve(null),[tab,employee,competencia,version])
  const rows=payroll.data?.launches||[]
  const first=rows.filter((row:any)=>row.quinzena===1)
  const second=rows.filter((row:any)=>row.quinzena===2)
  const payment=(quinzena:number)=>payroll.data?.payments.find((item:any)=>item.quinzena===quinzena&&item.status==='pago')
  const totals=(items:any[])=>items.reduce((result,row)=>{result[row.natureza]+=row.valor_centavos;return result},{credito:0,desconto:0})
  const firstTotals=totals(first),secondTotals=totals(second)
  const totalAll={credito:firstTotals.credito+secondTotals.credito,desconto:firstTotals.desconto+secondTotals.desconto}
  const selectedEmployee=employees.data?.find((item:any)=>item.id===Number(employee))
  const selectedCargo=cargos.data?.find((item:any)=>item.id===selectedEmployee?.cargo_id)
  const importCompanyId=empresaId||(companies.data?.length===1?String(companies.data[0].id):'')
  const selectedCompany=companies.data?.find((item:any)=>item.id===Number(importCompanyId))
  const selectedWork=works.data?.find((item:any)=>item.id===Number(obraId))
  const exportOverview=async(format:'xlsx'|'pdf')=>{
    setMessage('')
    setExporting(format)
    try{
      const result=await window.fluxoDre.folha.exportOverview({
        format,
        competencia,
        empresa_id:importCompanyId?Number(importCompanyId):null,
        obra_id:obraId?Number(obraId):null,
        empresa_nome:selectedCompany?.nome_fantasia||selectedCompany?.razao_social||'',
        obra_nome:selectedWork?.nome||''
      })
      if(!result?.canceled)setMessage('Exportação '+(format==='xlsx'?'Excel':'PDF')+' salva em '+result.path+'.')
    }catch(error:any){setMessage(error?.message||String(error))}
    finally{setExporting('')}
  }


  const openEmployeePayroll=(row:any)=>{
    setEmployee(String(row.funcionario_id))
    setTab('funcionarios')
  }

  const openCellDetail=(row:any,column:any,value:number)=>{
    setCellDetail({
      kind:'employee',
      title:`${row.funcionario_nome} · ${column.label}`,
      subtitle:row.cargo_nome,
      value,
      group:column.group,
      employeeId:row.funcionario_id,
      sources:row.sources?.[column.key]||[]
    })
  }
  const openCompanyExpenseDetail=(row:any)=>setCellDetail({
    kind:'company',
    title:row.descricao,
    subtitle:row.categoria_nome||'Despesa da empresa',
    value:row.valor_centavos,
    accountId:row.id,
    sources:row.sources||[]
  })
  const SmartCell=({row,column}:{row:any,column:any})=>{
    const value=overviewValue(row,column)
    if(!value)return <td className="payroll-overview-empty">—</td>
    return <td><button className={`payroll-overview-cell ${column.group==='descontos'?'is-discount':''}`} onClick={()=>openCellDetail(row,column,value)} title="Ver origem do valor">{overviewMoney(value,column.group)}</button></td>
  }

  const openVariable=(row?:any,quinzena=1)=>{setForm(row?{...row,valor:(row.valor_centavos/100).toFixed(2).replace('.',',')}:{tipo:quinzena===2?'vale_salario':'diaria',descricao:quinzena===2?'Vale / adiantamento':'Diária',natureza:'credito',quinzena,valor:''});setModal(true)}
  const submit=async(event:FormEvent)=>{event.preventDefault();if(operation.current)return;operation.current=true;setBusy(true);try{await window.fluxoDre.folha.saveVariable({...form,funcionario_id:Number(employee),competencia,valor_centavos:toCents(form.valor)});setModal(false);setVersion(v=>v+1);setMessage('Lançamento salvo.')}catch(e:any){setMessage(e.message)}finally{operation.current=false;setBusy(false)}}
  const selectType=(event:React.ChangeEvent<HTMLSelectElement>)=>{const item=variables.find(x=>x.tipo===event.target.value)!;setForm({...form,...item,quinzena:item.quinzena||form.quinzena})}
  const confirm=async(quinzena:number)=>{if(operation.current)return;operation.current=true;setBusy(true);setMessage('');try{const result:any=await window.fluxoDre.folha.confirm({funcionario_id:Number(employee),competencia,quinzena,data:paymentDate,forma_pagamento:method});setVersion(v=>v+1);setReview(null);if(quinzena===1)setMessage(result?.documentError?'Pagamento confirmado, mas os documentos mensais não foram gerados: '+result.documentError:'Pagamento confirmado. A ficha de ponto e os recibos mensais foram gerados juntos na pasta do mês.');else setMessage(`${quinzena}ª quinzena confirmada e registrada.`)}catch(error:any){setMessage(error?.message||String(error))}finally{operation.current=false;setBusy(false)}}
  const VariableRows=({items}:{items:any[]})=><div className="variable-list">{items.filter(row=>row.editavel).map((row:any)=><div className="variable-row" key={row.id}><div><strong>{row.descricao}</strong><small>{row.natureza==='desconto'?'Desconto variável':'Crédito variável'}</small></div><span className={row.natureza==='desconto'?'amount-negative':'amount-positive'}>{brl(row.valor_centavos)}</span>{row.status!=='pago'&&<div className="row-actions"><button className="icon-button" aria-label={`Editar ${row.descricao}`} onClick={()=>{openVariable(row);setModal(true)}}><Edit3 size={14}/></button><button className="icon-button danger-icon" aria-label={`Remover ${row.descricao}`} onClick={async()=>{if(!window.confirm("Remover este lançamento?"))return;try{await window.fluxoDre.folha.removeVariable(row.id);setVersion(v=>v+1)}catch(e:any){setMessage(e.message)}}}><Trash2 size={14}/></button></div>}</div>)}</div>

  const CompanyExpenses=()=>{
    if(overview.loading)return <Card><Loading label="Consolidando despesas da competência..."/></Card>
    const data=overview.data
    if(!data)return <Card><Empty title="Não foi possível carregar as despesas" description="Revise a competência e tente novamente."/></Card>
    const expenses:any[]=Array.isArray(data.company_expenses)?data.company_expenses:[]
    const grouped=new Map<string,number>()
    for(const row of expenses){const key=String(row.categoria_nome||'Outras despesas');grouped.set(key,(grouped.get(key)||0)+Number(row.valor_centavos||0))}
    const groups:Array<[string,number]>=Array.from(grouped.entries())
    const total=groups.reduce((sum,[,value])=>sum+value,0)
    const financeHref='/financeiro?'+new URLSearchParams({tipo:'pagar',competencia,empresa:empresaId,obra:obraId}).toString()
    return <Card className="company-expenses-card"><div className="section-heading"><div><h2>Despesas e encargos da competência</h2><p>{competenceLabel(competencia)} · valores vindos das contas a pagar, sem duplicar a própria folha.</p></div><strong>{brl(total)}</strong></div>{groups.length?<div className="company-expense-summary">{groups.map(([label,value])=><div key={label}><span>{label}</span><strong>{brl(value)}</strong></div>)}</div>:<Empty title="Sem outras despesas nesta competência" description="As contas a pagar da empresa aparecerão aqui quando forem lançadas."/>}<div className="header-actions" style={{marginTop:12}}><Link className="button button-secondary" to={financeHref}>Abrir contas a pagar</Link><Link className="button button-secondary" to="/dre">Abrir DRE</Link></div></Card>
  }

  const OverviewMatrix=()=>{
    if(overview.loading)return <Card><Loading label="Consolidando folha e despesas da competência..."/></Card>
    const data=overview.data
    if(!data)return <Card><Empty title="Não foi possível carregar a visão geral" description="Revise a competência e tente novamente."/></Card>
    if(!data.employees?.length&&!data.company_expenses?.length)return <Card><Empty title="Sem dados nesta competência" description="A visão geral será preenchida a partir da folha e das contas a pagar."/></Card>
    return <Card className="payroll-overview-card">
      <div className="payroll-overview-intro"><div><h2>Visão geral da competência</h2><p>Valores consolidados da folha e das despesas da empresa. Clique em uma célula com valor para ver sua origem.</p></div><span>{competenceLabel(competencia)}</span></div>
      <div className="payroll-overview-wrap"><table className="payroll-overview-table">
        <thead>
          <tr><th rowSpan={2} className="payroll-overview-sticky">Funcionário / despesa</th>{overviewGroups.map(group=><th key={group.key} colSpan={group.columns.length} className={'overview-group '+group.key}>{group.label}</th>)}<th rowSpan={2} className="overview-total-head">Total funcionário</th><th rowSpan={2} className="overview-cost-head">Custo empresa</th></tr>
          <tr>{overviewGroups.flatMap(group=>group.columns.map(column=><th key={column.key} className={'overview-subhead '+group.key}>{column.label}</th>))}</tr>
        </thead>
        <tbody>
          {data.employees.map((row:any)=><tr key={row.funcionario_id}><th className="payroll-overview-sticky payroll-overview-person"><button type="button" className="payroll-overview-person-link" title="Abrir folha do funcionário" onClick={()=>openEmployeePayroll(row)}><strong>{row.funcionario_nome}</strong><small>{row.cargo_nome||'Sem cargo'}</small></button></th>{overviewColumns.map(column=><SmartCell key={column.key} row={row} column={column}/>)}<td className="payroll-overview-total-cell">{brl(row.total_funcionario_centavos)}</td><td className="payroll-overview-cost-cell">{brl(row.custo_empresa_centavos)}</td></tr>)}
          <tr className="payroll-overview-section-row"><th colSpan={overviewColumns.length+3}>Despesas da empresa</th></tr>
          {data.company_expenses.map((row:any)=><tr key={'expense-'+row.id}><th className="payroll-overview-sticky payroll-overview-person"><strong>{row.descricao}</strong><small>{row.categoria_nome||'Outras despesas'}</small></th><td colSpan={overviewColumns.length} className="payroll-overview-company-space">Conta a pagar da competência</td><td className="payroll-overview-empty">—</td><td><button className="payroll-overview-cell payroll-overview-company-cell" onClick={()=>openCompanyExpenseDetail(row)} title="Ver origem do valor">{brl(row.valor_centavos)}</button></td></tr>)}
          <tr className="payroll-overview-total"><th className="payroll-overview-sticky">TOTAL DA COMPETÊNCIA</th>{overviewColumns.map(column=><td key={column.key}>{overviewMoney(Number(data.totals?.by_column_centavos?.[column.key]||0),column.group)}</td>)}<td>{brl(data.totals?.total_funcionarios_centavos||0)}</td><td>{brl(data.totals?.custo_competencia_centavos||0)}</td></tr>
        </tbody>
      </table></div>
    </Card>
  }

  if(employees.error)return <ErrorState error={employees.error} retry={employees.reload}/>
  if(cargos.error)return <ErrorState error={cargos.error} retry={cargos.reload}/>
  if(companies.error)return <ErrorState error={companies.error} retry={companies.reload}/>
  if(works.error)return <ErrorState error={works.error} retry={works.reload}/>
  if(overview.error)return <ErrorState error={overview.error} retry={overview.reload}/>
  if(payroll.error)return <ErrorState error={payroll.error} retry={payroll.reload}/>
  if(pending.error)return <ErrorState error={pending.error} retry={pending.reload}/>
  return <>
    <PageHeader title="Controle de pagamento" description="Folha, benefícios, descontos, encargos e despesas da empresa por competência." actions={tab==='overview'?<div className="header-actions payroll-overview-actions"><Button variant="secondary" icon={<Download size={15}/>} disabled={!!exporting} onClick={()=>exportOverview('xlsx')}>{exporting==='xlsx'?'Exportando...':'Excel'}</Button><Button variant="secondary" icon={<FileText size={15}/>} disabled={!!exporting} onClick={()=>exportOverview('pdf')}>{exporting==='pdf'?'Exportando...':'PDF'}</Button><Button icon={<UploadCloud size={16}/>} onClick={()=>setImportModal(true)}>Importar planilha</Button></div>:tab==='funcionarios'&&employee?<Button icon={<Plus size={16}/>} onClick={()=>{openVariable();setModal(true)}}>Novo variável</Button>:null}/>
    <div className="toolbar payroll-tabs"><Segmented value={tab} onChange={setTab} options={[{value:'overview',label:'Visão geral'},{value:'funcionarios',label:'Funcionários'},{value:'empresa',label:'Encargos da empresa'},{value:'pendentes',label:'Pendentes'}]}/></div>
    {['overview','empresa'].includes(tab)?<Card className="payroll-overview-filter"><Field label="Competência"><input type="month" value={competencia} onChange={event=>setCompetencia(event.target.value)}/></Field><Field label="Empresa"><select value={empresaId} onChange={event=>update({empresaId:event.target.value})}><option value="">Todas</option>{companies.data?.map((item:any)=><option key={item.id} value={item.id}>{item.nome_fantasia||item.razao_social}</option>)}</select></Field><Field label="Local de trabalho (opcional)"><select value={obraId} onChange={event=>update({obraId:event.target.value})}><option value="">Todos os locais</option>{works.data?.map((item:any)=><option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field></Card>:<Card className="payroll-filter"><Field label="Funcionário" wide><select value={employee} onChange={event=>setEmployee(event.target.value)}><option value="">Selecione um funcionário...</option>{employees.data?.map((item:any)=><option key={item.id} value={item.id}>{item.nome} · CPF {item.cpf||'não informado'} · {cargos.data?.find((cargo:any)=>cargo.id===item.cargo_id)?.nome||'Sem cargo'}</option>)}</select></Field><Field label="Competência"><input type="month" value={competencia} onChange={e=>setCompetencia(e.target.value)}/></Field></Card>}

    {tab==='overview'?<OverviewMatrix/>:tab==='empresa'?<CompanyExpenses/>:tab==='pendentes'?<Card className="pending-card"><div className="section-heading"><div><h2>Pagamentos pendentes</h2><p>Quinzenas aguardando confirmação em {competenceLabel(competencia)}.</p></div><Status value="pendente"/></div>{pending.loading?<Loading label="Preparando pagamentos fixos..."/>:pending.data?.length?<div className="table-wrap"><table><thead><tr><th>Funcionário</th><th>Cargo</th><th>Quinzena</th><th>Valor previsto</th><th>Status</th><th></th></tr></thead><tbody>{pending.data.map((item:any)=><tr key={`${item.funcionario_id}-${item.quinzena}`}><td><strong>{item.funcionario_nome}</strong></td><td>{item.cargo_nome||'Sem cargo'}</td><td>{item.quinzena}ª quinzena</td><td className="money-cell">{brl(item.valor_centavos)}</td><td><Status value="pendente"/></td><td><Button variant="secondary" onClick={()=>{setEmployee(String(item.funcionario_id));setTab('funcionarios')}}>Revisar</Button></td></tr>)}</tbody></table></div>:<Empty title="Tudo confirmado" description="Não há pagamentos pendentes nesta competência."/>}</Card>:!employee?<Card><Empty title="Selecione um funcionário" description="Os valores fixos do cargo serão preparados automaticamente para a competência escolhida."/></Card>:payroll.loading?<Card><Loading label="Preparando valores fixos e pagamentos..."/></Card>:payroll.data&&<>
      <div className="employee-payroll-banner"><span className="employee-banner-avatar">{selectedEmployee?.nome?.slice(0,1).toUpperCase()}</span><div><strong>{selectedEmployee?.nome}</strong><span>{selectedCargo?.nome||'Sem cargo'} · {competenceLabel(competencia)}</span></div><div className="banner-total"><small>Total previsto</small><b>{brl(totalAll.credito-totalAll.desconto)}</b></div></div>
      <div className="payroll-summary-grid"><Card><span>Proventos</span><strong className="amount-positive">{brl(totalAll.credito)}</strong></Card><Card><span>Descontos</span><strong className="amount-negative">{brl(totalAll.desconto)}</strong></Card><Card><span>Líquido</span><strong>{brl(totalAll.credito-totalAll.desconto)}</strong></Card></div>

      <Card className="payroll-period-card">
        <div className="payroll-period-header"><div><h2>1ª Quinzena — Pagamento mensal</h2><p>Salário e benefícios fixos vinculados ao cargo.</p></div>{payment(1)?<Status value="pago"/>:<span className="status status-warning"><Clock3 size={12}/> Pendente</span>}</div>
        <div className="payroll-period-body"><h3>Valores fixos</h3><div className="fixed-values-grid">{first.filter((row:any)=>!row.editavel).map((row:any)=><label key={row.id}><span>{row.descricao}</span><div className="locked-value">{brl(row.valor_centavos)}<small>Vinculado ao cargo</small></div></label>)}</div>
        <div className="variable-heading"><h3>Variáveis da competência</h3>{!payment(1)&&<Button variant="secondary" icon={<Plus size={14}/>} onClick={()=>{openVariable(undefined,1);setModal(true)}}>Adicionar</Button>}</div><VariableRows items={first}/></div>
        <div className="payroll-total-bar"><div><span>Total bruto</span><strong className="amount-positive">{brl(firstTotals.credito)}</strong></div><div><span>Descontos</span><strong className="amount-negative">{brl(firstTotals.desconto)}</strong></div><div className="payroll-payable"><span>A pagar</span><strong>{brl(Math.max(0,firstTotals.credito-firstTotals.desconto))}</strong></div><div className="payroll-actions">{payment(1)?<span className="paid-confirmation"><CheckCircle2 size={17}/> Pago em {payment(1).data}</span>:<><span className="payroll-save-state">Lançamentos já salvos · pagamento pendente</span><Button icon={<CheckCircle2 size={16}/>} disabled={busy} onClick={()=>setReview(1)}>Confirmar pagamento</Button></>}</div></div>
      </Card>

      <Card className="payroll-period-card second-period">
        <div className="payroll-period-header"><div><h2>2ª Quinzena — Vale / adiantamento</h2><p>Este valor pode ser alterado e será considerado no fechamento.</p></div>{payment(2)?<Status value="pago"/>:<span className="status status-warning"><Clock3 size={12}/> Pendente</span>}</div>
        <div className="payroll-period-body"><VariableRows items={second}/>{!second.length&&!payment(2)&&<Empty title="Nenhum adiantamento lançado" description="Adicione somente quando houver vale, permuta ou outro valor variável." action={<Button variant="secondary" icon={<Plus size={14}/>} onClick={()=>{openVariable(undefined,2);setModal(true)}}>Adicionar vale</Button>}/>}</div>
        <div className="payroll-total-bar compact"><div className="payroll-payable"><span>A pagar</span><strong>{brl(Math.max(0,secondTotals.credito-secondTotals.desconto))}</strong></div><div className="payroll-actions">{payment(2)?<span className="paid-confirmation"><CheckCircle2 size={17}/> Pago em {payment(2).data}</span>:<Button icon={<CheckCircle2 size={16}/>} disabled={busy||!second.length} onClick={()=>setReview(2)}>Confirmar pagamento</Button>}</div></div>
      </Card>
    </>}
    {message&&<div role="status" className="notice" style={{marginTop:14}}>{message}{message.includes('não foram gerados')&&<p><Link to={`/rh/ponto?funcionario=${employee}`}>Tentar gerar documentos no Ponto</Link></p>}</div>}
    <Modal open={review!==null} title="Registrar pagamento realizado" onClose={()=>{if(!busy)setReview(null)}}><form onSubmit={e=>{e.preventDefault();if(review!==null)void confirm(review)}}><div className="modal-body form-grid"><p className="field-wide">{selectedEmployee?.nome} · {competenceLabel(competencia)} · {review}ª quinzena · {brl(Math.max(0,(review===1?firstTotals:secondTotals).credito-(review===1?firstTotals:secondTotals).desconto))}</p><p className="field-wide">Esta ação registra um pagamento já realizado. Ela não faz uma transferência bancária.</p><Field label="Data do pagamento"><input required type="date" value={paymentDate} onChange={e=>setPaymentDate(e.target.value)}/></Field><Field label="Forma de pagamento"><select value={method} onChange={e=>setMethod(e.target.value)}>{['PIX','Transferência','Dinheiro','Cheque','Outro'].map(x=><option key={x}>{x}</option>)}</select></Field>{message&&<p role="alert">{message}</p>}</div><FormActions loading={busy} submitLabel={busy?'Registrando...':'Registrar pagamento'} onCancel={()=>{if(!busy)setReview(null)}}/></form></Modal>
    <PayrollImportModal open={importModal} onClose={()=>setImportModal(false)} competencia={competencia} empresaId={importCompanyId} obraId={obraId} onImported={()=>setVersion(value=>value+1)}/>
    <Modal open={!!cellDetail} title="Origem do valor" onClose={()=>setCellDetail(null)} size="sm">{cellDetail&&<div className="modal-body payroll-source-detail"><div className="payroll-source-heading"><span className="payroll-source-icon"><Info size={18}/></span><div><strong>{cellDetail.title}</strong><small>{cellDetail.subtitle}</small></div><b>{brl(cellDetail.group==='descontos'?-Math.abs(cellDetail.value):cellDetail.value)}</b></div><div className="payroll-source-list">{cellDetail.sources?.length?cellDetail.sources.map((source:any,index:number)=><div className="payroll-source-row" key={(source.kind||'source')+'-'+(source.id||index)}><div><strong>{source.kind==='conta'?'Conta a pagar':'Lançamento da folha'} #{source.id||'—'}</strong><small>{source.origem?('Origem: '+source.origem):'Origem registrada no dado canônico'}{source.importacao_linha_id?(' · linha importada #'+source.importacao_linha_id):''}</small></div></div>):<div className="notice">Nenhuma referência de origem foi encontrada para este valor.</div>}</div><div className="payroll-source-actions">{cellDetail.kind==='employee'?<Button variant="secondary" onClick={()=>{setEmployee(String(cellDetail.employeeId));setTab('funcionarios');setCellDetail(null)}}>Abrir funcionário</Button>:<Link className="button button-secondary" to="/financeiro?tipo=pagar" onClick={()=>setCellDetail(null)}>Abrir contas a pagar</Link>}</div></div>}</Modal>
    <Modal open={modal} title={form.id?'Editar lançamento variável':'Novo lançamento variável'} onClose={()=>setModal(false)}><form onSubmit={submit}><div className="modal-body form-grid"><Field label="Funcionário" wide><div className="readonly-person"><UserRound size={17}/>{selectedEmployee?.nome} · CPF {selectedEmployee?.cpf||'não informado'}</div></Field><Field label="Rubrica" required><select value={form.tipo} onChange={selectType}>{variables.map(item=><option value={item.tipo} key={item.tipo}>{item.descricao}</option>)}</select></Field><Field label="Natureza"><select value={form.natureza} onChange={event=>setForm({...form,natureza:event.target.value})}><option value="credito">Crédito</option><option value="desconto">Desconto</option></select></Field><Field label="Quinzena"><select value={form.quinzena} onChange={event=>setForm({...form,quinzena:Number(event.target.value)})}><option value="1">1ª quinzena</option><option value="2">2ª quinzena</option></select></Field><Field label="Valor" required><input required value={form.valor} onChange={event=>setForm({...form,valor:event.target.value})} placeholder="0,00"/></Field><Field label="Data"><input type="date" value={form.data||today()} onChange={event=>setForm({...form,data:event.target.value})}/></Field></div>{message&&<p role="alert">{message}</p>}<FormActions loading={busy} onCancel={()=>setModal(false)} submitLabel="Salvar lançamento"/></form></Modal>
  </>
}




