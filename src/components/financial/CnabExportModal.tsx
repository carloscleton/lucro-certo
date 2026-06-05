import { useState, useMemo } from 'react';
import { X, Download, AlertCircle, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { Button } from '../ui/Button';
import { useBankingSettings } from '../../hooks/useBankingSettings';
import type { CompanyBankInfo, PaymentItem } from '../../services/cnab/cnab240Generator';
import { generateCnab240 } from '../../services/cnab/cnab240Generator';
import { BANK_TEMPLATES } from '../../services/cnab/bankTemplates';
import type { Transaction } from '../../hooks/useTransactions';

interface CnabExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedTransactions: Transaction[];
    companyCnpj: string;
    companyName: string;
}

const getBankCodeFromProvider = (provider: string): string => {
    if (provider.startsWith('bb_')) return '001';
    if (provider.startsWith('itau_')) return '341';
    if (provider.startsWith('bradesco_')) return '237';
    if (provider.startsWith('santander_')) return '033';
    if (provider.startsWith('caixa_')) return '104';
    if (provider.startsWith('sicoob_')) return '756';
    if (provider.startsWith('sicredi_')) return '748';
    if (provider.startsWith('inter_')) return '077';
    return '001'; // Default BB
};

const getBarcodeFromTransaction = (t: Transaction): string | null => {
    if (!t.notes) return null;

    // 1. Tenta extrair usando o delimitador oficial da IA
    const match = t.notes.match(/>+BARCODE_DATA<+([\s\S]*?)>+END_BARCODE<+/);
    if (match) {
        const cleaned = match[1].replace(/\D/g, '');
        if (cleaned.length >= 44 && cleaned.length <= 48) {
            return cleaned;
        }
    }

    // 2. Busca qualquer bloco de texto que contenha entre 44 e 48 dígitos
    // Remove caracteres comuns de formatação como pontos, espaços e hifens
    // mas preserva quebras de linha para analisar linha por linha
    const lines = t.notes.split('\n');
    for (const line of lines) {
        const cleanedLine = line.replace(/\D/g, '');
        if (cleanedLine.length >= 44 && cleanedLine.length <= 48) {
            return cleanedLine;
        }
    }

    // 3. Busca no texto completo (caso esteja quebrado em várias linhas ou tenha formatação muito complexa)
    const cleanedAll = t.notes.replace(/\D/g, '');
    if (cleanedAll.length >= 44 && cleanedAll.length <= 48) {
        return cleanedAll;
    }

    // 4. Procura padrão de linha digitável ou código de barras com espaços/pontos no meio
    const longNumPattern = /[0-9.\-\s]{40,60}/g;
    const matches = t.notes.match(longNumPattern);
    if (matches) {
        for (const m of matches) {
            const cleanM = m.replace(/\D/g, '');
            if (cleanM.length >= 44 && cleanM.length <= 48) {
                return cleanM;
            }
        }
    }

    return null;
};

