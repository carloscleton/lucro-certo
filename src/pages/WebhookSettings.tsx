import { useState } from 'react';
import { Plus, Trash2, Power, PowerOff, Activity, Zap, Copy } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Tooltip } from '../components/ui/Tooltip';
import { useWebhooks } from '../hooks/useWebhooks';
import { WebhookForm } from '../components/webhooks/WebhookForm';
import { WebhookLogModal } from '../components/webhooks/WebhookLogModal';
import { webhookService } from '../services/webhookService';
import type { Webhook } from '../hooks/useWebhooks';

export function WebhookSettings() {
    const { webhooks, loading, createWebhook, updateWebhook, deleteWebhook, toggleWebhook, getWebhookLogs } = useWebhooks();
    const [formOpen, setFormOpen] = useState(false);
    const [logsOpen, setLogsOpen] = useState(false);
    const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
    const [testingId, setTestingId] = useState<string | null>(null);

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
