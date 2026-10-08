import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
const read=(file:string)=>readFileSync(join(process.cwd(),file),'utf8')
describe('RH Total standalone contracts',()=>{
  it('uses unique database without loading Cloudflare authentication or legacy updater',()=>{
    const main=read('electron/main.cjs')
    const database=read('electron/services/database.cjs')
    expect(main).not.toMatch(/online-service|electron-updater|cloud-authority/i)
    expect(database).toContain('rh-total.sqlite')
  })
  it('keeps the RH modules and omits construction UI',()=>{
    const app=read('src/App.tsx')
    for(const page of ['EmployeesPage','EmployeeRegistrationPage','CompensationPage','PayrollPage','TimeSheetPage','HrTemplatesPage'])expect(app).toContain(page)
    expect(app).not.toMatch(/WorksPage|DailyReportPage|ProcurementPage|MeasurementsPage/)
  })
  it('retains original automatic filling, batch generation and synthetic-point disclaimer',()=>{
    const service=read('electron/services/time-service.cjs')
    expect(service).toContain('autoFill(payload)')
    expect(service).toContain('generateForAll(payload)')
    expect(service).toContain('Pré-preenchimento automatizado')
  })
})
