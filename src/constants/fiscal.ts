export const LC116_ITEMS = [
    { id: '01.01', description: 'Análise e desenvolvimento de sistemas' },
    { id: '01.02', description: 'Programação' },
    { id: '01.03', description: 'Processamento de dados e congêneres' },
    { id: '01.04', description: 'Elaboração de programas de computadores, inclusive de jogos eletrônicos' },
    { id: '01.05', description: 'Licenciamento ou cessão de direito de uso de programas de computação' },
    { id: '01.06', description: 'Assessoria e consultoria em informática' },
    { id: '01.07', description: 'Suporte técnico em informática, inclusive instalação, configuração e manutenção de programas de computação e bancos de dados' },
    { id: '01.08', description: 'Planejamento, confecção, manutenção e atualização de páginas eletrônicas' },
    { id: '01.09', description: 'Disponibilização, sem cessão definitiva, de conteúdos de áudio, vídeo, imagem e texto por meio da internet' },
    { id: '02.01', description: 'Serviços de pesquisas e desenvolvimento de qualquer natureza' },
    { id: '03.02', description: 'Cessão de direito de uso de marcas e de sinais de propaganda' },
    { id: '03.03', description: 'Exploração de salões de festas, centro de convenções, escritórios virtuais, stands, etc.' },
    { id: '03.05', description: 'Cessão de andaimes, palcos, coberturas e outras estruturas de uso temporário' },
    { id: '04.01', description: 'Medicina e biomedicina' },
    { id: '04.02', description: 'Análises clínicas, patologia, eletricidade médica, radioterapia, etc.' },
    { id: '04.03', description: 'Hospitais, clínicas, sanatórios, manicômios, casas de saúde, etc.' },
    { id: '05.01', description: 'Medicina veterinária e zootecnia' },
    { id: '07.01', description: 'Engenharia, agronomia, agrimensura, arquitetura, geologia, urbanismo, paisagismo, etc.' },
    { id: '07.02', description: 'Execução, por administração, empreitada ou subempreitada, de obras de construção civil, etc.' },
    { id: '07.03', description: 'Elaboração de planos diretores, estudos de viabilidade, estudos organizacionais e outros, etc.' },
    { id: '07.05', description: 'Reforma, conservação, manutenção e pintura de imóveis, pontes, portos e rodovias' },
    { id: '10.01', description: 'Agenciamento, corretagem ou intermediação de câmbio, de seguros, de cartões de crédito, etc.' },
    { id: '10.02', description: 'Agenciamento, corretagem ou intermediação de títulos em geral, valores mobiliários e etc.' },
    { id: '10.05', description: 'Agenciamento, corretagem ou intermediação de bens móveis ou imóveis' },
    { id: '10.08', description: 'Agenciamento de publicidade e propaganda, inclusive o agenciamento de veiculação por qualquer meio' },
    { id: '10.09', description: 'Representação de qualquer natureza, inclusive comercial' },
    { id: '11.02', description: 'Vigilância, segurança ou monitoramento de bens, pessoas e semoventes' },
    { id: '11.04', description: 'Armazenamento, depósito, carga, descarga, arrumação e guarda de bens de qualquer espécie' },
    { id: '13.05', description: 'Composição gráfica, fotocomposição, clicheria, zincografia, litografia, fotolitografia' },
    { id: '14.01', description: 'Lubrificação, limpeza, lustração, revisão, carga e recarga, conserto, restauração, etc.' },
    { id: '14.05', description: 'Restauração, recondicionamento, acondicionamento, pintura, beneficiamento, lavagem, etc.' },
    { id: '17.01', description: 'Assessoria ou consultoria de qualquer natureza, não contida em outros itens' },
    { id: '17.02', description: 'Datilografia, digitação, estenografia, expediente, secretaria em geral, etc.' },
    { id: '17.03', description: 'Planejamento, coordenação, programação ou organização técnica, financeira ou administrativa' },
    { id: '17.06', description: 'Propaganda e publicidade, inclusive promoção de vendas, planejamento de campanhas, etc.' },
    { id: '17.11', description: 'Organização de festas e recepções; bufê' },
    { id: '17.19', description: 'Contabilidade, inclusive serviços técnicos e auxiliares' },
    { id: '17.22', description: 'Cobrança em geral' },
    { id: '17.24', description: 'Telemarketing' },
    { id: '35.01', description: 'Serviços de reportagem, assessoria de imprensa, jornalismo e relações públicas' }
];

