-- Modulos P0-P4: registros canonicos internos, sem conexoes externas.
CREATE TABLE IF NOT EXISTS rh_registros (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 empresa_id INTEGER NOT NULL REFERENCES empresas(id),
 funcionario_id INTEGER REFERENCES funcionarios(id),
 tipo TEXT NOT NULL CHECK(tipo IN ('ferias','afastamento','desligamento','historico_contratual','checklist','vencimento','jornada','ajuste_ponto','rubrica','vaga','candidato','onboarding','departamento','competencia','avaliacao','meta','pdi','treinamento','matricula','pesquisa','resposta','feedback')),
 titulo TEXT NOT NULL,
 estado TEXT NOT NULL DEFAULT 'rascunho' CHECK(estado IN ('rascunho','pendente','aprovado','concluido','cancelado')),
 inicio TEXT,
 fim TEXT,
 responsavel TEXT,
 valor_centavos INTEGER NOT NULL DEFAULT 0 CHECK(valor_centavos>=0),
 dados_json TEXT NOT NULL DEFAULT '{}',
 revisao INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_rh_registros_escopo ON rh_registros(empresa_id,tipo,estado,deleted_at);
CREATE INDEX IF NOT EXISTS idx_rh_registros_func ON rh_registros(funcionario_id,tipo,inicio);
CREATE TABLE IF NOT EXISTS rh_remuneracao_competencia (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 empresa_id INTEGER REFERENCES empresas(id),
 funcionario_id INTEGER NOT NULL REFERENCES funcionarios(id),
 competencia TEXT NOT NULL,
 cargo_id INTEGER REFERENCES cargos(id),
 salario_centavos INTEGER NOT NULL CHECK(salario_centavos>=0),
 lancamentos_fixos_json TEXT NOT NULL,
 criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(funcionario_id,competencia)
);
CREATE INDEX IF NOT EXISTS idx_rh_remuneracao_empresa_comp ON rh_remuneracao_competencia(empresa_id,competencia);
CREATE TABLE IF NOT EXISTS rh_ponto_conferencias (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 ponto_mensal_id INTEGER NOT NULL REFERENCES pontos_mensais(id),
 funcionario_id INTEGER NOT NULL REFERENCES funcionarios(id),
 competencia TEXT NOT NULL,
 confirmado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 observacao TEXT NOT NULL,
 revisao INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_rh_ponto_conferencias ON rh_ponto_conferencias(ponto_mensal_id,confirmado_em);
CREATE TABLE IF NOT EXISTS rh_contas_locais (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 empresa_id INTEGER REFERENCES empresas(id),
 usuario TEXT NOT NULL UNIQUE,
 nome TEXT NOT NULL,
 perfil TEXT NOT NULL CHECK(perfil IN ('admin','rh','gestor','contador','colaborador')),
 senha_hash TEXT NOT NULL,
 ativo INTEGER NOT NULL DEFAULT 1,
 criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS rh_sessoes_locais (
 token_hash TEXT PRIMARY KEY,
 conta_id INTEGER NOT NULL REFERENCES rh_contas_locais(id) ON DELETE CASCADE,
 expira_em INTEGER NOT NULL,
 criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rh_sessoes_expira ON rh_sessoes_locais(expira_em);
