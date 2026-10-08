import { Form } from '../components/ui'
import { FormEvent, useState } from 'react'
import { Building2, Plus } from 'lucide-react'
import { ErrorState, Button, Card, Field, PageHeader, Modal, FormActions, Loading, Empty } from '../components/ui'
import { useAsync } from '../hooks/useAsync'

export default function CompaniesPage(){
  const companies=useAsync(()=>window.fluxoDre.empresas.list(),[])
  const [form,setForm]=useState<any>(null)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const save=async(event:FormEvent)=>{
    event.preventDefault();setBusy(true);setMessage('')
    try{await window.fluxoDre.empresas.save({...form,razao_social:String(form.razao_social||'').trim()});setForm(null);await companies.reload();setMessage('Empresa salva.')}
    catch(e:any){setMessage(e?.message||String(e))}finally{setBusy(false)}
  }
  if(companies.error)return <ErrorState error={companies.error} retry={companies.reload}/>
  return <>
    <PageHeader title="Empresas" description="Cadastre as empresas cujos colaboradores serão gerenciados." actions={<Button icon={<Plus size={16}/>} onClick={()=>setForm({razao_social:'',nome_fantasia:'',cnpj:''})}>Nova empresa</Button>}/>
    {message&&<p role="status">{message}</p>}
    {companies.loading?<Loading label="Carregando empresas..."/>:companies.data?.length?<div className="rh-total-companies">{companies.data.map((company:any)=><Card key={company.id}>
      <div className="rh-total-company"><Building2 size={22}/><div><strong>{company.nome_fantasia||company.razao_social}</strong><small>{company.razao_social} · CNPJ {company.cnpj||'não informado'}</small></div><Button variant="secondary" onClick={()=>setForm(company)}>Editar</Button></div>
    </Card>)}</div>:<Card><Empty title="Nenhuma empresa cadastrada" description="Cadastre uma empresa para iniciar os registros do RH."/></Card>}
    <Modal open={!!form} title={form?.id?'Editar empresa':'Nova empresa'} onClose={()=>setForm(null)}>
      {form&&<Form noValidate onSubmit={save}><div className="modal-body form-grid">
        <Field label="Razão social" required><input required value={form.razao_social||''} onChange={e=>setForm({...form,razao_social:e.target.value})}/></Field>
        <Field label="Nome fantasia"><input value={form.nome_fantasia||''} onChange={e=>setForm({...form,nome_fantasia:e.target.value})}/></Field>
        <Field label="CNPJ"><input value={form.cnpj||''} onChange={e=>setForm({...form,cnpj:e.target.value})}/></Field>
      </div>{message&&<p role="alert">{message}</p>}<FormActions loading={busy} onCancel={()=>setForm(null)} submitLabel={busy?'Salvando...':'Salvar empresa'}/></Form>}
    </Modal>
  </>
}
