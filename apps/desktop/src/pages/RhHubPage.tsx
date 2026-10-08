import { BriefcaseBusiness, CalendarClock, FileArchive, ReceiptText, UsersRound, WalletCards, ClipboardList, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, Field, Kpi, PageHeader } from '../components/ui'
import { WorkQueue } from '../components/WorkQueue'
import { useAsync } from '../hooks/useAsync'
import { useWorkContext } from '../hooks/useWorkContext'
import { ErrorState, Loading } from '../components/ui'
import { ROUTES } from '../routes/registry'

const cards = [
  {to:ROUTES.rhEmployees,title:'Funcionários',description:'Consulte a equipe, cadastros ativos e dados dos colaboradores.',icon:UsersRound},
  {to:ROUTES.rhAdmissions,title:'Registro de funcionário',description:'Cadastre novos colaboradores ou atualize registros existentes.',icon:BriefcaseBusiness},
  {to:ROUTES.rhCompensation,title:'Cargos e remuneração',description:'Defina salário-base, benefícios por cargo e os valores que alimentam a folha.',icon:WalletCards},
  {to:ROUTES.rhPayroll,title:'Folha e pagamentos',description:'Revise valores fixos e variáveis e confirme pagamentos por competência.',icon:ReceiptText},
  {to:ROUTES.rhTime,title:'Folhas de ponto e recibos',description:'Revise marcações, gere documentos mensais, imprima e reimprima lotes.',icon:CalendarClock},
  {to:ROUTES.rhAccess,title:'Acesso local e backup',description:'Gerencie contas de acesso à LAN, instantâneos SQLite e restauração segura.',icon:ShieldCheck},
  {to:ROUTES.rhWorkspace,title:'Gestão de pessoas',description:'Férias, afastamentos, desligamentos, recrutamento, jornada, treinamento, metas e desempenho.',icon:ClipboardList},
  {to:ROUTES.rhTemplates,title:'Modelos de documentos',description:'Gerencie os modelos, regras admissionais e kits de EPI por empresa e cargo.',icon:FileArchive},
]

export default function RhHubPage(){
  const {competencia,setCompetencia}=useWorkContext()
  const employees=useAsync(()=>window.fluxoDre.funcionarios.list(),[])
  const pending=useAsync(()=>window.fluxoDre.folha.pending(competencia),[competencia])
  const incomplete=employees.data?.filter(x=>!x.cpf||!x.empresa_id||!x.cargo_id)||[]
  if(employees.error)return <ErrorState error={employees.error} retry={employees.reload}/>
  if(pending.error)return <ErrorState error={pending.error} retry={pending.reload}/>
  return <>
    <PageHeader title="Visão geral do RH" description="Sua equipe e as próximas tarefas, no mesmo lugar." actions={<Field label="Competência"><input type="month" value={competencia} onChange={e=>setCompetencia(e.target.value)}/></Field>}/>
    <section className="rh-month-overview" aria-label="Resumo da competência"><div className="rh-month-intro"><span>Seu RH em dia</span><h2>Organize a equipe.<br/>Acompanhe cada fechamento.</h2><p>Confira os pagamentos e complete os cadastros antes de gerar a documentação.</p><Link className="button button-primary" to="/rh/folha?tab=pendentes">Revisar pagamentos</Link></div>
    {employees.loading||pending.loading?<Loading/>:<div className="rh-overview-metrics"><Kpi label="Funcionários ativos" value={String(employees.data?.filter(x=>x.status==='ativo').length||0)} icon={<UsersRound size={20}/>}/><Kpi label="Pagamentos a revisar" value={String(pending.data?.length||0)} icon={<ReceiptText size={20}/>}/><Kpi label="Cadastros incompletos" value={String(incomplete.length)} icon={<BriefcaseBusiness size={20}/>}/></div>}</section>
    {!employees.loading&&!pending.loading&&<WorkQueue items={[
      ...((pending.data?.length||0)>0?[{id:'payments',title:`${pending.data!.length} ${pending.data!.length===1?'pagamento aguardando':'pagamentos aguardando'} revisão`,description:`Competência ${competencia}`,to:'/rh/folha?tab=pendentes',action:'Conferir folha'}]:[]),
      ...incomplete.map(x=>({id:`employee-${x.id}`,title:x.nome,description:'Complete empresa, cargo ou CPF no cadastro.',to:`/rh/admissoes?id=${x.id}`,action:'Completar cadastro'}))
    ]}/>}
    <section className="rh-admission-section" aria-labelledby="rh-admission-flow-title">
      <div className="section-heading">
        <div>
          <h2 id="rh-admission-flow-title">Fluxo de admissão</h2>
          <p>Siga as etapas para cadastrar, gerar e conferir a documentação do colaborador.</p>
        </div>
      </div>
      <ol className="rh-journey" aria-label="Jornada de admissão">
        <li><Link to={ROUTES.rhAdmissions}>1. Cadastro</Link><small>Dados pessoais e documentos.</small></li>
        <li><Link to={`${ROUTES.rhAdmissions}?step=2`}>2. Contrato</Link><small>Empresa, cargo, jornada e remuneração.</small></li>
        <li><Link to={`${ROUTES.rhAdmissions}?step=3`}>3. Benefícios e EPI</Link><small>Confira benefícios e itens entregues.</small></li>
        <li><Link to={`${ROUTES.rhAdmissions}?step=4`}>4. Documentos</Link><small>Gere o kit admissional.</small></li>
        <li><Link to={`${ROUTES.documents}?context=rh`}>5. Conferência</Link><small>Revise, imprima e acompanhe os documentos de RH.</small></li>
      </ol>
    </section>
    <div className="rh-panel-heading"><div><h2>Áreas de trabalho</h2><p>Acesse a rotina que você precisa resolver.</p></div></div><div className="artisys-rh-hub">
      {cards.map(({to,title,description,icon:Icon})=><Link to={to} key={to} className="rh-card-link"><Card className="artisys-rh-card">
        <div className="artisys-rh-card-body">
          <div className="artisys-rh-card-icon"><Icon size={20}/></div>
          <div className="artisys-rh-card-copy"><h2>{title}</h2><p>{description}</p></div>
        </div>
        <span className="artisys-rh-card-arrow" aria-hidden="true">›</span>
      </Card></Link>)}
    </div>
  </>
}
