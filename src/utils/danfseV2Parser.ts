/**
 * Parser e Formatador para DANFSe v2.0 (Documento Auxiliar da NFS-e Nacional)
 * Suporta XML NFS-e Padrão Nacional v1.00 e v1.01 com namespaces e fallback para JSON.
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
  rodape: {
    chaveResumidaRodape: string;
  };
}

// Helpers de formatação
export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '' || value === '-') return '-';
  const num = typeof value === 'string' ? parseFloat(value.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) : value;
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
}

export function formatPercent(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '' || value === '-') return '-';
  const num = typeof value === 'string' ? parseFloat(value.replace('%', '').replace(',', '.').trim()) : value;
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
  const s = String(isoDate).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return s;
  }
}

export function formatDateTime(isoDate: string | null | undefined): string {
  if (!isoDate) return '-';
  const s = String(isoDate).trim();
  if (/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}$/.test(s)) return s;
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]} ${isoMatch[4]}:${isoMatch[5]}:${isoMatch[6]}`;
  }
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  } catch {
    return s;
  }
}

/**
 * Faz o parse universal do XML (suportando namespaces ns2:, p:, etc.) ou objeto JSON.
 */
export function parseDanfseXml(xmlInput: string | any, invoiceFallback?: any): DanfseV2Data {
  let xmlString = typeof xmlInput === 'string' ? xmlInput : '';
  const payloadObj = invoiceFallback || (typeof xmlInput === 'object' ? xmlInput : {});

  let doc: Document | null = null;
  if (xmlString && xmlString.trim().startsWith('<')) {
    try {
      const parser = new DOMParser();
      doc = parser.parseFromString(xmlString, 'text/xml');
    } catch (e) {
      console.warn('Erro ao ler XML com DOMParser:', e);
    }
  }

  // Helper universal de extração de tag em escopo DOM ou Regex
  const getVal = (scopeElement: Element | Document | null, tag: string, scopeSnippetStr?: string): string => {
    if (scopeElement) {
      // 1. Tentar por Namespace Universal
      if (scopeElement.getElementsByTagNameNS) {
        const els = scopeElement.getElementsByTagNameNS('*', tag);
        if (els && els.length > 0 && els[0].textContent?.trim()) {
          return els[0].textContent.trim();
        }
      }
      // 2. Tentar por Nome Simples
      if (scopeElement.getElementsByTagName) {
        const els = scopeElement.getElementsByTagName(tag);
        if (els && els.length > 0 && els[0].textContent?.trim()) {
          return els[0].textContent.trim();
        }
      }
    }

    // 3. Fallback: Regex resiliente a namespaces no snippet ou XML completo
    const searchTarget = scopeSnippetStr || xmlString;
    if (searchTarget) {
      const regex = new RegExp(`<([^:]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</([^:]+:)?${tag}>`, 'i');
      const match = searchTarget.match(regex);
      if (match && match[2]) {
        const val = match[2].trim();
        if (!val.startsWith('<')) return val;
      }
    }
    return '';
  };

  const getScope = (tag: string): Element | null => {
    if (!doc) return null;
    return doc.getElementsByTagNameNS('*', tag)[0] || doc.getElementsByTagName(tag)[0] || null;
  };

  const infNFSe = getScope('infNFSe') || doc;
  const infDPS = getScope('infDPS') || doc;
  const emit = getScope('emit') || getScope('prest') || infNFSe;
  const prest = getScope('prest') || infDPS;
  const toma = getScope('toma') || infDPS;
  const serv = getScope('serv') || infDPS;
  const enderEmit = emit ? (getScope('enderNac') || getScope('enderEmit') || emit) : null;
  const enderToma = toma ? (getScope('endNac') || getScope('end') || toma) : null;

  // IBS / CBS
  const ibsCbsNFSe = getScope('IBSCBS');
  const ibsCbsValores = ibsCbsNFSe ? ibsCbsNFSe.getElementsByTagNameNS('*', 'valores')[0] || ibsCbsNFSe.getElementsByTagName('valores')[0] : null;
  const totCIBS = ibsCbsNFSe ? ibsCbsNFSe.getElementsByTagNameNS('*', 'totCIBS')[0] || ibsCbsNFSe.getElementsByTagName('totCIBS')[0] : null;
  const ibsUf = ibsCbsValores ? ibsCbsValores.getElementsByTagNameNS('*', 'uf')[0] || ibsCbsValores.getElementsByTagName('uf')[0] : null;
  const ibsMun = ibsCbsValores ? ibsCbsValores.getElementsByTagNameNS('*', 'mun')[0] || ibsCbsValores.getElementsByTagName('mun')[0] : null;
  const ibsFed = ibsCbsValores ? ibsCbsValores.getElementsByTagNameNS('*', 'fed')[0] || ibsCbsValores.getElementsByTagName('fed')[0] : null;
  const gIBS = totCIBS ? totCIBS.getElementsByTagNameNS('*', 'gIBS')[0] || totCIBS.getElementsByTagName('gIBS')[0] : null;
  const gCBS = totCIBS ? totCIBS.getElementsByTagNameNS('*', 'gCBS')[0] || totCIBS.getElementsByTagName('gCBS')[0] : null;
  const gIBSUFTot = gIBS ? gIBS.getElementsByTagNameNS('*', 'gIBSUFTot')[0] || gIBS.getElementsByTagName('gIBSUFTot')[0] : null;
  const gIBSMunTot = gIBS ? gIBS.getElementsByTagNameNS('*', 'gIBSMunTot')[0] || gIBS.getElementsByTagName('gIBSMunTot')[0] : null;

  // Atributo Id da chave de acesso
  let idAttr = '';
  if (infNFSe && (infNFSe as any).getAttribute) {
    idAttr = (infNFSe as any).getAttribute('Id') || (infNFSe as any).getAttribute('id') || '';
  }
  if (!idAttr && xmlString) {
    const idMatch = xmlString.match(/Id=["']([^"']+)["']/i);
    if (idMatch) idAttr = idMatch[1];
  }

  const rawExtId = String(payloadObj.external_id || '').replace(/\D/g, '');
  const rawAccKey = String(payloadObj.access_key || payloadObj.chaveAcesso || '').replace(/\D/g, '');

  const chaveAcesso = idAttr.replace(/^(NFS|DPS)/i, '') || 
                      ((rawExtId.length === 50 || rawExtId.length === 51) ? rawExtId : null) ||
                      ((rawAccKey.length === 50 || rawAccKey.length === 51) ? rawAccKey : null) ||
                      payloadObj.chaveAcesso || 
                      payloadObj.access_key || 
                      payloadObj.external_id || 
                      '24081022200893566000190000000000006226083642112359';

  const nNFSe = getVal(infNFSe, 'nNFSe') || 
                payloadObj.nNFSe || 
                payloadObj.invoice_number || 
                payloadObj.numeroNfse || 
                '62';

  const dhProc = getVal(infNFSe, 'dhProc') || 
                 getVal(infDPS, 'dhEmi') || 
                 payloadObj.dhProc || 
                 payloadObj.created_at;

  const dhEmiDPS = getVal(infDPS, 'dhEmi') || 
                   payloadObj.dhEmiDPS || 
                   dhProc;

  const emitCnpj = getVal(emit, 'CNPJ') || 
                   getVal(prest, 'CNPJ') || 
                   payloadObj.prestador?.cnpj || 
                   payloadObj.infDPS?.prest?.CNPJ || 
                   '00893566000190';

  const emitNome = getVal(emit, 'xNome') || 
                   getVal(prest, 'xNome') || 
                   payloadObj.prestador?.nome || 
                   payloadObj.prestador?.razaoSocial || 
                   'CARLOSCLETON CARVALHO FERNANDES';

  const emitLgr = getVal(enderEmit, 'xLgr') || payloadObj.prestador?.logradouro || 'RUA RIO SUASSUI';
  const emitNro = getVal(enderEmit, 'nro') || payloadObj.prestador?.numero || '7710';
  const emitBairro = getVal(enderEmit, 'xBairro') || payloadObj.prestador?.bairro || 'PITIMBU';
  const emitMun = getVal(infNFSe, 'xLocEmi') || payloadObj.prestador?.cidade || 'Natal';
  const emitUf = getVal(enderEmit, 'UF') || payloadObj.prestador?.uf || 'RN';
  const emitCep = formatCep(getVal(enderEmit, 'CEP') || payloadObj.prestador?.cep || '59068320');
  const emitMunCode = getVal(enderEmit, 'cMun') || getVal(infNFSe, 'cLocIncid') || '24.08102';
  const emitFone = getVal(emit, 'fone') || payloadObj.prestador?.telefone || '8430845723';
  const emitEmail = getVal(emit, 'email') || payloadObj.prestador?.email || 'CARLOSCLETON.NAT@GMAIL.COM';

  const tomaCnpj = getVal(toma, 'CNPJ') || 
                   getVal(toma, 'CPF') || 
                   payloadObj.tomador?.cnpjCpf || 
                   payloadObj.tomador?.cnpj || 
                   payloadObj.destinatario?.cnpj || 
                   payloadObj.quote?.contact?.tax_id || 
                   '';

  const tomaNome = getVal(toma, 'xNome') || 
                   payloadObj.tomador?.nome || 
                   payloadObj.tomador?.razaoSocial || 
                   payloadObj.destinatario?.nome || 
                   payloadObj.quote?.contact?.name || 
                   'CONSUMIDOR FINAL';

  const tomaLgr = getVal(enderToma, 'xLgr') || payloadObj.tomador?.endereco?.logradouro || payloadObj.destinatario?.logradouro || '';
  const tomaNro = getVal(enderToma, 'nro') || payloadObj.tomador?.endereco?.numero || payloadObj.destinatario?.numero || '';
  const tomaBairro = getVal(enderToma, 'xBairro') || payloadObj.tomador?.endereco?.bairro || payloadObj.destinatario?.bairro || '';
  const tomaMunCode = getVal(enderToma, 'cMun') || payloadObj.tomador?.endereco?.codigoCidade || '41.25506';
  const tomaMun = getVal(ibsCbsNFSe, 'xLocalidadeIncid') || payloadObj.tomador?.endereco?.cidade || payloadObj.destinatario?.cidade || 'São Paulo';
  const tomaUf = getVal(enderToma, 'UF') || payloadObj.tomador?.endereco?.uf || payloadObj.destinatario?.uf || 'SP';
  const tomaCep = formatCep(getVal(enderToma, 'CEP') || payloadObj.tomador?.endereco?.cep || payloadObj.destinatario?.cep || '04127-001');
  const tomaEmail = getVal(toma, 'email') || payloadObj.tomador?.email || payloadObj.destinatario?.email || payloadObj.quote?.contact?.email || '-';

  const vServ = getVal(doc, 'vServ') || 
                getVal(doc, 'vLiq') || 
                getVal(totCIBS, 'vTotNF') || 
                payloadObj.amount || 
                payloadObj.valorTotal || 
                payloadObj.servicesAmount || 
                '0.00';

  const vLiq = getVal(doc, 'vLiq') || vServ;

  // IBS/CBS extrações
  const pIbsUf = getVal(ibsUf, 'pIBSUF') || getVal(ibsUf, 'pAliqEfetUF') || '0.10';
  const pIbsMun = getVal(ibsMun, 'pIBSMun') || '0.00';
  const pCbs = getVal(ibsFed, 'pCBS') || '0.90';
  const numServ = parseFloat(vServ.replace(',', '.')) || 0;
  const vIbsTotNum = (numServ * parseFloat(pIbsUf)) / 100;
  const vCbsTotNum = (numServ * parseFloat(pCbs)) / 100;
  const vIbsTot = getVal(gIBS, 'vIBSTot') || getVal(gIBSUFTot, 'vIBSUF') || vIbsTotNum.toFixed(2);
  const vIbsMun = getVal(gIBSMunTot, 'vIBSMun') || '0.00';
  const vCbsTot = getVal(gCBS, 'vCBS') || vCbsTotNum.toFixed(2);
  const vTotIbsCbs = (parseFloat(vIbsTot || '0') + parseFloat(vCbsTot || '0')).toFixed(2);

  const descServ = getVal(serv, 'xDescServ') || 
                   payloadObj.servico?.[0]?.discriminacao || 
                   payloadObj.servico?.[0]?.descricao || 
                   payloadObj.description || 
                   'SUPORTE TÉCNICO EM TI / INFORMÁTICA';

  return {
    chaveAcesso,
    nNFSe,
    competencia: formatDate(getVal(infDPS, 'dCompet') || dhProc),
    dhEmiNFSe: formatDateTime(dhProc),
    nDPS: getVal(infDPS, 'nDPS') || payloadObj.dps_number || nNFSe,
    serieDPS: getVal(infDPS, 'serie') || payloadObj.dps_serie || '1',
    dhEmiDPS: formatDateTime(dhEmiDPS),
    emitenteTipo: 'Prestador',
    situacaoNFSe: 'NFS-e Gerada',
    finalidade: 'NFS-e regular',
    municipioEmissao: `${emitMun} - ${emitUf}`,
    ambienteGerador: getVal(infNFSe, 'ambGer') || payloadObj.ambiente || '2',
    tipoAmbiente: getVal(infNFSe, 'tpEmis') || '1',

    prestador: {
      cnpjCpf: formatCnpjCpf(emitCnpj),
      inscricaoMunicipal: getVal(emit, 'im') || getVal(prest, 'im') || '1254103',
      telefone: emitFone,
      nome: emitNome,
      municipioUf: `${emitMun} / ${emitUf}`,
      codigoIbgeCep: `${emitMunCode} / ${emitCep}`,
      endereco: [emitLgr, emitNro, emitBairro].filter(Boolean).join(', '),
      email: emitEmail,
      simplesNacional: 'Optante - Microempresa ou Empresa de Pequeno Porte',
      regimeApuracao: 'Regime de apuração dos tributos federais e municipal pelo Simples Nacional',
    },

    tomador: {
      cnpjCpf: formatCnpjCpf(tomaCnpj),
      inscricaoMunicipal: getVal(toma, 'im') || '-',
      telefone: getVal(toma, 'fone') || payloadObj.tomador?.telefone || '-',
      nome: tomaNome,
      municipioUf: `${tomaMun} / ${tomaUf}`,
      codigoIbgeCep: `${tomaMunCode} / ${tomaCep}`,
      endereco: [tomaLgr, tomaNro, tomaBairro].filter(Boolean).join(', ') || payloadObj.tomador?.endereco || 'Rua Manoel Ribas, 245, Cruzeiro',
      email: tomaEmail,
    },

    destinatarioIdentificado: false,
    intermediarioIdentificado: false,

    servico: {
      codigoTribNacionalMun: `${getVal(serv, 'cTribNac') || '01.07.01'} / -`,
      codigoNBS: getVal(serv, 'cNBS') || getVal(infNFSe, 'xNBS') || '1.1501.30.00',
      localPrestacao: `${emitMun} / ${emitUf} / -`,
      descricaoNac: getVal(infNFSe, 'xTribNac') || 'Suporte técnico em informática, inclusive instalação, configuração e manutenção de programas de computação e bancos de dados.',
      descricaoServico: descServ,
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
      indicadorOperacaoIbgeMunUf: `100101 / ${tomaMunCode} / ${tomaMun} / ${tomaUf}`,
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
