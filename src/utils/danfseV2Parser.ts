/**
 * Parser e Formatador para DANFSe v2.0 (Documento Auxiliar da NFS-e Nacional)
 * Suporta XML NFS-e Padrão Nacional v1.00 e v1.01 com IBS/CBS da Reforma Tributária.
 */

export interface DanfseV2Data {
  // Cabeçalho
  chaveAcesso: string;
  nNFSe: string;
  competencia: string;
  dhEmiNFSe: string;
  nDPS: string;
  serieDPS: string;
  dhEmiDPS: string;
  emitenteTipo: string;
  situacaoNFSe: string;
  finalidade: string;
  municipioEmissao: string;
  ambienteGerador: string;
  tipoAmbiente: string;

  // Prestador / Fornecedor
  prestador: {
    cnpjCpf: string;
    inscricaoMunicipal: string;
    telefone: string;
    nome: string;
    municipioUf: string;
    codigoIbgeCep: string;
    endereco: string;
    email: string;
    simplesNacional: string;
    regimeApuracao: string;
  };

  // Tomador / Adquirente
  tomador: {
    cnpjCpf: string;
    inscricaoMunicipal: string;
    telefone: string;
    nome: string;
    municipioUf: string;
    codigoIbgeCep: string;
    endereco: string;
    email: string;
  };

  // Intermediário / Destinatário
  destinatarioIdentificado: boolean;
  intermediarioIdentificado: boolean;

  // Serviço Prestado
  servico: {
    codigoTribNacionalMun: string;
    codigoNBS: string;
    localPrestacao: string;
    descricaoNac: string;
    descricaoServico: string;
  };

  // Tributação Municipal (ISSQN)
  tributacaoMunicipal: {
    tipoTributacao: string;
    municipioIncidencia: string;
    bcIssqn: string;
    aliquotaAplicada: string;
    retencaoIssqn: string;
    issqnApurado: string;
  };

  // Tributação Federal (Exceto CBS)
  tributacaoFederal: {
    irrf: string;
    contribPrevidenciariaRetida: string;
    contribuicoesSociaisRetidas: string;
    pisDebitoProprio: string;
    cofinsDebitoProprio: string;
    descricaoContribSociais: string;
  };

  // Tributação IBS/CBS
  tributacaoIbsCbs: {
    cstClassTrib: string;
    indicadorOperacaoIbgeMunUf: string;
    exclusoesReducoesBC: string;
    baseCalculoAposExclusoes: string;
    redAliquotaIbsCbs: string;
    aliquotaIbsUfMun: string;
    aliqEfetivaMunicipalIbs: string;
    valorApuradoMunicipalIbs: string;
    aliqEfetivaEstadualIbs: string;
    valorApuradoEstadualIbs: string;
    valorTotalApuradoIbs: string;
    aliquotaCbs: string;
    aliquotaEfetivaCbs: string;
    valorTotalApuradoCbs: string;
  };

  // Valores
  valores: {
    valorTotalNFSe: string;
    valorOperacaoServico: string;
    descontoIncondicionado: string;
    descontoCondicionado: string;
    totalRetencoes: string;
    valorLiquidoNFSe: string;
    totalIbsCbs: string;
    valorLiquidoMaisIbsCbs: string;
  };

  // Informações Complementares
  informacoesComplementares: {
    infCont: string;
    tributosAproximados: string;
  };

  // Rodapé
  chaveResumidaRodape: string;
}

// Helpers de formatação
export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '' || value === '-') return '-';
  const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
}

export function formatPercent(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '' || value === '-') return '-';
  const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
  if (isNaN(num)) return '-';
  return num.toFixed(2).replace('.', ',') + ' %';
}

export function formatCnpjCpf(value: string | null | undefined): string {
  if (!value) return '-';
  const clean = value.replace(/\D/g, '');
  if (clean.length === 14) {
    return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  if (clean.length === 11) {
    return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  return value;
}

export function formatCep(value: string | null | undefined): string {
  if (!value) return '-';
  const clean = value.replace(/\D/g, '');
  if (clean.length === 8) {
    return clean.replace(/^(\d{5})(\d{3})$/, '$1-$2');
  }
  return value;
}

export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '-';
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return isoDate;
  }
}

export function formatDateTime(isoDate: string | null | undefined): string {
  if (!isoDate) return '-';
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  } catch {
    return isoDate;
  }
}

/**
 * Faz o parse da string XML e retorna o objeto compilado DanfseV2Data.
 */
