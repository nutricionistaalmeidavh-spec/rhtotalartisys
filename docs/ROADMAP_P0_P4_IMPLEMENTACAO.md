# RH Total ArtiSys — Execução P0–P4

Branch: `feat/rh-total-p0-p4`. Não realizar merge sem QA e revisão.

## Restrições
- Núcleo R$ 0, local-first, self-hosted, open source; nenhum serviço pago obrigatório.
- Não integrar eSocial, bancos, serviços fiscais, APIs governamentais ou assinatura externa nesta entrega.
- Preservar SQLite canônico, compatibilidade de migrações e dados de instalações existentes.
- Não modificar secrets nem publicar releases/atualizações automáticas.
- Não copiar código de concorrentes sem verificar licença.
- Desenvolver cada comportamento por TDD (teste falha → implementação → teste passa).
- QA via GitHub Actions por workflow_dispatch/PR, sem execução a cada push.

## P0 — Segurança e consistência do núcleo
- [ ] Separar rascunho de ponto sintético de marcação real, com aprovação humana auditada e bloqueio da geração documental sem revisão.
- [ ] Eliminar gravações em operações de consulta de folha; criar comando explícito de inicialização/sincronização e garantir idempotência.
- [ ] Persistir snapshots históricos de salário, benefícios e rubricas por competência, com bloqueio de período encerrado.
- [ ] Implementar papéis RH, administrador, gestor, contador e colaborador com autorização no serviço, não só na UI.
- [ ] Corrigir botões inertes, rotas financeiras e contratos preload/IPC herdados.
- [ ] Backup/restauração íntegros e testados, proteção de dados pessoais, trilha de auditoria.
- [ ] Testes de isolamento multiempresa e invariantes de valores entre folha, visão geral e financeiro.

## P1 — Ciclo completo de DP
- [ ] Férias: período aquisitivo/concessivo, saldo, agendamento, aprovação, recibo e reflexo financeiro.
- [ ] Afastamentos: motivo, datas, anexos, aprovação, retorno e impacto no ponto/folha.
- [ ] Histórico contratual: admissões, cargos, salários e alterações com vigência.
- [ ] Desligamento: checklist, aviso, cálculos parametrizados locais, documentos e encerramento de acesso.
- [ ] Checklists, vencimentos, responsáveis e alertas internos; sem serviço externo.

## P2 — Folha e jornada
- [ ] Rubricas parametrizáveis e versionadas, cálculo demonstrativo e conferência; não anunciar conformidade fiscal automática.
- [ ] Jornada real: registros, correções justificadas, aprovação, escalas, horas extras e banco de horas.
- [ ] Fechamento e reabertura controlada por competência com auditoria e testes.
- [ ] Documentos e relatórios gerados somente de valores e registros aprovados.

## P3 — LAN self-hosted
- [ ] Servidor local opcional sem Cloudflare, com autenticação local, sessões e RBAC.
- [ ] Concorrência, transações, revisões, conflitos e sincronização segura sem fontes de verdade paralelas.
- [ ] Acesso de RH, gestor e colaborador por permissões e empresa.
- [ ] Backup/restore, recuperação de rede e migração testados.
- [ ] Desktop continua funcional offline sem servidor LAN.

## P4 — RH estratégico
- [ ] Recrutamento: vagas, candidatos, pipeline, entrevistas e contratação.
- [ ] Onboarding: tarefas, responsáveis, documentos e conclusão.
- [ ] Organograma, cargos, competências e histórico.
- [ ] Avaliação de desempenho, feedback, metas e PDI.
- [ ] Treinamentos, trilhas, validade, pesquisas de clima e indicadores.
- [ ] People Analytics: headcount, turnover, absenteísmo, custo e tendências.

## Critérios de aceite
1. Lint, testes de unidade, integração, segurança, build Electron e smoke SQLite verdes.
2. Playwright com screenshots de fluxos reais, estados vazios/erros e permissões.
3. Windows e macOS empacotados isoladamente, sem distribuir atualização aos clientes.
4. Testar migração com backup real anonimizado e rollback.
5. Matriz de rastreabilidade por funcionalidade com evidências dos testes.
6. Nenhuma alegação de conformidade eSocial/REP-P ou cálculo fiscal homologado sem validação específica.
