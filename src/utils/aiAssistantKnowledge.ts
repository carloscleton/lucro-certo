export interface KnowledgeAnswer {
    keywords: string[];
    title: string;
    answer: string;
    actionLabel?: string;
    actionPath?: string;
}

export const LUCRO_CERTO_KNOWLEDGE: KnowledgeAnswer[] = [
    {
        keywords: ['nota', 'nfe', 'nfse', 'emitir nota', 'fiscal', 'imposto', 'tecnospeed', 'nfeio', 'plugnotas', 'lote'],
        title: '📄 Emissão de Notas Fiscais',
        answer: `Para emitir Notas Fiscais no **Lucro Certo**:

1. Acesse o menu **Notas Fiscais** na barra lateral.
2. Clique no botão **+ Nova Nota Fiscal**.
3. Selecione o Cliente/Tomador e o Serviço/Produto prestado.
4. Confira a alíquota de ISS/impostos e clique em **Emitir Nota**.

💡 **Faturamento Recorrente:** Você também pode emitir notas em lote para todos os seus assinantes em **Notas Fiscais > Faturamento Recorrente em Lote**.`,
        actionLabel: 'Ir para Notas Fiscais',
        actionPath: '/dashboard/invoices'
    },
    {
        keywords: ['recorrente', 'recorrência', 'clube', 'fidelidade', 'assinatura', 'plano', 'mensalidade', 'mensal', 'contrato'],
        title: '🔄 Faturamento Recorrente & Clube de Fidelidade',
        answer: `O **Faturamento Recorrente** permite cobrar clientes mensalmente e emitir notas automáticas:

1. Acesse **Contatos** e edite ou cadastre um cliente.
2. Ative a chave **Faturamento Recorrente**.
3. Escolha a modalidade:
   - **Plano:** Selecione um plano do Clube de Fidelidade.
   - **Serviço:** Vincule a um serviço do seu catálogo.
   - **Personalizado:** Defina um valor negociado para este cliente.
4. Marque a opção de gerar cobrança no Gateway (Asaas) se desejar enviar o link de pagamento por WhatsApp!`,
        actionLabel: 'Ver Clube de Fidelidade',
        actionPath: '/dashboard/loyalty'
    },
    {
        keywords: ['asaas', 'gateway', 'pagamento', 'pix', 'boleto', 'cartao', 'cartão', 'cobrança', 'cobranca'],
        title: '💳 Configuração de Gateways de Pagamento (Asaas)',
        answer: `Para integrar sua conta do **Asaas** e receber via PIX/Boleto/Cartão:

1. Vá em **Configurações > Gateways de Pagamento**.
2. Selecione **Asaas** e insira sua **API Key** gerada no painel do Asaas.
3. Ative as opções de recibos e notificações automáticas.
4. Quando cadastrar faturamentos recorrentes ou orçamentos, o sistema criará os links de pagamento automaticamente!`,
        actionLabel: 'Configurar Gateways',
        actionPath: '/dashboard/settings'
    },
    {
        keywords: ['caixa', 'financeiro', 'extrato', 'dre', 'receita', 'despesa', 'transacao', 'transação', 'relatorio', 'relatório', 'entradas', 'saidas'],
        title: '📊 Gestão Financeira & DRE',
        answer: `No módulo **Financeiro**:

- **Contas a Receber / Pagar:** Acompanhe o status de cada lançamento (Pendente, Pago, Atrasado).
- **Baixa Simplificada:** Dê baixa em parcelas com um clique.
- **Relatórios & DRE:** Veja seu lucro real, entradas x saídas e centro de custo em tempo real.`,
        actionLabel: 'Ver Fluxo de Caixa',
        actionPath: '/dashboard/receivables'
    },
    {
        keywords: ['orcamento', 'orçamento', 'proposta', 'crm', 'venda', 'funil', 'lead', 'radar'],
        title: '🚀 Ciclo de Vendas & CRM',
        answer: `Para gerenciar suas propostas e fechar vendas:

1. Vá em **Orçamentos** e crie uma proposta com itens do seu catálogo.
2. Envie o link da **Proposta Pública** para seu cliente aprovar online!
3. Ao ser aprovada, a proposta converte automaticamente em contas a receber no financeiro.`,
        actionLabel: 'Ir para Orçamentos',
        actionPath: '/dashboard/quotes'
    },
    {
        keywords: ['contato', 'cliente', 'fornecedor', 'ambos', 'cadastro', 'cpf', 'cnpj'],
        title: '👥 Gestão de Contatos',
        answer: `Você pode cadastrar seus contatos como **Cliente**, **Fornecedor** ou **Ambos**:

1. Acesse o menu **Contatos > + Novo Contato**.
2. Preencha CPF ou CNPJ e clique na **Lupa 🔍** para preencher automaticamente a razão social e endereço via Receita Federal!
3. Defina se o contato tem Faturamento Recorrente ativado.`,
        actionLabel: 'Ver Contatos',
        actionPath: '/dashboard/contacts'
    },
    {
        keywords: ['certificado', 'a1', 'empresa', 'logo', 'logotipo', 'cnpj', 'dados'],
        title: '🏢 Configurações da Empresa & Certificado Digital',
        answer: `Para transmitir notas fiscais eletrônicas, configure seu Certificado Digital:

1. Vá em **Configurações > Dados da Empresa**.
2. Envie o arquivo do seu **Certificado Digital A1 (.pfx/.p12)** e a senha.
3. Insira sua Inscrição Municipal e o código de tributação do seu município.`,
        actionLabel: 'Configurações da Empresa',
        actionPath: '/dashboard/settings'
    }
];

export function findKnowledgeAnswer(userQuery: string): KnowledgeAnswer | null {
    const normalized = userQuery.toLowerCase().trim();
    
    let bestMatch: KnowledgeAnswer | null = null;
    let maxScore = 0;

    for (const item of LUCRO_CERTO_KNOWLEDGE) {
        let score = 0;
        for (const kw of item.keywords) {
            if (normalized.includes(kw)) {
                score += kw.length;
            }
        }
        if (score > maxScore) {
            maxScore = score;
            bestMatch = item;
        }
    }

    return bestMatch;
}
