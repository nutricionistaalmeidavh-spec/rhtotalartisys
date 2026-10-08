import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAsync } from '../hooks/useAsync'
import { Button, Card, Empty, ErrorState, Field, Loading, PageHeader, Status } from '../components/ui'
import { brDate } from '../utils/format'
export default function DocumentsPage(){
 const [params]=useSearchParams(),[employee,setEmployee]=useState(params.get('funcionario')||''),[message,setMessage]=useState('')
 const employees=useAsync(()=>window.fluxoDre.funcionarios.list(),[])
 const documents=useAsync(()=>window.fluxoDre.documentos.list(employee?{funcionario_id:Number(employee)}:{}),[employee])
 const files=useAsync(()=>window.fluxoDre.arquivos.list(),[])
 const open=async(id:number)=>{try{const file=files.data?.find(x=>x.id===id);if(!file?.caminho)throw Error('Arquivo não encontrado. Gere novamente os documentos deste funcionário.');await window.fluxoDre.documentos.open(file.caminho)}catch(e:any){setMessage(e.message)}}
 const failed=[documents,employees,files].find(x=>x.error);if(failed?.error)return <ErrorState error={failed.error} retry={failed.reload}/>
 return <><PageHeader title="Documentos dos funcionários" description="Consulte os documentos gerados, confira o status e abra o arquivo." actions={<Link className="button button-secondary" to="/rh/modelos">Configurar modelos</Link>}/><Card><Field label="Funcionário"><select value={employee} onChange={e=>setEmployee(e.target.value)}><option value="">Todos</option>{employees.data?.map(x=><option key={x.id} value={x.id}>{x.nome}</option>)}</select></Field></Card>{message&&<p role="alert">{message}</p>}<Card>{documents.loading?<Loading/>:documents.data?.length?<div className="table-wrap"><table className="data-table"><thead><tr><th>Documento</th><th>Funcionário</th><th>Gerado em</th><th>Status</th><th>Ação</th></tr></thead><tbody>{documents.data.map(x=><tr key={x.id}><td>{x.titulo}</td><td>{employees.data?.find(e=>e.id===x.funcionario_id)?.nome||'—'}</td><td>{brDate(x.created_at)}</td><td><Status value={x.status_assinatura}/></td><td><Button variant="secondary" onClick={()=>open(x.arquivo_id)}>Abrir documento</Button></td></tr>)}</tbody></table></div>:<Empty title="Nenhum documento gerado" description="Selecione um funcionário ou gere o dossiê na admissão." action={<Link className="button button-primary" to={employee?`/rh/admissoes?id=${employee}&step=4`:'/rh/admissoes'}>Gerar documentos</Link>}/>}</Card></>
}
