import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Eye, EyeOff, Webhook as WebhookIcon, Shield, ListTodo, Code2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import type { Webhook, WebhookEvent } from '../../hooks/useWebhooks';
import { useNotification } from '../../context/NotificationContext';

interface WebhookFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    initialData?: Webhook | null;
}

const AVAILABLE_EVENTS: { value: WebhookEvent; label: string }[] = [
    { value: 'QUOTE_CREATED', label: 'Orçamento Criado' },
    { value: 'QUOTE_SENT', label: 'Orçamento Enviado' },
    { value: 'QUOTE_APPROVED', label: 'Orçamento Aprovado' },
    { value: 'QUOTE_REJECTED', label: 'Orçamento Rejeitado' },
    { value: 'TRANSACTION_CREATED', label: 'Transação Criada' },
    { value: 'TRANSACTION_PAID', label: 'Transação Paga/Recebida' },
    { value: 'CONTACT_CREATED', label: 'Contato Criado' },
    { value: 'COMMISSION_GENERATED', label: 'Comissão Gerada' },
];

export function WebhookForm({ isOpen, onClose, onSubmit, initialData }: WebhookFormProps) {
    const { notify } = useNotification();
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [method, setMethod] = useState<'POST' | 'GET' | 'PUT' | 'PATCH'>('POST');
    const [events, setEvents] = useState<WebhookEvent[]>([]);
    const [headersText, setHeadersText] = useState('');
    const [authUsername, setAuthUsername] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (initialData) {
            setName(initialData.name);
            setUrl(initialData.url);
            setMethod(initialData.method);
            setEvents(initialData.events);
            setHeadersText(initialData.headers ? JSON.stringify(initialData.headers, null, 2) : '');
            setAuthUsername(initialData.auth_username || '');
            setAuthPassword(initialData.auth_password || '');
        } else {
            setName('');
            setUrl('');
            setMethod('POST');
            setEvents([]);
            setHeadersText('');
            setAuthUsername('');
            setAuthPassword('');
        }
    }, [initialData, isOpen]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            let headers = {};
            if (headersText.trim()) {
                try {
                    headers = JSON.parse(headersText);
                } catch {
                    notify('error', 'Headers inválidos. Certifique-se de que o formato JSON está correto.', 'Erro no JSON');
                    setLoading(false);
                    return;
                }
            }

            await onSubmit({
                name,
                url,
                method,
                events,
                headers,
                auth_username: authUsername || null,
                auth_password: authPassword || null,
                is_active: true
            });
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const toggleEvent = (event: WebhookEvent) => {
        setEvents(prev =>
            prev.includes(event)
                ? prev.filter(e => e !== event)
                : [...prev, event]
        );
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={initialData ? 'Editar Webhook' : 'Novo Webhook'}
            subtitle={initialData ? 'Atualize as configurações de integração' : 'Crie uma nova ponte para enviar dados para outros sistemas'}
            icon={WebhookIcon}
            maxWidth="max-w-2xl"
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <Input
                            label="Nome do Webhook *"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                            placeholder="Ex: Integração n8n, Zapier..."
                        />
                    </div>

                    <div className="md:col-span-2">
                        <Input
                            label="URL de Destino *"
                            type="url"
                            value={url}
                            onChange={e => setUrl(e.target.value.toLowerCase())}
                            required
                            placeholder="https://seu-servidor.com/webhook"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Método HTTP</label>
                        <select
                            className="flex h-10 w-full rounded-lg border border-gray-300 bg-[var(--color-surface)] dark:bg-slate-700 px-3 py-2 text-sm text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-600"
                            value={method}
                            onChange={e => setMethod(e.target.value as any)}
                        >
                            <option value="POST">POST (Recomendado)</option>
                            <option value="GET">GET</option>
                            <option value="PUT">PUT</option>
                            <option value="PATCH">PATCH</option>
                        </select>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-700 space-y-4">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Shield className="w-4 h-4 text-emerald-600" /> Autenticação Básica (Opcional)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Usuário / Client ID"
                            value={authUsername}
                            onChange={e => setAuthUsername(e.target.value)}
                            placeholder="username"
                        />
                        <div className="relative">
                            <Input
                                label="Senha / Client Secret"
                                type={showPassword ? "text" : "password"}
                                value={authPassword}
                                onChange={e => setAuthPassword(e.target.value)}
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-[34px] text-gray-400 hover:text-emerald-500 transition-colors"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                    <p className="text-[10px] text-gray-500 font-medium leading-tight">
                        Seu destino de webhook (ex: n8n, Make) deve estar configurado para aceitar "Basic Auth" para usar estas credenciais.
                    </p>
                </div>

                <div className="space-y-3">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ListTodo className="w-4 h-4 text-emerald-600" /> Eventos do Webhook
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {AVAILABLE_EVENTS.map(event => (
                            <label
                                key={event.value}
                                className={`flex items-center gap-2 p-3 rounded-lg border transition-all cursor-pointer ${events.includes(event.value)
                                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10'
                                    : 'border-gray-200 dark:border-slate-700 hover:border-emerald-200 dark:hover:border-emerald-900/50 bg-white dark:bg-slate-700'
                                    }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={events.includes(event.value)}
                                    onChange={() => toggleEvent(event.value)}
                                    className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                                />
                                <span className={`text-sm ${events.includes(event.value)
                                    ? 'text-emerald-900 dark:text-emerald-400 font-bold'
                                    : 'text-gray-700 dark:text-gray-300'
                                    }`}>
                                    {event.label}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Code2 className="w-4 h-4 text-emerald-600" /> Headers Customizados (JSON)
                    </h3>
                    <textarea
                        value={headersText}
                        onChange={e => setHeadersText(e.target.value)}
                        placeholder={'{\n  "Authorization": "Bearer TOKEN_AQUI",\n  "X-Custom-ID": "123"\n}'}
                        className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono min-h-[100px]"
                        rows={4}
                    />
                    <p className="text-[10px] text-gray-500 font-medium">Use apenas se precisar de cabeçalhos específicos para a sua requisição.</p>
                </div>

                <div className="flex justify-end gap-3 mt-4">
                    <Button type="button" variant="outline" onClick={onClose} className="px-8">
                        Cancelar
                    </Button>
                    <Button type="submit" isLoading={loading} disabled={events.length === 0} className="bg-emerald-600 hover:bg-emerald-700 px-8">
                        Salvar Webhook
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