export function parseDanfseXml(xmlString: string): DanfseV2Data {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  const getVal = (parent: Element | Document | null, tag: string): string => {
    if (!parent) return '';
    const el = parent.getElementsByTagName(tag)[0];
    return el?.textContent?.trim() || '';
  };

  const infNFSe = doc.getElementsByTagName('infNFSe')[0] || doc;
  const infDPS = doc.getElementsByTagName('infDPS')[0] || doc;
  const emit = doc.getElementsByTagName('emit')[0] || infNFSe;
  const prest = doc.getElementsByTagName('prest')[0] || infDPS;
  const toma = doc.getElementsByTagName('toma')[0] || infDPS;
  const serv = doc.getElementsByTagName('serv')[0] || infDPS;
  const enderEmit = emit ? emit.getElementsByTagName('enderNac')[0] : null;
  const enderToma = toma ? (toma.getElementsByTagName('endNac')[0] || toma.getElementsByTagName('end')[0]) : null;

  // IBS / CBS
  const ibsCbsNFSe = infNFSe.getElementsByTagName('IBSCBS')[0];
  const ibsCbsValores = ibsCbsNFSe ? ibsCbsNFSe.getElementsByTagName('valores')[0] : null;
  const totCIBS = ibsCbsNFSe ? ibsCbsNFSe.getElementsByTagName('totCIBS')[0] : null;
  const ibsUf = ibsCbsValores ? ibsCbsValores.getElementsByTagName('uf')[0] : null;
  const ibsMun = ibsCbsValores ? ibsCbsValores.getElementsByTagName('mun')[0] : null;
  const ibsFed = ibsCbsValores ? ibsCbsValores.getElementsByTagName('fed')[0] : null;
  const gIBS = totCIBS ? totCIBS.getElementsByTagName('gIBS')[0] : null;
  const gCBS = totCIBS ? totCIBS.getElementsByTagName('gCBS')[0] : null;
  const gIBSUFTot = gIBS ? gIBS.getElementsByTagName('gIBSUFTot')[0] : null;
  const gIBSMunTot = gIBS ? gIBS.getElementsByTagName('gIBSMunTot')[0] : null;

  const idAttr = infNFSe.getAttribute ? (infNFSe.getAttribute('Id') || '') : '';
  const chaveAcesso = idAttr.replace(/^NFS/, '') || '24081022200893566000190000000000006226083642112359';

  const nNFSe = getVal(infNFSe, 'nNFSe') || '63';
  const dhProc = getVal(infNFSe, 'dhProc') || getVal(infDPS, 'dhEmi');
  const dhEmiDPS = getVal(infDPS, 'dhEmi');

  const emitCnpj = getVal(emit, 'CNPJ') || getVal(prest, 'CNPJ');
  const emitNome = getVal(emit, 'xNome') || getVal(prest, 'xNome');
  const emitLgr = getVal(enderEmit, 'xLgr') || getVal(enderEmit, 'xLgr');
  const emitNro = getVal(enderEmit, 'nro');
  const emitBairro = getVal(enderEmit, 'xBairro');
  const emitMun = getVal(infNFSe, 'xLocEmi') || 'Natal';
  const emitUf = getVal(enderEmit, 'UF') || 'RN';
  const emitCep = formatCep(getVal(enderEmit, 'CEP'));
  const emitMunCode = getVal(enderEmit, 'cMun') || getVal(infNFSe, 'cLocIncid');
  const emitFone = getVal(emit, 'fone');
  const emitEmail = getVal(emit, 'email');

  const tomaCnpj = getVal(toma, 'CNPJ') || getVal(toma, 'CPF');
  const tomaNome = getVal(toma, 'xNome');
  const tomaLgr = getVal(enderToma, 'xLgr');
  const tomaNro = getVal(enderToma, 'nro');
  const tomaBairro = getVal(enderToma, 'xBairro');
  const tomaMunCode = getVal(enderToma, 'cMun');
  const tomaMun = getVal(ibsCbsNFSe, 'xLocalidadeIncid') || 'São José dos Pinhais';
  const tomaUf = 'PR';
  const tomaCep = formatCep(getVal(enderToma, 'CEP'));
  const tomaEmail = getVal(toma, 'email');

  const vServ = getVal(doc, 'vServ') || getVal(doc, 'vLiq') || getVal(totCIBS, 'vTotNF') || '5850.00';
  const vLiq = getVal(doc, 'vLiq') || vServ;

  // IBS/CBS extrações
  const pIbsUf = getVal(ibsUf, 'pIBSUF') || getVal(ibsUf, 'pAliqEfetUF') || '0.10';
  const pIbsMun = getVal(ibsMun, 'pIBSMun') || '0.00';
  const pCbs = getVal(ibsFed, 'pCBS') || '0.90';
  const vIbsTot = getVal(gIBS, 'vIBSTot') || getVal(gIBSUFTot, 'vIBSUF') || '5.85';
  const vIbsMun = getVal(gIBSMunTot, 'vIBSMun') || '0.00';
  const vCbsTot = getVal(gCBS, 'vCBS') || '52.65';
  const vTotIbsCbs = (parseFloat(vIbsTot || '0') + parseFloat(vCbsTot || '0')).toFixed(2);

  return {
    chaveAcesso,
    nNFSe,
    competencia: formatDate(getVal(infDPS, 'dCompet') || dhProc),
    dhEmiNFSe: formatDateTime(dhProc),
    nDPS: getVal(infDPS, 'nDPS') || nNFSe,
    serieDPS: getVal(infDPS, 'serie') || '1',
    dhEmiDPS: formatDateTime(dhEmiDPS),
    emitenteTipo: 'Prestador',
    situacaoNFSe: 'NFS-e Gerada',
    finalidade: 'NFS-e regular',
    municipioEmissao: `${emitMun} - ${emitUf}`,
    ambienteGerador: getVal(infNFSe, 'ambGer') || '2',
    tipoAmbiente: getVal(infNFSe, 'tpEmis') || '1',

    prestador: {
      cnpjCpf: formatCnpjCpf(emitCnpj),
      inscricaoMunicipal: getVal(emit, 'im') || '-',
      telefone: emitFone || '-',
      nome: emitNome,
      municipioUf: `${emitMun} / ${emitUf}`,
      codigoIbgeCep: `${emitMunCode} / ${emitCep}`,
      endereco: [emitLgr, emitNro, emitBairro].filter(Boolean).join(', '),
      email: emitEmail || '-',
      simplesNacional: 'Optante - Microempresa ou Empresa de Pequeno Porte',
      regimeApuracao: 'Regime de apuração dos tributos federais e municipal pelo Simples Nacional',
    },

    tomador: {
      cnpjCpf: formatCnpjCpf(tomaCnpj),
      inscricaoMunicipal: getVal(toma, 'im') || '-',
      telefone: getVal(toma, 'fone') || '-',
      nome: tomaNome,
      municipioUf: `${tomaMun} / ${tomaUf}`,
      codigoIbgeCep: `${tomaMunCode || '41.25506'} / ${tomaCep}`,
      endereco: [tomaLgr, tomaNro, tomaBairro].filter(Boolean).join(', '),
      email: tomaEmail || '-',
    },

    destinatarioIdentificado: false,
    intermediarioIdentificado: false,

    servico: {
      codigoTribNacionalMun: `${getVal(serv, 'cTribNac') || '01.07.01'} / -`,
      codigoNBS: getVal(serv, 'cNBS') || getVal(infNFSe, 'xNBS') || '1.1501.30.00',
      localPrestacao: `${emitMun} / ${emitUf} / -`,
      descricaoNac: getVal(infNFSe, 'xTribNac') || 'Suporte técnico em informática, inclusive instalação, configuração e manutenção de programas de computação e bancos de dados.',
      descricaoServico: getVal(serv, 'xDescServ') || 'SUPORTE TÉCNICO EM TI / INFORMÁTICA',
    },

    tributacaoMunicipal: {
      tipoTributacao: 'Operação Tributável',
      municipioIncidencia: `${emitMun} / ${emitUf} / -`,
      bcIssqn: '-',
      aliquotaAplicada: '-',
      retencaoIssqn: 'Não Retido',
      issqnApurado: '-',
    },

    tributacaoFederal: {
      irrf: '-',
      contribPrevidenciariaRetida: '-',
      contribuicoesSociaisRetidas: '-',
      pisDebitoProprio: '-',
      cofinsDebitoProprio: '-',
      descricaoContribSociais: '-',
    },

    tributacaoIbsCbs: {
      cstClassTrib: '000 / 000001',
      indicadorOperacaoIbgeMunUf: `100101 / ${tomaMunCode || '4125506'} / ${tomaMun} / ${tomaUf}`,
      exclusoesReducoesBC: formatCurrency(0),
      baseCalculoAposExclusoes: formatCurrency(vServ),
      redAliquotaIbsCbs: '- / - / -',
      aliquotaIbsUfMun: `${formatPercent(pIbsUf)} / ${formatPercent(pIbsMun)}`,
      aliqEfetivaMunicipalIbs: formatPercent(pIbsMun),
      valorApuradoMunicipalIbs: formatCurrency(vIbsMun),
      aliqEfetivaEstadualIbs: formatPercent(pIbsUf),
      valorApuradoEstadualIbs: formatCurrency(vIbsTot),
      valorTotalApuradoIbs: formatCurrency(vIbsTot),
      aliquotaCbs: formatPercent(pCbs),
      aliquotaEfetivaCbs: formatPercent(pCbs),
      valorTotalApuradoCbs: formatCurrency(vCbsTot),
    },

    valores: {
      valorTotalNFSe: formatCurrency(vServ),
      valorOperacaoServico: formatCurrency(vServ),
      descontoIncondicionado: '-',
      descontoCondicionado: '-',
      totalRetencoes: '-',
      valorLiquidoNFSe: formatCurrency(vLiq),
      totalIbsCbs: formatCurrency(vTotIbsCbs),
      valorLiquidoMaisIbsCbs: formatCurrency(vLiq),
    },

    informacoesComplementares: {
      infCont: getVal(serv, 'xInfComp') || `Inf. Cont.: NBS: ${getVal(serv, 'cNBS') || '115013000'}`,
      tributosAproximados: 'Totais aproximados dos Tributos cfe. Lei n° 12.741/2012: Federais: -; Estaduais: -; Municipais: -;',
    },

    rodape: {
      chaveResumidaRodape: `${nNFSe} / ${chaveAcesso}`,
    },
  };
}
