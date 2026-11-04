/**
 * Extrai dados de configuração fiscal (prestador + tributação) a partir do XML de uma NFS-e.
 * Suporta: NFS-e Padrão Nacional (DPS/NFSe) e ABRASF (maioria das prefeituras).
 * Saída neutra — o mapeamento para cada provedor fica em fiscalImportMappers.ts.
 */

export interface ExtractedFiscalData {
  layout: 'nacional' | 'abrasf' | 'desconhecido';
  numeroNota: string;
  serie: string;
  cnpj: string;
  inscricaoMunicipal: string;
  inscricaoEstadual: string;
  razaoSocial: string;
  nomeFantasia: string;
  email: string;
  telefone: string;
  endereco: {
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cidade: string;
    codigoCidade: string;
    uf: string;
    cep: string;
  };
  simplesNacional: boolean | null;
  opSimpNac: string;
  regApTribSN: string;
  regimeEspecial: string;
  cnae: string;
  codigoServico: string; // cTribNac / ItemListaServico
  codigoTributacaoMunicipio: string;
  descricaoServico: string;
  issAliquota: string;
  tribIssqn: string;
  issRetido: boolean | null;
  tpRetIssqn: string;
  exigibilidadeIss: string;
  pisAliquota: string;
  cofinsAliquota: string;
  csllAliquota: string;
  irrfAliquota: string;
  pisCofinsCst: string;
  totTribSN: string;
  ibsAliquota: string;
  cbsAliquota: string;
  cNBS?: string;
  xInfComp?: string;
}

const byTag = (scope: Element | Document | null, tag: string): Element | null => {
  if (!scope) return null;
  return (scope.getElementsByTagNameNS('*', tag)[0] as Element) || (scope.getElementsByTagName(tag)[0] as Element) || null;
};

const txt = (scope: Element | Document | null, ...tags: string[]): string => {
  for (const t of tags) {
    const el = byTag(scope, t);
    const v = el?.textContent?.trim();
    if (v && !el!.children.length) return v;
  }
  return '';
};

const onlyDigits = (v: string) => v.replace(/\D/g, '');

/**
 * Normaliza alíquota para percentual com 2 casas ("2,5" -> "2.50").
 * fromFraction: usado só no ISS ABRASF, onde algumas prefeituras enviam 0.05 = 5% (ISS mínimo é 2%).
 */
const pct = (v: string, fromFraction = false): string => {
  if (!v) return '';
  let n = parseFloat(v.replace(',', '.'));
  if (isNaN(n)) return '';
  if (fromFraction && n > 0 && n < 1) n = n * 100;
  return n.toFixed(2);
};

/** Calcula percentual a partir de valor/base quando a nota só traz valores. */
const pctFromValue = (valor: string, base: string): string => {
  const v = parseFloat((valor || '').replace(',', '.'));
  const b = parseFloat((base || '').replace(',', '.'));
  if (!v || !b) return '';
  return ((v / b) * 100).toFixed(2);
};

export function extractFiscalDataFromXml(xml: string): ExtractedFiscalData {
  const doc = new DOMParser().parseFromString(xml.replace(/^\uFEFF/, ''), 'text/xml');
  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error('Arquivo XML inválido ou corrompido.');
  }

  const isNacional = !!(byTag(doc, 'infDPS') || byTag(doc, 'infNFSe'));
  const isAbrasf = !!(byTag(doc, 'InfNfse') || byTag(doc, 'InfDeclaracaoPrestacaoServico') || byTag(doc, 'InfRps') || byTag(doc, 'PrestadorServico') || byTag(doc, 'Prestador'));

  if (isNacional) return extractNacional(doc);
  if (isAbrasf) return extractAbrasf(doc);
  throw new Error('Layout de XML não reconhecido. Envie o XML de uma NFS-e (Padrão Nacional ou ABRASF).');
}