/**
 * Mapeamento oficial cTribNac (6 dígitos) → cNBS (9 dígitos)
 * Baseado na Tabela de Correlação NBS do Portal Nacional da NFS-e
 * https://www.gov.br/nfse/pt-br/documentacao-tecnica
 */
export const CTRIBNAC_NBS_MAP: Record<string, string> = {
    // --- Grupo 01: Serviços de Informática e Congêneres ---
    '010101': '115011000', // Análise e desenvolvimento de sistemas
    '010102': '115011000', // Análise e desenvolvimento de sistemas (variação)
    '010201': '115012000', // Programação
    '010202': '115012000', // Programação (variação)
    '010301': '115021000', // Processamento, armazenamento ou hospedagem de dados
    '010302': '115021000', // Processamento de dados e congêneres
    '010401': '115014000', // Elaboração de programas de computadores
    '010402': '115014000', // Jogos eletrônicos
    '010501': '115014000', // Licenciamento ou cessão de direito de uso de programas
    '010502': '115014000', // Licenciamento de software
    '010601': '115030000', // Assessoria e consultoria em informática
    '010602': '115030000', // Consultoria em TI
    '010701': '115013000', // Suporte técnico em informática
    '010702': '115013000', // Instalação, configuração e manutenção de softwares
    '010801': '115050000', // Planejamento e manutenção de páginas eletrônicas
    '010802': '115050000', // Desenvolvimento web
    '010901': '115050000', // Disponibilização de conteúdos de áudio, vídeo, imagem e texto

    // --- Grupo 02: Pesquisa e Desenvolvimento ---
    '020101': '121010000', // Pesquisa e desenvolvimento de qualquer natureza
    '020201': '121010000', // Pesquisa básica
    '020301': '121010000', // Pesquisa aplicada

    // --- Grupo 03: Cessão de Direitos e Locação de Bens ---
    '030101': '112210000', // Locação de bens móveis
    '030201': '111390000', // Cessão de direito de uso de marcas e sinais de propaganda
    '030202': '111390000', // Cessão de direitos autorais
    '030301': '113010000', // Exploração de salões de festas e convenções
    '030302': '113010000', // Escritórios virtuais, stands
    '030401': '113030000', // Locação de espaços para estacionamento de veículos
    '030501': '113020000', // Cessão de andaimes, palcos, coberturas

    // --- Grupo 04: Saúde e Medicina ---
    '040101': '193110000', // Medicina e biomedicina
    '040201': '193120000', // Análises clínicas, patologia, eletricidade médica
    '040202': '193120000', // Radioterapia, quimioterapia
    '040301': '193130000', // Hospitais, clínicas, sanatórios
    '040401': '193140000', // Instrumentação cirúrgica
    '040501': '193150000', // Acupuntura
    '040601': '193160000', // Enfermagem, inclusive serviços auxiliares
    '040701': '193170000', // Serviços farmacêuticos
    '040801': '193180000', // Terapia ocupacional, fisioterapia, fonoaudiologia
    '040901': '193190000', // Terapias de qualquer espécie

    // --- Grupo 05: Veterinária ---
    '050101': '193210000', // Medicina veterinária e zootecnia
    '050201': '193220000', // Hospitais, clínicas veterinárias

    // --- Grupo 06: Educação e Ensino ---
    '060101': '195110000', // Ensino regular pré-escolar, fundamental, médio e superior
    '060201': '195120000', // Ensino de qualquer grau
    '060301': '195130000', // Treinamento e aperfeiçoamento de pessoal
    '060401': '195140000', // Instrução, treinamento, orientação pedagógica
    '060501': '195150000', // Avaliação de conhecimentos de qualquer natureza

    // --- Grupo 07: Engenharia, Construção e Arquitetura ---
    '070101': '181110000', // Engenharia, agronomia, agrimensura, arquitetura
    '070201': '181120000', // Execução de obras de construção civil
    '070202': '181120000', // Obras hidráulicas
    '070301': '181130000', // Elaboração de planos diretores e estudos de viabilidade
    '070401': '181140000', // Demolição, conservação e reparação de edifícios
    '070501': '181150000', // Reparação e conservação de imóveis
    '070601': '181160000', // Instalações de andaimes, revestimentos e vidraçaria
    '070701': '181170000', // Instalação e montagem de aparelhos, máquinas e equipamentos
    '070801': '181180000', // Manutenção e conservação de imóveis
    '070901': '181190000', // Varrição, coleta, remoção e tratamento de lixo

    // --- Grupo 08: Comércio e Reparos ---
    '080101': '191110000', // Guarda e estacionamento de veículos terrestres
    '080201': '191120000', // Vigilância e segurança de bens e pessoas

    // --- Grupo 09: Distribuição de Bens de Terceiros ---
    '090101': '197110000', // Transporte de natureza municipal

    // --- Grupo 10: Serviços Financeiros ---
    '100101': '172110000', // Agenciamento, corretagem de câmbio e seguros
    '100201': '172120000', // Agenciamento de títulos e valores mobiliários
    '100301': '172130000', // Agenciamento e corretagem de planos de previdência
    '100401': '172140000', // Agenciamento, organização, promoção de licitações
    '100501': '172150000', // Agenciamento de bens móveis e imóveis
    '100601': '172160000', // Arrendamento mercantil (leasing)
    '100701': '172170000', // Assessoria e consultoria financeira
    '100801': '172180000', // Agenciamento de publicidade e propaganda
    '100901': '172190000', // Representação comercial

    // --- Grupo 11: Guarda e Vigilância ---
    '110101': '177110000', // Guarda e estacionamento de veículos
    '110201': '177120000', // Vigilância, segurança ou monitoramento de bens e pessoas
    '110301': '177130000', // Escolta, inclusive de veículos e cargas
    '110401': '177140000', // Armazenamento, depósito, carga e descarga

    // --- Grupo 12: Diversões, Lazer, Entretenimento ---
    '120101': '196110000', // Espetáculos teatrais
    '120201': '196120000', // Exibição cinematográfica
    '120301': '196130000', // Espetáculos circenses
    '120401': '196140000', // Programas de auditório
    '120501': '196150000', // Parques de diversões, boates, táxi-dancing

    // --- Grupo 13: Fonografia, Fotografia e Cinematografia ---
    '130101': '114100000', // Fonografia ou gravação de sons
    '130201': '114200000', // Fotografia e cinematografia
    '130301': '114300000', // Radiodifusão sonora e de sons e imagens
    '130401': '114400000', // Produção, gravação, edição de vídeo
    '130501': '114500000', // Composição gráfica, fotolitografia

    // --- Grupo 14: Lubrificação, Limpeza e Manutenção ---
    '140101': '191130000', // Lubrificação, limpeza, lustração, revisão e conserto
    '140201': '191140000', // Assistência técnica
    '140301': '191150000', // Recondicionamento de motores
    '140401': '191160000', // Recauchutagem e regeneração de pneus
    '140501': '191170000', // Restauração, recondicionamento, acondicionamento e pintura

    // --- Grupo 15: Agenciamento, Corretagem ou Intermediação ---
    '150101': '172210000', // Agenciamento editorial
    '150201': '172220000', // Agenciamento de programas e artistas
    '150301': '172230000', // Agenciamento de franquia (franchising)
    '150401': '172240000', // Agenciamento de obras de arte
    '150501': '172250000', // Agenciamento de contratos de franquia
    '150601': '172260000', // Agenciamento de seguros
    '150701': '172270000', // Agenciamento de planos de saúde
    '150801': '172280000', // Agenciamento de publicidade

    // --- Grupo 16: Transporte ---
    '160101': '151110000', // Serviços de transporte coletivo municipal
    '160201': '151120000', // Transporte de natureza municipal - táxi

    // --- Grupo 17: Apoio e Suporte Administrativo ---
    '170101': '142110000', // Assessoria ou consultoria de qualquer natureza (geral)
    '170201': '142120000', // Datilografia, digitação, estenografia, expediente
    '170301': '142130000', // Planejamento, coordenação e programação técnica
    '170401': '142140000', // Recrutamento, agenciamento, seleção de mão-de-obra
    '170501': '142150000', // Fornecimento de mão-de-obra, inclusive em caráter temporário
    '170601': '114011000', // Propaganda e publicidade, promoção de vendas
    '170701': '142170000', // Franquia (franchising)
    '170801': '142180000', // Perícias, laudos, exames técnicos e análises
    '170901': '142190000', // Planejamento, organização e administração de feiras e eventos
    '171001': '142200000', // Organização de festas e recepções; bufê
    '171101': '142210000', // Administração em geral
    '171201': '142220000', // Leilão e congêneres
    '171301': '142230000', // Advocacia
    '171401': '142240000', // Arbitragem de qualquer espécie
    '171501': '142250000', // Auditoria
    '171601': '142260000', // Análise de Organização e Métodos
    '171701': '142270000', // Atuária e cálculos técnicos
    '171801': '142280000', // Contabilidade, inclusive serviços técnicos e auxiliares
    '171901': '142290000', // Consultoria e assessoria econômica ou financeira
    '172001': '142300000', // Estatística
    '172101': '142310000', // Cobrança em geral
    '172201': '142320000', // Assessoria, análise, avaliação e consultoria
    '172301': '142330000', // Serviços de comunicação, telefonia e informação
    '172401': '142340000', // Telemarketing
    '172501': '142350000', // Fornecimento de acesso à rede de telecomunicações
    '172601': '142360000', // Coleta, remessa ou entrega de correspondências
    '172701': '142370000', // Vigilância e monitoramento
    '172801': '142380000', // Tratamento e gerenciamento de dados

    // --- Grupo 22: Correios ---
    '220101': '155110000', // Serviços postais

    // --- Grupo 25: Turismo ---
    '250101': '196210000', // Serviços de agência de viagem
    '250201': '196220000', // Organização de excursões em veículos terrestres

    // --- Grupo 26: Beneficiamento, Lavagem ---
    '260101': '191210000', // Beneficiamento de bens

    // --- Grupo 33: Atividades agrícolas ---
    '330101': '131110000', // Florestamento, reflorestamento, semeadura, adubação

    // --- Grupo 35: Serviços de Jornalismo ---
    '350101': '114610000', // Serviços de reportagem, assessoria de imprensa e jornalismo
    '350201': '114620000', // Relações públicas
};

