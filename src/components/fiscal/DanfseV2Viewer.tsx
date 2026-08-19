import React, { useMemo } from 'react';
import { DanfseV2Data, parseDanfseXml } from '../../utils/danfseV2Parser';
import QRCode from 'qrcode';
import './danfseV2.css';

interface DanfseV2ViewerProps {
  xmlString?: string;
  data?: DanfseV2Data;
  onPrint?: () => void;
}

export const DanfseV2Viewer: React.FC<DanfseV2ViewerProps> = ({ xmlString, data: propData, onPrint }) => {
  const data: DanfseV2Data | null = useMemo(() => {
    if (propData) return propData;
    if (xmlString) {
      try {
        return parseDanfseXml(xmlString);
      } catch (err) {
        console.error('Erro ao fazer parse do XML da DANFSe:', err);
        return null;
      }
    }
    return null;
  }, [propData, xmlString]);

  // Gera o QR Code Data URL para a chave de acesso
  const qrCodeUrl = useMemo(() => {
    if (!data?.chaveAcesso) return '';
    const portalUrl = `https://www.nfse.gov.br/consultapublica/qr?chave=${data.chaveAcesso}`;
    try {
      let url = '';
      QRCode.toDataURL(portalUrl, { margin: 1, width: 100 }, (err, res) => {
        if (!err && res) url = res;
      });
      return url || `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(portalUrl)}`;
    } catch {
      return `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(portalUrl)}`;
    }
  }, [data?.chaveAcesso]);

  if (!data) {
    return (
      <div className="p-6 text-center text-red-600 bg-red-50 rounded-lg border border-red-200">
        Nenhum dado válido de NFS-e ou XML foi fornecido para exibição da DANFSe v2.0.
      </div>
    );
  }

  return (
    <div className="danfse-container">
      {/* Botão de impressão (somente tela) */}
      <div className="no-print mb-4 flex justify-end">
        <button
          onClick={onPrint || (() => window.print())}
          className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium text-sm hover:bg-blue-700 shadow-sm flex items-center gap-2 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Imprimir DANFSe v2.0
        </button>
      </div>

      {/* CABEÇALHO DA NFS-E */}
      <div className="danfse-header">
        <div className="danfse-logo-area">
          <svg className="w-10 h-10 text-emerald-600" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="8" fill="#008855" />
            <path d="M12 20L18 26L28 14" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <div className="danfse-logo-text">NFS-e</div>
            <div style={{ fontSize: '6.5pt', color: '#555', marginTop: '-2px' }}>Nota Fiscal de Serviço eletrônica</div>
          </div>
        </div>

        <div className="danfse-title-area">
          <div className="danfse-title-main">DANFSe v2.0</div>
          <div className="danfse-title-sub">Documento Auxiliar da NFS-e</div>
        </div>

        <div className="danfse-meta-area">
          <div><strong>Município:</strong> {data.municipioEmissao}</div>
          <div><strong>Ambiente Gerador:</strong> {data.ambienteGerador}</div>
          <div><strong>Tipo de Ambiente:</strong> {data.tipoAmbiente}</div>
        </div>
      </div>

      {/* CHAVE DE ACESSO E QR CODE */}
      <div className="danfse-chave-box">
        <div className="danfse-chave-info">
          <div className="danfse-label">CHAVE DE ACESSO DA NFS-e</div>
          <div className="danfse-chave-num">{data.chaveAcesso}</div>
        </div>
        <div className="danfse-qr-info">
          {qrCodeUrl ? (
            <img src={qrCodeUrl} alt="QR Code NFS-e" className="danfse-qr-img" />
          ) : (
            <div className="w-16 h-16 bg-gray-200" />
          )}
          <div className="danfse-qr-text">
            A autenticidade desta NFS-e pode ser verificada pela leitura deste código QR ou pela consulta da chave de acesso no portal nacional da NFS-e
          </div>
        </div>
      </div>

      {/* BLOCO 1: DADOS CABEÇALHO */}
      <div className="danfse-box">
        <div className="danfse-row">
          <div className="danfse-col w-20">
            <span className="danfse-label">NÚMERO DA NFS-e</span>
            <span className="danfse-value danfse-value-bold">{data.nNFSe}</span>
          </div>
          <div className="danfse-col w-20">
            <span className="danfse-label">COMPETÊNCIA DA NFS-e</span>
            <span className="danfse-value">{data.competencia}</span>
          </div>
          <div className="danfse-col w-60">
            <span className="danfse-label">DATA E HORA DA EMISSÃO DA NFS-e</span>
            <span className="danfse-value">{data.dhEmiNFSe}</span>
          </div>
        </div>
        <div className="danfse-row">
          <div className="danfse-col w-20">
            <span className="danfse-label">NÚMERO DA DPS</span>
            <span className="danfse-value">{data.nDPS}</span>
          </div>
          <div className="danfse-col w-20">
            <span className="danfse-label">SÉRIE DA DPS</span>
            <span className="danfse-value">{data.serieDPS}</span>
          </div>
          <div className="danfse-col w-60">
            <span className="danfse-label">DATA E HORA DA EMISSÃO DA DPS</span>
            <span className="danfse-value">{data.dhEmiDPS}</span>
          </div>
        </div>
        <div className="danfse-row">
          <div className="danfse-col w-33">
            <span className="danfse-label">EMITENTE DA NFS-e</span>
            <span className="danfse-value">{data.emitenteTipo}</span>
          </div>
          <div className="danfse-col w-33">
            <span className="danfse-label">SITUAÇÃO DA NFS-e</span>
            <span className="danfse-value">{data.situacaoNFSe}</span>
          </div>
          <div className="danfse-col w-33">
            <span className="danfse-label">FINALIDADE</span>
            <span className="danfse-value">{data.finalidade}</span>
          </div>
        </div>
      </div>

      {/* BLOCO 2: PRESTADOR / FORNECEDOR */}
      <div className="danfse-box mt-1">
        <div className="danfse-section-header">PRESTADOR / FORNECEDOR</div>
        <div className="danfse-row">
          <div className="danfse-col w-40">
            <span className="danfse-label">CNPJ / CPF / NIF</span>
            <span className="danfse-value">{data.prestador.cnpjCpf}</span>
          </div>
          <div className="danfse-col w-35">
            <span className="danfse-label">Indicador Municipal (Inscrição)</span>
            <span className="danfse-value">{data.prestador.inscricaoMunicipal}</span>
          </div>
          <div className="danfse-col w-25">
            <span className="danfse-label">Telefone</span>
            <span className="danfse-value">{data.prestador.telefone}</span>
          </div>
        </div>
        <div className="danfse-row">
          <div className="danfse-col w-40">
            <span className="danfse-label">Nome / Nome Empresarial</span>
            <span className="danfse-value danfse-value-bold">{data.prestador.nome}</span>
          </div>
          <div className="danfse-col w-35">
            <span className="danfse-label">Município / Sigla UF</span>
            <span className="danfse-value">{data.prestador.municipioUf}</span>
          </div>
          <div className="danfse-col w-25">
            <span className="danfse-label">Código IBGE / CEP</span>
            <span className="danfse-value">{data.prestador.codigoIbgeCep}</span>
          </div>
        </div>
        <div className="danfse-row">
          <div className="danfse-col w-75">
            <span className="danfse-label">Endereço</span>
            <span className="danfse-value">{data.prestador.endereco}</span>
          </div>
          <div className="danfse-col w-25">
            <span className="danfse-label">E-mail</span>
            <span className="danfse-value">{data.prestador.email}</span>
          </div>
        </div>
        <div className="danfse-row">
          <div className="danfse-col w-50">
            <span className="danfse-label">Simples Nacional na Data de Competência</span>
            <span className="danfse-value">{data.prestador.simplesNacional}</span>
          </div>
          <div className="danfse-col w-50">
            <span className="danfse-label">Regime de Apuração Tributária pelo SN</span>
            <span className="danfse-value">{data.prestador.regimeApuracao}</span>
          </div>
        </div>
      </div>

      {/* BLOCO 3: TOMADOR / ADQUIRENTE */}
      <div className="danfse-box mt-1">
        <div className="danfse-section-header">TOMADOR / ADQUIRENTE</div>
        <div className="danfse-row">
          <div className="danfse-col w-40">
            <span className="danfse-label">CNPJ / CPF / NIF</span>
            <span className="danfse-value">{data.tomador.cnpjCpf}</span>
          </div>
          <div className="danfse-col w-35">
            <span className="danfse-label">Indicador Municipal (Inscrição)</span>
            <span className="danfse-value">{data.tomador.inscricaoMunicipal}</span>
          </div>
          <div className="danfse-col w-25">
            <span className="danfse-label">Telefone</span>
            <span className="danfse-value">{data.tomador.telefone}</span>
          </div>
        </div>
        <div className="danfse-row">
          <div className="danfse-col w-40">
            <span className="danfse-label">Nome / Nome Empresarial</span>
            <span className="danfse-value danfse-value-bold">{data.tomador.nome}</span>
          </div>
          <div className="danfse-col w-35">
            <span className="danfse-label">Município / Sigla UF</span>
            <span className="danfse-value">{data.tomador.municipioUf}</span>
          </div>
          <div className="danfse-col w-25">
            <span className="danfse-label">Código IBGE / CEP</span>
            <span className="danfse-value">{data.tomador.codigoIbgeCep}</span>
          </div>
        </div>
        <div className="danfse-row">
          <div className="danfse-col w-60">
            <span className="danfse-label">Endereço</span>
            <span className="danfse-value">{data.tomador.endereco}</span>
          </div>
          <div className="danfse-col w-40">
            <span className="danfse-label">E-mail</span>
            <span className="danfse-value">{data.tomador.email}</span>
          </div>
        </div>
      </div>

      {/* BLOCO 4: INTERMEDIÁRIO / DESTINATÁRIO */}
      <div className="danfse-box mt-1">
        <div className="danfse-sub-header">DESTINATÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e</div>
        <div className="danfse-sub-header" style={{ borderBottom: 'none' }}>INTERMEDIÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e</div>
      </div>

      {/* BLOCO 5: SERVIÇO PRESTADO */}
      <div className="danfse-box mt-1">
        <div className="danfse-section-header">SERVIÇO PRESTADO</div>
        <div className="danfse-row">
          <div className="danfse-col w-35">
            <span className="danfse-label">Código de Tributação Nacional/Municipal</span>
            <span className="danfse-value">{data.servico.codigoTribNacionalMun}</span>
          </div>
          <div className="danfse-col w-25">
            <span className="danfse-label">Código da NBS</span>
            <span className="danfse-value">{data.servico.codigoNBS}</span>
          </div>
          <div className="danfse-col w-40">
            <span className="danfse-label">Local da Prestação / Sigla UF / País</span>
            <span className="danfse-value">{data.servico.localPrestacao}</span>
          </div>
        </div>
        <div className="danfse-row">
          <div className="danfse-col w-100">
            <span className="danfse-value">{data.servico.descricaoNac}</span>
          </div>
        </div>
        <div className="danfse-row">
          <div className="danfse-col w-100">
            <span className="danfse-label">Descrição do Serviço</span>
            <span className="danfse-value" style={{ whiteSpace: 'pre-line' }}>{data.servico.descricaoServico}</span>
          </div>
        </div>
      </div>

      {/* BLOCO 6: TRIBUTAÇÃO MUNICIPAL (ISSQN) */}
      <div className="danfse-box mt-1">
        <div className="danfse-section-header">TRIBUTAÇÃO MUNICIPAL (ISSQN)</div>
        <div className="danfse-row">
          <div className="danfse-col w-50">
            <span className="danfse-label">Tipo de Tributação do ISSQN</span>
            <span className="danfse-value">{data.tributacaoMunicipal.tipoTributacao}</span>
          </div>
          <div className="danfse-col w-50">
            <span className="danfse-label">Município / Sigla UF / País de Incidência do ISSQN</span>
            <span className="danfse-value">{data.tributacaoMunicipal.municipioIncidencia}</span>
          </div>
        </div>
        <div className="danfse-row">
          <div className="danfse-col w-25">
            <span className="danfse-label">BC ISSQN</span>
            <span className="danfse-value">{data.tributacaoMunicipal.bcIssqn}</span>
          </div>
          <div className="danfse-col w-25">
            <span className="danfse-label">Alíquota Aplicada</span>
            <span className="danfse-value">{data.tributacaoMunicipal.aliquotaAplicada}</span>
          </div>
          <div className="danfse-col w-25">
            <span className="danfse-label">Retenção do ISSQN</span>
            <span className="danfse-value">{data.tributacaoMunicipal.retencaoIssqn}</span>
          </div>
          <div className="danfse-col w-25">
            <span className="danfse-label">ISSQN Apurado</span>
            <span className="danfse-value">{data.tributacaoMunicipal.issqnApurado}</span>
          </div>
        </div>
      </div>

      {/* BLOCO 7: TRIBUTAÇÃO FEDERAL (EXCETO CBS) */}
      <div className="danfse-box mt-1">
        <div className="danfse-section-header">TRIBUTAÇÃO FEDERAL (EXCETO CBS)</div>
        <div className="danfse-row">
          <div className="danfse-col w-33">
            <span className="danfse-label">IRRF</span>
            <span className="danfse-value">{data.tributacaoFederal.irrf}</span>
          </div>
          <div className="danfse-col w-33">
            <span className="danfse-label">Contribuição Previdenciária - Retida</span>
            <span className="danfse-value">{data.tributacaoFederal.contribPrevidenciariaRetida}</span>
          </div>
          <div className="danfse-col w-33">
            <span className="danfse-label">Contribuições Sociais - Retidas</span>
            <span className="danfse-value">{data.tributacaoFederal.contribuicoesSociaisRetidas}</span>
          </div>
        </div>
        <div className="danfse-row">
          <div className="danfse-col w-33">
            <span className="danfse-label">PIS - Débito Apuração Própria</span>
            <span className="danfse-value">{data.tributacaoFederal.pisDebitoProprio}</span>
          </div>
          <div className="danfse-col w-33">
            <span className="danfse-label">COFINS - Débito Apuração Própria</span>
            <span className="danfse-value">{data.tributacaoFederal.cofinsDebitoProprio}</span>
          </div>
          <div className="danfse-col w-33">
            <span className="danfse-label">Descrição Contrib. Sociais - Retidas</span>
            <span className="danfse-value">{data.tributacaoFederal.descricaoContribSociais}</span>
          </div>
        </div>
      </div>

      {/* BLOCO 8: TRIBUTAÇÃO IBS/CBS */}
      <div className="danfse-box mt-1">
        <div className="danfse-section-header">TRIBUTAÇÃO IBS/CBS</div>
        <div className="danfse-row">
          <div className="danfse-col w-35">
            <span className="danfse-label">CST / cClassTrib</span>
            <span className="danfse-value">{data.tributacaoIbsCbs.cstClassTrib}</span>
          </div>
          <div className="danfse-col w-65">
            <span className="danfse-label">Indicador de Operação / Código IBGE Incidência / Município Incidência / Sigla UF</span>
            <span className="danfse-value">{data.tributacaoIbsCbs.indicadorOperacaoIbgeMunUf}</span>
          </div>
        </div>
        <div className="danfse-row">
          <div className="danfse-col w-30">
            <span className="danfse-label">Exclusões e Reduções da Base de Cálculo</span>
            <span className="danfse-value">{data.tributacaoIbsCbs.exclusoesReducoesBC}</span>
          </div>
          <div className="danfse-col w-35">
            <span className="danfse-label">Base de Cálculo Após Exclusões e Reduções</span>
            <span className="danfse-value danfse-value-bold">{data.tributacaoIbsCbs.baseCalculoAposExclusoes}</span>
          </div>
          <div className="danfse-col w-35">
            <span className="danfse-label">Red. Alíquota IBS / Red. Alíquota CBS</span>
            <span className="danfse-value">{data.tributacaoIbsCbs.redAliquotaIbsCbs}</span>
          </div>
        </div>
        <div className="danfse-row">
          <div className="danfse-col w-30">
            <span className="danfse-label">Alíquota - IBS UF / IBS Mun</span>
            <span className="danfse-value">{data.tributacaoIbsCbs.aliquotaIbsUfMun}</span>
          </div>
          <div className="danfse-col w-25">
            <span className="danfse-label">Alíq. Efetiva Municipal - IBS</span>
            <span className="danfse-value">{data.tributacaoIbsCbs.aliqEfetivaMunicipalIbs}</span>
          </div>
          <div className="danfse-col w-25">
            <span className="danfse-label">Valor Apurado Municipal - IBS</span>
            <span className="danfse-value">{data.tributacaoIbsCbs.valorApuradoMunicipalIbs}</span>
          </div>
          <div className="danfse-col w-20">
            <span className="danfse-label">Alíq. Efetiva Estadual - IBS</span>
            <span className="danfse-value">{data.tributacaoIbsCbs.aliqEfetivaEstadualIbs}</span>
          </div>
        </div>
        <div className="danfse-row">
          <div className="danfse-col w-30">
            <span className="danfse-label">Valor Apurado Estadual - IBS</span>
            <span className="danfse-value">{data.tributacaoIbsCbs.valorApuradoEstadualIbs}</span>
          </div>
          <div className="danfse-col w-25">
            <span className="danfse-label">Valor Total Apurado - IBS</span>
            <span className="danfse-value danfse-value-bold">{data.tributacaoIbsCbs.valorTotalApuradoIbs}</span>
          </div>
          <div className="danfse-col w-25">
            <span className="danfse-label">Alíquota - CBS / Alíq. Efetiva</span>
            <span className="danfse-value">{data.tributacaoIbsCbs.aliquotaCbs}</span>
          </div>
          <div className="danfse-col w-20">
            <span className="danfse-label">Valor Total Apurado - CBS</span>
            <span className="danfse-value danfse-value-bold">{data.tributacaoIbsCbs.valorTotalApuradoCbs}</span>
          </div>
        </div>
      </div>

      {/* BLOCO 9: VALOR TOTAL DA NFS-E */}
      <div className="danfse-box mt-1">
        <div className="danfse-row">
          <div className="danfse-col w-30">
            <span className="danfse-label">VALOR TOTAL DA NFS-e</span>
            <span className="danfse-value danfse-value-bold" style={{ fontSize: '9pt' }}>{data.valores.valorTotalNFSe}</span>
          </div>
          <div className="danfse-col w-35">
            <span className="danfse-label">VALOR DA OPERAÇÃO / SERVIÇO</span>
            <span className="danfse-value">{data.valores.valorOperacaoServico}</span>
          </div>
          <div className="danfse-col w-20">
            <span className="danfse-label">Desconto Incondicionado</span>
            <span className="danfse-value">{data.valores.descontoIncondicionado}</span>
          </div>
          <div className="danfse-col w-15">
            <span className="danfse-label">Desconto Condicionado</span>
            <span className="danfse-value">{data.valores.descontoCondicionado}</span>
          </div>
        </div>
        <div className="danfse-row">
          <div className="danfse-col w-30">
            <span className="danfse-label">Total das Retenções (ISSQN / Federais)</span>
            <span className="danfse-value">{data.valores.totalRetencoes}</span>
          </div>
          <div className="danfse-col w-35">
            <span className="danfse-label">VALOR LÍQUIDO DA NFS-e</span>
            <span className="danfse-value danfse-value-bold">{data.valores.valorLiquidoNFSe}</span>
          </div>
          <div className="danfse-col w-15">
            <span className="danfse-label">Total do IBS/CBS</span>
            <span className="danfse-value">{data.valores.totalIbsCbs}</span>
          </div>
          <div className="danfse-col w-20">
            <span className="danfse-label">VALOR LÍQUIDO DA NFS-e + IBS/CBS</span>
            <span className="danfse-value danfse-value-bold">{data.valores.valorLiquidoMaisIbsCbs}</span>
          </div>
        </div>
      </div>

      {/* BLOCO 10: INFORMAÇÕES COMPLEMENTARES */}
      <div className="danfse-box mt-1">
        <div className="danfse-section-header">INFORMAÇÕES COMPLEMENTARES</div>
        <div className="danfse-row">
          <div className="danfse-col w-100" style={{ minHeight: '35px' }}>
            <span className="danfse-value">{data.informacoesComplementares.infCont}</span>
            <span className="danfse-value" style={{ marginTop: '4px' }}>{data.informacoesComplementares.tributosAproximados}</span>
          </div>
        </div>
      </div>

      {/* RODAPÉ: ASSINATURA E CANHOTO */}
      <div className="danfse-box mt-1" style={{ marginTop: '12px' }}>
        <div className="danfse-row" style={{ height: '35px' }}>
          <div className="danfse-col w-30">
            <span className="danfse-label">DATA CIENTIFICAÇÃO:</span>
          </div>
          <div className="danfse-col w-35">
            <span className="danfse-label">IDENTIFICAÇÃO E ASSINATURA</span>
          </div>
          <div className="danfse-col w-35">
            <span className="danfse-label">N° NFS-e / CHAVE NFS-e</span>
            <span className="danfse-value danfse-value-bold">{data.rodape.chaveResumidaRodape}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
