---
version: alpha
name: RH Total ArtiSys
description: Painel de RH por competência, com referência cromática Nubank e identidade ArtiSys.
colors:
  primary: '#820ad1'
  primary-dark: '#6500a3'
  primary-soft: '#f3e8fc'
  background: '#f7f5f9'
  surface: '#ffffff'
  text: '#251b2d'
  muted: '#706778'
  border: '#e9e3ed'
typography:
  sans:
    fontFamily: 'Segoe UI, system-ui, -apple-system, sans-serif'
  mono:
    fontFamily: 'ui-monospace, monospace'
rounded:
  control: '10px'
  card: '16px'
  action: '999px'
spacing:
  page: '32px'
  section: '28px'
  field: '20px'
---

# RH Total ArtiSys

## Overview
Painel operacional para responsáveis pelo RH de pequenas empresas brasileiras, em desktop Electron/SQLite local. Registro de colaboradores, revisão de pagamentos, ponto e documentos são as tarefas centrais. Português brasileiro; moeda BRL; sem serviços pagos obrigatórios.

### Creative North Star
Fechamento mensal visível: competência, pendências e continuidade do trabalho. A referência solicitada pelo usuário é a paleta roxa do Nubank. Mantemos nome, ícones e dados próprios ArtiSys; sem tipografia proprietária ou assets externos em runtime.

### Token ownership/runtime mapping
Modelo B: `apps/desktop/src/styles/theme.css` é a fonte canônica de tokens. Este arquivo documenta os valores aceitos. Tailwind adapta `--primary`, `--canvas`, `--text` e cores semânticas; componentes compartilhados consomem essas variáveis. CSS legado recebe os mesmos aliases. Nenhuma fonte ou tema depende da rede.

## Colors
Roxo nas ações, links, seleção e foco; lilás em apoios; branco nos painéis. Verde, vermelho e âmbar continuam com significado de estado, acompanhado de texto. Fundo claro é o único tema suportado. Alto contraste usa as cores do sistema.

## Typography
Cabeçalhos 24–28 px, textos e campos 14 px, descrição e ações 13 px, labels 12 px. Dados monetários usam algarismos tabulares. Fonte local do sistema; sem download de Nu Sans.

## Layout
Menu superior fino, rolável horizontalmente quando necessário. Conteúdo até 1480 px, com rolagem natural. Cards de módulos em três, duas ou uma coluna; jornada em cinco, três ou duas colunas. Abaixo de 760 px, formulários passam a uma coluna e as etapas ficam em uma faixa rolável. A fila mostra todos os cadastros incompletos retornados pelo serviço local.

## Elevation & Depth
Hierarquia por espaço, bordas e superfícies. Sombra de painel discreta; ações sem sombra colorida. Overlays mantêm destaque e foco próprios.

## Shapes
Cards 16 px; hero 20 px; campos 10 px; botões e navegação em cápsula. Não transformar as tabelas de trabalho em cards decorativos.

## Components
`ui.tsx` mantém Button, Field, Kpi, SearchInput, Modal e estados. `WorkQueue.tsx` adapta a composição de `frontEnds/shells/product-runtime/primitives.tsx` ao roteador existente. A jornada e os atalhos usam links reais. Sem ação financeira nova e sem cálculo duplicado.

### Foundational visual states
Hover lilás; seleção roxa; foco visível 3 px; disabled mantém texto e geometria. Erros, loading, vazio e sucesso usam os componentes existentes. Busca pode ser limpa e restaura foco no campo.

### Iconography
Lucide, 16–23 px nas ações e 20 px nos módulos, sempre com rótulo para navegação.

### Motion
Transições de cor de 160 ms; sem efeitos ambientais. Reduced motion desativa transições e reduz animações.

### Content and data visualization
Texto descreve a tarefa. Indicadores vêm dos serviços canônicos e são ocultados durante carregamento; zero só é mostrado após leitura concluída.

## Do's and Don'ts
- Manter o usuário situado na competência e no funcionário.
- Reutilizar os componentes e tokens em todas as telas.
- Não importar o renderer com autenticação do frontEnds: o RH já tem runtime e serviços próprios.
- Não trocar cores semânticas de erro/sucesso pelo roxo da marca.
