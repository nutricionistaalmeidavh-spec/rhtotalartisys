# Contrato de experiência RH Total

## Canonical UI Map
| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Select/Listbox | Field + select nativo | ui.tsx e APIs existentes | seletor de empresa, cargo e funcionário | e2e/rh.spec.ts |
| Date | Field + input nativo | useWorkContext e serviços RH | date, month, time; popup do SO | e2e/rh.spec.ts |
| Form | Form + Field | validação de domínio e serviço SQLite | cadastro, edição | testes de serviço e e2e |
| Scrollbar | theme.css | DESIGN.md | tabelas com rolagem própria | teste visual compacto |
| Toast | Notice e mensagens inline | resultado real de IPC | status, alerta | falha e recuperação e2e |
| CRUD | rotas registry + serviços IPC | main.cjs e services | cadastro separado de emissão | e2e/rh.spec.ts |

## Comportamento
Cadastros preservam rascunhos. Pagamento confirma objeto, data, método e valor e impede duplicação. Documentos pendentes após pagamento não desfazem o registro. Ponto simulado pede confirmação antes de substituir marcações. Nenhuma alteração visual modifica essas regras.

Navegação usa links; operações usam botões. A fila encaminha à tela responsável pelo objeto. Busca local é imediata e sua limpeza devolve foco. Estados de falha mantêm conteúdo e acesso a retry. Modais compartilham foco, Escape e retorno ao controle original.

## Limites mantidos
Select e calendário continuam nativos, com popup e locale do sistema operacional. Form valida os campos, anuncia o erro e direciona o foco antes do envio ao serviço. Confirmações nativas em cadastro/ponto permanecem como débito anterior. Tabelas locais existentes continuam com renderização completa; o redesign não adiciona paginação sem alterar o contrato de consulta.

## Fontes de negócio
README.md, docs/REUSE_MATRIX.md, electron/services/payroll-service.cjs e e2e/rh.spec.ts. Identidade e composição: DESIGN.md.