export function CnabExportModal({ isOpen, onClose, selectedTransactions, companyCnpj, companyName }: CnabExportModalProps) {
    const { configs, loading } = useBankingSettings();
    const [selectedConfigId, setSelectedConfigId] = useState<string>('');

    // Analisa todas as transações selecionadas e seus respectivos códigos de barras
    const processedTransactions = useMemo(() => {
        return selectedTransactions.map(t => {
            const barcode = getBarcodeFromTransaction(t);
            return {
                transaction: t,
                barcode,
                isValid: !!barcode && t.status !== 'paid'
            };
        });
    }, [selectedTransactions]);

    const validPayments = useMemo(() => {
        return processedTransactions.filter(p => p.isValid);
    }, [processedTransactions]);

    const hasInvalidPayments = processedTransactions.length > validPayments.length;

    if (!isOpen) return null;

    const handleExport = () => {
        if (!selectedConfigId) {
            alert('Selecione uma conta bancária de origem.');
            return;
        }

        const bankConfig = configs.find(c => c.id === selectedConfigId);
        if (!bankConfig) return;

        const bankCode = getBankCodeFromProvider(bankConfig.provider);

        // Verifica se a conta possui agência e conta correntes configurados (essencial para CNAB)
        if (!bankConfig.config?.branch || !bankConfig.config?.account) {
            if (!confirm('Esta conta bancária não possui Agência ou Conta configurados no cadastro. O arquivo CNAB pode ser gerado incompleto e rejeitado pelo banco. Deseja continuar assim mesmo?')) {
                return;
            }
        }

        // Monta informações da empresa para o CNAB
        const company: CompanyBankInfo = {
            cnpj: companyCnpj,
            legal_name: companyName,
            bankCode: bankCode,
            agency: bankConfig.config?.branch || '',
            agency_dv: bankConfig.config?.branch_digit || '0',
            account: bankConfig.config?.account || '',
            account_dv: bankConfig.config?.account_digit || '0',
            company_code: bankConfig.config?.transmission_code || ''
        };

        if (validPayments.length === 0) {
            alert('Nenhum dos lançamentos selecionados possui um Código de Barras válido em suas observações.');
            return;
        }

        const payments: PaymentItem[] = validPayments.map(item => ({
            id: item.transaction.id,
            barcode: item.barcode!.replace(/\D/g, ''),
            amount: item.transaction.amount,
            due_date: item.transaction.date,
            beneficiary_name: (item.transaction.contact as any)?.name || item.transaction.description
        }));

        try {
            const cnabContent = generateCnab240(company, payments, 1);
            
            // Download file
            const blob = new Blob([cnabContent], { type: 'text/plain;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const dataHoje = new Date().toISOString().split('T')[0].replace(/-/g, '');
            link.setAttribute('download', `remessa_${company.bankCode}_${dataHoje}.txt`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            onClose();
        } catch (error: any) {
            console.error('Erro ao gerar CNAB:', error);
            alert('Erro ao gerar arquivo CNAB: ' + error.message);
        }
    };

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    const totalAmount = selectedTransactions.reduce((acc, t) => acc + t.amount, 0);
    const validAmount = validPayments.reduce((acc, p) => acc + p.transaction.amount, 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            Preparar Remessa de Pagamento (CNAB 240)
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Gere o arquivo para fazer upload no Internet Banking de qualquer banco.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 p-1.5 hover:bg-gray-100 dark:hover:bg-slate-850 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    {/* Resumo da seleção */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                            <span className="block text-xs font-semibold uppercase tracking-wider text-gray-400">Total Selecionado</span>
                            <span className="block text-2xl font-black text-gray-950 dark:text-white mt-1">
                                {formatCurrency(totalAmount)}
                            </span>
                            <span className="text-xs text-gray-500 mt-1 block">
                                {selectedTransactions.length} lançamentos marcados
                            </span>
                        </div>
                        <div className="bg-blue-50/50 dark:bg-blue-950/20 p-4 rounded-xl border border-blue-100/30 dark:border-blue-900/30">
                            <span className="block text-xs font-semibold uppercase tracking-wider text-blue-500">Pronto para Exportar</span>
                            <span className="block text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                                {formatCurrency(validAmount)}
                            </span>
                            <span className="text-xs text-blue-750 dark:text-blue-300 mt-1 block font-medium">
                                {validPayments.length} de {selectedTransactions.length} títulos com código de barras
                            </span>
                        </div>
                    </div>

                    {/* Seleção de Conta de Origem */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                            Conta Bancária de Origem
                        </label>
                        {loading ? (
                            <div className="text-sm text-gray-500 animate-pulse bg-gray-150 h-10 rounded-lg"></div>
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
                                        const bankCode = getBankCodeFromProvider(config.provider);
                                        const bankName = BANK_TEMPLATES[bankCode]?.bankName || 'Banco';
                                        const hasAgencyAndAccount = config.config?.branch && config.config?.account;
                                        return (
                                            <option key={config.id} value={config.id}>
                                                {bankName} {hasAgencyAndAccount ? `(Ag: ${config.config.branch} / CC: ${config.config.account})` : '(API / Sem dados de agência)'}
                                            </option>
                                        );
                                    })}
                                </select>
                                {selectedConfigId && !configs.find(c => c.id === selectedConfigId)?.config?.branch && (
                                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 p-2.5 rounded-lg border border-amber-250/20 flex gap-2">
                                        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                        <span>Esta conta foi configurada via API. Para exportação de arquivo CNAB, preencha os dados de Agência e Conta nas Configurações da conta bancária.</span>
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Explicação / Dica se houver algum lançamento sem código de barras */}
                    {hasInvalidPayments && (
                        <div className="bg-amber-55/40 dark:bg-amber-950/20 border border-amber-200/30 rounded-xl p-4 flex items-start gap-3">
                            <AlertTriangle className="text-amber-550 dark:text-amber-400 shrink-0 mt-0.5" size={20} />
                            <div className="text-sm text-amber-800 dark:text-amber-300 space-y-1.5 leading-relaxed">
                                <p className="font-bold">Atenção: Existem lançamentos sem código de barras!</p>
                                <p className="text-xs">
                                    O arquivo de remessa CNAB exige que todos os boletos tenham o código de barras ou a linha digitável cadastrados.
                                </p>
                                <p className="text-xs font-semibold bg-white/50 dark:bg-slate-900/50 p-2 rounded-lg border border-amber-200/20">
                                    💡 <strong>Como resolver:</strong> Abra ou edite a despesa e cole o código de barras (apenas os números) no campo <strong>Observações</strong>. Você também pode arrastar o PDF do boleto para que a IA faça a leitura automática do código.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Lista de lançamentos selecionados */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                            Lançamentos Selecionados ({selectedTransactions.length})
                        </label>
                        <div className="border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-slate-800 max-h-[200px] overflow-y-auto">
                            {processedTransactions.map(({ transaction: t, isValid }) => (
                                <div key={t.id} className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-850/50 transition-colors">
                                    <div className="min-w-0 pr-4">
                                        <span className="block text-sm font-semibold text-gray-800 dark:text-white truncate">
                                            {t.description}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            Vencimento: {new Date(t.date).toLocaleDateString('pt-BR')} {t.contact?.name ? `• ${t.contact.name}` : ''}
                                        </span>
                                    </div>
                                    <div className="text-right shrink-0 flex items-center gap-3">
                                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                                            {formatCurrency(t.amount)}
                                        </span>
                                        {isValid ? (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full border border-green-200/10">
                                                <CheckCircle2 size={10} />
                                                Pronto
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-200/10">
                                                <AlertCircle size={10} />
                                                Sem código
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
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
    );
}
