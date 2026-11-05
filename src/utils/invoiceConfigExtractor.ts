/**
 * Extrai dados de configuração fiscal (prestador + tributação) a partir de XML ou PDF de NFS-e.
 * Suporta: NFS-e Padrão Nacional (DANFSe v2.0 / DPS / NFSe) e ABRASF (maioria das prefeituras).
 * Saída neutra — o mapeamento para cada provedor fica em fiscalImportMappers.ts.
 */

export interface ExtractedFiscalData {
  layout: 'nacional' | 'abrasf' | 'desconhecido';
  numeroNota: string;
  numeroDps?: string;
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
  cstIbsCbs?: string;
  cClassTrib?: string;
  cIndOp?: string;
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
  const ibsCbs = byTag(infNFSe, 'IBSCBS') || byTag(infDPS, 'IBSCBS') || byTag(doc, 'gIBSCBS') || byTag(doc, 'IBSCBS');

  const opSimpNac = txt(regTrib, 'opSimpNac');
  const tpRet = txt(tribMun, 'tpRetISSQN');

  return {
    layout: 'nacional',
    numeroNota: txt(infNFSe, 'nNFSe') || txt(infDPS, 'nDPS'),
    numeroDps: txt(infDPS, 'nDPS'),
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
      cidade: txt(infNFSe, 'xLocEmi') || txt(ender, 'xMun'),
      codigoCidade: txt(ender, 'cMun') || txt(infDPS, 'cLocEmi'),
      uf: txt(ender, 'UF'),
      cep: onlyDigits(txt(ender, 'CEP')),
    },
    simplesNacional: opSimpNac ? opSimpNac !== '1' : null,
    opSimpNac,
    regApTribSN: txt(regTrib, 'regApTribSN'),
    regimeEspecial: txt(regTrib, 'regEspTrib'),
    cnae: txt(cServ, 'CNAE') || txt(serv, 'CNAE') || txt(doc, 'CNAE'),
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
    cNBS: txt(cServ, 'cNBS') || txt(serv, 'cNBS') || txt(doc, 'cNBS'),
    xInfComp: txt(doc, 'xInfComp', 'InfAdic', 'InformacoesComplementares', 'infAdic'),
    cstIbsCbs: txt(ibsCbs, 'CST', 'cstIBSCBS', 'cst'),
    cClassTrib: txt(ibsCbs, 'cClassTrib') || txt(doc, 'cClassTrib'),
    cIndOp: txt(ibsCbs, 'cIndOp') || txt(doc, 'cIndOp'),
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

/**
 * Extrai dados fiscais completos a partir do PDF de uma NFS-e (DANFSe Padrão Nacional ou ABRASF).
 */
export async function extractFiscalDataFromPdf(fileBuffer: ArrayBuffer): Promise<ExtractedFiscalData> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(fileBuffer) }).promise;
  const allLines: string[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = (content.items as any[])
      .filter(it => typeof it.str === 'string' && it.str.trim())
      .map(it => ({ str: it.str.trim(), x: Math.round(it.transform[4]), y: Math.round(it.transform[5]) }));
    items.sort((a, b) => b.y - a.y || a.x - b.x);

    let curLine: any[] = [];
    let curY: number | null = null;
    for (const it of items) {
      if (curY === null || Math.abs(it.y - curY) > 3) {
        if (curLine.length) allLines.push(curLine.map(x => x.str).join('   '));
        curLine = [it];
        curY = it.y;
      } else {
        curLine.push(it);
      }
    }
    if (curLine.length) allLines.push(curLine.map(x => x.str).join('   '));
  }

  const isNacional = allLines.some(l => /DANFSe|Portal Nacional da NFS-e|CHAVE DE ACESSO DA NFS-e|NFS-e Padrão Nacional/i.test(l));

  if (isNacional) {
    return parseDanfsePdf(allLines);
  }

  return parseAbrasfPdf(allLines);
}