function extractNacional(doc: Document): ExtractedFiscalData {
  const infNFSe = byTag(doc, 'infNFSe');
  const infDPS = byTag(doc, 'infDPS');
  const emit = byTag(infNFSe, 'emit');
  const prest = byTag(infDPS, 'prest');
  const ender = byTag(emit, 'enderNac') || byTag(prest, 'endNac') || byTag(prest, 'end');
  const regTrib = byTag(prest, 'regTrib');
  const serv = byTag(infDPS, 'serv');
  const cServ = byTag(serv, 'cServ');
  const trib = byTag(infDPS, 'trib');
  const tribMun = byTag(trib, 'tribMun');
  const tribFed = byTag(trib, 'tribFed');
  const piscofins = byTag(tribFed, 'piscofins');
  const valores = byTag(infDPS, 'valores');
  const base = txt(valores, 'vServ');
  const ibsCbs = byTag(infNFSe, 'IBSCBS');

  const opSimpNac = txt(regTrib, 'opSimpNac');
  const tpRet = txt(tribMun, 'tpRetISSQN');

  return {
    layout: 'nacional',
    numeroNota: txt(infDPS, 'nDPS') || txt(infNFSe, 'nNFSe'),
    serie: txt(infDPS, 'serie'),
    cnpj: onlyDigits(txt(emit, 'CNPJ', 'CPF') || txt(prest, 'CNPJ', 'CPF')),
    inscricaoMunicipal: txt(emit, 'IM') || txt(prest, 'IM'),
    inscricaoEstadual: '',
    razaoSocial: txt(emit, 'xNome') || txt(prest, 'xNome'),
    nomeFantasia: txt(emit, 'xFant'),
    email: txt(emit, 'email') || txt(prest, 'email'),
    telefone: onlyDigits(txt(emit, 'fone') || txt(prest, 'fone')),
    endereco: {
      logradouro: txt(ender, 'xLgr'),
      numero: txt(ender, 'nro'),
      complemento: txt(ender, 'xCpl'),
      bairro: txt(ender, 'xBairro'),
      cidade: txt(infNFSe, 'xLocEmi'),
      codigoCidade: txt(ender, 'cMun') || txt(infDPS, 'cLocEmi'),
      uf: txt(ender, 'UF'),
      cep: onlyDigits(txt(ender, 'CEP')),
    },
    simplesNacional: opSimpNac ? opSimpNac !== '1' : null,
    opSimpNac,
    regApTribSN: txt(regTrib, 'regApTribSN'),
    regimeEspecial: txt(regTrib, 'regEspTrib'),
    cnae: '',
    codigoServico: txt(cServ, 'cTribNac'),
    codigoTributacaoMunicipio: txt(cServ, 'cTribMun'),
    descricaoServico: txt(cServ, 'xDescServ'),
    issAliquota: pct(txt(tribMun, 'pAliq')) || pct(txt(infNFSe, 'pAliqAplic')),
    tribIssqn: txt(tribMun, 'tribISSQN'),
    issRetido: tpRet ? tpRet !== '1' : null,
    tpRetIssqn: tpRet,
    exigibilidadeIss: '',
    pisAliquota: pct(txt(piscofins, 'pAliqPis')) || pctFromValue(txt(piscofins, 'vPis'), base),
    cofinsAliquota: pct(txt(piscofins, 'pAliqCofins')) || pctFromValue(txt(piscofins, 'vCofins'), base),
    csllAliquota: pctFromValue(txt(tribFed, 'vRetCSLL'), base),
    irrfAliquota: pctFromValue(txt(tribFed, 'vRetIRRF'), base),
    pisCofinsCst: txt(piscofins, 'CST'),
    totTribSN: pct(txt(trib, 'pTotTribSN')),
    ibsAliquota: (() => {
      const uf = txt(ibsCbs, 'pIBSUF'), mun = txt(ibsCbs, 'pIBSMun');
      if (!uf && !mun) return '';
      return ((parseFloat(uf) || 0) + (parseFloat(mun) || 0)).toFixed(2);
    })(),
    cbsAliquota: pct(txt(ibsCbs, 'pCBS')),
    cNBS: txt(cServ, 'cNBS'),
    xInfComp: txt(doc, 'xInfComp', 'InfAdic', 'InformacoesComplementares'),
  };
}

function extractAbrasf(doc: Document): ExtractedFiscalData {
  const prest = byTag(doc, 'PrestadorServico') || byTag(doc, 'Prestador');
  const idPrest = byTag(prest, 'IdentificacaoPrestador') || prest;
  const ender = byTag(prest, 'Endereco');
  const contato = byTag(prest, 'Contato');
  const servico = byTag(doc, 'Servico');
  const valores = byTag(servico, 'Valores');
  const base = txt(valores, 'BaseCalculo', 'ValorServicos');
  const infNfse = byTag(doc, 'InfNfse');
  const optante = txt(doc, 'OptanteSimplesNacional');
  const issRetido = txt(servico, 'IssRetido') || txt(valores, 'IssRetido');

  return {
    layout: 'abrasf',
    numeroNota: txt(infNfse, 'Numero') || txt(byTag(doc, 'IdentificacaoRps'), 'Numero'),
    serie: txt(byTag(doc, 'IdentificacaoRps'), 'Serie'),
    cnpj: onlyDigits(txt(idPrest, 'Cnpj', 'Cpf')),
    inscricaoMunicipal: txt(idPrest, 'InscricaoMunicipal'),
    inscricaoEstadual: txt(prest, 'InscricaoEstadual'),
    razaoSocial: txt(prest, 'RazaoSocial'),
    nomeFantasia: txt(prest, 'NomeFantasia'),
    email: txt(contato, 'Email'),
    telefone: onlyDigits(txt(contato, 'Telefone')),
    endereco: {
      logradouro: txt(ender, 'Endereco', 'Logradouro'),
      numero: txt(ender, 'Numero'),
      complemento: txt(ender, 'Complemento'),
      bairro: txt(ender, 'Bairro'),
      cidade: txt(ender, 'Cidade', 'NomeMunicipio'),
      codigoCidade: txt(ender, 'CodigoMunicipio'),
      uf: txt(ender, 'Uf', 'UF'),
      cep: onlyDigits(txt(ender, 'Cep')),
    },
    simplesNacional: optante ? optante === '1' : null,
    opSimpNac: optante === '1' ? '3' : optante === '2' ? '1' : '',
    regApTribSN: '',
    regimeEspecial: txt(doc, 'RegimeEspecialTributacao'),
    cnae: onlyDigits(txt(servico, 'CodigoCnae')),
    codigoServico: txt(servico, 'ItemListaServico'),
    codigoTributacaoMunicipio: txt(servico, 'CodigoTributacaoMunicipio'),
    descricaoServico: txt(servico, 'Discriminacao'),
    issAliquota: pct(txt(valores, 'Aliquota') || txt(servico, 'Aliquota'), true),
    tribIssqn: '',
    issRetido: issRetido ? issRetido === '1' : null,
    tpRetIssqn: issRetido === '1' ? '2' : issRetido === '2' ? '1' : '',
    exigibilidadeIss: txt(servico, 'ExigibilidadeISS'),
    pisAliquota: pctFromValue(txt(valores, 'ValorPis'), base),
    cofinsAliquota: pctFromValue(txt(valores, 'ValorCofins'), base),
    csllAliquota: pctFromValue(txt(valores, 'ValorCsll'), base),
    irrfAliquota: pctFromValue(txt(valores, 'ValorIr'), base),
    pisCofinsCst: '',
    totTribSN: '',
    ibsAliquota: '',
    cbsAliquota: '',
  };
}
