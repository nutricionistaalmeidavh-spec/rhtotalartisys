import {describe,it,expect} from 'vitest'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const {monthWorkSummary}=require('./work-hours.cjs')
const schedule={jornada_inicio:'08:00',intervalo_inicio:'12:00',intervalo_fim:'13:00',jornada_fim:'17:00'}
describe('P2 apuracao local de jornada',()=>{
 it('desconta intervalo e soma excedentes e faltas sem calculo fiscal',()=>{
  const result=monthWorkSummary([
    {data:'2026-10-05',tipo:'trabalho',entrada:'08:00',intervalo_saida:'12:00',intervalo_entrada:'13:00',saida:'18:00'},
    {data:'2026-10-06',tipo:'trabalho',entrada:'08:00',intervalo_saida:'12:00',intervalo_entrada:'13:00',saida:'16:30'}
  ],schedule)
  expect(result.minutos_trabalhados).toBe(16*60+30)
  expect(result.minutos_previstos).toBe(16*60)
  expect(result.minutos_extras).toBe(60)
  expect(result.minutos_deficit).toBe(30)
  expect(result.saldo_minutos).toBe(30)
  expect(result.pendencias).toHaveLength(0)
 })
 it('nao transforma afastamento em falta e sinaliza marcações incompletas',()=>{
  const result=monthWorkSummary([
   {data:'2026-10-07',tipo:'afastado'},
   {data:'2026-10-08',tipo:'trabalho',entrada:'08:00',saida:'17:00'}
  ],schedule)
  expect(result.minutos_previstos).toBe(0)
  expect(result.pendencias).toContain('2026-10-08')
  expect(result.ausencias).toBe(1)
 })
})
