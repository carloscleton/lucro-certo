import { useState, useEffect, useRef } from 'react';
import { Building2, Save, ExternalLink, ShieldCheck, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useCompanies } from '../../hooks/useCompanies';
import { useEntity } from '../../context/EntityContext';
import { fiscalService } from '../../services/fiscalService';
import { supabase } from '../../lib/supabase';
import { RefreshCw } from 'lucide-react';

export function FiscalSettings() {
    const { currentEntity, refresh: refreshEntity } = useEntity();
    const { companies, updateCompany } = useCompanies();
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [moduleEnabled, setModuleEnabled] = useState(false);
    const [uploadingCert, setUploadingCert] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [certPassword, setCertPassword] = useState('');

    const [config, setConfig] = useState({
        cnpj: '',
        inscricao_estadual: '',
        inscricao_municipal: '',
        razao_social: '',
        nome_fantasia: '',
        email: '',
        telefone: '',
        endereco: {
            logradouro: '',
            numero: '',
            complemento: '',
            bairro: '',
            cep: '',
            codigoCidade: '',
            uf: ''
        },
        regime_tributario: '1', // 1 - Simples Nacional, 3 - Regime Normal
        tecnospeed_api_key: '',
        ambiente: 'homologacao',
        endpoint_homologacao: '',
        endpoint_producao: ''
    });

    const currentCompany = companies.find(c => c.id === currentEntity.id);

    useEffect(() => {
        if (!currentCompany) return;

        setModuleEnabled(!!currentCompany.fiscal_module_enabled);
        setConfig((prev: any) => {
            const newConfig = { ...prev };
            const tc = currentCompany.tecnospeed_config || {};

            Object.assign(newConfig, tc);

            if (!newConfig.cnpj && currentCompany.cnpj) newConfig.cnpj = currentCompany.cnpj;
            if (!newConfig.razao_social && currentCompany.legal_name) newConfig.razao_social = currentCompany.legal_name;
            if (!newConfig.nome_fantasia && currentCompany.trade_name) newConfig.nome_fantasia = currentCompany.trade_name;
            if (!newConfig.telefone && currentCompany.phone) newConfig.telefone = currentCompany.phone;

            if (!newConfig.endereco) {
                newConfig.endereco = {};
            }
            if (!newConfig.endereco.logradouro && currentCompany.street) newConfig.endereco.logradouro = currentCompany.street;
            if (!newConfig.endereco.numero && currentCompany.number) newConfig.endereco.numero = currentCompany.number;
            if (!newConfig.endereco.complemento && currentCompany.complement) newConfig.endereco.complemento = currentCompany.complement;
            if (!newConfig.endereco.bairro && currentCompany.neighborhood) newConfig.endereco.bairro = currentCompany.neighborhood;
            if (!newConfig.endereco.cep && currentCompany.zip_code) newConfig.endereco.cep = currentCompany.zip_code;
            if (!newConfig.endereco.uf && currentCompany.state) newConfig.endereco.uf = currentCompany.state;

            return newConfig;
        });
    }, [currentCompany]);

    const handleSave = async () => {
        if (!currentEntity.id || currentEntity.type === 'personal') {
            alert('Configurações fiscais são exclusivas para empresas. Mude o contexto no topo.');
            return;
        }
        setSaving(true);
        try {
            await updateCompany(currentEntity.id, {
                tecnospeed_config: config,
                fiscal_module_enabled: moduleEnabled
            });
            await refreshEntity();
            alert('Configurações fiscais salvas com sucesso!');
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar configurações fiscais.');
        } finally {
            setSaving(false);
        }
    };

    const handleUploadCertificate = async () => {
        const file = fileInputRef.current?.files?.[0];
        
        if (!currentEntity.id || currentEntity.type === 'personal' || !file || !certPassword) {
            if (currentEntity.type === 'personal') {
                alert('O Certificado Digital deve ser vinculado a uma empresa. Mude o contexto no topo.');
            } else {
                alert('Selecione o arquivo e informe a senha do certificado.');
            }
            return;
        }

        setUploadingCert(true);
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');

            await fiscalService.uploadCertificate(currentEntity.id, file, certPassword, token);
            
            // Atualizar config local para marcar que o certificado foi enviado
            const newConfig = { ...config, certificado_enviado: true, certificado_data_upload: new Date().toISOString() };
            await updateCompany(currentEntity.id, {
                tecnospeed_config: newConfig
            });
            setConfig(newConfig);
            
            alert('Certificado Digital enviado com sucesso!');
            if (fileInputRef.current) fileInputRef.current.value = '';
            setCertPassword('');
        } catch (error: any) {
            console.error(error);
            const detail = error.response?.data?.detail;
            const errorMsg = detail?.error?.message || detail?.message || error.response?.data?.error || error.message;
            alert('Erro ao enviar certificado: ' + errorMsg);
        } finally {
            setUploadingCert(false);
        }
    };

    const handleSyncIssuer = async () => {
        if (!currentEntity.id || currentEntity.type === 'personal') {
            alert('A sincronização de emitente é exclusiva para empresas.');
            return;
        }

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
        <div className="space-y-6">
            {/* Módulo Toggle */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${moduleEnabled ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                            <ShieldCheck size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Status do Módulo Fiscal</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Ative para habilitar a emissão de notas e o menu lateral</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={moduleEnabled}
                            onChange={(e) => setModuleEnabled(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                </div>
            </div>

            <div className={`space-y-8 transition-opacity duration-200 ${moduleEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none grayscale'}`}>
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
                    label="Razão Social"
                    value={config.razao_social}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, razao_social: e.target.value })}
                    placeholder="Sua Empresa LTDA"
                />
                <Input
                    label="Nome Fantasia"
                    value={config.nome_fantasia}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, nome_fantasia: e.target.value })}
                    placeholder="Nome da sua loja/empresa"
                />
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
                <Input
                    label="E-mail"
                    type="email"
                    value={config.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, email: e.target.value })}
                    placeholder="contato@empresa.com"
                />
                <Input
                    label="Telefone"
                    value={config.telefone}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, telefone: e.target.value })}
                    placeholder="(00) 00000-0000"
                />
            </div>

            <div className="pt-6 border-t border-gray-200 dark:border-slate-700">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Endereço (Obrigatório)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Input
                        label="CEP"
                        value={config.endereco?.cep || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, endereco: { ...config.endereco, cep: e.target.value } })}
                        placeholder="00000-000"
                    />
                    <div className="md:col-span-2">
                        <Input
                            label="Logradouro"
                            value={config.endereco?.logradouro || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, endereco: { ...config.endereco, logradouro: e.target.value } })}
                            placeholder="Rua, Avenida, etc."
                        />
                    </div>
                    <Input
                        label="Número"
                        value={config.endereco?.numero || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, endereco: { ...config.endereco, numero: e.target.value } })}
                        placeholder="123"
                    />
                    <div className="md:col-span-2">
                        <Input
                            label="Complemento"
                            value={config.endereco?.complemento || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, endereco: { ...config.endereco, complemento: e.target.value } })}
                            placeholder="Sala 1, Apto 2, etc."
                        />
                    </div>
                    <Input
                        label="Bairro"
                        value={config.endereco?.bairro || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, endereco: { ...config.endereco, bairro: e.target.value } })}
                        placeholder="Centro"
                    />
                    <Input
                        label="Código Cidade (IBGE)"
                        value={config.endereco?.codigoCidade || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, endereco: { ...config.endereco, codigoCidade: e.target.value } })}
                        placeholder="Ex: 3550308 (São Paulo)"
                    />
                    <Input
                        label="UF"
                        value={config.endereco?.uf || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, endereco: { ...config.endereco, uf: e.target.value } })}
                        placeholder="SP, RJ, MG"
                        maxLength={2}
                    />
                </div>
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

                <div className="mt-6 border-t border-gray-100 dark:border-slate-800 pt-4">
                    <label className="flex items-center gap-2 cursor-pointer mb-4 w-fit">
                        <input
                            type="checkbox"
                            checked={!!(config.ambiente === 'homologacao' ? config.endpoint_homologacao : config.endpoint_producao)}
                            onChange={(e) => {
                                if (!e.target.checked) {
                                    setConfig({
                                        ...config,
                                        ...(config.ambiente === 'homologacao' ? { endpoint_homologacao: '' } : { endpoint_producao: '' })
                                    });
                                } else {
                                    setConfig({
                                        ...config,
                                        ...(config.ambiente === 'homologacao' ? { endpoint_homologacao: 'https://api.sandbox.plugnotas.com.br' } : { endpoint_producao: 'https://api.plugnotas.com.br' })
                                    });
                                }
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Usar Endpoint Personalizado</span>
                    </label>

                    {(config.ambiente === 'homologacao' && config.endpoint_homologacao !== '') || 
                     (config.ambiente === 'producao' && config.endpoint_producao !== '') || 
                     (config.endpoint_homologacao || config.endpoint_producao) ? (
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                            {config.ambiente === 'homologacao' ? (
                                <Input
                                    label="Endpoint Personalizado (Homologação)"
                                    value={config.endpoint_homologacao || ''}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, endpoint_homologacao: e.target.value })}
                                    placeholder="Ex: https://api.sandbox.plugnotas.com.br"
                                />
                            ) : (
                                <Input
                                    label="Endpoint Personalizado (Produção)"
                                    value={config.endpoint_producao || ''}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, endpoint_producao: e.target.value })}
                                    placeholder="Ex: https://api.plugnotas.com.br"
                                />
                            )}
                            <p className="text-xs text-gray-500 mt-2">
                                Deixe desmarcado para usar a URL padrão da TecnoSpeed.
                            </p>
                        </div>
                    ) : null}
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
                            ref={fileInputRef}
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
        </div>
    );
}
