import { useState, useMemo, useEffect } from 'react';
import { X, Download, AlertCircle, CheckCircle2, AlertTriangle, Info, Landmark, Save } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useBankingSettings, encodeBankingConfig } from '../../hooks/useBankingSettings';
import type { CompanyBankInfo, PaymentItem } from '../../services/cnab/cnab240Generator';
import { generateCnab240, validateBoleto } from '../../services/cnab/cnab240Generator';
import { BANK_TEMPLATES } from '../../services/cnab/bankTemplates';
import type { Transaction } from '../../hooks/useTransactions';
import { supabase } from '../../lib/supabase';

interface CnabExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedTransactions: Transaction[];
    companyCnpj: string;
    companyName: string;
}

// ─── Modal de confirmação / preenchimento de dados bancários ────────────────
interface MissingBankDataModalProps {
    bankName: string;
    isCustom?: boolean;
    currentBankCode?: string;
    currentBranch: string;
    currentAccount: string;
    currentBranchDigit: string;
    currentAccountDigit: string;
    onSaveAndContinue: (data: { bank_code?: string; branch: string; branch_digit: string; account: string; account_digit: string }) => void;
    onContinueAnyway: () => void;
    onCancel: () => void;
    isSaving: boolean;
}

function MissingBankDataModal({
    bankName, isCustom = false, currentBankCode = '',
    currentBranch, currentAccount, currentBranchDigit, currentAccountDigit,
    onSaveAndContinue, onContinueAnyway, onCancel, isSaving
}: MissingBankDataModalProps) {
    const [bankCode, setBankCode] = useState(currentBankCode);
    const [branch, setBranch] = useState(currentBranch);
    const [branchDigit, setBranchDigit] = useState(currentBranchDigit);
    const [account, setAccount] = useState(currentAccount);
    const [accountDigit, setAccountDigit] = useState(currentAccountDigit);

    const hasData = branch.trim() && account.trim() && (!isCustom || bankCode.trim());

    const handleBranchChange = (val: string) => {
        if (/[-/. ]/.test(val)) {
            const parts = val.split(/[-/. ]/);
            if (parts.length >= 2) {
                const brPart = parts[0].replace(/[^0-9a-zA-Z]/g, '');
                const digPart = parts.slice(1).join('').replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
                setBranch(brPart);
                setBranchDigit(digPart);
                return;
            }
        }
        setBranch(val.replace(/[^0-9a-zA-Z]/g, ''));
    };

    const handleAccountChange = (val: string) => {
        if (/[-/. ]/.test(val)) {
            const parts = val.split(/[-/. ]/);
            if (parts.length >= 2) {
                const accPart = parts[0].replace(/[^0-9a-zA-Z]/g, '');
                const digPart = parts.slice(1).join('').replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
                setAccount(accPart);
                setAccountDigit(digPart);
                return;
            }
        }
        setAccount(val.replace(/[^0-9a-zA-Z]/g, ''));
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center gap-3 p-5 border-b border-gray-100 dark:border-slate-800 bg-amber-50 dark:bg-amber-950/30">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 shrink-0">
                        <Landmark size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">Dados bancários incompletos</h4>
                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 truncate">{bankName}</p>
                    </div>
                    <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                        Esta conta bancária não possui as configurações básicas necessárias.
                        Preencha abaixo para que o arquivo CNAB seja gerado corretamente — os dados serão salvos automaticamente.
                    </p>

                    <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-4 space-y-3 border border-gray-100 dark:border-slate-700">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Dados da Conta para CNAB</p>

                        {isCustom && (
                            <div className="mb-3">
                                <Input
                                    label="Código do Banco (ex: 260)"
                                    value={bankCode}
                                    onChange={e => setBankCode(e.target.value.replace(/\D/g, ''))}
                                    placeholder="000"
                                    maxLength={3}
                                    className="dark:bg-slate-900 dark:border-slate-600"
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-2">
                                <Input
                                    label="Agência"
                                    value={branch}
                                    onChange={e => handleBranchChange(e.target.value)}
                                    placeholder="0000"
                                    maxLength={6}
                                    className="dark:bg-slate-900 dark:border-slate-600"
                                />
                            </div>
                            <div>
                                <Input
                                    label="Dígito"
                                    value={branchDigit}
                                    onChange={e => setBranchDigit(e.target.value.replace(/[^0-9a-zA-Z]/g, '').toUpperCase())}
                                    placeholder="0"
                                    maxLength={2}
                                    className="dark:bg-slate-900 dark:border-slate-600"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-2">
                                <Input
                                    label="Conta Corrente"
                                    value={account}
                                    onChange={e => handleAccountChange(e.target.value)}
                                    placeholder="00000"
                                    maxLength={12}
                                    className="dark:bg-slate-900 dark:border-slate-600"
                                />
                            </div>
                            <div>
                                <Input
                                    label="Dígito"
                                    value={accountDigit}
                                    onChange={e => setAccountDigit(e.target.value.replace(/[^0-9a-zA-Z]/g, '').toUpperCase())}
                                    placeholder="0"
                                    maxLength={2}
                                    className="dark:bg-slate-900 dark:border-slate-600"
                                />
                            </div>
                        </div>
                    </div>
                    
                    {!hasData && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                            <AlertTriangle size={13} />
                            Sem os dados bancários corretos, o arquivo CNAB poderá ser rejeitado pelo banco.
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="flex flex-col gap-2 p-5 pt-0">
                    <Button
                        onClick={() => onSaveAndContinue({
                            ...(isCustom ? { bank_code: bankCode } : {}),
                            branch,
                            branch_digit: branchDigit,
                            account,
                            account_digit: accountDigit
                        })}
                        isLoading={isSaving}
                        disabled={!hasData || isSaving}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-500/20 border-none"
                    >
                        <Save size={16} className="mr-2" />
                        Salvar e Gerar Remessa
                    </Button>
                    <button
                        onClick={onContinueAnyway}
                        disabled={isSaving}
                        className="w-full text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        Continuar sem preencher (arquivo pode ser rejeitado)
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const getBankCodeFromProvider = (provider: string): string => {
    if (provider.startsWith('bb_')) return '001';
    if (provider.startsWith('itau_')) return '341';
    if (provider.startsWith('bradesco_')) return '237';
    if (provider.startsWith('santander_')) return '033';
    if (provider.startsWith('caixa_')) return '104';
    if (provider.startsWith('sicoob_')) return '756';
    if (provider.startsWith('sicredi_')) return '748';
    if (provider.startsWith('inter_')) return '077';
    return '001';
};

const getBarcodeFromTransaction = (t: Transaction): string | null => {
    if (!t.notes) return null;

    const match = t.notes.match(/>{1,}BARCODE_DATA<{1,}([\s\S]*?)>{1,}END_BARCODE<{1,}/);
    if (match) {
        const cleaned = match[1].replace(/\D/g, '');
        if (cleaned.length >= 44 && cleaned.length <= 48) return cleaned;
    }

    const lines = t.notes.split('\n');
    for (const line of lines) {
        const cleanedLine = line.replace(/\D/g, '');
        if (cleanedLine.length >= 44 && cleanedLine.length <= 48) return cleanedLine;
    }

    const cleanedAll = t.notes.replace(/\D/g, '');
    if (cleanedAll.length >= 44 && cleanedAll.length <= 48) return cleanedAll;

    const longNumPattern = /[0-9.\-\s]{40,60}/g;
    const matches = t.notes.match(longNumPattern);
    if (matches) {
        for (const m of matches) {
            const cleanM = m.replace(/\D/g, '');
            if (cleanM.length >= 44 && cleanM.length <= 48) return cleanM;
        }
    }

    return null;
};

const BANK_UPLOAD_INSTRUCTIONS: Record<string, string[]> = {
    '001': [
        'Acesse o Gerenciador Financeiro do Banco do Brasil.',
        'Vá no menu principal e selecione Arquivos > Transmitir > Pagamentos.',
        'Selecione o arquivo de remessa (.txt) baixado e confirme o envio.',
        'Acesse o menu de liberação de pagamentos para autorizar o lote de transações.'
    ],
    '341': [
        'Acesse o portal Itaú Empresas (Internet Banking).',
        'Vá em Transmissão de Arquivos > Enviar arquivo.',
        'Selecione o serviço correspondente a "Contas a Pagar" (ou Pagamento de Títulos) e envie o arquivo .txt.',
        'Confirme com seu token e vá para a tela de pendências para assinar a liberação.'
    ],
    '237': [
        'Acesse o portal Bradesco Net Empresa.',
        'Navegue até Transmissão de Arquivos > Pagamentos > Enviar Remessa.',
        'Selecione o arquivo de remessa .txt baixado e clique em Enviar.',
        'Acesse o menu Autorização de Pagamentos para assinar e liberar as transações.'
    ],
    '033': [
        'Acesse o Santander Office (Internet Banking).',
        'Navegue até o menu Transferência de Arquivos > Enviar.',
        'Selecione o layout correspondente a pagamentos e selecione o arquivo de remessa .txt.',
        'Acesse a lista de assinaturas pendentes para aprovar a remessa com seu token/certificado.'
    ],
    '104': [
        'Acesse o Internet Banking da Caixa Econômica Federal PJ.',
        'Navegue até o menu PAGAMENTOS > Transmissão de Arquivo (ou utilize o Gerenciador Financeiro Caixa).',
        'Selecione o arquivo de remessa .txt baixado e clique em Transmitir.',
        'Vá na lista de assinaturas pendentes para autorizar a liberação dos valores.'
    ],
    '756': [
        'Acesse o Sicoobnet Empresarial.',
        'Vá no menu Transferência de Arquivos > Enviar.',
        'Selecione o tipo de arquivo como "Pagamento de Títulos / Remessa" e envie o arquivo .txt.',
        'Efetue a liberação dos pagamentos no menu de autorizações pendentes.'
    ],
    '748': [
        'Acesse o Sicredi Internet Empresas.',
        'Vá no menu Arquivos > Enviar Arquivo > Pagamentos.',
        'Selecione o arquivo de remessa .txt baixado e clique em Enviar.',
        'Vá na fila de aprovações pendentes para assinar e liberar as transações.'
    ],
    '077': [
        'Acesse a Conta Digital PJ do Banco Inter.',
        'Vá no menu Gestão de Pagamentos > Upload de Arquivos.',
        'Selecione o arquivo de remessa .txt baixado e faça o upload.',
        'Acesse o aplicativo do Banco Inter no seu celular e autorize os pagamentos na fila de aprovação.'
    ]
};

const DEFAULT_INSTRUCTIONS = [
    'Acesse o Internet Banking Corporativo da sua instituição financeira.',
    'Procure pela seção de "Transmissão de Arquivos", "Envio de CNAB" ou "Remessa de Pagamentos".',
    'Faça o upload do arquivo de remessa (.txt) baixado.',
    'Acesse o menu de pendências ou liberação de pagamentos do seu banco para assinar e confirmar os pagamentos com seu token.'
];

// ─── Main Component ──────────────────────────────────────────────────────────

export function CnabExportModal({ isOpen, onClose, selectedTransactions, companyCnpj, companyName }: CnabExportModalProps) {
    const { configs, loading, refresh } = useBankingSettings();
    const [selectedConfigId, setSelectedConfigId] = useState<string>('');
    const [showMissingDataModal, setShowMissingDataModal] = useState(false);
    const [isSavingBankData, setIsSavingBankData] = useState(false);
    const [fileExtension, setFileExtension] = useState<'rem' | 'txt'>('txt');

    useEffect(() => {
        if (configs && configs.length > 0 && !selectedConfigId) {
            const defaultConfig = configs.find(c => c.config?.is_default);
            if (defaultConfig) {
                setSelectedConfigId(defaultConfig.id);
            } else if (configs.length === 1) {
                setSelectedConfigId(configs[0].id);
            }
        }
    }, [configs, selectedConfigId]);

    useEffect(() => {
        if (selectedConfigId && configs) {
            const config = configs.find(c => c.id === selectedConfigId);
            if (config) {
                const code = config.config?.bank_code || getBankCodeFromProvider(config.provider);
                const isRem = ['077', '104', '756', '748'].includes(code);
                setFileExtension(isRem ? 'rem' : 'txt');
            }
        }
    }, [selectedConfigId, configs]);

    const processedTransactions = useMemo(() => {
        return selectedTransactions.map(t => {
            const rawBarcode = getBarcodeFromTransaction(t);
            const validation = rawBarcode ? validateBoleto(rawBarcode) : null;
            return { 
                transaction: t, 
                rawBarcode, 
                validation, 
                isValid: !!validation && validation.type !== 'invalid' && t.status !== 'paid' 
            };
        });
    }, [selectedTransactions]);

    const validPayments = useMemo(() => processedTransactions.filter(p => p.isValid), [processedTransactions]);
    const hasInvalidPayments = processedTransactions.length > validPayments.length;

    if (!isOpen) return null;

    const bankConfig = configs.find(c => c.id === selectedConfigId);
    const bankCode = bankConfig ? (bankConfig.config?.bank_code || getBankCodeFromProvider(bankConfig.provider)) : '';
    
    const selectedBankName = useMemo(() => {
        if (!bankConfig) return '';
        const isCust = bankConfig.provider.startsWith('custom_');
        return isCust 
            ? (bankConfig.config?.custom_name || 'Banco Personalizado') 
            : (BANK_TEMPLATES[bankCode]?.bankName || 'seu Banco');
    }, [bankConfig, bankCode]);

    const instructions = useMemo(() => {
        if (!selectedConfigId) return null;
        return BANK_UPLOAD_INSTRUCTIONS[bankCode] || DEFAULT_INSTRUCTIONS;
    }, [selectedConfigId, bankCode]);

    const isCustomBank = !!bankConfig?.provider.startsWith('custom_');
    const hasAgencyAndAccount = !!(
        bankConfig?.config?.branch && 
        bankConfig?.config?.account &&
        (!isCustomBank || bankConfig?.config?.bank_code)
    );

    // ── Executa geração do CNAB ──────────────────────────────────────────────
    const doExport = (overrideConfig?: { bank_code?: string; branch: string; branch_digit: string; account: string; account_digit: string }) => {
        if (!bankConfig) return;
        const effectiveConfig = overrideConfig
            ? { ...bankConfig.config, ...overrideConfig }
            : bankConfig.config;

        const company: CompanyBankInfo = {
            cnpj: companyCnpj,
            legal_name: companyName,
            bankCode: effectiveConfig?.bank_code || bankCode,
            agency: effectiveConfig?.branch || '',
            agency_dv: effectiveConfig?.branch_digit || '0',
            account: effectiveConfig?.account || '',
            account_dv: effectiveConfig?.account_digit || '0',
            company_code: effectiveConfig?.transmission_code || ''
        };

        const payments: PaymentItem[] = validPayments.map(item => ({
            id: item.transaction.id,
            barcode: item.rawBarcode!.replace(/\D/g, ''),
            amount: item.transaction.amount,
            due_date: item.transaction.date,
            beneficiary_name: (item.transaction.contact as any)?.name || item.transaction.description
        }));

        try {
            const nsa = 1; // Número Seqüencial de Arquivo
            const cnabContent = generateCnab240(company, payments, nsa);
            const blob = new Blob([cnabContent], { type: 'text/plain;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            
            let filename = `remessa_${company.bankCode}_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.${fileExtension}`;
            if (company.bankCode === '077') {
                const nsaString = String(nsa).padStart(6, '0');
                filename = `CI240_001_${nsaString}.${fileExtension.toUpperCase()}`;
            }
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setShowMissingDataModal(false);
            onClose();
        } catch (error: any) {
            console.error('Erro ao gerar CNAB:', error);
        }
    };

    // ── Botão principal de exportação ────────────────────────────────────────
    const handleExport = () => {
        if (!selectedConfigId) return;
        if (!bankConfig) return;
        if (validPayments.length === 0) return;

        if (!hasAgencyAndAccount) {
            setShowMissingDataModal(true);
            return;
        }

        doExport();
    };

    // ── Salva dados bancários no Supabase e depois exporta ───────────────────
    const handleSaveAndContinue = async (data: { branch: string; branch_digit: string; account: string; account_digit: string }) => {
        if (!bankConfig) return;
        setIsSavingBankData(true);
        try {
            const newConfig = { ...bankConfig.config, ...data };
            const encodedNewConfig = encodeBankingConfig(newConfig);
            await supabase
                .from('company_banking_configs')
                .update({ config: encodedNewConfig })
                .eq('id', bankConfig.id);
            if (refresh) await refresh();
            doExport(data);
        } catch (err) {
            console.error('Erro ao salvar dados bancários:', err);
        } finally {
            setIsSavingBankData(false);
        }
    };

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    const totalAmount = selectedTransactions.reduce((acc, t) => acc + t.amount, 0);
    const validAmount = validPayments.reduce((acc, p) => acc + p.transaction.amount, 0);

    return (
        <>
            {/* Modal principal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-slate-800 bg-gradient-to-r from-blue-600 to-indigo-600">
                        <div>
                            <h3 className="text-lg font-bold text-white">
                                Preparar Remessa de Pagamento (CNAB 240)
                            </h3>
                            <p className="text-xs text-blue-100 mt-1">
                                Gere o arquivo para fazer upload no Internet Banking de qualquer banco.
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white/70 hover:text-white p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                        {/* Resumo */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                                <span className="block text-xs font-semibold uppercase tracking-wider text-gray-400">Total Selecionado</span>
                                <span className="block text-2xl font-black text-gray-950 dark:text-white mt-1">{formatCurrency(totalAmount)}</span>
                                <span className="text-xs text-gray-500 mt-1 block">{selectedTransactions.length} lançamentos marcados</span>
                            </div>
                            <div className="bg-blue-50/50 dark:bg-blue-950/20 p-4 rounded-xl border border-blue-100/30 dark:border-blue-900/30">
                                <span className="block text-xs font-semibold uppercase tracking-wider text-blue-500">Pronto para Exportar</span>
                                <span className="block text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{formatCurrency(validAmount)}</span>
                                <span className="text-xs text-blue-750 dark:text-blue-300 mt-1 block font-medium">
                                    {validPayments.length} de {selectedTransactions.length} títulos com código de barras
                                </span>
                            </div>
                        </div>

                        {/* Conta Bancária de Origem */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                                Conta Bancária de Origem
                            </label>
                            {loading ? (
                                <div className="text-sm text-gray-500 animate-pulse bg-gray-150 h-10 rounded-lg" />
                            ) : configs.length === 0 ? (
                                <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950/20 p-3 rounded-lg border border-red-200/30">
                                    Nenhuma conta bancária configurada. Acesse as <strong>Configurações &gt; Bancos e DDA</strong> para adicionar uma conta de origem.
                                </div>
                            ) : (
                                <div>
                                    <select
                                        value={selectedConfigId}
                                        onChange={(e) => setSelectedConfigId(e.target.value)}
                                        className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-medium text-sm transition-shadow outline-none"
                                    >
                                        <option value="">Selecione a conta de onde sairá o dinheiro...</option>
                                        {configs.map(config => {
                                            const isCust = config.provider.startsWith('custom_');
                                            const code = config.config?.bank_code || getBankCodeFromProvider(config.provider);
                                            const bankName = isCust ? (config.config?.custom_name || 'Banco Personalizado') : (BANK_TEMPLATES[code]?.bankName || 'Banco');
                                            const hasFull = config.config?.branch && config.config?.account && (!isCust || config.config?.bank_code);
                                            return (
                                                <option key={config.id} value={config.id}>
                                                    {bankName} {hasFull
                                                        ? `(Banco: ${code || '?'} | Ag: ${config.config.branch} | CC: ${config.config.account})`
                                                        : `⚠ Sem dados completos (Banco: ${code || '?'})`}
                                                </option>
                                            );
                                        })}
                                    </select>

                                    {/* Alerta de dados faltando */}
                                    {selectedConfigId && !hasAgencyAndAccount && (
                                        <div className="mt-2 flex items-start gap-2.5 px-3 py-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-xl">
                                            <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                                                    Agência e Conta não configuradas
                                                </p>
                                                <p className="text-[11px] text-amber-600 dark:text-amber-500 mt-0.5">
                                                    Ao baixar a remessa, você poderá preencher e salvar esses dados antes de continuar.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Badge verde quando dados estão ok */}
                                    {selectedConfigId && hasAgencyAndAccount && (
                                        <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl">
                                            <CheckCircle2 size={14} className="text-emerald-500" />
                                            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                                Ag: {bankConfig?.config?.branch}-{bankConfig?.config?.branch_digit || '0'} &nbsp;|&nbsp; CC: {bankConfig?.config?.account}-{bankConfig?.config?.account_digit || '0'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Extensão do Arquivo */}
                        {selectedConfigId && (
                            <div className="bg-slate-50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800 space-y-3">
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-405 dark:text-gray-400">
                                    Formato / Extensão do Arquivo
                                </label>
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="file-extension"
                                            value="rem"
                                            checked={fileExtension === 'rem'}
                                            onChange={() => setFileExtension('rem')}
                                            className="w-4 h-4 text-indigo-650 focus:ring-indigo-500 border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                                        />
                                        <span>Arquivo de Remessa (.rem)</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="file-extension"
                                            value="txt"
                                            checked={fileExtension === 'txt'}
                                            onChange={() => setFileExtension('txt')}
                                            className="w-4 h-4 text-indigo-650 focus:ring-indigo-500 border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                                        />
                                        <span>Arquivo de Texto (.txt)</span>
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* Aviso de lançamentos sem código */}
                        {hasInvalidPayments && (
                            <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 rounded-xl p-4 flex items-start gap-3">
                                <AlertTriangle className="text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" size={20} />
                                <div className="text-sm text-amber-800 dark:text-amber-300 space-y-1.5 leading-relaxed">
                                    <p className="font-bold">Atenção: Existem lançamentos sem código de barras!</p>
                                    <p className="text-xs">O arquivo de remessa CNAB exige que todos os boletos tenham o código de barras ou a linha digitável cadastrados.</p>
                                    <p className="text-xs font-semibold bg-white/50 dark:bg-slate-900/50 p-2 rounded-lg border border-amber-200/20">
                                        💡 <strong>Como resolver:</strong> Abra ou edite a despesa e cole o código de barras no campo <strong>Observações</strong>. Você também pode arrastar o PDF do boleto para que a IA faça a leitura automática do código.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Lista de lançamentos */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                                Lançamentos Selecionados ({selectedTransactions.length})
                            </label>
                            <div className="border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-slate-800 max-h-[200px] overflow-y-auto">
                                {processedTransactions.map(({ transaction: t, rawBarcode, validation, isValid }) => {
                                    const hasBarcode = !!rawBarcode;
                                    const isWarning = validation && !validation.isValid;
                                    const isError = !isValid;
                                    
                                    return (
                                        <div key={t.id} className="p-3.5 flex flex-col md:flex-row md:items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-850/50 transition-colors gap-3">
                                            <div className="min-w-0 flex-1 space-y-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-sm font-semibold text-gray-800 dark:text-white truncate">
                                                        {t.description}
                                                    </span>
                                                    {validation && (
                                                        <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                                            validation.type === 'utility'
                                                                ? 'bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 border-purple-200/10'
                                                                : 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-200/10'
                                                        }`}>
                                                            {validation.type === 'utility' ? 'Concessionária' : 'Bancário'}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-500 flex items-center gap-1.5 flex-wrap">
                                                    <span>Vencimento: {new Date(t.date).toLocaleDateString('pt-BR')}</span>
                                                    {t.contact?.name && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="truncate">{t.contact.name}</span>
                                                        </>
                                                    )}
                                                </div>
                                                
                                                {/* Detalhes do código de barras */}
                                                {hasBarcode && validation && (
                                                    <div className="pt-1 space-y-0.5">
                                                        <code className="text-[10px] font-mono bg-gray-50 dark:bg-slate-900/60 px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-400 block w-full overflow-x-auto truncate whitespace-nowrap">
                                                            {validation.clean}
                                                        </code>
                                                        {validation.errors.length > 0 && (
                                                            <div className="text-[10px] text-amber-600 dark:text-amber-400 flex items-start gap-1">
                                                                <AlertTriangle size={10} className="shrink-0 mt-0.5" />
                                                                <span className="leading-tight">{validation.errors.join(', ')}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
                                                <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(t.amount)}</span>
                                                
                                                {isError ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full border border-red-200/10">
                                                        <AlertCircle size={10} /> Inválido
                                                    </span>
                                                ) : isWarning ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-200/10">
                                                        <AlertTriangle size={10} /> Com aviso
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-200/10">
                                                        <CheckCircle2 size={10} /> Pronto
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Guia de Upload no Banco */}
                        {selectedConfigId && instructions && (
                            <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800 rounded-xl p-4 space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-350">
                                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                                    <Info size={16} />
                                    <h5 className="text-xs font-bold uppercase tracking-wider">
                                        Como importar no {selectedBankName}
                                    </h5>
                                </div>
                                <ol className="list-decimal pl-4 text-xs text-gray-600 dark:text-gray-300 space-y-1.5 leading-relaxed">
                                    {instructions.map((step, idx) => (
                                        <li key={idx} className="marker:text-indigo-500 marker:font-bold">
                                            {step}
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-5 bg-gray-50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-150 dark:border-slate-800">
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                            <Info size={14} className="text-gray-450" />
                            <span>Apenas títulos marcados como "Pronto" serão incluídos no arquivo.</span>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end">
                            <Button variant="ghost" onClick={onClose} className="w-full sm:w-auto">Cancelar</Button>
                            <Button
                                onClick={handleExport}
                                disabled={!selectedConfigId || validPayments.length === 0}
                                className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto shadow-md shadow-blue-500/15"
                            >
                                <Download size={18} className="mr-2" />
                                Baixar Remessa ({validPayments.length})
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de dados bancários faltando */}
            {showMissingDataModal && bankConfig && (
                <MissingBankDataModal
                    bankName={bankConfig.provider.startsWith('custom_') ? (bankConfig.config?.custom_name || 'Banco Personalizado') : (BANK_TEMPLATES[bankCode]?.bankName || bankConfig.provider)}
                    isCustom={bankConfig.provider.startsWith('custom_')}
                    currentBankCode={bankConfig.config?.bank_code || ''}
                    currentBranch={bankConfig.config?.branch || ''}
                    currentBranchDigit={bankConfig.config?.branch_digit || ''}
                    currentAccount={bankConfig.config?.account || ''}
                    currentAccountDigit={bankConfig.config?.account_digit || ''}
                    onSaveAndContinue={handleSaveAndContinue}
                    onContinueAnyway={() => { setShowMissingDataModal(false); doExport(); }}
                    onCancel={() => setShowMissingDataModal(false)}
                    isSaving={isSavingBankData}
                />
            )}
        </>
    );
}
