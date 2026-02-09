import { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button } from '../ui/Button';
import type { WebhookLog } from '../../hooks/useWebhooks';
import { format } from 'date-fns';

interface WebhookLogModalProps {
    isOpen: boolean;
    onClose: () => void;
    webhookId: string;
    webhookName: string;
    getLogs: (webhookId: string) => Promise<WebhookLog[]>;
}

export function WebhookLogModal({ isOpen, onClose, webhookId, webhookName, getLogs }: WebhookLogModalProps) {
    const [logs, setLogs] = useState<WebhookLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);

    useEffect(() => {
        if (isOpen && webhookId) {
            loadLogs();
        }
    }, [isOpen, webhookId]);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const data = await getLogs(webhookId);
            setLogs(data);
        } catch (error) {
            console.error('Error loading logs:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const getStatusIcon = (log: WebhookLog) => {
        if (log.error_message) {
            return <XCircle className="text-red-500" size={20} />;
        }
        if (log.status_code && log.status_code >= 200 && log.status_code < 300) {
            return <CheckCircle className="text-green-500" size={20} />;
        }
        return <Clock className="text-yellow-500" size={20} />;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="w-full max-w-4xl bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 relative transition-colors max-h-[90vh] overflow-hidden flex flex-col">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                    <X size={24} />
                </button>

                <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
                    Logs - {webhookName}
                </h2>

                {loading ? (
                    <div className="flex justify-center items-center py-10">
                        <div className="text-gray-500">Carregando logs...</div>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex justify-center items-center py-10">
                        <div className="text-gray-500">Nenhum log encontrado</div>
                    </div>
                ) : (
                    <div className="flex gap-4 flex-1 overflow-hidden">
                        {/* Logs List */}
                        <div className="w-1/2 overflow-y-auto border-r border-gray-200 dark:border-slate-700 pr-4">
                            <div className="space-y-2">
                                {logs.map(log => (
                                    <div
                                        key={log.id}
                                        onClick={() => setSelectedLog(log)}
                                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedLog?.id === log.id
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                                : 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                {getStatusIcon(log)}
                                                <span className="font-medium text-sm text-gray-900 dark:text-white">
                                                    {log.event_type}
                                                </span>
                                            </div>
                                            {log.status_code && (
                                                <span className={`text-xs px-2 py-1 rounded ${log.status_code >= 200 && log.status_code < 300
                                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                    }`}>
                                                    {log.status_code}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Log Details */}
                        <div className="w-1/2 overflow-y-auto">
                            {selectedLog ? (
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                            Evento
                                        </h3>
                                        <p className="text-sm text-gray-900 dark:text-white">{selectedLog.event_type}</p>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                            Payload
                                        </h3>
                                        <pre className="text-xs bg-gray-100 dark:bg-slate-900 p-3 rounded overflow-x-auto">
                                            {JSON.stringify(selectedLog.payload, null, 2)}
                                        </pre>
                                    </div>

                                    {selectedLog.response && (
                                        <div>
                                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                Resposta
                                            </h3>
                                            <pre className="text-xs bg-gray-100 dark:bg-slate-900 p-3 rounded overflow-x-auto max-h-40">
                                                {selectedLog.response}
                                            </pre>
                                        </div>
                                    )}

                                    {selectedLog.error_message && (
                                        <div>
                                            <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">
                                                Erro
                                            </h3>
                                            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded">
                                                {selectedLog.error_message}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-500">
                                    Selecione um log para ver detalhes
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
                    <Button variant="outline" onClick={onClose}>Fechar</Button>
                </div>
            </div>
        </div>
    );
}
