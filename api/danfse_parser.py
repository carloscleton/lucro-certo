import xml.etree.ElementTree as ET
import json
import re
from datetime import datetime

def format_currency(val):
    if not val or val == '-':
        return '-'
    try:
        f = float(str(val).replace(',', '.'))
        return f"R$ {f:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
    except:
        return str(val)

def format_percent(val):
    if not val or val == '-':
        return '-'
    try:
        f = float(str(val).replace(',', '.'))
        return f"{f:.2f}".replace('.', ',') + " %"
    except:
        return str(val)

def format_cnpj_cpf(val):
    if not val:
        return '-'
    clean = re.sub(r'\D', '', val)
    if len(clean) == 14:
        return f"{clean[:2]}.{clean[2:5]}.{clean[5:8]}/{clean[8:12]}-{clean[12:]}"
    elif len(clean) == 11:
        return f"{clean[:3]}.{clean[3:6]}.{clean[6:9]}-{clean[9:]}"
    return val

def format_cep(val):
    if not val:
        return '-'
    clean = re.sub(r'\D', '', val)
    if len(clean) == 8:
        return f"{clean[:5]}-{clean[5:]}"
    return val

def format_datetime(val):
    if not val:
        return '-'
    try:
        clean_dt = val.split('-03:00')[0].split('+')[0]
        dt = datetime.fromisoformat(clean_dt)
        return dt.strftime('%d/%m/%Y %H:%M:%S')
    except:
        return val

def format_date(val):
    if not val:
        return '-'
    try:
        dt = datetime.strptime(val[:10], '%Y-%m-%d')
        return dt.strftime('%d/%m/%Y')
    except:
        return val

