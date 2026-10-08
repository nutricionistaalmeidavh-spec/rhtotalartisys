function minutes(value){
 const s=String(value||'')
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(s))return null
 const [h,m]=s.split(':').map(Number)
 return h*60+m
}
function duration(start,end){
 const a=minutes(start),b=minutes(end)
 return a===null||b===null||b<a?null:b-a
}
function monthWorkSummary(marks=[],schedule={}){
 const expectedMorning=duration(schedule.jornada_inicio,schedule.intervalo_inicio)
 const expectedAfternoon=duration(schedule.intervalo_fim,schedule.jornada_fim)
 const expected=expectedMorning===null||expectedAfternoon===null?null:expectedMorning+expectedAfternoon
 const report={minutos_trabalhados:0,minutos_previstos:0,minutos_extras:0,minutos_deficit:0,saldo_minutos:0,ausencias:0,dias_trabalhados:0,pendencias:[],dias:[]}
 for(const row of marks){
  if(row.tipo!=='trabalho'){if(['falta','ferias','afastado'].includes(row.tipo))report.ausencias++;continue}
  const morning=duration(row.entrada,row.intervalo_saida)
  const afternoon=duration(row.intervalo_entrada,row.saida)
  if(expected===null||morning===null||afternoon===null||minutes(row.intervalo_saida)>minutes(row.intervalo_entrada)){
   report.pendencias.push(String(row.data));continue
  }
  const actual=morning+afternoon
  const extra=Math.max(0,actual-expected),deficit=Math.max(0,expected-actual)
  report.minutos_trabalhados+=actual
  report.minutos_previstos+=expected
  report.minutos_extras+=extra
  report.minutos_deficit+=deficit
  report.dias_trabalhados++
  report.dias.push({data:row.data,trabalhado_minutos:actual,previsto_minutos:expected,extra_minutos:extra,deficit_minutos:deficit})
 }
 report.saldo_minutos=report.minutos_trabalhados-report.minutos_previstos
 return report
}
module.exports={minutes,duration,monthWorkSummary}
