import { useState } from 'react';
import { Plus, Trash2, Power, PowerOff, Activity, Zap, Copy, Download, Building2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Tooltip } from '../components/ui/Tooltip';
import { useWebhooks } from '../hooks/useWebhooks';
import { WebhookForm } from '../components/webhooks/WebhookForm';
import { WebhookLogModal } from '../components/webhooks/WebhookLogModal';
import { webhookService } from '../services/webhookService';
import type { Webhook } from '../hooks/useWebhooks';

export function WebhookSettings() {
    const { webhooks, templateWebhooks, loading, createWebhook, updateWebhook, deleteWebhook, toggleWebhook, deployWebhook, getWebhookLogs } = useWebhooks();
    const [formOpen, setFormOpen] = useState(false);
    const [logsOpen, setLogsOpen] = useState(false);
    const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
    const [testingId, setTestingId] = useState<string | null>(null);
    const [deployingId, setDeployingId] = useState<string | null>(null);

    const handleEdit = (webhook: Webhook) => {
        setSelectedWebhook(webhook);
        setFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir este webhook?')) {
            try {
                await deleteWebhook(id);
            } catch (error) {
                alert('Erro ao excluir webhook');
            }
        }
    };

    const handleToggle = async (id: string, currentStatus: boolean) => {
        try {
            await toggleWebhook(id, !currentStatus);
        } catch (error) {
            alert('Erro ao alterar status do webhook');
        }
    };

    const handleTest = async (webhook: Webhook) => {
        setTestingId(webhook.id);
        try {
            await webhookService.testWebhook(webhook);
            alert('Webhook de teste enviado! Verifique os logs para ver o resultado.');
        } catch (error) {
            alert('Erro ao testar webhook');
        } finally {
            setTestingId(null);
        }
    };

    const handleViewLogs = (webhook: Webhook) => {
        setSelectedWebhook(webhook);
        setLogsOpen(true);
    };

    const handleDuplicate = async (webhook: Webhook) => {
        try {
            const duplicatedData = {
                name: `${webhook.name} (Cópia)`,
                url: webhook.url,
                method: webhook.method,
                events: webhook.events,
                headers: webhook.headers,
                auth_username: webhook.auth_username,
                auth_password: webhook.auth_password,
                is_active: false // Start as inactive
            };
            await createWebhook(duplicatedData);
            alert('✅ Webhook duplicado com sucesso!');
        } catch (error) {
            alert('❌ Erro ao duplicar webhook');
        }
    };

    const handleDeploy = async (template: Webhook & { company_name?: string }) => {
        setDeployingId(template.id);
        try {
            await deployWebhook(template);
            alert('✅ Webhook implementado com sucesso! Ele está inativo — ative quando estiver pronto.');
        } catch (error) {
            alert('❌ Erro ao implementar webhook');
        } finally {
            setDeployingId(null);
        }
    };

    const handleFormSubmit = async (data: any) => {
        if (selectedWebhook) {
            await updateWebhook(selectedWebhook.id, data);
        } else {
            await createWebhook(data);
        }
        setSelectedWebhook(null);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-10">
                <div className="text-gray-500">Carregando webhooks...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Webhooks</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Configure webhooks para integrar com sistemas externos
                    </p>
                </div>
                <Button
                    onClick={() => {
                        setSelectedWebhook(null);
                        setFormOpen(true);
                    }}
                >
                    <Plus size={18} className="mr-2" />
                    Novo Webhook
                </Button>
            </div>

            {webhooks.length === 0 ? (
                <div className="space-y-6">
                    {/* Empty state */}
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-12 text-center">
                        <div className="flex justify-center mb-4">
                            <Zap size={48} className="text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                            Nenhum webhook configurado
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            Crie seu primeiro webhook para começar a receber notificações de eventos
                        </p>
                        <Button
                            onClick={() => {
                                setSelectedWebhook(null);
                                setFormOpen(true);
                            }}
                        >
                            <Plus size={18} className="mr-2" />
                            Criar Webhook
                        </Button>
                    </div>

                    {/* Template Webhooks from other companies */}
                    {templateWebhooks.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <Download size={18} className="text-blue-500" />
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                        Webhooks Disponíveis
                                    </h3>
                                </div>
                                <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full font-semibold">
                                    {templateWebhooks.length}
                                </span>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 -mt-2">
                                Estes webhooks já estão configurados em outras empresas. Implemente-os aqui com um clique.
                            </p>

                            <div className="grid gap-3">
                                {templateWebhooks.map(template => (
                                    <div
                                        key={template.id}
                                        className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-all duration-200 hover:border-blue-300 dark:hover:border-blue-700"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                                                        {template.name}
                                                    </h4>
                                                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
                                                        {template.method}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate mb-2" title={template.url}>
                                                    {template.url}
                                                </p>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {template.events.slice(0, 3).map(event => (
                                                        <span
                                                            key={event}
                                                            className="px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300 rounded font-medium"
                                                        >
                                                            {event}
                                                        </span>
                                                    ))}
                                                    {template.events.length > 3 && (
                                                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                                                            +{template.events.length - 3} mais
                                                        </span>
                                                    )}
                                                    <span className="text-gray-300 dark:text-gray-600">|</span>
                                                    <div className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
                                                        <Building2 size={11} />
                                                        <span className="text-[10px] font-medium">{template.company_name}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <Button
                                                onClick={() => handleDeploy(template)}
                                                isLoading={deployingId === template.id}
                                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 flex-shrink-0"
                                            >
                                                <Download size={14} className="mr-1.5" />
                                                Implementar
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid gap-4">
                    {webhooks.map(webhook => (
                        <div
                            key={webhook.id}
                            className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 border border-gray-200 dark:border-slate-700"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                            {webhook.name}
                                        </h3>
                                        <span className={`px-2 py-1 text-xs rounded-full ${webhook.is_active
                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                            : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                                            }`}>
                                            {webhook.is_active ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 font-mono">
                                        {webhook.method} {webhook.url}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {webhook.events.map(event => (
                                            <span
                                                key={event}
                                                className="px-2 py-1 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded"
                                            >
                                                {event}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Tooltip content={webhook.is_active ? 'Desativar' : 'Ativar'}>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleToggle(webhook.id, webhook.is_active)}
                                        >
                                            {webhook.is_active ? (
                                                <PowerOff size={18} className="text-orange-500" />
                                            ) : (
                                                <Power size={18} className="text-green-500" />
                                            )}
                                        </Button>
                                    </Tooltip>
                                    <Tooltip content="Ver Logs">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleViewLogs(webhook)}
                                        >
                                            <Activity size={18} className="text-blue-500" />
                                        </Button>
                                    </Tooltip>
                                    <Tooltip content="Testar Webhook">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleTest(webhook)}
                                            isLoading={testingId === webhook.id}
                                        >
                                            <Zap size={18} className="text-purple-500" />
                                        </Button>
                                    </Tooltip>
                                    <Tooltip content="Duplicar">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDuplicate(webhook)}
                                        >
                                            <Copy size={18} className="text-gray-500" />
                                        </Button>
                                    </Tooltip>
                                    <Tooltip content="Editar">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEdit(webhook)}
                                        >
                                            Editar
                                        </Button>
                                    </Tooltip>
                                    <Tooltip content="Excluir">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(webhook.id)}
                                        >
                                            <Trash2 size={18} className="text-red-500" />
                                        </Button>
                                    </Tooltip>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <WebhookForm
                isOpen={formOpen}
                onClose={() => {
                    setFormOpen(false);
                    setSelectedWebhook(null);
                }}
                onSubmit={handleFormSubmit}
                initialData={selectedWebhook}
            />

            {selectedWebhook && (
                <WebhookLogModal
                    isOpen={logsOpen}
                    onClose={() => {
                        setLogsOpen(false);
                        setSelectedWebhook(null);
                    }}
                    webhookId={selectedWebhook.id}
                    webhookName={selectedWebhook.name}
                    getLogs={getWebhookLogs}
                />
            )}
        </div>
    );
}
