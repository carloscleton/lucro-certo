import { useState, useEffect } from 'react';
import { Building2, Save, ExternalLink, ShieldCheck, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useCompanies } from '../../hooks/useCompanies';
import { useEntity } from '../../context/EntityContext';
import { fiscalService } from '../../services/fiscalService';
import { supabase } from '../../lib/supabase';
import { RefreshCw } from 'lucide-react';

export function FiscalSettings() {
    const { currentEntity } = useEntity();
    const { companies, updateCompany } = useCompanies();
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [uploadingCert, setUploadingCert] = useState(false);
    const [certFile, setCertFile] = useState<File | null>(null);
    const [certPassword, setCertPassword] = useState('');
    const [certStatus, setCertStatus] = useState<any>(null);

    const [config, setConfig] = useState({
        cnpj: '',
        inscricao_estadual: '',
        inscricao_municipal: '',
        regime_tributario: '1', // 1 - Simples Nacional, 3 - Regime Normal
        tecnospeed_api_key: '',
        ambiente: 'homologacao'
    });

    const currentCompany = companies.find(c => c.id === currentEntity.id);

    useEffect(() => {
        if (currentCompany?.tecnospeed_config) {
            setConfig((prev: any) => ({ ...prev, ...currentCompany.tecnospeed_config }));
        }
        if (currentCompany?.cnpj && !currentCompany.tecnospeed_config?.cnpj) {
            setConfig((prev: any) => ({ ...prev, cnpj: currentCompany.cnpj }));
        }

        if (currentEntity.id) {
            loadCertStatus();
        }
    }, [currentCompany, currentEntity.id]);

    const loadCertStatus = async () => {
        if (!currentEntity.id) return;
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            if (!token) return;

            const status = await fiscalService.getCertificateStatus(currentEntity.id, token);
            if (status && status.data) {
                setCertStatus(status.data);
            }
        } catch (error) {
            console.warn('Não foi possível carregar status do certificado');
        }
    };

    const handleSave = async () => {
        if (!currentEntity.id) return;
        setSaving(true);
        try {
            await updateCompany(currentEntity.id, {
                tecnospeed_config: config
            });
            alert('Configurações fiscais salvas com sucesso!');
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar configurações fiscais.');
        } finally {
            setSaving(false);
        }
    };

    const handleUploadCertificate = async () => {
        if (!currentEntity.id || !certFile || !certPassword) {
            alert('Selecione o arquivo e informe a senha do certificado.');
            return;
        }

        setUploadingCert(true);
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');

            await fiscalService.uploadCertificate(currentEntity.id, certFile, certPassword, token);
            alert('Certificado Digital enviado com sucesso!');
            setCertFile(null);
            setCertPassword('');
            loadCertStatus(); // Recarrega o status após subir
        } catch (error: any) {
            console.error(error);
            alert('Erro ao enviar certificado: ' + (error.response?.data?.error || error.message));
        } finally {
            setUploadingCert(false);
        }
    };

    const handleSyncIssuer = async () => {
        if (!currentEntity.id) return;

        // 1. Confirm fields
        if (!config.cnpj || !config.tecnospeed_api_key) {
            alert('CNPJ e API Key são obrigatórios para sincronizar.');
            return;
        }

        setSyncing(true);
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');

            const result = await fiscalService.syncIssuer(currentEntity.id, config, token);
            alert('Emitente sincronizado com sucesso no PlugNotas!\n\nID: ' + (result.data?.id || 'OK'));
        } catch (error: any) {
            console.error(error);
            alert('Erro ao sincronizar emitente: ' + (error.response?.data?.error || error.message));
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-start gap-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                <Building2 className="text-indigo-600 mt-1" size={24} />
                <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Configurações do Emitente</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        Insira os dados da sua empresa exatamente como registrados na SEFAZ e Prefeitura.
                        Estes dados serão usados para preencher os campos do PlugNotas da TecnoSpeed.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                    label="CNPJ do Emitente"
                    value={config.cnpj}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, cnpj: e.target.value })}
                    placeholder="00.000.000/0000-00"
                />
                <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Regime Tributário
                    </label>
                    <select
                        value={config.regime_tributario}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setConfig({ ...config, regime_tributario: e.target.value })}
                        className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="1">Simples Nacional</option>
                        <option value="2">Simples Nacional (Excesso de Sublimite)</option>
                        <option value="3">Regime Normal (Lucro Real/Presumido)</option>
                    </select>
                </div>
                <Input
                    label="Inscrição Estadual"
                    value={config.inscricao_estadual}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, inscricao_estadual: e.target.value })}
                    placeholder="Isento ou Número"
                />
                <Input
                    label="Inscrição Municipal"
                    value={config.inscricao_municipal}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, inscricao_municipal: e.target.value })}
                    placeholder="Obrigatório para NFS-e"
                />
            </div>

            <div className="pt-6 border-t border-gray-200 dark:border-slate-700">
                <div className="flex items-center gap-2 mb-4">
                    <ShieldCheck className="text-green-600" size={20} />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Credenciais TecnoSpeed</h3>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg mb-6 flex items-start gap-3 border border-amber-100 dark:border-amber-900/30">
                    <AlertCircle className="text-amber-600 shrink-0" size={20} />
                    <p className="text-xs text-amber-800 dark:text-amber-400">
                        Sua API Key pode ser encontrada no painel do PlugNotas. Recomendamos testar primeiro em ambiente de <strong>Homologação</strong> para evitar o consumo de notas reais.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                        label="TecnoSpeed API Key"
                        type="password"
                        value={config.tecnospeed_api_key}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, tecnospeed_api_key: e.target.value })}
                        placeholder="Insira sua chave"
                    />
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Ambiente de Emissão
                        </label>
                        <div className="flex gap-4 mt-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="ambiente"
                                    value="homologacao"
                                    checked={config.ambiente === 'homologacao'}
                                    onChange={(e) => setConfig({ ...config, ambiente: e.target.value })}
                                    className="text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-sm">Homologação (Teste)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="ambiente"
                                    value="producao"
                                    checked={config.ambiente === 'producao'}
                                    onChange={(e) => setConfig({ ...config, ambiente: e.target.value })}
                                    className="text-red-600 focus:ring-red-500"
                                />
                                <span className="text-sm">Produção (Real)</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            <div className="pt-6 border-t border-gray-200 dark:border-slate-700">
                <div className="flex items-center gap-2 mb-4">
                    <ShieldCheck className="text-blue-600" size={20} />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Certificado Digital (A1)</h3>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-6 border border-blue-100 dark:border-blue-900/30">
                    <p className="text-sm text-blue-800 dark:text-blue-400">
                        O envio do certificado digital A1 (.pfx ou .p12) é obrigatório para a emissão de notas em produção.
                        Sua senha é transmitida de forma segura e não fica armazenada em nossos servidores.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Arquivo do Certificado (.pfx, .p12)
                        </label>
                        <input
                            type="file"
                            accept=".pfx,.p12"
                            onChange={(e) => setCertFile(e.target.files?.[0] || null)}
                            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                        />
                    </div>
                    <div className="flex gap-4 items-end">
                        <div className="flex-1">
                            <Input
                                label="Senha do Certificado"
                                type="password"
                                value={certPassword}
                                onChange={(e: any) => setCertPassword(e.target.value)}
                                placeholder="Sua senha"
                            />
                        </div>
                        <Button
                            variant="outline"
                            onClick={handleUploadCertificate}
                            isLoading={uploadingCert}
                            className="border-blue-200 text-blue-700 hover:bg-blue-50 h-[42px]"
                        >
                            <Save size={18} className="mr-2" />
                            Subir Certificado
                        </Button>
                    </div>
                </div>

                {certStatus && (
                    <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-100 dark:border-green-900/20">
                        <div className="flex items-center gap-2 mb-2">
                            <ShieldCheck className="text-green-600" size={18} />
                            <span className="font-semibold text-green-800 dark:text-green-400">Certificado Ativo</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                            <p className="text-gray-700 dark:text-gray-300">
                                <span className="font-medium">Vencimento:</span> {new Date(certStatus.vencimento).toLocaleDateString('pt-BR')}
                            </p>
                            <p className="text-gray-700 dark:text-gray-300">
                                <span className="font-medium">Emitente:</span> {certStatus.alias || certStatus.sujeito || 'Configurado'}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <div className="pt-6 border-t border-gray-200 dark:border-slate-700 flex justify-between items-center">
                <a
                    href="https://plugnotas.com.br"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-800 text-sm flex items-center gap-1"
                >
                    Acessar Painel TecnoSpeed <ExternalLink size={14} />
                </a>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={handleSyncIssuer}
                        isLoading={syncing}
                        className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                    >
                        <RefreshCw size={18} className={`mr-2 ${syncing ? 'animate-spin' : ''}`} />
                        Sincronizar Emitente
                    </Button>
                    <Button onClick={handleSave} isLoading={saving} className="bg-indigo-600 hover:bg-indigo-700">
                        <Save size={18} className="mr-2" />
                        Salvar Configurações
                    </Button>
                </div>
            </div>
        </div>
    );
}