function parseDanfsePdf(lines: string[]): ExtractedFiscalData {
  const findLineAfter = (headerPattern: RegExp) => {
    const idx = lines.findIndex(l => headerPattern.test(l));
    return idx !== -1 && idx + 1 < lines.length ? lines[idx + 1] : '';
  };

  // 1. Prestador (CNPJ, Inscrição Municipal, Telefone)
  let cnpj = '', inscricaoMunicipal = '', telefone = '';
  const prestHeaderIdx = lines.findIndex(l => /PRESTADOR\s*\/\s*FORNECEDOR/i.test(l));
  if (prestHeaderIdx !== -1 && prestHeaderIdx + 1 < lines.length) {
    const line = lines[prestHeaderIdx + 1];
    const parts = line.split(/\s{2,}|\t/);
    if (parts[0]) cnpj = onlyDigits(parts[0]);
    if (parts[1] && parts[1] !== '-') inscricaoMunicipal = parts[1].trim();
    if (parts[2] && parts[2] !== '-') telefone = onlyDigits(parts[2]);
  }

  // 2. Razão Social, Município, UF, IBGE, CEP
  let razaoSocial = '', cidade = '', uf = '', codigoCidade = '', cep = '';
  const nomeHeaderIdx = lines.findIndex((l, i) => i > prestHeaderIdx && /Nome\s*\/\s*Nome Empresarial/i.test(l));
  if (nomeHeaderIdx !== -1 && nomeHeaderIdx + 1 < lines.length) {
    const l1 = lines[nomeHeaderIdx + 1];
    const parts = l1.split(/\s{2,}|\t/);
    razaoSocial = parts[0] || '';
    if (parts[1]) {
      const munUf = parts[1].split('/');
      cidade = munUf[0]?.trim() || '';
      uf = munUf[1]?.trim() || '';
    }
    if (parts[2]) {
      const ibgeCep = parts[2].split('/');
      codigoCidade = onlyDigits(ibgeCep[0] || '');
      cep = onlyDigits(ibgeCep[1] || '');
    }
    let nextIdx = nomeHeaderIdx + 2;
    while (nextIdx < lines.length && !/Endereço/i.test(lines[nextIdx]) && !/TOMADOR/i.test(lines[nextIdx])) {
      razaoSocial += ' ' + lines[nextIdx].trim();
      nextIdx++;
    }
  }

  // 3. Endereço e Email
  let logradouro = '', numero = '', bairro = '', email = '';
  const endHeaderIdx = lines.findIndex((l, i) => i > prestHeaderIdx && /Endereço/i.test(l) && /E-mail/i.test(l));
  if (endHeaderIdx !== -1 && endHeaderIdx + 1 < lines.length) {
    const l = lines[endHeaderIdx + 1];
    const emailMatch = l.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch) {
      email = emailMatch[0];
      logradouro = l.replace(emailMatch[0], '').replace(/\s{2,}|\t/, ' ').trim();
    } else {
      logradouro = l.trim();
    }
    const addrParts = logradouro.split(',').map(s => s.trim());
    if (addrParts.length >= 3) {
      logradouro = addrParts[0];
      numero = addrParts[1];
      bairro = addrParts.slice(2).join(', ');
    } else if (addrParts.length === 2) {
      logradouro = addrParts[0];
      numero = addrParts[1];
    }
  }

  // 4. Simples Nacional
  let opSimpNac = '1';
  let simplesNacional = false;
  const snHeaderIdx = lines.findIndex((l, i) => i > prestHeaderIdx && /Simples Nacional na Data/i.test(l));
  if (snHeaderIdx !== -1 && snHeaderIdx + 1 < lines.length) {
    const snLine = lines[snHeaderIdx + 1];
    if (/Não optante/i.test(snLine)) {
      opSimpNac = '1';
      simplesNacional = false;
    } else if (/MEI/i.test(snLine) || /Microempreendedor/i.test(snLine)) {
      opSimpNac = '2';
      simplesNacional = true;
    } else if (/Optante/i.test(snLine)) {
      opSimpNac = '3';
      simplesNacional = true;
    }
  }

  // 5. Números e DPS
  const dpsLine = findLineAfter(/NÚMERO DA DPS/i);
  let numeroDps = '', serie = '';
  const dpsMatch = dpsLine.match(/(\d+)\s+(\d+)\s+\d{2}\/\d{2}\/\d{4}/);
  if (dpsMatch) {
    numeroDps = dpsMatch[1];
    serie = dpsMatch[2];
  }
  const nfseLine = findLineAfter(/NÚMERO DA NFS-e/i);
  const numeroNota = nfseLine.split(/\s+/)[0] || '';

  // 6. Serviço (cTribNac, cNBS)
  let codigoServico = '', cNBS = '';
  const servHeaderIdx = lines.findIndex(l => /SERVIÇO PRESTADO/i.test(l) || /Código de Tributação Nacional/i.test(l));
  if (servHeaderIdx !== -1 && servHeaderIdx + 1 < lines.length) {
    const l = lines[servHeaderIdx + 1];
    const parts = l.split(/\s{2,}|\t/);
    if (parts[0]) codigoServico = onlyDigits(parts[0].split('/')[0]);
    if (parts[1]) cNBS = parts[1].trim();
  }

  // 7. Descrição do Serviço
  let descricaoServico = '';
  const descHeaderIdx = lines.findIndex(l => /^Descrição do Serviço/i.test(l.trim()));
  if (descHeaderIdx !== -1 && descHeaderIdx + 1 < lines.length) {
    let nextIdx = descHeaderIdx + 1;
    const descLines: string[] = [];
    while (nextIdx < lines.length && !/TRIBUTAÇÃO/i.test(lines[nextIdx]) && !/Tipo de Tributação do ISSQN/i.test(lines[nextIdx])) {
      descLines.push(lines[nextIdx].trim());
      nextIdx++;
    }
    descricaoServico = descLines.join(' ');
  }

  // 8. Regime Especial
  let regimeEspecial = '0';
  const regEspIdx = lines.findIndex(l => /Regime Especial de Tributação/i.test(l));
  if (regEspIdx !== -1 && regEspIdx + 1 < lines.length) {
    const regLine = lines[regEspIdx + 1];
    if (/Ato Cooperado|Cooperativa/i.test(regLine)) regimeEspecial = '4';
    else if (/Microempresa municipal/i.test(regLine)) regimeEspecial = '1';
    else if (/Estimativa/i.test(regLine)) regimeEspecial = '2';
    else if (/Sociedade de profissionais/i.test(regLine)) regimeEspecial = '3';
    else if (/MEI|Microempresário Individual/i.test(regLine)) regimeEspecial = '5';
    else if (/ME\/EPP|Microempresa ou EPP/i.test(regLine)) regimeEspecial = '6';
  }

  // 9. Tributação ISSQN
  let tribIssqn = '1';
  const tribIssIdx = lines.findIndex(l => /Tipo de Tributação do ISSQN/i.test(l));
  if (tribIssIdx !== -1 && tribIssIdx + 1 < lines.length) {
    const l = lines[tribIssIdx + 1];
    if (/Exportação/i.test(l)) tribIssqn = '2';
    else if (/Não Incidência/i.test(l)) tribIssqn = '3';
    else if (/Imunidade/i.test(l)) tribIssqn = '4';
  }

  // 10. Retenção e Alíquota ISSQN
  let tpRetIssqn = '1';
  let issRetido: boolean | null = false;
  let issAliquota = '';
  const issHeaderIdx = lines.findIndex(l => /BC ISSQN\s+Alíquota Aplicada/i.test(l));
  if (issHeaderIdx !== -1 && issHeaderIdx + 1 < lines.length) {
    const l = lines[issHeaderIdx + 1];
    if (/Retido/i.test(l) && !/Não Retido/i.test(l)) {
      tpRetIssqn = '2';
      issRetido = true;
    }
    const aliqMatch = l.match(/(\d+[.,]\d+)\s*%/);
    if (aliqMatch) issAliquota = parseFloat(aliqMatch[1].replace(',', '.')).toFixed(2);
  }

  // 11. Tributação IBS / CBS
  let cstIbsCbs = '', cClassTrib = '', cIndOp = '', ibsAliquota = '', cbsAliquota = '';
  const ibsCbsHeaderIdx = lines.findIndex(l => /TRIBUTAÇÃO IBS\/CBS/i.test(l) || /CST\s*\/\s*cClassTrib/i.test(l));
  if (ibsCbsHeaderIdx !== -1 && ibsCbsHeaderIdx + 1 < lines.length) {
    const l = lines[ibsCbsHeaderIdx + 1];
    const match = l.match(/(\d+)\s*\/\s*(\d+)\s+(\d+)/);
    if (match) {
      cstIbsCbs = match[1];
      cClassTrib = match[2];
      cIndOp = match[3];
    }
  }

  const ibsAliqLine = lines.find(l => /Alíquota - IBS UF \/ IBS Mun/i.test(l));
  if (ibsAliqLine) {
    const nextL = lines[lines.indexOf(ibsAliqLine) + 1] || '';
    const matches = [...nextL.matchAll(/(\d+[.,]\d+)\s*%/g)];
    if (matches.length >= 2) {
      const ufVal = parseFloat(matches[matches.length - 2][1].replace(',', '.')) || 0;
      const munVal = parseFloat(matches[matches.length - 1][1].replace(',', '.')) || 0;
      ibsAliquota = (ufVal + munVal).toFixed(2);
    }
  }

  const cbsAliqLine = lines.find(l => /Alíquota - CBS/i.test(l));
  if (cbsAliqLine) {
    const nextL = lines[lines.indexOf(cbsAliqLine) + 1] || '';
    const m = nextL.match(/(\d+[.,]\d+)\s*%/);
    if (m) cbsAliquota = parseFloat(m[1].replace(',', '.')).toFixed(2);
  }

  // 12. Informações Complementares
  let xInfComp = '';
  const infCompIdx = lines.findIndex(l => /^INFORMAÇÕES COMPLEMENTARES/i.test(l.trim()));
  if (infCompIdx !== -1) {
    let nextIdx = infCompIdx + 1;
    const infLines: string[] = [];
    while (nextIdx < lines.length && !/DATA CIENTIFICAÇÃO/i.test(lines[nextIdx]) && !/IDENTIFICAÇÃO E ASSINATURA/i.test(lines[nextIdx])) {
      infLines.push(lines[nextIdx].trim());
      nextIdx++;
    }
    xInfComp = infLines.join('\n');
  }

  return {
    layout: 'nacional',
    numeroNota: numeroNota || numeroDps,
    numeroDps,
    serie,
    cnpj,
    inscricaoMunicipal,
    inscricaoEstadual: '',
    razaoSocial,
    nomeFantasia: '',
    email,
    telefone,
    endereco: {
      logradouro,
      numero,
      complemento: '',
      bairro,
      cidade,
      codigoCidade,
      uf,
      cep,
    },
    simplesNacional,
    opSimpNac,
    regApTribSN: '',
    regimeEspecial,
    cnae: '',
    codigoServico,
    codigoTributacaoMunicipio: '',
    descricaoServico,
    issAliquota,
    tribIssqn,
    issRetido,
    tpRetIssqn,
    exigibilidadeIss: '',
    pisAliquota: '',
    cofinsAliquota: '',
    csllAliquota: '',
    irrfAliquota: '',
    pisCofinsCst: '',
    totTribSN: '',
    ibsAliquota,
    cbsAliquota,
    cNBS,
    xInfComp,
    cstIbsCbs,
    cClassTrib,
    cIndOp,
  };
}

