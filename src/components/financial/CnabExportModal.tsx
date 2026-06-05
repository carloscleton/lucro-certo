import { useState } from 'react';
import { X, Download, AlertCircle } from 'lucide-react';
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
    const match = t.notes.match(/>+BARCODE_DATA<+([\s\S]*?)>+END_BARCODE<+/);
    return match ? match[1].trim() : null;
};

export function CnabExportModal({ isOpen, onClose, selectedTransactions, companyCnpj, companyName }: CnabExportModalProps) {
    const { configs, loading } = useBankingSettings();
    const [selectedConfigId, setSelectedConfigId] = useState<string>('');

    if (!isOpen) return null;

    const handleExport = () => {
        if (!selectedConfigId) {
            alert('Selecione uma conta bancária de origem.');
            return;
        }

        const bankConfig = configs.find(c => c.id === selectedConfigId);
        if (!bankConfig) return;

        const bankCode = getBankCodeFromProvider(bankConfig.provider);

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

        // Filtra apenas pagamentos com código de barras extraído das notas e que não estejam pagos
        const transactionsWithBarcode = selectedTransactions.map(t => {
            const barcode = getBarcodeFromTransaction(t);
            return { transaction: t, barcode };
        });

        const validPayments = transactionsWithBarcode.filter(item => 
            item.barcode && item.transaction.status !== 'paid'
        );

        if (validPayments.length === 0) {
            alert('Nenhum dos lançamentos selecionados possui Código de Barras válido em suas Observações ou todos já estão pagos.');
            return;
        }

        const payments: PaymentItem[] = validPayments.map(item => ({
            id: item.transaction.id,
            barcode: item.barcode!.replace(/\D/g, ''),
            amount: item.transaction.amount,
            due_date: item.transaction.date, // data do vencimento
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Gerar Remessa de Pagamento
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg flex items-start gap-3">
                        <AlertCircle className="text-blue-500 mt-0.5" size={18} shrink-0="true" />
                        <div className="text-sm text-blue-700 dark:text-blue-300">
                            <strong>{selectedTransactions.length} títulos selecionados</strong> para pagamento,
                            totalizando <strong>{formatCurrency(totalAmount)}</strong>.
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Conta Bancária de Origem
                        </label>
                        {loading ? (
                            <div className="text-sm text-gray-500 animate-pulse">Carregando contas...</div>
                        ) : configs.length === 0 ? (
                            <div className="text-sm text-red-500">
                                Nenhuma conta bancária configurada. Acesse Configurações &gt; Bancos para adicionar.
                            </div>
                        ) : (
                            <select
                                value={selectedConfigId}
                                onChange={(e) => setSelectedConfigId(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                            >
                                <option value="">Selecione uma conta...</option>
                                {configs.map(config => {
                                    const bankCode = getBankCodeFromProvider(config.provider);
                                    const bankName = BANK_TEMPLATES[bankCode]?.bankName || 'Banco';
                                    return (
                                        <option key={config.id} value={config.id}>
                                            {bankName} (Ag: {config.config?.branch || ''} / CC: {config.config?.account || ''})
                                        </option>
                                    );
                                })}
                            </select>
                        )}
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            A conta de onde o dinheiro sairá para pagar os fornecedores.
                        </p>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-slate-700/50 flex justify-end gap-2 border-t border-gray-200 dark:border-slate-700">
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button 
                        onClick={handleExport} 
                        disabled={!selectedConfigId || selectedTransactions.length === 0}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        <Download size={18} className="mr-2" />
                        Baixar Arquivo CNAB
                    </Button>
                </div>
            </div>
        </div>
    );
}
