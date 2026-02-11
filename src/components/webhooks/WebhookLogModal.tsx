import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Activity } from 'lucide-react';
import { Button } from '../ui/Button';
import type { WebhookLog } from '../../hooks/useWebhooks';
import { format } from 'date-fns';
import { Modal } from '../ui/Modal';

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
            return <XCircle className="text-red-500" size={18} />;
        }
        if (log.status_code && log.status_code >= 200 && log.status_code < 300) {
            return <CheckCircle className="text-emerald-500" size={18} />;
        }
        return <Clock className="text-amber-500" size={18} />;
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Logs - ${webhookName}`}
            icon={Activity}
            maxWidth="max-w-4xl"
        >
            <div className="flex flex-col h-[70vh]">
                {loading ? (
                    <div className="flex flex-col justify-center items-center flex-1 space-y-3">
                        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-gray-500 dark:text-gray-400 font-medium">Carregando logs...</p>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex flex-col justify-center items-center flex-1 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-slate-800">
                        <Activity className="text-gray-300 dark:text-gray-700 mb-2" size={48} />
                        <p className="text-gray-500 dark:text-gray-400">Nenhum log encontrado para este webhook</p>
                    </div>
                ) : (
                    <div className="flex gap-6 flex-1 overflow-hidden">
                        {/* Logs List */}
                        <div className="w-1/2 overflow-y-auto pr-2 custom-scrollbar">
                            <div className="space-y-2">
                                {logs.map(log => (
                                    <div
                                        key={log.id}
                                        onClick={() => setSelectedLog(log)}
                                        className={`p-4 rounded-xl border transition-all cursor-pointer ${selectedLog?.id === log.id
                                            ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-900/10 shadow-sm'
                                            : 'border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                {getStatusIcon(log)}
                                                <span className="font-semibold text-sm text-gray-900 dark:text-white">
                                                    {log.event_type}
                                                </span>
                                            </div>
                                            {log.status_code && (
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${log.status_code >= 200 && log.status_code < 300
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                    : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                                    }`}>
                                                    {log.status_code}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[10px] text-gray-500 font-medium">
                                            {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Log Details */}
                        <div className="w-1/2 overflow-y-auto bg-gray-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 custom-scrollbar">
                            {selectedLog ? (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
                                            Tipo de Evento
                                        </h3>
                                        <p className="text-sm font-semibold text-gray-900 dark:text-white bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                                            {selectedLog.event_type}
                                        </p>
                                    </div>

                                    <div>
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
                                            Payload de Envio
                                        </h3>
                                        <pre className="text-[11px] bg-slate-950 text-slate-300 p-4 rounded-xl overflow-x-auto border border-slate-800 shadow-inner">
                                            {JSON.stringify(selectedLog.payload, null, 2)}
                                        </pre>
                                    </div>

                                    {selectedLog.response && (
                                        <div>
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
                                                Resposta do Servidor
                                            </h3>
                                            <pre className="text-[11px] bg-slate-950 text-slate-300 p-4 rounded-xl overflow-x-auto border border-slate-800 shadow-inner max-h-40">
                                                {selectedLog.response}
                                            </pre>
                                        </div>
                                    )}

                                    {selectedLog.error_message && (
                                        <div className="p-4 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 rounded-xl">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-2">
                                                Mensagem de Erro
                                            </h3>
                                            <p className="text-sm text-rose-700 dark:text-rose-300 italic">
                                                {selectedLog.error_message}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-2">
                                    <Activity className="opacity-20" size={48} />
                                    <p className="text-sm italic">Selecione um log para ver detalhes</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-100 dark:border-slate-700">
                    <Button variant="outline" onClick={onClose} className="px-8">Fechar</Button>
                </div>
            </div>
        </Modal>
    );
}
