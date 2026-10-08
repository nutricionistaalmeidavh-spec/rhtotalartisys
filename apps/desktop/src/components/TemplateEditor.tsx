import { useEffect, useRef } from 'react'
function editableBody(html:string){
 const doc=new DOMParser().parseFromString(html,'text/html')
 const allowed=new Set(['P','DIV','SPAN','B','STRONG','I','EM','U','BR','H1','H2','H3','H4','UL','OL','LI','TABLE','THEAD','TBODY','TR','TD','TH','BLOCKQUOTE','PRE','CAPTION'])
 doc.body.querySelectorAll('*').forEach(el=>{if(!allowed.has(el.tagName)){el.remove();return}for(const attr of Array.from(el.attributes))if(!['colspan','rowspan'].includes(attr.name))el.removeAttribute(attr.name)})
 return doc.body.innerHTML
}
export default function TemplateEditor({value,onChange}:{value:string;onChange:(html:string)=>void}){
 const ref=useRef<HTMLDivElement>(null),last=useRef('')
 useEffect(()=>{if(ref.current&&value!==last.current){ref.current.innerHTML=editableBody(value);last.current=value}},[value])
 const update=()=>{if(!ref.current)return;const body=editableBody(ref.current.innerHTML);const result=/<body\b[^>]*>/i.test(value)?value.replace(/(<body\b[^>]*>)[\s\S]*?(<\/body>)/i,(_,start,end)=>start+body+end):body;last.current=result;onChange(result)}
 const insert=(text:string)=>{ref.current?.focus();const selection=window.getSelection();if(selection?.rangeCount&&ref.current?.contains(selection.anchorNode)){const range=selection.getRangeAt(0);range.deleteContents();const node=document.createTextNode(text);range.insertNode(node);range.setStartAfter(node);range.collapse(true);selection.removeAllRanges();selection.addRange(range)}else ref.current?.append(document.createTextNode(text));update()}
 return <div className="field-wide"><div className="toolbar"><label>Inserir dado do funcionário <select aria-label="Inserir dado do funcionário" value="" onChange={e=>{if(e.target.value)insert('{{'+e.target.value+'}}')}}><option value="">Escolha um campo</option>{[['nome_funcionario','Nome'],['cpf','CPF'],['empresa','Empresa'],['cnpj','CNPJ'],['cargo','Cargo'],['salario','Salário'],['admissao','Admissão'],['data_hoje','Data de hoje']].map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></div><div ref={ref} className="template-visual-editor" role="textbox" aria-label="Texto do documento" aria-multiline="true" contentEditable suppressContentEditableWarning onInput={update} onPaste={e=>{e.preventDefault();insert(e.clipboardData.getData('text/plain'))}}/><small>Edite o texto e insira os dados que serão preenchidos para cada funcionário.</small></div>
}