function parseAbrasfPdf(lines: string[]): ExtractedFiscalData {
  const fullText = lines.join('\n');

  // Regex utilitárias
  const cnpjMatch = fullText.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/);
  const cnpj = cnpjMatch ? onlyDigits(cnpjMatch[0]) : '';

  const imMatch = fullText.match(/Inscri[çc][ãa]o\s*Municipal[:\s]+(\d+)/i);
  const inscricaoMunicipal = imMatch ? imMatch[1] : '';

  const cepMatch = fullText.match(/\b\d{2}\.?\d{3}-?\d{3}\b/);
  const cep = cepMatch ? onlyDigits(cepMatch[0]) : '';

  const emailMatch = fullText.match(/[\w.-]+@[\w.-]+\.\w+/);
  const email = emailMatch ? emailMatch[0] : '';

  const foneMatch = fullText.match(/\(?\d{2}\)?\s*9?\d{4}-?\d{4}/);
  const telefone = foneMatch ? onlyDigits(foneMatch[0]) : '';

  const aliqMatch = fullText.match(/Al[íi]quota[:\s]+(\d+[.,]\d+)\s*%/i);
  const issAliquota = aliqMatch ? parseFloat(aliqMatch[1].replace(',', '.')).toFixed(2) : '';

  const itemServMatch = fullText.match(/Item\s+da\s+Lista\s+de\s+Servi[çc]os?[:\s]+(\d{1,2}\.?\d{2})/i);
  const codigoServico = itemServMatch ? itemServMatch[1].replace('.', '') : '';

  let razaoSocial = '';
  const prestIdx = lines.findIndex(l => /PRESTADOR DE SERVI[ÇC]OS?/i.test(l));
  if (prestIdx !== -1 && prestIdx + 1 < lines.length) {
    razaoSocial = lines[prestIdx + 1].trim();
  }

  let descricaoServico = '';
  const discrIdx = lines.findIndex(l => /DISCRIMINA[ÇC][ÃA]O\s+DOS\s+SERVI[ÇC]OS/i.test(l));
  if (discrIdx !== -1) {
    const descParts: string[] = [];
    let i = discrIdx + 1;
    while (i < lines.length && !/VALOR|RETEN|TRIBUT/i.test(lines[i])) {
      descParts.push(lines[i].trim());
      i++;
    }
    descricaoServico = descParts.join(' ');
  }

  const isSimples = /Optante\s+pelo\s+Simples\s+Nacional[:\s]+Sim/i.test(fullText);

  return {
    layout: 'abrasf',
    numeroNota: '',
    serie: '',
    cnpj,
    inscricaoMunicipal,
    inscricaoEstadual: '',
    razaoSocial,
    nomeFantasia: '',
    email,
    telefone,
    endereco: {
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      codigoCidade: '',
      uf: '',
      cep,
    },
    simplesNacional: isSimples,
    opSimpNac: isSimples ? '3' : '1',
    regApTribSN: '',
    regimeEspecial: '',
    cnae: '',
    codigoServico,
    codigoTributacaoMunicipio: '',
    descricaoServico,
    issAliquota,
    tribIssqn: '',
    issRetido: null,
    tpRetIssqn: '',
    exigibilidadeIss: '',
    pisAliquota: '',
    cofinsAliquota: '',
    csllAliquota: '',
    irrfAliquota: '',
    pisCofinsCst: '',
    totTribSN: '',
    ibsAliquota: '',
    cbsAliquota: '',
  };
}