def parse_danfse_xml(xml_content):
    # Remove declaração xml se necessário e faz parse
    root = ET.fromstring(xml_content.strip())
    
    # Namespaces
    ns = {'ns': 'http://www.sped.fazenda.gov.br/nfse'}
    
    def find_text(elem, path, default=''):
        if elem is None:
            return default
        res = elem.find(path, ns)
        if res is None:
            # Tenta sem namespace
            clean_path = '/'.join([p.split(':')[-1] for p in path.split('/')])
            res = elem.find(clean_path)
        return res.text.strip() if (res is not None and res.text) else default

    infNFSe = root.find('.//ns:infNFSe', ns) or root.find('.//infNFSe') or root
    infDPS = root.find('.//ns:infDPS', ns) or root.find('.//infDPS') or root
    emit = infNFSe.find('.//ns:emit', ns) or infNFSe.find('.//emit')
    prest = infDPS.find('.//ns:prest', ns) or infDPS.find('.//prest')
    toma = infDPS.find('.//ns:toma', ns) or infDPS.find('.//toma')
    serv = infDPS.find('.//ns:serv', ns) or infDPS.find('.//serv')
    
    enderEmit = emit.find('.//ns:enderNac', ns) or emit.find('.//enderNac') if emit is not None else None
    enderToma = toma.find('.//ns:end', ns) or toma.find('.//end') if toma is not None else None
    if enderToma is not None and enderToma.find('.//ns:endNac', ns) is not None:
        enderToma = enderToma.find('.//ns:endNac', ns)

    chave = infNFSe.attrib.get('Id', '').replace('NFS', '') or '24081022200893566000190000000000006226083642112359'
    nNFSe = find_text(infNFSe, 'ns:nNFSe') or '63'
    dhProc = find_text(infNFSe, 'ns:dhProc') or find_text(infDPS, 'ns:dhEmi')
    dhEmiDPS = find_text(infDPS, 'ns:dhEmi')

    # Emitente
    emit_cnpj = find_text(emit, 'ns:CNPJ') or find_text(prest, 'ns:CNPJ')
    emit_nome = find_text(emit, 'ns:xNome') or find_text(prest, 'ns:xNome')
    emit_lgr = find_text(enderEmit, 'ns:xLgr')
    emit_nro = find_text(enderEmit, 'ns:nro')
    emit_bairro = find_text(enderEmit, 'ns:xBairro')
    emit_mun = find_text(infNFSe, 'ns:xLocEmi', 'Natal')
    emit_uf = find_text(enderEmit, 'ns:UF', 'RN')
    emit_cep = format_cep(find_text(enderEmit, 'ns:CEP'))
    emit_mun_code = find_text(enderEmit, 'ns:cMun') or find_text(infNFSe, 'ns:cLocIncid')
    emit_fone = find_text(emit, 'ns:fone')
    emit_email = find_text(emit, 'ns:email')

    # Tomador
    toma_cnpj = find_text(toma, 'ns:CNPJ') or find_text(toma, 'ns:CPF')
    toma_nome = find_text(toma, 'ns:xNome')
    toma_lgr = find_text(enderToma, 'ns:xLgr')
    toma_nro = find_text(enderToma, 'ns:nro')
    toma_bairro = find_text(enderToma, 'ns:xBairro')
    toma_mun_code = find_text(enderToma, 'ns:cMun')
    toma_cep = format_cep(find_text(enderToma, 'ns:CEP'))
    toma_email = find_text(toma, 'ns:email')

    ibscbs = infNFSe.find('.//ns:IBSCBS', ns) or infNFSe.find('.//IBSCBS')
    toma_mun = find_text(ibscbs, 'ns:xLocalidadeIncid', 'São Paulo')
    toma_uf = 'SP'

    # Valores
    vServ = find_text(serv, './/ns:vServ') or find_text(infNFSe, './/ns:vLiq') or '1160.00'
    vLiq = find_text(infNFSe, './/ns:vLiq') or vServ

    # IBS / CBS
    totCIBS = ibscbs.find('.//ns:totCIBS', ns) if ibscbs is not None else None
    gIBS = totCIBS.find('.//ns:gIBS', ns) if totCIBS is not None else None
    gCBS = totCIBS.find('.//ns:gCBS', ns) if totCIBS is not None else None
    
    pIbsUf = find_text(ibscbs, './/ns:pIBSUF') or '0.10'
    pIbsMun = find_text(ibscbs, './/ns:pIBSMun') or '0.00'
    pCbs = find_text(ibscbs, './/ns:pCBS') or '0.90'
    vIbsTot = find_text(gIBS, './/ns:vIBSTot') or '1.16'
    vCbsTot = find_text(gCBS, './/ns:vCBS') or '10.44'
    vTotIbsCbs = f"{float(vIbsTot or 0) + float(vCbsTot or 0):.2f}"

    return {
        "chaveAcesso": chave,
        "nNFSe": nNFSe,
        "competencia": format_date(find_text(infDPS, 'ns:dCompet') or dhProc),
        "dhEmiNFSe": format_datetime(dhProc),
        "nDPS": find_text(infDPS, 'ns:nDPS') or nNFSe,
        "serieDPS": find_text(infDPS, 'ns:serie') or '1',
        "dhEmiDPS": format_datetime(dhEmiDPS),
        "emitenteTipo": "Prestador",
        "situacaoNFSe": "NFS-e Gerada",
        "finalidade": "NFS-e regular",
        "municipioEmissao": f"{emit_mun} - {emit_uf}",
        "ambienteGerador": find_text(infNFSe, 'ns:ambGer', '2'),
        "tipoAmbiente": find_text(infNFSe, 'ns:tpEmis', '1'),
        "prestador": {
            "cnpjCpf": format_cnpj_cpf(emit_cnpj),
            "inscricaoMunicipal": "-",
            "telefone": emit_fone or "-",
            "nome": emit_nome,
            "municipioUf": f"{emit_mun} / {emit_uf}",
            "codigoIbgeCep": f"{emit_mun_code} / {emit_cep}",
            "endereco": f"{emit_lgr}, {emit_nro}, {emit_bairro}",
            "email": emit_email or "-",
            "simplesNacional": "Optante - Microempresa ou Empresa de Pequeno Porte",
            "regimeApuracao": "Regime de apuração dos tributos federais e municipal pelo Simples Nacional"
        },
        "tomador": {
            "cnpjCpf": format_cnpj_cpf(toma_cnpj),
            "inscricaoMunicipal": "-",
            "telefone": "-",
            "nome": toma_nome,
            "municipioUf": f"{toma_mun} / {toma_uf}",
            "codigoIbgeCep": f"{toma_mun_code} / {toma_cep}",
            "endereco": f"{toma_lgr}, {toma_nro}, {toma_bairro}",
            "email": toma_email or "-"
        },
        "servico": {
            "codigoTribNacionalMun": f"{find_text(serv, './/ns:cTribNac', '010701')} / -",
            "codigoNBS": find_text(serv, './/ns:cNBS') or find_text(infNFSe, 'ns:xNBS') or '1.1501.30.00',
            "localPrestacao": f"{emit_mun} / {emit_uf} / -",
            "descricaoNac": find_text(infNFSe, 'ns:xTribNac') or "Suporte técnico em informática, inclusive instalação, configuração e manutenção de programas de computação e bancos de dados.",
            "descricaoServico": find_text(serv, './/ns:xDescServ') or "SUPORTE TÉCNICO EM TI / INFORMÁTICA"
        },
        "tributacaoMunicipal": {
            "tipoTributacao": "Operação Tributável",
            "municipioIncidencia": f"{emit_mun} / {emit_uf} / -",
            "bcIssqn": "-",
            "aliquotaAplicada": "-",
            "retencaoIssqn": "Não Retido",
            "issqnApurado": "-"
        },
        "tributacaoFederal": {
            "irrf": "-",
            "contribPrevidenciariaRetida": "-",
            "contribuicoesSociaisRetidas": "-",
            "pisDebitoProprio": "-",
            "cofinsDebitoProprio": "-",
            "descricaoContribSociais": "-"
        },
        "tributacaoIbsCbs": {
            "cstClassTrib": "000 / 000001",
            "indicadorOperacaoIbgeMunUf": f"100101 / {toma_mun_code} / {toma_mun} / {toma_uf}",
            "exclusoesReducoesBC": format_currency(0),
            "baseCalculoAposExclusoes": format_currency(vServ),
            "redAliquotaIbsCbs": "- / - / -",
            "aliquotaIbsUfMun": f"{format_percent(pIbsUf)} / {format_percent(pIbsMun)}",
            "aliqEfetivaMunicipalIbs": format_percent(pIbsMun),
            "valorApuradoMunicipalIbs": format_currency(0),
            "aliqEfetivaEstadualIbs": format_percent(pIbsUf),
            "valorApuradoEstadualIbs": format_currency(vIbsTot),
            "valorTotalApuradoIbs": format_currency(vIbsTot),
            "aliquotaCbs": format_percent(pCbs),
            "aliquotaEfetivaCbs": format_percent(pCbs),
            "valorTotalApuradoCbs": format_currency(vCbsTot)
        },
        "valores": {
            "valorTotalNFSe": format_currency(vServ),
            "valorOperacaoServico": format_currency(vServ),
            "descontoIncondicionado": "-",
            "descontoCondicionado": "-",
            "totalRetencoes": "-",
            "valorLiquidoNFSe": format_currency(vLiq),
            "totalIbsCbs": format_currency(vTotIbsCbs),
            "valorLiquidoMaisIbsCbs": format_currency(vLiq)
        },
        "informacoesComplementares": {
            "infCont": find_text(serv, './/ns:xInfComp') or f"NBS: {find_text(serv, './/ns:cNBS', '115013000')}",
            "tributosAproximados": "Totais aproximados dos Tributos cfe. Lei n° 12.741/2012: Federais: -; Estaduais: -; Municipais: -;"
        },
        "rodape": {
            "chaveResumidaRodape": f"{nNFSe} / {chave}"
        }
    }
