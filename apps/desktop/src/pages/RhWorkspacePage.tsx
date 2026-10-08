import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, ClipboardCheck, Plus, RefreshCw, Search, ShieldCheck, Trash2 } from 'lucide-react'
import { Button, Card, Empty, Field, FormActions, Kpi, Modal, PageHeader, Status } from '../components/ui'
import { useWorkContext } from '../hooks/useWorkContext'
import { competenceLabel } from '../utils/format'
import { Link } from 'react-router-dom'
import { ROUTES } from '../routes/registry'

type Group={name:string;note:string;kinds:{id:string;label:string}[]}
const GROUPS:Group[]=[
 {name:'Departamento pessoal',note:'Ciclo contratual e prazos',kinds:[{id:'ferias',label:'Férias'},{id:'afastamento',label:'Afastamentos'},{id:'desligamento',label:'Desligamentos'},{id:'historico_contratual',label:'Histórico contratual'},{id:'checklist',label:'Checklists'},{id:'vencimento',label:'Vencimentos'}]},
 {name:'Jornada e folha',note:'Conferência e planejamento interno',kinds:[{id:'jornada',label:'Escalas e jornadas'},{id:'ajuste_ponto',label:'Correções de ponto'},{id:'rubrica',label:'Rubricas de conferência'}]},
 {name:'Recrutamento e integração',note:'Do candidato à admissão',kinds:[{id:'vaga',label:'Vagas'},{id:'candidato',label:'Candidatos'},{id:'onboarding',label:'Onboarding'}]},
 {name:'Desenvolvimento',note:'Pessoas, competências e desempenho',kinds:[{id:'departamento',label:'Departamentos'},{id:'competencia',label:'Competências'},{id:'avaliacao',label:'Avaliações'},{id:'meta',label:'Metas'},{id:'pdi',label:'Planos de desenvolvimento'},{id:'feedback',label:'Feedback'}]},
 {name:'Aprendizagem e clima',note:'Treinamentos, matrículas e pesquisas',kinds:[{id:'treinamento',label:'Treinamentos'},{id:'matricula',label:'Matrículas'},{id:'pesquisa',label:'Pesquisas'},{id:'resposta',label:'Respostas'}]},
]
const STATES=[['rascunho','Rascunho'],['pendente','Pendente'],['aprovado','Aprovado'],['concluido','Concluído'],['cancelado','Cancelado']] as const
const defaultRecord={titulo:'',estado:'rascunho',inicio:'',fim:'',funcionario_id:'',responsavel:'',valor_centavos:'',observacoes:'',referencia:'',detalhes:''}
const KIND_LABELS=Object.fromEntries(GROUPS.flatMap(group=>group.kinds.map(kind=>[kind.id,kind.label])))
function toForm(record:any){return record?{...record,funcionario_id:String(record.funcionario_id||''),inicio:record.inicio||'',fim:record.fim||'',responsavel:record.responsavel||'',valor_centavos:String(record.valor_centavos||''),observacoes:record.dados?.observacoes||'',referencia:record.dados?.referencia||'',detalhes:record.dados?.detalhes||''}:{...defaultRecord}}
export default function RhWorkspacePage(){
 const {empresaId,competencia,update}=useWorkContext()
 const [companies,setCompanies]=useState<any[]>([])
 const [employees,setEmployees]=useState<any[]>([])
 const [kind,setKind]=useState('ferias')
 const [rows,setRows]=useState<any[]>([])
 const [stats,setStats]=useState<any>(null)
 const [editing,setEditing]=useState<any|null>(null)
 const [form,setForm]=useState<any>({...defaultRecord})
 const [search,setSearch]=useState('')
 const [loading,setLoading]=useState(false)
 const [saving,setSaving]=useState(false)
 const [notice,setNotice]=useState('')
 const [error,setError]=useState('')
 const [version,setVersion]=useState(0)
 const company=Number(empresaId||0)
 useEffect(()=>{void Promise.all([window.fluxoDre.empresas.list(),window.fluxoDre.funcionarios.list()]).then(([c,e])=>{setCompanies(c);setEmployees(e);if(!empresaId&&c.length===1)update({empresaId:String(c[0].id)})}).catch((e)=>setError(String(e.message||e)))},[])
 useEffect(()=>{if(!company){setRows([]);setStats(null);return}let active=true;setLoading(true);setError('');void Promise.all([
   window.fluxoDre.rh.list({empresa_id:company,tipo:kind}),
   window.fluxoDre.rh.indicators({empresa_id:company})
 ]).then(([items,summary])=>{if(active){setRows(items);setStats(summary)}}).catch(e=>{if(active)setError(String(e.message||e))}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[company,kind,version])
 const filtered=useMemo(()=>rows.filter((r)=>[r.titulo,r.responsavel,employees.find(e=>e.id===r.funcionario_id)?.nome].join(' ').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))),[rows,search,employees])
 const companyEmployees=employees.filter(e=>Number(e.empresa_id)===company)
 const openNew=()=>{setForm({...defaultRecord});setEditing({tipo:kind});setError('')}
 const edit=(r:any)=>{setForm(toForm(r));setEditing(r);setError('')}
 const field=(key:string,value:string)=>setForm((f:any)=>({...f,[key]:value}))
 const save=async()=>{if(!company)return;setSaving(true);setError('');try{
   const data={empresa_id:company,tipo:editing.tipo,id:editing.id,revisao:editing.revisao,
    titulo:form.titulo,estado:form.estado,funcionario_id:form.funcionario_id?Number(form.funcionario_id):null,
    inicio:form.inicio||null,fim:form.fim||null,responsavel:form.responsavel||null,
    valor_centavos:Number(form.valor_centavos)||0,
    dados:{observacoes:form.observacoes||'',referencia:form.referencia||'',detalhes:form.detalhes||''}}
   await window.fluxoDre.rh.save(data);setEditing(null);setNotice('Registro salvo na base local.');setVersion(v=>v+1)
  }catch(e:any){setError(e.message||String(e))}finally{setSaving(false)}}
 const remove=async(row:any)=>{if(!window.confirm('Arquivar este registro? O histórico ficará preservado.'))return;setSaving(true);try{await window.fluxoDre.rh.remove({id:row.id,empresa_id:company,revisao:row.revisao});setNotice('Registro arquivado.');setVersion(v=>v+1)}catch(e:any){setError(e.message||String(e))}finally{setSaving(false)}}
 const termination=async(row:any)=>{if(!window.confirm('Confirmar o desligamento deste colaborador e inativar seu cadastro?'))return;setSaving(true);try{await window.fluxoDre.rh.completeTermination({empresa_id:company,id:row.id,confirmacao:true});setNotice('Desligamento registrado e colaborador inativado.');setVersion(v=>v+1)}catch(e:any){setError(e.message||String(e))}finally{setSaving(false)}}
 const close=async()=>{if(!window.confirm('Fechar a folha de '+competenceLabel(competencia)+'? Os lançamentos pendentes devem estar quitados.'))return;setSaving(true);try{await window.fluxoDre.rh.closePayroll({empresa_id:company,competencia});setNotice('Competência fechada com trilha de auditoria.')}catch(e:any){setError(e.message||String(e))}finally{setSaving(false)}}
 const reopen=async()=>{const justificativa=window.prompt('Justificativa para reabrir a competência:');if(justificativa===null)return;setSaving(true);try{await window.fluxoDre.rh.reopenPayroll({empresa_id:company,competencia,justificativa});setNotice('Competência reaberta e auditada.')}catch(e:any){setError(e.message||String(e))}finally{setSaving(false)}}
 return <>
 <PageHeader title="Gestão de pessoas" description="Departamento pessoal, recrutamento e desenvolvimento com dados locais por empresa."
   actions={<Button variant="secondary" icon={<RefreshCw size={15}/>} onClick={()=>setVersion(v=>v+1)}>Atualizar</Button>}/>
 <Card style={{padding:16,marginBottom:14}}>
  <div style={{display:'flex',alignItems:'end',gap:12,flexWrap:'wrap'}}>
   <Field label="Empresa"><select value={empresaId} onChange={e=>update({empresaId:e.target.value})}><option value="">Selecione uma empresa</option>{companies.map(c=><option key={c.id} value={c.id}>{c.nome_fantasia||c.razao_social}</option>)}</select></Field>
   <div style={{marginBottom:6,fontSize:12,color:'var(--muted)'}}>Dados separados por empresa. Nenhum envio a serviços externos.</div>
  </div>
 </Card>
 {company>0&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12,marginBottom:18}}>
  <Kpi label="Colaboradores ativos" value={String(stats?.funcionarios??'—')}/>
  <Kpi label="Ausências no dia" value={String(stats?.ausencias_hoje??'—')}/>
  <Kpi label={KIND_LABELS[kind]||'Registros'} value={String(stats?.registros?.[kind]??0)}/>
  <Kpi label="Competência em uso" value={competenceLabel(competencia)}/>
 </div>}
 <div style={{display:'grid',gridTemplateColumns:'minmax(190px,235px) minmax(0,1fr)',gap:16,alignItems:'start'}}>
  <Card style={{padding:12}}>
   <h2 style={{fontSize:14,margin:'4px 8px 12px'}}>Módulos de RH</h2>
   {GROUPS.map(group=><section key={group.name} style={{marginBottom:16}}>
    <h3 style={{fontSize:11,textTransform:'uppercase',letterSpacing:'.04em',padding:'0 8px',color:'var(--muted)'}}>{group.name}</h3>
    {group.kinds.map(item=><button key={item.id} type="button" onClick={()=>{setKind(item.id);setSearch('');setNotice('')}} aria-current={kind===item.id?'page':undefined}
     style={{display:'block',width:'100%',textAlign:'left',padding:'9px 10px',marginBottom:2,border:0,borderRadius:7,background:kind===item.id?'var(--surface-alt,#e8eef7)':'transparent',fontWeight:kind===item.id?700:400,cursor:'pointer',color:'inherit'}}>{item.label}</button>)}
   </section>)}
  </Card>
  <div style={{minWidth:0}}>
   <Card style={{padding:18}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12,marginBottom:14}}>
     <div><h2 style={{fontSize:19,margin:'0 0 4px'}}>{KIND_LABELS[kind]}</h2><p style={{fontSize:12,margin:0,color:'var(--muted)'}}>{GROUPS.find(g=>g.kinds.some(k=>k.id===kind))?.note}</p></div>
     <Button onClick={openNew} disabled={!company} icon={<Plus size={16}/>}>Novo registro</Button>
    </div>
    <label style={{display:'flex',alignItems:'center',gap:8,border:'1px solid var(--border)',borderRadius:8,padding:'6px 10px',marginBottom:14}}><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar registros..." aria-label="Buscar registros" style={{width:'100%',border:0,background:'transparent'}}/></label>
    {loading?<p>Carregando registros...</p>:!company?<Empty title="Selecione uma empresa" description="Escolha o contexto de trabalho para exibir os registros."/>:!filtered.length?<Empty title="Nenhum registro nesta seção" description="Adicione o primeiro registro ou escolha outro módulo."/>:
     <div style={{display:'grid',gap:8}}>{filtered.map(row=><article key={row.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,padding:12,border:'1px solid var(--border)',borderRadius:8,flexWrap:'wrap'}}>
      <div style={{minWidth:160,flex:1}}><strong style={{display:'block',fontSize:13}}>{row.titulo}</strong><small style={{display:'block',color:'var(--muted)',marginTop:4}}>{companyEmployees.find(e=>e.id===row.funcionario_id)?.nome||'Registro geral'} {row.inicio?' · '+row.inicio:''}{row.fim?' até '+row.fim:''}</small></div>
      <Status value={row.estado}/>
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}><Button variant="secondary" onClick={()=>edit(row)}>Abrir</Button>
       {row.tipo==='desligamento'&&row.estado!=='concluido'&&<Button variant="secondary" disabled={saving} onClick={()=>termination(row)}>Efetivar</Button>}
       <Button variant="ghost" aria-label={'Arquivar '+row.titulo} title="Arquivar" disabled={saving} onClick={()=>remove(row)}><Trash2 size={15}/></Button>
      </div>
     </article>)}</div>}
   </Card>
   {kind==='rubrica'&&<Card style={{padding:14,marginTop:12}}><p style={{margin:0,fontSize:12}}>As rubricas aqui são configurações e registros de conferência. Cálculos fiscais legais e transmissão ao eSocial não estão habilitados.</p><Link to={ROUTES.rhPayroll}>Abrir folha e pagamentos</Link></Card>}
   {['jornada','ajuste_ponto'].includes(kind)&&<Card style={{padding:14,marginTop:12}}><p style={{margin:0,fontSize:12}}>Marcação real, correções e revisão da ficha mensal são feitas na tela de ponto; estes registros preservam o contexto e as justificativas.</p><Link to={ROUTES.rhTime}>Abrir controle de ponto</Link></Card>}
   {company>0&&<Card style={{padding:14,marginTop:12}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><div><h3 style={{fontSize:14,margin:'0 0 4px'}}><ShieldCheck size={16} style={{display:'inline',verticalAlign:'middle'}}/> Controle de fechamento da folha</h3><small>{competenceLabel(competencia)} · Uma fonte canônica de valores por competência</small></div>
     <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Button variant="secondary" onClick={reopen} disabled={saving}>Reabrir com justificativa</Button><Button onClick={close} disabled={saving}><ClipboardCheck size={15}/> Fechar competência</Button></div></div>
   </Card>}
  </div>
 </div>
 {notice&&<p role="status" style={{marginTop:14,color:'var(--success,#15803d)'}}>{notice}</p>}
 {error&&!editing&&<p role="alert" style={{marginTop:14,color:'var(--danger,#b91c1c)'}}>{error}</p>}
 <Modal open={Boolean(editing)} title={(editing?.id?'Editar':'Novo')+' · '+(KIND_LABELS[editing?.tipo]||'Registro')} onClose={()=>setEditing(null)} size="lg">
  <form onSubmit={e=>{e.preventDefault();void save()}}><div className="modal-body">
   {error&&<p role="alert" style={{color:'var(--danger,#b91c1c)'}}>{error}</p>}
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:14}}>
    <Field label="Título" required wide><input required minLength={2} maxLength={160} value={form.titulo} onChange={e=>field('titulo',e.target.value)} placeholder="Descrição curta do registro"/></Field>
    <Field label="Situação"><select value={form.estado} onChange={e=>field('estado',e.target.value)}>{STATES.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></Field>
    <Field label="Colaborador"><select disabled={Boolean(editing?.id)} value={form.funcionario_id} onChange={e=>field('funcionario_id',e.target.value)}><option value="">Sem vínculo direto</option>{companyEmployees.map(person=><option key={person.id} value={person.id}>{person.nome}</option>)}</select></Field>
    <Field label="Início / data"><input type="date" value={form.inicio} onChange={e=>field('inicio',e.target.value)}/></Field>
    <Field label="Fim / prazo"><input type="date" value={form.fim} onChange={e=>field('fim',e.target.value)}/></Field>
    <Field label="Responsável"><input value={form.responsavel} maxLength={160} onChange={e=>field('responsavel',e.target.value)}/></Field>
    <Field label="Valor de referência (R$)"><input inputMode="numeric" type="number" step="0.01" min="0" value={form.valor_centavos===''?'':Number(form.valor_centavos)/100} onChange={e=>field('valor_centavos',String(Math.round(Math.max(0,Number(e.target.value)||0)*100)))}/></Field>
    <Field label="Referência / período aquisitivo" wide><input value={form.referencia} onChange={e=>field('referencia',e.target.value)} placeholder="Ex.: 01/07/2026 a 30/06/2027"/></Field>
    <Field label="Etapas e detalhes" wide><textarea rows={3} value={form.detalhes} onChange={e=>field('detalhes',e.target.value)} placeholder="Critérios, etapas, pendências e responsáveis"/></Field>
    <Field label="Observações" wide><textarea rows={3} value={form.observacoes} onChange={e=>field('observacoes',e.target.value)} placeholder="Orientações internas e justificativas"/></Field>
   </div>
   {editing?.tipo==='desligamento'&&<p style={{fontSize:12}}>Salvar este registro não desativa o colaborador. Use "Efetivar" após concluir a conferência e informar a data final.</p>}
   {editing?.tipo==='ferias'&&<p style={{fontSize:12}}>Férias aprovadas exigem funcionário, data de início e fim, sem sobreposição com outros períodos aprovados.</p>}
  </div><FormActions onCancel={()=>setEditing(null)} loading={saving}/></form>
 </Modal>
 </>}