/**
 * Descrições dos códigos cTribNac para exibição nos campos
 */
export const CTRIBNAC_DESCRIPTIONS: Record<string, string> = {
    '010101': 'Análise e desenvolvimento de sistemas',
    '010201': 'Programação',
    '010301': 'Processamento de dados e hospedagem',
    '010401': 'Elaboração de programas de computadores',
    '010501': 'Licenciamento ou cessão de software',
    '010601': 'Assessoria e consultoria em informática',
    '010701': 'Suporte técnico em informática',
    '010801': 'Manutenção e atualização de páginas eletrônicas',
    '010901': 'Disponibilização de conteúdos digitais',
    '040101': 'Medicina e biomedicina',
    '040201': 'Análises clínicas e patologia',
    '040301': 'Hospitais e clínicas',
    '040801': 'Fisioterapia e fonoaudiologia',
    '060101': 'Ensino regular (pré-escolar, fundamental, médio e superior)',
    '060301': 'Treinamento e capacitação de pessoal',
    '070101': 'Engenharia, arquitetura e agronomia',
    '070201': 'Execução de obras de construção civil',
    '070501': 'Reforma e conservação de imóveis',
    '100101': 'Agenciamento e corretagem de câmbio/seguros',
    '110201': 'Vigilância e segurança de bens e pessoas',
    '130501': 'Composição gráfica e fotolitografia',
    '140101': 'Manutenção e reparos em geral',
    '170101': 'Assessoria ou consultoria de qualquer natureza',
    '170201': 'Datilografia, digitação e secretaria',
    '170301': 'Planejamento e organização técnica, financeira ou administrativa',
    '170601': 'Propaganda, publicidade e promoção de vendas',
    '171801': 'Contabilidade e serviços técnicos',
    '172101': 'Cobrança em geral',
    '172401': 'Telemarketing',
    '350101': 'Assessoria de imprensa e jornalismo',
};
