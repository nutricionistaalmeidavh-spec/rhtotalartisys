# RH Total ArtiSys

Aplicativo de gestão de recursos humanos derivado **seletivamente** das funcionalidades existentes no Obra na Mão Comercial. O desktop usa React/TypeScript, Electron e SQLite local. Não exige serviços pagos ou login Cloudflare.

## Executar localmente

Instale Node 22 e execute na pasta `apps/desktop`:

```bash
npm ci
npm run electron:dev
```

Testes: `npm test` e `node --test ../../packages/domain-core/index.test.cjs`. Build de interface: `npm run build`. Instalador Windows: `npm run dist`.

## Estado

F0 documentada em [docs/REUSE_MATRIX.md](docs/REUSE_MATRIX.md). F1–F4 foram portadas parcialmente com serviços originais; com testes de serviços e QA de interface Electron/Playwright; os cenários e limites estão em [docs/QA_PLAYWRIGHT.md](docs/QA_PLAYWRIGHT.md). F5 (LAN independente) e F6 (instaladores validados) não concluídas.

Origem pinada: `99bd3da6c8c56e237a27ed84a5b12f5786076bd3` de `nutricionistaalmeidavh-spec/OBRANAMAOCOMERCIAL`. Pasta de dados, identificador Electron e publicação separados. Não tocar na main nem no repositório original.

O preenchimento automático de ponto gera horários sintéticos; os registros devem ser conferidos e validados conforme a jornada efetivamente realizada.

## Continuidade e revisão

O cadastro possui rascunho por funcionário/perfil e salvamento separado da geração documental. A conferência abre documentos gerados; contas e DRE usam os serviços SQLite existentes. A confirmação de pagamento permite escolher data e forma, impede acionamento repetido e distingue documentação pendente de pagamento salvo.
