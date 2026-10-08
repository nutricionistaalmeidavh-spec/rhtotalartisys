import { ArrowUpRight, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from './ui'

// Adapted from frontEnds/shells/product-runtime/primitives.tsx (WorkQueue).
// Navigation stays with the RH router; no business state is duplicated here.
export function WorkQueue({items}:{items:Array<{id:string;title:string;description:string;to:string;action:string}>}){
 return <Card className="rh-work-queue"><div className="rh-panel-heading"><div><h2>O que precisa de atenção</h2><p>Continue de onde o trabalho está pendente.</p></div></div>
 {items.length?<div className="rh-queue-items">{items.map(item=><Link key={item.id} to={item.to} className="rh-queue-item"><span><strong>{item.title}</strong><small>{item.description}</small></span><span className="rh-queue-action">{item.action}<ArrowUpRight size={16}/></span></Link>)}</div>:<div className="rh-queue-clear"><CheckCircle2 size={23}/><div><strong>Nenhuma pendência encontrada</strong><p>Os pagamentos e cadastros consultados não precisam de revisão.</p></div></div>}
 </Card>
}
