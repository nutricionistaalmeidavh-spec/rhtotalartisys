import { useEffect, useState } from 'react'
import { ArchiveRestore, DatabaseBackup, LockKeyhole, Network, ShieldCheck, UserPlus } from 'lucide-react'
import { Button, Card, Empty, Field, PageHeader, Status } from '../components/ui'
import { useWorkContext } from '../hooks/useWorkContext'
type AccountInput={usuario:string;nome:string;senha:string;perfil:string;empresa_id:string;funcionario_id:string}
const defaults:AccountInput={usuario:'',nome:'',senha:'',perfil:'rh',empresa_id:'',funcionario_id:''}
export default function RhAccessPage(){
 const {empresaId}=useWorkContext()
 const [accounts,setAccounts]=useState<any[]>([])
 const [backups,setBackups]=useState<any[]>([])
 const [companies,setCompanies]=useState<any[]>([])
 const [employees,setEmployees]=useState<any[]>([])
 const [host,setHost]=useState('127.0.0.1')
 const [port,setPort]=useState('8765')
 const [cert,setCert]=useState('')
 const [key,setKey]=useState('')
 const [server,setServer]=useState<any>({running:false})
 const [form,setForm]=useState<AccountInput>({...defaults})
 const [busy,setBusy]=useState(false)
 const [notice,setNotice]=useState('')
 const [error,setError]=useState('')
 const refresh=async()=>{
  const [users,copies,companiesList,people,hostStatus]=await Promise.all([
   window.fluxoDre.access.accounts(),window.fluxoDre.backup.list(),window.fluxoDre.empresas.list(),
   window.fluxoDre.funcionarios.list(),window.fluxoDre.access.lanStatus()])
  setAccounts(users);setBackups(copies);setCompanies(companiesList);setEmployees(people);setServer(hostStatus)
 }
 useEffect(()=>{void refresh().catch(e=>setError(e.message||String(e)))},[])
 const act=async(fn:()=>Promise<any>,message:string)=>{setBusy(true);setError('');setNotice('');try{const result=await fn();setNotice(message);await refresh();return result}catch(e:any){setError(e.message||String(e));return null}finally{setBusy(false)}}
 const create=async(event:React.FormEvent)=>{event.preventDefault();const payload={...form,empresa_id:form.empresa_id?Number(form.empresa_id):null,funcionario_id:form.funcionario_id?Number(form.funcionario_id):null}
  const response=await act(()=>window.fluxoDre.access.create(payload),'Conta local criada; compartilhe as credenciais por um canal seguro.')
  if(response)setForm({...defaults,empresa_id:empresaId||''})
 }
 const start=async()=>{const response=await act(()=>window.fluxoDre.access.startLan({host,port:Number(port),tlsKey:key||undefined,tlsCert:cert||undefined}),'Servidor inicializado manualmente.')
  if(response)setServer(response)
 }
 const createBackup=async()=>{const result=await act(()=>window.fluxoDre.backup.create(),'Backup SQLite criado e verificado.');if(result)setNotice('Backup verificado: '+result.path)}
 const restore=async(copy:any)=>{if(!window.confirm('Restaurar este backup? Todos os dados posteriores serão substituídos. Uma cópia do estado atual será criada automaticamente.'))return
  const result=await act(()=>window.fluxoDre.backup.restore({path:copy.path,confirm:true}),'Backup restaurado e verificado. Reinicie as telas para atualizar os dados.')
  if(result)setNotice('Restauração concluída. Cópia anterior preservada em '+result.previous_snapshot)
 }
 return <>
  <PageHeader title="Acesso local e backup" description="Autenticação opcional do servidor local, permissões por empresa e proteção do banco SQLite."/>
  {notice&&<p role="status" style={{color:'var(--success,#15803d)'}}>{notice}</p>}
  {error&&<p role="alert" style={{color:'var(--danger,#b91c1c)'}}>{error}</p>}
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(330px,1fr))',gap:16}}>
   <Card style={{padding:18}}>
    <h2 style={{display:'flex',alignItems:'center',gap:8,fontSize:17}}><UserPlus size={18}/> Contas locais</h2>
    <p style={{fontSize:12}}>A primeira conta deve ser administradora. Depois, crie perfis separados para RH, gestor, contador e colaborador. Nenhuma conta em nuvem é exigida.</p>
    <form onSubmit={create} style={{display:'grid',gap:12}}>
     <Field label="Usuário" required><input required minLength={3} maxLength={64} autoComplete="off" value={form.usuario} onChange={e=>setForm(v=>({...v,usuario:e.target.value}))}/></Field>
     <Field label="Nome" required><input required value={form.nome} onChange={e=>setForm(v=>({...v,nome:e.target.value}))}/></Field>
     <Field label="Senha local (mínimo 12 caracteres)" required><input required type="password" autoComplete="new-password" minLength={12} value={form.senha} onChange={e=>setForm(v=>({...v,senha:e.target.value}))}/></Field>
     <Field label="Perfil"><select value={form.perfil} onChange={e=>setForm(v=>({...v,perfil:e.target.value}))}>{[['admin','Administrador'],['rh','RH'],['gestor','Gestor'],['contador','Contador'],['colaborador','Colaborador']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field>
     <Field label="Empresa"><select value={form.empresa_id} onChange={e=>setForm(v=>({...v,empresa_id:e.target.value}))}><option value="">Administrador global (somente perfil admin)</option>{companies.map(c=><option key={c.id} value={c.id}>{c.nome_fantasia||c.razao_social}</option>)}</select></Field>
     {form.perfil==='colaborador'&&<Field label="Funcionário vinculado" required><select required value={form.funcionario_id} onChange={e=>setForm(v=>({...v,funcionario_id:e.target.value}))}><option value="">Selecione</option>{employees.filter(e=>Number(e.empresa_id)===Number(form.empresa_id)).map(e=><option key={e.id} value={e.id}>{e.nome}</option>)}</select></Field>}
     <Button type="submit" disabled={busy}>Criar conta local</Button>
    </form>
    <h3 style={{fontSize:13,marginTop:20}}>Contas cadastradas ({accounts.length})</h3>
    {accounts.length===0?<Empty title="Sem contas" description="Crie a primeira conta de administrador para habilitar o servidor."/>:<div style={{display:'grid',gap:6}}>{accounts.map(u=><div key={u.id} style={{display:'flex',gap:10,justifyContent:'space-between',borderBottom:'1px solid var(--border)',padding:'7px 0',fontSize:12}}><span><strong>{u.nome}</strong> · @{u.usuario}<small style={{display:'block'}}>{companies.find(c=>c.id===u.empresa_id)?.razao_social||'Global'} · {u.perfil}</small></span><Status value={u.ativo?'ativo':'inativo'}/></div>)}</div>}
   </Card>
   <div style={{display:'grid',gap:16,alignContent:'start'}}>
    <Card style={{padding:18}}>
     <h2 style={{display:'flex',alignItems:'center',gap:8,fontSize:17}}><Network size={18}/> Servidor RH local (opcional)</h2>
     <p style={{fontSize:12}}>O desktop continua operando offline. O servidor começa desligado e exige contas locais. Para acesso por outros computadores é obrigatório informar certificados TLS válidos e proteger a rede.</p>
     <div style={{display:'grid',gridTemplateColumns:'1fr 100px',gap:10,marginBottom:10}}>
      <Field label="Endereço de escuta"><select value={host} onChange={e=>setHost(e.target.value)}><option value="127.0.0.1">Apenas este PC</option><option value="0.0.0.0">Rede LAN com TLS</option></select></Field>
      <Field label="Porta"><input type="number" min={1024} max={65535} value={port} onChange={e=>setPort(e.target.value)}/></Field>
     </div>
     {host==='0.0.0.0'&&<div style={{display:'grid',gap:10,marginBottom:10}}>
      <Field label="Caminho completo do certificado TLS"><input value={cert} onChange={e=>setCert(e.target.value)} placeholder="Certificado .pem"/></Field>
      <Field label="Caminho completo da chave privada TLS"><input type="password" value={key} onChange={e=>setKey(e.target.value)} placeholder="Arquivo de chave .pem"/></Field>
      <small>Os arquivos continuam no computador. Não envie certificados ou chaves ao GitHub.</small>
     </div>}
     <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}><Status value={server.running?'ativo':'inativo'}/>{server.running?<Button variant="secondary" disabled={busy} onClick={()=>{void act(()=>window.fluxoDre.access.stopLan(),'Servidor local parado.')}}>Desligar servidor</Button>:<Button disabled={busy||accounts.length===0||host==='0.0.0.0'&&(!cert||!key)} onClick={start}><LockKeyhole size={16}/> Iniciar servidor</Button>}</div>
     {server.url&&<small style={{display:'block',marginTop:8}}>Endereço local: {server.url}</small>}
    </Card>
    <Card style={{padding:18}}>
     <h2 style={{display:'flex',alignItems:'center',gap:8,fontSize:17}}><DatabaseBackup size={18}/> Backups SQLite</h2>
     <p style={{fontSize:12}}>Os instantâneos usam a API de backup transacional do SQLite. A restauração confere integridade, exige confirmação e preserva uma cópia do banco substituído.</p>
     <Button onClick={createBackup} disabled={busy} icon={<DatabaseBackup size={16}/>}>Criar e verificar backup</Button>
     {backups.length===0?<p style={{fontSize:12}}>Nenhum backup manual nesta pasta.</p>:<div style={{display:'grid',gap:8,marginTop:12}}>{backups.slice(0,12).map(copy=><div key={copy.path} style={{padding:10,border:'1px solid var(--border)',borderRadius:8,display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'}}><div><strong style={{fontSize:12}}>{copy.name}</strong><small style={{display:'block'}}>{new Date(copy.created_at).toLocaleString('pt-BR')} · {(copy.size/1024/1024).toFixed(1)} MB</small></div><Button variant="secondary" disabled={busy||server.running} onClick={()=>{void restore(copy)}} icon={<ArchiveRestore size={15}/>}>Restaurar</Button></div>)}</div>}
    </Card>
   </div>
  </div>
  <p style={{fontSize:12,marginTop:14}}><ShieldCheck size={14} style={{display:'inline',verticalAlign:'middle'}}/> Segurança: servidor sem nuvem obrigatória. O tráfego fora do computador exige HTTPS; somente usuários autorizados podem consultar dados da empresa.</p>
 </>}
