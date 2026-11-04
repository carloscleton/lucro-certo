/**
 * Mapeadores ISOLADOS por provedor fiscal (regra AGENTS.md: sem impacto cruzado).
 * Cada função converte ExtractedFiscalData em uma lista de campos do state daquele provedor.
 * Credenciais, tokens, webhooks, certificado e ambiente NUNCA são preenchidos.
 */
import type { ExtractedFiscalData } from './invoiceConfigExtractor';

export interface ImportField {
  path: string; // ex.: 'cnpj' ou 'endereco.cep'
  label: string;
  value: any;
}

const keep = (fields: ImportField[]) =>
  fields.filter(f => f.value !== '' && f.value !== null && f.value !== undefined);

// ---------------- TecnoSpeed / PlugNotas (state: config) ----------------
export function mapToTecnoSpeed(d: ExtractedFiscalData): ImportField[] {
  return keep([
    { path: 'cnpj', label: 'CNPJ', value: d.cnpj },
    { path: 'inscricao_municipal', label: 'Inscrição Municipal', value: d.inscricaoMunicipal },
    { path: 'inscricao_estadual', label: 'Inscrição Estadual', value: d.inscricaoEstadual },
    { path: 'razao_social', label: 'Razão Social', value: d.razaoSocial },
    { path: 'nome_fantasia', label: 'Nome Fantasia', value: d.nomeFantasia },
    { path: 'email', label: 'E-mail', value: d.email },
    { path: 'telefone', label: 'Telefone', value: d.telefone },
    { path: 'endereco.logradouro', label: 'Logradouro', value: d.endereco.logradouro },
    { path: 'endereco.numero', label: 'Número', value: d.endereco.numero },
    { path: 'endereco.complemento', label: 'Complemento', value: d.endereco.complemento },
    { path: 'endereco.bairro', label: 'Bairro', value: d.endereco.bairro },
    { path: 'endereco.cidade', label: 'Cidade', value: d.endereco.cidade },
    { path: 'endereco.codigoCidade', label: 'Código IBGE', value: d.endereco.codigoCidade },
    { path: 'endereco.uf', label: 'UF', value: d.endereco.uf },
    { path: 'endereco.cep', label: 'CEP', value: d.endereco.cep },
    { path: 'regime_tributario', label: 'Regime Tributário', value: d.simplesNacional === null ? '' : d.simplesNacional ? '1' : '3' },
    { path: 'nfse_nacional', label: 'NFS-e Nacional', value: d.layout === 'nacional' ? true : '' },
    { path: 'default_cnae', label: 'CNAE padrão', value: d.cnae },
    { path: 'default_taxation_code', label: 'Código de Serviço', value: d.codigoServico },
    { path: 'default_iss_aliquota', label: 'Alíquota ISS (%)', value: d.issAliquota },
    { path: 'default_iss_exigibilidade', label: 'Exigibilidade ISS', value: d.exigibilidadeIss || d.tribIssqn },
    { path: 'default_regime_especial', label: 'Regime Especial', value: d.regimeEspecial },
    { path: 'default_pis_aliquota', label: 'Alíquota PIS (%)', value: d.pisAliquota },
    { path: 'default_cofins_aliquota', label: 'Alíquota COFINS (%)', value: d.cofinsAliquota },
    { path: 'default_csll_aliquota', label: 'Alíquota CSLL (%)', value: d.csllAliquota },
    { path: 'default_irrf_aliquota', label: 'Alíquota IRRF (%)', value: d.irrfAliquota },
    { path: 'simples_nacional_aliquota', label: 'Alíquota Simples Nacional (%)', value: d.totTribSN },
    { path: 'simples_nacional_regime_apuracao', label: 'Regime Apuração SN', value: d.regApTribSN },
    { path: 'pis_cofins_situacao_tributaria', label: 'CST PIS/COFINS', value: d.pisCofinsCst },
    { path: 'reforma_tributaria_ibs_aliquota', label: 'Alíquota IBS (%)', value: d.ibsAliquota },
    { path: 'reforma_tributaria_cbs_aliquota', label: 'Alíquota CBS (%)', value: d.cbsAliquota },
  ]);
}

