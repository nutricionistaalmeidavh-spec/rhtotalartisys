# RH Total — QA Electron com Playwright

O workflow existente `RH Total QA` agora contém dois jobs: verificações de código/serviços e QA de interface no Electron real. Executa em PRs que alteram desktop/domínio e por `workflow_dispatch`.

O padrão do QA do Obra na Mão foi reaproveitado: lançamento com `_electron`, dados temporários, screenshots, trace e telemetria. A suíte específica do RH Total usa os serviços reais via preload e SQLite; não requer servidor, licença ou serviço pago. Cada teste tem banco **e perfil Chromium** próprios.

## Executar

Na pasta `apps/desktop`, com Node 22:

```sh
npm ci
npm run lint
npm test
npm run build
npx electron-rebuild -f -w better-sqlite3
xvfb-run -a npm run test:e2e
```

Em Windows/macOS com sessão gráfica aberta, execute `npm run test:e2e` sem Xvfb. Recompile `better-sqlite3` para Node antes de voltar aos testes de serviço se o ABI do Node local diferir do Electron.

## Cobertura

1. Primeiro uso: empresa pela UI, cadastro, retomada/reload e salvar sem emitir documentos.
2. Atalhos das etapas e conferência documental.
3. Folha individual, pagamento com data/forma, read-back, reload, contas/DRE e bloqueio de repetição.
4. Ponto de outra competência, aviso anterior ao preenchimento simulado, salvar e reabrir.
5. Conta manual refletida na folha e DRE.
6. Modelo personalizado pela edição visual.
7. Falha induzida no IPC de leitura e recuperação usando o handler real, sem tratar erro como lista vazia.
8. EPIs sem seleção automática, nomes acessíveis e busca textual.
9. Pagamento salvo com documentação pendente por CPF incompleto; caminho de recuperação sem registrar novo pagamento.
10. Capturas dos nove módulos em janela compacta de 800 × 720.

## Artefatos

O job publica `rh-total-playwright-<run_id>` com relatório HTML, JUnit, screenshots de etapas, screenshot final, erros do renderer e trace de cada teste, inclusive em falhas. Dados são fictícios. `RH_TOTAL_DATA_DIR` isola também userData/sessionData do Electron.

## Limites

A suíte valida a aplicação desktop, não anuncia um PWA nem prova usabilidade humana. A abertura de impressora e do leitor externo de PDF depende do sistema operacional e não é automatizada. A falha de leitura é injetada apenas no processo isolado de teste. Não há merge, publicação de instalador ou auto-update neste fluxo.
