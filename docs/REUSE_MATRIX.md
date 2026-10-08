# Inventário e contrato de extração — RH Total ArtiSys

Fonte canônica: `nutricionistaalmeidavh-spec/OBRANAMAOCOMERCIAL`, commit `99bd3da6c8c56e237a27ed84a5b12f5786076bd3`.
Destino: `nutricionistaalmeidavh-spec/rhtotalartisys`, branch `feat/rh-core-extraction`.

## Regra principal
Copiar implementações existentes e seus testes. Não reinventar geração de ponto, folha, planilhas ou documentos. Não alterar o repositório de origem. Não exigir Cloudflare, autenticação externa ou infraestrutura paga para operar localmente.

## Matriz de reutilização
| Funcionalidade | Origem | Destino | Estratégia |
|---|---|---|---|
| Dados canônicos e importador de folha | packages/domain-core/index.cjs | packages/domain-core/index.cjs | Copiar com testes; extração pura posterior |
| Cadastro de funcionários | apps/desktop/src/pages/EmployeesPage.tsx | mesmo caminho | Copiar |
| Admissões | apps/desktop/src/pages/EmployeeRegistrationPage.tsx | mesmo caminho | Copiar |
| Cargos e benefícios | apps/desktop/src/pages/CompensationPage.tsx e catalog-service.cjs | mesmos caminhos | Copiar |
| Ponto e variação determinística | apps/desktop/src/pages/TimeSheetPage.tsx e time-service.cjs | mesmos caminhos | Copiar e sinalizar pré-preenchimento |
| Folha e visão geral | apps/desktop/src/pages/PayrollPage.tsx e payroll-service.cjs | mesmos caminhos | Copiar |
| Importação/undo | PayrollImportModal.tsx e payroll-import-file-service.cjs | mesmos caminhos | Copiar |
| Exportação Excel/PDF | payroll-export-service.cjs | mesmo caminho | Copiar |
| Documentos admissionais, políticas e modelos | document-service.cjs, admission-*, commercial-admission-templates.cjs | mesmos caminhos | Copiar |
| SQLite local | database.cjs + migrations/001..017 | mesmos caminhos | Copiar esquema inicial integral para preservar compatibilidade; podar dependências residuais depois |
| Shell, identidade e configurações de atualização | App.tsx, electron/main.cjs, preload.cjs | mesmos caminhos | Substituir por aplicativo próprio de RH |
| LAN/Cloud do Obra na Mão | apps/lan-server e online-service.cjs | — | NÃO copiar em F1–F4. F5 demanda identidade e ACL self-hosted auditadas |
| Obras, RDO, contratos, compras | módulos da construção civil | — | NÃO copiar interfaces. Tabelas legadas mantidas temporariamente por dependências canônicas de folha |

## Critérios de aceite
- F0: inventário e origem registrados.
- F1: Electron + React + banco persistente independentes, sem Cloudflare obrigatório.
- F2: funcionários, admissão, remuneração e documentos operacionais.
- F3: ponto preserva autoFill, revisão, PDF, impressão e lote; dados sintéticos são rotulados.
- F4: folha, importação e exportação usam as mesmas fontes canônicas.
- F5: servidor LAN self-hosted, autenticação, isolamento por empresa, migrações e backups testados; não afirmar pronto até os testes.
- F6: QA real, testes e instaladores Windows/macOS verificados; não afirmar pronto sem artefatos.

## Restrições de migração
- Os horários do autoFill são pré-preenchimento sintético e não registro factual de jornada. Exigir revisão humana antes de uso trabalhista.
- O importador da folha é fonte canônica; nunca gerar segunda tabela de saldo.
- Não ativar updater do produto antigo, não copiar secrets, não reutilizar appId, pasta de dados ou publicação do Obra na Mão.
- Banco original mantém algumas tabelas de obras para não quebrar migrações e cálculos preexistentes; eliminar só mediante teste de equivalência.
