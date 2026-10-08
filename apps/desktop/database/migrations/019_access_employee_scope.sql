ALTER TABLE rh_contas_locais ADD COLUMN funcionario_id INTEGER REFERENCES funcionarios(id);
CREATE INDEX IF NOT EXISTS idx_rh_contas_empresa ON rh_contas_locais(empresa_id,perfil,ativo);
