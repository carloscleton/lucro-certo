import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Eye, FileText, CheckCircle2, ShieldCheck, Building2, MapPin, Settings } from 'lucide-react';
import type { Company } from '../../hooks/useCompanies';
import { useState } from 'react';
import { StandaloneInvoiceModal } from '../fiscal/StandaloneInvoiceModal';
import { useNavigate } from 'react-router-dom';

import { useEntity } from '../../context/EntityContext';

interface CompanyFiscalModalProps {
    isOpen: boolean;
    onClose: () => void;
    company: Company | null;
}

export function CompanyFiscalModal({ isOpen, onClose, company }: CompanyFiscalModalProps) {
    const navigate = useNavigate();
    const { availableEntities, switchEntity } = useEntity();
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);

    if (!company) return null;

    const nat = company.settings?.national_config || {};
    const tec = company.tecnospeed_config || {};
    
    const activeProvider = company.settings?.fiscal_provider || 'national';
    const isNational = activeProvider === 'national';
    const ambiente = (isNational ? nat.ambiente : tec.ambiente) || 'homologacao';
    const isProducao = ambiente === 'producao';

    const im = company.inscricao_municipal || (company as any).state_tax_number || nat.inscricao_municipal || tec.inscricao_municipal || 'Não cadastrada';
    const certVenc = nat.certificado_vencimento || tec.certificado_vencimento || null;
    const certSujeito = nat.certificado_sujeito || tec.certificado_sujeito || null;

    const handleOpenSettings = () => {
        if (company?.id) {
            const target = availableEntities.find(e => e.id === company.id);
            if (target) {
                switchEntity(target);
            }
        }
        onClose();
        navigate('/settings?tab=fiscal');
    };

    return (
        <>
            <Modal
                isOpen={isOpen && !showInvoiceModal}
                onClose={onClose}
                title={`Configurações de Emissão: ${company.trade_name}`}
                subtitle="Resumo das credenciais e parâmetros para emissão de NFS-e"
                icon={Eye}
                maxWidth="max-w-xl"
            >
                <div className="flex flex-col gap-6 py-2">
                    {/* Status da Emissão */}
                    <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${isProducao ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50' : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50'}`}>
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl ${isProducao ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'}`}>
                                <ShieldCheck size={20} />
                            </div>
                            <div>
                                <h4 className={`font-bold text-sm ${isProducao ? 'text-emerald-900 dark:text-emerald-200' : 'text-amber-900 dark:text-amber-200'}`}>
                                    {isProducao ? 'Ambiente de PRODUÇÃO (Notas com Validade Fiscal)' : 'Ambiente de TESTE / HOMOLOGAÇÃO'}
                                </h4>
                                <p className={`text-xs ${isProducao ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                                    Emissor Ativo: <strong className="uppercase">{isNational ? 'Portal Nacional (ADN gov.br)' : 'PlugNotas / TecnoSpeed'}</strong>
                                </p>
                            </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${isProducao ? 'bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100' : 'bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100'}`}>
                            {isProducao ? 'Produção' : 'Homologação'}
                        </span>
                    </div>

                    {/* Dados Fiscais da Empresa */}
                    <div className="bg-gray-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-gray-200 dark:border-slate-700/80 space-y-3">
                        <h4 className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                            <Building2 size={14} className="text-blue-500" /> Dados Fiscais da Empresa
                        </h4>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-xs text-gray-400 dark:text-gray-500 block">Razão Social:</span>
                                <span className="font-semibold text-gray-800 dark:text-gray-200">{company.legal_name || company.trade_name}</span>
                            </div>
                            <div>
                                <span className="text-xs text-gray-400 dark:text-gray-500 block">CNPJ / CPF:</span>
                                <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">{company.cnpj || company.cpf || 'Não informado'}</span>
                            </div>
                            <div>
                                <span className="text-xs text-gray-400 dark:text-gray-500 block">Inscrição Municipal (IM):</span>
                                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{im}</span>
                            </div>
                            <div>
                                <span className="text-xs text-gray-400 dark:text-gray-500 block">Localidade:</span>
                                <span className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                                    <MapPin size={12} className="text-gray-400" />
                                    {company.city ? `${company.city} / ${company.state}` : 'Não informada'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Dados do Certificado Digital */}
                    <div className="bg-blue-50/50 dark:bg-blue-950/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30 space-y-2">
                        <h4 className="text-xs font-bold uppercase text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                            <CheckCircle2 size={14} className="text-blue-600" /> Certificado Digital A1
                        </h4>
                        <div className="text-xs space-y-1 text-gray-600 dark:text-gray-300">
                            {certSujeito && <p><strong>Titular:</strong> {certSujeito}</p>}
                            {certVenc ? (
                                <p><strong>Validade:</strong> <span className="text-emerald-600 dark:text-emerald-400 font-bold">{certVenc}</span></p>
                            ) : (
                                <p className="text-gray-400 italic">Certificado digital configurado e pronto para emissão.</p>
                            )}
                        </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                        <Button
                            variant="outline"
                            onClick={handleOpenSettings}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 text-xs font-bold"
                        >
                            <Settings size={16} /> Configurações Fiscais Completas
                        </Button>

                        <Button
                            onClick={() => setShowInvoiceModal(true)}
                            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-2 text-xs shadow-lg shadow-emerald-600/20"
                        >
                            <FileText size={16} /> Emitir Nota Avulsa Agora
                        </Button>
                    </div>
                </div>
            </Modal>

            {showInvoiceModal && (
                <StandaloneInvoiceModal
                    onClose={() => {
                        setShowInvoiceModal(false);
                        onClose();
                    }}
                    onSuccess={() => {
                        setShowInvoiceModal(false);
                        onClose();
                    }}
                />
            )}
        </>
    );
}
