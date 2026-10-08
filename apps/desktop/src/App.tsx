import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { Building2, CalendarClock, FileArchive, ReceiptText, UsersRound, WalletCards } from 'lucide-react'
import { WorkContextProvider } from './hooks/useWorkContext'
import { ROUTES } from './routes/registry'
import RhHubPage from './pages/RhHubPage'
import EmployeesPage from './pages/EmployeesPage'
import EmployeeRegistrationPage from './pages/EmployeeRegistrationPage'
import CompensationPage from './pages/CompensationPage'
import PayrollPage from './pages/PayrollPage'
import TimeSheetPage from './pages/TimeSheetPage'
import HrTemplatesPage from './pages/HrTemplatesPage'
import CompaniesPage from './pages/CompaniesPage'

const links=[
  {to:ROUTES.rh,icon:UsersRound,label:'Visão geral'},
  {to:ROUTES.rhEmployees,icon:UsersRound,label:'Funcionários'},
  {to:ROUTES.rhAdmissions,icon:UsersRound,label:'Admissões'},
  {to:ROUTES.rhCompensation,icon:WalletCards,label:'Remuneração'},
  {to:ROUTES.rhPayroll,icon:ReceiptText,label:'Folha'},
  {to:ROUTES.rhTime,icon:CalendarClock,label:'Ponto'},
  {to:ROUTES.rhTemplates,icon:FileArchive,label:'Modelos'},
  {to:ROUTES.companies,icon:Building2,label:'Empresas'}
]
export default function App(){
  return <WorkContextProvider>
    <div className="rh-total-shell">
      <header className="rh-total-topbar">
        <NavLink className="rh-total-brand" to={ROUTES.rh}>RH Total <span>ArtiSys</span></NavLink>
        <nav aria-label="Navegação do RH">{links.map(({to,icon:Icon,label})=><NavLink key={to} end to={to} className={({isActive})=>'rh-total-nav'+(isActive?' active':'')}><Icon size={16}/>{label}</NavLink>)}</nav>
      </header>
      <main className="rh-total-main">
        <Routes>
          <Route path="/" element={<Navigate to={ROUTES.rh} replace/>}/>
          <Route path={ROUTES.rh} element={<RhHubPage/>}/>
          <Route path={ROUTES.rhEmployees} element={<EmployeesPage/>}/>
          <Route path={ROUTES.rhAdmissions} element={<EmployeeRegistrationPage/>}/>
          <Route path={ROUTES.rhCompensation} element={<CompensationPage/>}/>
          <Route path={ROUTES.rhPayroll} element={<PayrollPage/>}/>
          <Route path={ROUTES.rhTime} element={<TimeSheetPage/>}/>
          <Route path={ROUTES.rhTemplates} element={<HrTemplatesPage/>}/>
          <Route path={ROUTES.companies} element={<CompaniesPage/>}/>
          <Route path={ROUTES.finance} element={<Navigate to={ROUTES.rhPayroll} replace/>}/>
          <Route path={ROUTES.dre} element={<Navigate to={ROUTES.rhPayroll} replace/>}/>
          <Route path="*" element={<Navigate to={ROUTES.rh} replace/>}/>
        </Routes>
      </main>
    </div>
  </WorkContextProvider>
}