// ---------------- NFe.io (state: nfeioConfig) ----------------
export function mapToNfeio(d: ExtractedFiscalData): ImportField[] {
  return keep([
    { path: 'inscricaoMunicipal', label: 'Inscrição Municipal', value: d.inscricaoMunicipal },
    { path: 'cnae', label: 'CNAE', value: d.cnae },
    { path: 'aliquotaIss', label: 'Alíquota ISS (%)', value: d.issAliquota },
    { path: 'simplesNacional', label: 'Simples Nacional', value: d.simplesNacional === null ? '' : d.simplesNacional },
    { path: 'cityServiceCode', label: 'Código de Serviço Municipal', value: d.codigoTributacaoMunicipio || d.codigoServico },
    { path: 'reforma_tributaria_ibs_aliquota', label: 'Alíquota IBS (%)', value: d.ibsAliquota },
    { path: 'reforma_tributaria_cbs_aliquota', label: 'Alíquota CBS (%)', value: d.cbsAliquota },
  ]);
}

// ---------------- Portal Nacional (state: nationalConfig) ----------------
export function mapToNational(d: ExtractedFiscalData): ImportField[] {
  const num = (v: string) => (v === '' ? '' : Number(v));
  const proximo = d.layout === 'nacional' && d.numeroNota ? String(Number(d.numeroNota) + 1) : '';
  return keep([
    { path: 'cnpj', label: 'CNPJ', value: d.cnpj },
    { path: 'inscricao_municipal', label: 'Inscrição Municipal', value: d.inscricaoMunicipal },
    { path: 'simples_nacional', label: 'Simples Nacional', value: d.simplesNacional === null ? '' : d.simplesNacional },
    { path: 'op_simp_nac', label: 'Opção Simples Nacional', value: num(d.opSimpNac) },
    { path: 'reg_ap_trib_sn', label: 'Regime Apuração SN', value: num(d.regApTribSN) },
    { path: 'reg_esp_trib', label: 'Regime Especial', value: num(d.regimeEspecial) },
    { path: 'trib_issqn', label: 'Tributação ISSQN', value: num(d.tribIssqn) },
    { path: 'tp_ret_issqn', label: 'Retenção ISSQN', value: num(d.tpRetIssqn) },
    { path: 'default_cTribNac', label: 'Código Tributação Nacional', value: d.layout === 'nacional' ? d.codigoServico : '' },
    { path: 'default_xDescServ', label: 'Descrição do Serviço', value: d.descricaoServico },
    { path: 'default_iss_aliquota', label: 'Alíquota ISS (%)', value: d.issAliquota },
    { path: 'default_tot_trib_sn', label: 'Total Tributos SN (%)', value: d.totTribSN },
    { path: 'default_pis_aliquota', label: 'Alíquota PIS (%)', value: d.pisAliquota },
    { path: 'default_cofins_aliquota', label: 'Alíquota COFINS (%)', value: d.cofinsAliquota },
    { path: 'default_csll_aliquota', label: 'Alíquota CSLL (%)', value: d.csllAliquota },
    { path: 'default_irrf_aliquota', label: 'Alíquota IRRF (%)', value: d.irrfAliquota },
    { path: 'pis_cofins_situacao_tributaria', label: 'CST PIS/COFINS', value: d.pisCofinsCst },
    { path: 'reforma_tributaria_ibs_aliquota', label: 'Alíquota IBS (%)', value: d.ibsAliquota },
    { path: 'reforma_tributaria_cbs_aliquota', label: 'Alíquota CBS (%)', value: d.cbsAliquota },
    { path: 'proximo_numero_dps', label: 'Próximo número DPS', value: proximo },
    { path: 'serie_dps', label: 'Série da DPS', value: d.serie },
    { path: 'default_cnbs', label: 'Código NBS', value: d.cNBS },
    { path: 'default_inf_comp', label: 'Informações Complementares', value: d.xInfComp },
  ]);
}

/** Aplica os campos selecionados sobre um objeto de state (suporta 1 nível de aninhamento). */
export function applyImportFields<T extends Record<string, any>>(state: T, fields: ImportField[]): T {
  const next: any = { ...state };
  for (const f of fields) {
    const [a, b] = f.path.split('.');
    if (b) next[a] = { ...(next[a] || {}), [b]: f.value };
    else next[a] = f.value;
  }
  return next;
}

export const getAtPath = (obj: any, path: string) =>
  path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
