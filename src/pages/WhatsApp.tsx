import { useState, useEffect, useRef } from 'react';
import { Modal } from '../components/ui/Modal';
import {
    MessageSquare,
    MessageCircle,
    Plus,
    RefreshCw,
    Trash2,
    Smartphone,
    Link as LinkIcon,
    Copy,
    ChevronDown,
    ChevronUp,
    Settings2,
    Check,
    QrCode,
    Wand2,
    Activity,
    Pencil,
    Send,
    LogOut,
    Shield,
    AlertTriangle
} from 'lucide-react';
import { Tooltip } from '../components/ui/Tooltip';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { useEntity } from '../context/EntityContext';
import { supabase } from '../lib/supabase';
import { useNotification } from '../context/NotificationContext';
import { API_BASE_URL } from '../lib/constants';

interface Instance {
    id: string;
    instance_name: string;
    evolution_instance_id: string;
    status: 'connected' | 'connecting' | 'disconnected';
    webhook_url?: string;
    webhook_events?: string[];
    phone_number?: string;
    whatsapp_name?: string;
    created_at: string;
    provider?: string;
    is_active?: boolean;
}

export function WhatsApp() {
    const { user, session } = useAuth();
    const { currentEntity } = useEntity();
    const { notify } = useNotification();
    const [instances, setInstances] = useState<Instance[]>([]);
    const [loading, setLoading] = useState(true);
    const isMounted = useRef(true);

    useEffect(() => {
        return () => { isMounted.current = false; };
    }, []);
    const [isCreating, setIsCreating] = useState(false);
    const [friendlyName, setFriendlyName] = useState('');
    const [instanceId, setInstanceId] = useState('');
    const [waProfileName, setWaProfileName] = useState('');

    const generateEvoID = () => {
        const part = (len: number) => {
            let res = '';
            const hex = '0123456789ABCDEF';
            for (let i = 0; i < len; i++) res += hex.charAt(Math.floor(Math.random() * hex.length));
            return res;
        };
        return `${part(12)}-${part(4)}-${part(4)}-${part(12)}`;
    };

    const handleRandomizeName = () => {
        setInstanceId(generateEvoID());
    };
    const [showQRModal, setShowQRModal] = useState(false);
    const [currentInstance, setCurrentInstance] = useState<Instance | null>(null);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [proxyOnline, setProxyOnline] = useState<boolean | null>(null);
    const [isSyncingEvoGo, setIsSyncingEvoGo] = useState(false);

    // Edit State
    const [showEditModal, setShowEditModal] = useState(false);

    const [isUpdating, setIsUpdating] = useState(false);
    const [isTestingWebhook, setIsTestingWebhook] = useState(false);
    const [editingInstance, setEditingInstance] = useState<Instance | null>(null);

    // Duplicate Warning State
    const [showDuplicateModal, setShowDuplicateModal] = useState(false);
    const [duplicateInfo, setDuplicateInfo] = useState<{ name: string | null; techId: string | null }>({
        name: null,
        techId: null
    });

    // Webhook Settings State
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [evoWebhookUrl, setEvoWebhookUrl] = useState('');
    const [webhookEnabled, setWebhookEnabled] = useState(true);
    const [webhookBase64, setWebhookBase64] = useState(true);

    // EvoGo Advanced Settings State
    const [evoGoProfileName, setEvoGoProfileName] = useState('');
    const [evoGoAlwaysOnline, setEvoGoAlwaysOnline] = useState(false);
    const [evoGoRejectCall, setEvoGoRejectCall] = useState(false);
    const [evoGoMsgRejectCall, setEvoGoMsgRejectCall] = useState('');
    const [evoGoReadMessages, setEvoGoReadMessages] = useState(false);
    const [evoGoIgnoreGroups, setEvoGoIgnoreGroups] = useState(false);
    const [evoGoIgnoreStatus, setEvoGoIgnoreStatus] = useState(false);
    // EvoGo Transport
    const [evoGoRabbitMQ, setEvoGoRabbitMQ] = useState('default');
    const [evoGoWebSocket, setEvoGoWebSocket] = useState('default');
    const [evoGoNats, setEvoGoNats] = useState('default');

    const [selectedProvider, setSelectedProvider] = useState<'evolution_api' | 'evolution_go'>(
        currentEntity.settings?.whatsapp_provider === 'evolution_go' ? 'evolution_go' : 'evolution_api'
    );

    // Detect provider (check if company defaults to EvoGo or has any EvoGo instance in instances list)
    const isEvoGo = instances.some((i: any) => i.provider === 'evolution_go') || currentEntity.settings?.whatsapp_provider === 'evolution_go';

    // EvoGo Webhook events (lista completa)
    const EVO_GO_EVENTS = [
        'ALL', 'MESSAGE', 'READ_RECEIPT', 'PRESENCE', 'HISTORY_SYNC',
        'CHAT_PRESENCE', 'CALL', 'CONNECTION', 'QRCODE',
        'LABEL', 'CONTACT', 'GROUP', 'NEWSLETTER'
    ];

    const ALL_EVENTS = [
        'APPLICATION_STARTUP', 'CALL', 'CHATS_DELETE', 'CHATS_SET', 'CHATS_UPDATE',
        'CHATS_UPSERT', 'CONNECTION_UPDATE', 'CONTACTS_SET', 'CONTACTS_UPDATE',
        'CONTACTS_UPSERT', 'GROUP_PARTICIPANTS_UPDATE', 'GROUP_UPDATE', 'GROUPS_UPSERT',
        'LABELS_ASSOCIATION', 'LABELS_EDIT', 'LOGOUT_INSTANCE', 'MESSAGES_DELETE',
        'MESSAGES_SET', 'MESSAGES_UPDATE', 'MESSAGES_UPSERT', 'PRESENCE_UPDATE',
        'QRCODE_UPDATED', 'REMOVE_INSTANCE', 'SEND_MESSAGE', 'TYPEBOT_CHANGE_STATUS', 'TYPEBOT_START'
    ];

    const [selectedEvents, setSelectedEvents] = useState<string[]>(
        selectedProvider === 'evolution_go' ? ['MESSAGE'] : ['MESSAGES_UPSERT']
    );

    useEffect(() => {
        setSelectedEvents(selectedProvider === 'evolution_go' ? ['MESSAGE'] : ['MESSAGES_UPSERT']);
    }, [selectedProvider]);

    const isLimitReached = currentEntity.type === 'company' && instances.length >= (currentEntity.whatsapp_instance_limit || 1);


    const handleMarkAll = () => {
        if (selectedEvents.length === ALL_EVENTS.length) {
            setSelectedEvents(['MESSAGES_UPSERT']); // Reset to default if all selected
        } else {
            setSelectedEvents(ALL_EVENTS);
        }
    };

    const toggleEvent = (event: string) => {
        setSelectedEvents(prev =>
            prev.includes(event)
                ? prev.filter(e => e !== event)
                : [...prev, event]
        );
    };

    useEffect(() => {
        checkProxyStatus();
        fetchInstances();
    }, [currentEntity.id]);

    const checkProxyStatus = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/health`);
            setProxyOnline(response.ok);
        } catch (err) {
            setProxyOnline(false);
        }
    };

    const fetchInstances = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('instances')
                .select('*')
                .order('created_at', { ascending: false });

            // Filter by context
            if (currentEntity.type === 'company' && currentEntity.id) {
                query = query.eq('company_id', currentEntity.id);
            } else {
                query = query.eq('user_id', user?.id).is('company_id', null);
            }

            const { data, error } = await query;
            if (!isMounted.current) return;

            if (error) throw error;
            setInstances(data || []);

            // Sync status and details with Evolution for ALL instances
            if (data && data.length > 0) {
                const checkProxy = await fetch(`${API_BASE_URL}/health`).then(r => r.ok).catch(() => false);
                if (checkProxy && isMounted.current) {
                    data.forEach((inst: Instance) => syncInstanceWithEvolution(inst));
                }
                // Auto-sync EvoGo IDs after loading instances
                if (isEvoGo && isMounted.current) {
                    setTimeout(() => syncEvoGoIds(), 500);
                }
            }

        } catch (error) {
            if (isMounted.current) {
                console.error('Erro ao buscar instâncias:', error);
                notify('error', 'Falha ao carregar instâncias.', 'Erro de Conexão');
            }
        } finally {
            if (isMounted.current) setLoading(false);
        }
    };

    // Sincronizar IDs reais da EvoGo com o Supabase
    const syncEvoGoIds = async () => {
        if (!isEvoGo) return;
        setIsSyncingEvoGo(true);
        try {
            const companyParam = currentEntity.type === 'company' ? `company_id=${currentEntity.id}` : '';
            const syncRes = await fetch(`${API_BASE_URL}/instances/evogo-sync?${companyParam}`, {
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            });
            if (!syncRes.ok) throw new Error('Falha na sincronização');
            const syncData = await syncRes.json();
            const evoGoInstances: { id: string; name: string; token: string }[] = syncData.instances || [];

            if (evoGoInstances.length === 0) return;

            // Para cada instância no banco, verificar se o ID bate com o da EvoGo
            let updatedCount = 0;
            for (const localInst of instances) {
                // Buscar na EvoGo pelo nome da instância
                const evoInst = evoGoInstances.find(
                    e => e.name.toLowerCase() === localInst.instance_name.toLowerCase()
                );
                if (!evoInst) continue;

                // Se o ID local é diferente do token real da EvoGo, atualizar
                if (evoInst.token !== localInst.evolution_instance_id) {
                    console.log(`🔄 Sincronizando ${localInst.instance_name}: ${localInst.evolution_instance_id} → ${evoInst.token}`);
                    const { error } = await supabase
                        .from('instances')
                        .update({ evolution_instance_id: evoInst.token })
                        .eq('id', localInst.id);
                    if (!error) updatedCount++;
                }
            }

            if (updatedCount > 0) {
                notify('success', `${updatedCount} instância(s) sincronizada(s) com IDs reais da EvoGo.`, 'Sincronizado!');
                fetchInstances(); // Recarregar com IDs corretos
            } else {
                notify('success', 'IDs já estão sincronizados com a EvoGo.', 'Em dia!');
            }
        } catch (err: any) {
            console.error('Erro ao sincronizar EvoGo:', err);
            notify('error', err.message || 'Falha ao sincronizar com EvoGo.', 'Erro');
        } finally {
            setIsSyncingEvoGo(false);
        }
    };

    const syncInstanceWithEvolution = async (instance: Instance) => {
        try {
            const response = await fetch(`${API_BASE_URL}/instances/${encodeURIComponent(instance.instance_name)}/details?token=${instance.evolution_instance_id}&company_id=${currentEntity.type === 'company' ? currentEntity.id : ''}`);
            if (response.ok) {
                const data = await response.json().catch(() => null);
                if (!data) return;

                // Map Evolution status to our app status (Support v1 and v2)
                const evoStatus = data?.connectionStatus || data?.instance?.connectionStatus || data?.instance?.status || data?.status;

                let newStatus: 'connected' | 'connecting' | 'disconnected' = 'disconnected';
                if (evoStatus === 'open' || evoStatus === 'connected') newStatus = 'connected';
                else if (evoStatus === 'connecting') newStatus = 'connecting';


                // Fields to update
                const updates: any = {};
                if (instance.status !== newStatus) updates.status = newStatus;

                // Extract phone number (v2 uses ownerJid, v1 uses number)
                let rawNumber = data?.ownerJid || data?.instance?.ownerJid || data?.instance?.number || data?.number;
                if (rawNumber && typeof rawNumber === 'string') {
                    rawNumber = rawNumber.split('@')[0]; // Remove @s.whatsapp.net
                }

                if (rawNumber && rawNumber !== instance.phone_number) {
                    updates.phone_number = rawNumber;

                    // Check for duplicates in DB
                    const { data: duplicates } = await supabase
                        .from('instances')
                        .select('id, instance_name')
                        .eq('phone_number', rawNumber)
                        .neq('id', instance.id)
                        .limit(1);

                    if (duplicates && duplicates.length > 0) {
                        const other = duplicates[0];
                        notify('error', `O número ${rawNumber} já está em uso na instância "${other.instance_name}".`, 'Número Duplicado');
                        handleDisconnect(instance, true);
                        return;
                    }
                }

                // Sync WhatsApp Profile Name
                const profileName = data?.profileName || data?.instance?.profileName || data?.name || data?.instance?.name;

                // Allow update if we have a real name that is different from our local DB
                if (profileName && typeof profileName === 'string' && profileName !== instance.whatsapp_name) {
                    updates.whatsapp_name = profileName;
                }

                if (Object.keys(updates).length > 0 && isMounted.current) {

                    // Update Local State
                    setInstances(prev => prev.map(i => i.id === instance.id ? { ...i, ...updates } : i));

                    // Update Supabase
                    await supabase.from('instances').update(updates).eq('id', instance.id);
                }
            }
        } catch (error) {
            if (isMounted.current) {
                console.error('Error syncing instance:', instance.instance_name, error);
            }
        }
    };

    const handleCreateInstance = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = friendlyName.trim();
        if (!trimmedName) return;

        // Check if there is already an instance with the same friendly name
        const duplicateByName = instances.find(
            i => i.instance_name.toLowerCase() === trimmedName.toLowerCase()
        );

        // Check if there is already an instance with the same Technical ID (if specified)
        const duplicateByTechId = instanceId.trim()
            ? instances.find(i => i.evolution_instance_id.toLowerCase() === instanceId.trim().toLowerCase())
            : null;

        if (duplicateByName || duplicateByTechId) {
            setDuplicateInfo({
                name: duplicateByName ? duplicateByName.instance_name : null,
                techId: duplicateByTechId ? duplicateByTechId.evolution_instance_id : null
            });
            setShowDuplicateModal(true);
            return;
        }

        setIsCreating(true);
        try {
            // 1. Criar na Evolution API via Proxy Server
            const requestBody: any = {
                name: friendlyName,
                token: instanceId,
                company_id: currentEntity.type === 'company' ? currentEntity.id : undefined,
                provider: selectedProvider
            };

            if (selectedProvider === 'evolution_go') {
                // EvoGo payload: advancedSettings embutido + webhook via URL
                requestBody.webhook_url = evoWebhookUrl || undefined;
                requestBody.webhook_events = selectedEvents && selectedEvents.length > 0 ? selectedEvents : undefined;
                requestBody.profile_name = evoGoProfileName || undefined;
                requestBody.transport = {
                    rabbitMQ: evoGoRabbitMQ !== 'default' ? evoGoRabbitMQ : undefined,
                    webSocket: evoGoWebSocket !== 'default' ? evoGoWebSocket : undefined,
                    nats: evoGoNats !== 'default' ? evoGoNats : undefined
                };
                requestBody.advancedSettings = {
                    alwaysOnline: evoGoAlwaysOnline,
                    rejectCall: evoGoRejectCall,
                    msgRejectCall: evoGoMsgRejectCall || undefined,
                    readMessages: evoGoReadMessages,
                    ignoreGroups: evoGoIgnoreGroups,
                    ignoreStatus: evoGoIgnoreStatus
                };
            } else {
                // EvoAPI payload
                requestBody.webhook_url = evoWebhookUrl || undefined;
                requestBody.webhook_events = selectedEvents && selectedEvents.length > 0 ? selectedEvents : undefined;
                requestBody.enabled = webhookEnabled;
                requestBody.base64 = webhookBase64;
            }

            const response = await fetch(`${API_BASE_URL}/instances`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(async () => {
                    const text = await response.text();
                    return { error: 'Resposta inválida do servidor', detail: text.substring(0, 100) };
                });
                const detail = errorData.detail ? `: ${errorData.detail}` : '';
                throw new Error((errorData.error || 'Erro no servidor proxy') + detail);
            }

            const data = await response.json().catch(() => ({}));
            // Para EvoGo: a API pode ignorar o token enviado e gerar o seu próprio.
            // Sempre priorizar o ID retornado pela API.
            // Para EvoAPI: usa o token retornado, com fallback para o instanceId local.
            const technicalId = data.instance?.token || data.hash?.apikey || instanceId;

            // 2. Salvar metadados no Supabase
            const { data: dbData, error } = await supabase
                .from('instances')
                .insert([{
                    instance_name: friendlyName,
                    evolution_instance_id: technicalId,
                    user_id: user?.id,
                    company_id: currentEntity.type === 'company' ? currentEntity.id : null,
                    webhook_url: evoWebhookUrl || null,
                    webhook_events: selectedEvents && selectedEvents.length > 0 ? selectedEvents : null,
                    status: 'disconnected',
                    provider: selectedProvider,
                    is_active: true
                }])
                .select()
                .single();

            if (error) throw error;

            notify('success', 'Instância criada com sucesso!', 'Tudo Pronto');
            setInstances([dbData, ...instances]);
            setFriendlyName('');
            setInstanceId('');
            // Reset EvoGo settings
            setEvoGoProfileName('');
            setEvoGoAlwaysOnline(false);
            setEvoGoRejectCall(false);
            setEvoGoMsgRejectCall('');
            setEvoGoReadMessages(false);
            setEvoGoIgnoreGroups(false);
            setEvoGoIgnoreStatus(false);
            setEvoGoRabbitMQ('default');
            setEvoGoWebSocket('default');
            setEvoGoNats('default');
            setSelectedEvents(isEvoGo ? ['MESSAGE'] : ['MESSAGES_UPSERT']);
        } catch (error: any) {
            console.error('Erro ao conectar com Evolution:', error);
            notify('error', error.message || 'Não foi possível criar a instância.', 'Erro');
        } finally {
            setIsCreating(false);
        }
    };

    const handleTestWebhook = async () => {
        if (!evoWebhookUrl) {
            notify('error', 'Preencha a URL do webhook para testar.', 'Dados Faltando');
            return;
        }

        setIsTestingWebhook(true);
        try {
            const response = await fetch(`${API_BASE_URL}/webhook/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    webhook_url: evoWebhookUrl,
                    instance: editingInstance,
                    event_type: 'TEST_MANUAL_TRIGGER'
                })
            });

            const data = await response.json().catch(() => ({ error: 'Falha ao processar resposta do servidor' }));

            if (!response.ok) {
                throw new Error(data.error || data.message || 'Falha ao testar webhook');
            }

            notify('success', 'Webhook de teste disparado com sucesso!', 'Teste Confirmado');
        } catch (error: any) {
            console.error('Erro no teste de webhook:', error);
            notify('error', error.message || 'Falha ao testar webhook.', 'Erro no Teste');
        } finally {
            setIsTestingWebhook(false);
        }
    };



    const handleDisconnect = async (instance: Instance, silent = false) => {
        if (!silent && !confirm(`Deseja desconectar a instância "${instance.instance_name}"?`)) return;

        try {
            console.log(`🔌 Desconectando instância ${instance.instance_name} (ID Técnico: ${instance.evolution_instance_id})...`);
            const response = await fetch(`${API_BASE_URL}/instances/${encodeURIComponent(instance.instance_name)}/logout?token=${instance.evolution_instance_id}&company_id=${currentEntity.type === 'company' ? currentEntity.id : ''}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`
                }
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                console.warn('⚠️ Falha ao desconectar na Evolution:', data);
                if (!silent) throw new Error(data.error || 'Falha ao desconectar');
            }

            if (!silent) notify('success', 'Instância desconectada com sucesso!', 'Sucesso');
            fetchInstances();
        } catch (error: any) {
            console.error('Erro ao desconectar:', error);
            if (!silent) notify('error', error.message || 'Erro ao desconectar instância.', 'Erro');
        }
    };


    const handleDeleteInstance = async (instance: Instance) => {
        if (!confirm(`Tem certeza que deseja excluir a instância "${instance.instance_name}"?`)) return;

        try {
            // 1. Tentar deletar na Evolution via Proxy usando o nome amigável + token
            const response = await fetch(`${API_BASE_URL}/instances/${encodeURIComponent(instance.instance_name)}?token=${instance.evolution_instance_id}&company_id=${currentEntity.type === 'company' ? currentEntity.id : ''}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Falha ao excluir a instância na Evolution API.');
            }

            // 2. Deletar no Supabase
            const { error } = await supabase
                .from('instances')
                .delete()
                .eq('id', instance.id);

            if (error) throw error;

            setInstances(instances.filter(i => i.id !== instance.id));
            notify('success', 'Instância removida com sucesso.', 'Instância Deletada');
        } catch (error: any) {
            console.error('Erro ao deletar:', error);
            notify('error', error.message || 'Erro ao deletar instância.', 'Erro de Exclusão');
        }
    };

    const handleTestConnection = async (instance: Instance) => {
        try {
            notify('info', 'Testando conexão com a Evolution API...', 'Aguarde');
            const response = await fetch(`${API_BASE_URL}/instances/${encodeURIComponent(instance.instance_name)}/details?token=${instance.evolution_instance_id}&company_id=${currentEntity.type === 'company' ? currentEntity.id : ''}`);

            if (response.ok) {
                const data = await response.json().catch(() => ({}));
                const evoStatus = data?.connectionStatus || data?.instance?.connectionStatus || data?.instance?.status || data?.status;

                if (evoStatus === 'open' || evoStatus === 'connected') {
                    notify('success', `A instância "${instance.instance_name}" está conectada e respondendo!`, 'Conexão OK');
                } else {
                    notify('warning', `A instância "${instance.instance_name}" respondeu, mas o status é: ${evoStatus || 'desconhecido'}.`, 'Atenção');
                }
                syncInstanceWithEvolution(instance);
            } else {
                throw new Error('A API não respondeu para esta instância.');
            }
        } catch (error: any) {
            console.error('Erro no teste de conexão:', error);
            notify('error', 'Falha ao validar conexão. Verifique se o servidor Proxy está online.', 'Erro de Conexão');
        }
    };

    const handleEditInstance = async (instance: Instance) => {
        setEditingInstance(instance);
        setFriendlyName(instance.instance_name);
        setWaProfileName(instance.whatsapp_name || '');
        setEvoWebhookUrl(instance.webhook_url || '');

        if (isEvoGo) {
            // Resetar estados antes do fetch
            setEvoGoAlwaysOnline(false);
            setEvoGoRejectCall(false);
            setEvoGoMsgRejectCall('');
            setEvoGoReadMessages(false);
            setEvoGoIgnoreGroups(false);
            setEvoGoIgnoreStatus(false);
            setEvoGoRabbitMQ('default');
            setEvoGoWebSocket('default');
            setEvoGoNats('default');
            setSelectedEvents(instance.webhook_events || ['MESSAGE']);
            setShowEditModal(true);

            try {
                const res = await fetch(`${API_BASE_URL}/instances/${encodeURIComponent(instance.instance_name)}/advanced-settings?token=${instance.evolution_instance_id}&company_id=${currentEntity.type === 'company' ? currentEntity.id : ''}`, {
                    headers: { 'Authorization': `Bearer ${session?.access_token}` }
                });
                if (res.ok) {
                    const data = await res.json().catch(() => ({}));
                    const settings = data?.advancedSettings || data || {};
                    setEvoGoAlwaysOnline(!!settings.alwaysOnline);
                    setEvoGoRejectCall(!!settings.rejectCall);
                    setEvoGoMsgRejectCall(settings.msgRejectCall || '');
                    setEvoGoReadMessages(!!settings.readMessages);
                    setEvoGoIgnoreGroups(!!settings.ignoreGroups);
                    setEvoGoIgnoreStatus(!!settings.ignoreStatus);
                }
            } catch (err) {
                console.error('Erro ao buscar configurações avançadas da EvoGo:', err);
            }
        } else {
            setSelectedEvents(instance.webhook_events || ['MESSAGES_UPSERT']);
            setWebhookEnabled(true);
            setWebhookBase64(true);
            setShowEditModal(true);
        }
    };

    const handleUpdateInstance = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingInstance || !friendlyName.trim()) return;

        setIsUpdating(true);
        try {
            // 1. Se o nome mudou, atualizar na Evolution primeiro
            if (friendlyName !== editingInstance.instance_name) {
                console.log(`🔄 Alterando nome da instância de "${editingInstance.instance_name}" para "${friendlyName}"...`);
                const renameRes = await fetch(`${API_BASE_URL}/instances/${encodeURIComponent(editingInstance.instance_name)}/rename?token=${editingInstance.evolution_instance_id}&company_id=${currentEntity.type === 'company' ? currentEntity.id : ''}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session?.access_token}`
                    },
                    body: JSON.stringify({ newName: friendlyName })
                });

                if (!renameRes.ok) {
                    const errData = await renameRes.json().catch(() => ({}));
                    console.warn('⚠️ Não foi possível renomear na Evolution:', errData);
                }
            }

            // 1.1 Se o nome do perfil mudou, atualizar na Evolution
            if (waProfileName && waProfileName !== editingInstance.whatsapp_name) {
                console.log(`👤 Alterando nome do perfil de "${editingInstance.whatsapp_name}" para "${waProfileName}"...`);
                const profileRes = await fetch(`${API_BASE_URL}/instances/${encodeURIComponent(editingInstance.instance_name)}/profile-name?token=${editingInstance.evolution_instance_id}&company_id=${currentEntity.type === 'company' ? currentEntity.id : ''}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session?.access_token}`
                    },
                    body: JSON.stringify({ profileName: waProfileName })
                });

                if (!profileRes.ok) {
                    const errData = await profileRes.json().catch(() => ({}));
                    console.warn('⚠️ Erro ao atualizar perfil na Evolution:', errData);
                    notify('warning', 'O nome foi salvo no sistema, mas a Evolution API não conseguiu atualizar o perfil no WhatsApp (verifique se a instância está conectada).', 'Aviso de Sincronização');
                }
            }

            // 1.2 Se for EvoGo, atualizar configurações avançadas na API
            if (isEvoGo) {
                console.log(`⚙️ Atualizando configurações avançadas da EvoGo...`);
                const settingsRes = await fetch(`${API_BASE_URL}/instances/${encodeURIComponent(editingInstance.instance_name)}/advanced-settings?token=${editingInstance.evolution_instance_id}&company_id=${currentEntity.type === 'company' ? currentEntity.id : ''}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session?.access_token}`
                    },
                    body: JSON.stringify({
                        alwaysOnline: evoGoAlwaysOnline,
                        rejectCall: evoGoRejectCall,
                        msgRejectCall: evoGoMsgRejectCall || undefined,
                        readMessages: evoGoReadMessages,
                        ignoreGroups: evoGoIgnoreGroups,
                        ignoreStatus: evoGoIgnoreStatus
                    })
                });

                if (!settingsRes.ok) {
                    const errData = await settingsRes.json().catch(() => ({}));
                    console.warn('⚠️ Erro ao atualizar configurações avançadas na EvoGo:', errData);
                }
            }

            // 2. Atualizar Webhook na Evolution API via Proxy
            const response = await fetch(`${API_BASE_URL}/instances/${encodeURIComponent(editingInstance.instance_name)}/webhook`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    url: evoWebhookUrl,
                    events: selectedEvents,
                    enabled: webhookEnabled,
                    base64: webhookBase64,
                    token: editingInstance.evolution_instance_id,
                    company_id: currentEntity.type === 'company' ? currentEntity.id : undefined,
                    transport: isEvoGo ? {
                        rabbitMQ: evoGoRabbitMQ,
                        webSocket: evoGoWebSocket,
                        nats: evoGoNats
                    } : undefined
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(async () => {
                    const text = await response.text();
                    return { error: 'Resposta inválida do servidor', detail: text.substring(0, 100) };
                });
                const detail = errorData.detail ? `: ${errorData.detail}` : '';
                throw new Error((errorData.error || 'Erro ao sincronizar com Evolution') + detail);
            }

            // 3. Atualizar no Supabase
            const { error } = await supabase
                .from('instances')
                .update({
                    instance_name: friendlyName,
                    whatsapp_name: waProfileName,
                    webhook_url: evoWebhookUrl,
                    webhook_events: selectedEvents
                })
                .eq('id', editingInstance.id);

            if (error) throw error;

            notify('success', 'Instância atualizada com sucesso!', 'Atualizado');
            setInstances(instances.map(i => i.id === editingInstance.id ? {
                ...i,
                instance_name: friendlyName,
                whatsapp_name: waProfileName,
                webhook_url: evoWebhookUrl,
                webhook_events: selectedEvents
            } : i));
            setShowEditModal(false);
            setFriendlyName('');
            setEvoWebhookUrl('');
        } catch (error: any) {
            console.error('Erro ao atualizar:', error);
            notify('error', error.message || 'Erro ao atualizar configurações.', 'Erro de Atualização');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleConnect = async (instance: Instance) => {
        setCurrentInstance(instance);
        setShowQRModal(true);
        setQrCode(null);

        try {
            // Buscar QR Code via Proxy usando o nome amigável
            const response = await fetch(`${API_BASE_URL}/instances/${encodeURIComponent(instance.instance_name)}/connect?token=${instance.evolution_instance_id}&company_id=${currentEntity.type === 'company' ? currentEntity.id : ''}`);

            const data = await response.json().catch(async () => {
                // Se falhar o parse do JSON, pode ser um HTML (404/500 do servidor)
                const text = await response.text();
                return { error: 'Resposta inválida do servidor', detail: text.substring(0, 100) };
            });

            if (!response.ok) {
                throw new Error(data.error || data.message || 'Falha ao obter QR Code');
            }

            // A Evolution retorna base64 ou link dependendo da config
            if (data.base64) {
                setQrCode(data.base64);
            } else if (data.qrcode) {
                setQrCode(data.qrcode.base64);
            }
        } catch (error: any) {
            console.error('Erro ao conectar:', error);
            notify('error', error.message || 'Não foi possível gerar o código QR agora.', 'Erro de Conexão');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-sm">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                            <MessageCircle size={24} className="text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Instâncias WhatsApp
                        </h1>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 ml-11">
                        Conecte e monitore suas contas via Evolution API.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${proxyOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        <div className={`w-2 h-2 rounded-full ${proxyOnline ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
                        Proxy: {proxyOnline ? 'Conectado' : 'Offline (Porta 3001)'}
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
                        Limite: {currentEntity.whatsapp_instance_limit || 1} { (currentEntity.whatsapp_instance_limit || 1) === 1 ? 'instância' : 'instâncias' }
                    </div>
                    {isEvoGo && (
                        <Button
                            variant="outline"
                            onClick={syncEvoGoIds}
                            isLoading={isSyncingEvoGo}
                            className="h-12 px-6 rounded-2xl font-bold text-sm transition-all hover:scale-105 active:scale-95 flex items-center border-amber-300 text-amber-700 dark:border-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                        >
                            <RefreshCw size={18} className="mr-2" />
                            Sincronizar IDs EvoGo
                        </Button>
                    )}
                    <Button 
                        variant="outline" 
                        onClick={() => { fetchInstances(); checkProxyStatus(); }} 
                        isLoading={loading}
                        className="h-12 px-6 rounded-2xl font-bold text-sm transition-all hover:scale-105 active:scale-95 flex items-center"
                    >
                        <RefreshCw size={18} className="mr-2" />
                        Atualizar
                    </Button>
                </div>
            </div>



            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                <form onSubmit={handleCreateInstance} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-3">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Provedor WhatsApp
                        </label>
                        <select
                            value={selectedProvider}
                            onChange={(e) => setSelectedProvider(e.target.value as any)}
                            className="w-full rounded-lg border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 py-2.5 px-4 focus:ring-2 focus:ring-emerald-500 font-semibold text-sm h-[45px] text-gray-700 dark:text-white"
                        >
                            <option value="evolution_api">Evolution API (Padrão)</option>
                            <option value="evolution_go">Evolution GO (Alta Performance)</option>
                        </select>
                    </div>
                    <div className="md:col-span-3">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Nome Amigável
                        </label>
                        <input
                            type="text"
                            value={friendlyName}
                            onChange={(e) => setFriendlyName(e.target.value)}
                            placeholder="Ex: WhatsApp Principal"
                            className="w-full rounded-lg border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 py-2.5 px-4 focus:ring-2 focus:ring-emerald-500"
                            required
                        />
                    </div>
                    <div className="md:col-span-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            ID da Instância (Técnico)
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={instanceId}
                                onChange={(e) => setInstanceId(e.target.value)}
                                placeholder="Clique na varinha para gerar ID aleatório"
                                className="w-full rounded-lg border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 py-2.5 px-4 pr-12 focus:ring-2 focus:ring-emerald-500 font-mono text-xs"
                                required
                            />
                            <Tooltip content="Gerar ID Aleatório">
                                <button
                                    type="button"
                                    onClick={handleRandomizeName}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-md transition-colors"
                                >
                                    <Wand2 size={18} />
                                </button>
                            </Tooltip>
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <Button
                            type="submit"
                            isLoading={isCreating}
                            disabled={isLimitReached}
                            className={`${isLimitReached ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'} text-white w-full px-4 h-[45px]`}
                        >
                            <Plus size={18} className="mr-2" />
                            Criar
                        </Button>
                    </div>

                    {isLimitReached && (
                        <div className="md:col-span-12 mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400 text-xs">
                            <Shield size={14} />
                            Limite de {currentEntity.whatsapp_instance_limit} instância(s) atingido para esta empresa. Contate o suporte para aumentar.
                        </div>
                    )}

                    {/* Advanced Settings Toggle */}
                    <div className="md:col-span-12 mt-2">
                        <button
                            type="button"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-emerald-600 transition-colors"
                        >
                            <Settings2 size={16} />
                            {isEvoGo ? 'Configurações Avançadas (EvoGo)' : 'Configurações Avançadas de Webhook (n8n/Evolution)'}
                            {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                    </div>

                    {/* Advanced Settings Panel */}
                    {showAdvanced && (
                        <div className="md:col-span-12 mt-4 p-4 bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-gray-100 dark:border-slate-700 animate-in fade-in slide-in-from-top-2">
                            {isEvoGo ? (
                                /* ===== EVO GO ADVANCED SETTINGS ===== */
                                <div className="space-y-5">
                                    {/* Webhook URL */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            URL do Webhook
                                        </label>
                                        <input
                                            type="url"
                                            value={evoWebhookUrl}
                                            onChange={(e) => setEvoWebhookUrl(e.target.value)}
                                            placeholder="https://seu-servidor.com/webhook"
                                            className="w-full rounded-lg border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 py-2.5 px-4 focus:ring-2 focus:ring-emerald-500 text-sm"
                                        />
                                        <p className="mt-1 text-[11px] text-gray-400">URL que receberá os eventos do WhatsApp</p>
                                    </div>

                                    {/* EvoGo Events */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Eventos para Webhook</label>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedEvents(
                                                    selectedEvents.length === EVO_GO_EVENTS.length
                                                        ? []
                                                        : [...EVO_GO_EVENTS]
                                                )}
                                                className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-wider"
                                            >
                                                {selectedEvents.length === EVO_GO_EVENTS.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2 bg-white dark:bg-slate-800 rounded-lg border border-gray-100 dark:border-slate-700">
                                            {EVO_GO_EVENTS.map(event => (
                                                <label
                                                    key={event}
                                                    className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                                                        event === 'ALL'
                                                            ? (selectedEvents.includes('ALL') ? 'bg-indigo-50 dark:bg-indigo-900/20 col-span-2 sm:col-span-4 border border-indigo-200 dark:border-indigo-700' : 'col-span-2 sm:col-span-4 hover:bg-gray-50 dark:hover:bg-slate-700')
                                                            : (selectedEvents.includes(event) ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-gray-50 dark:hover:bg-slate-700')
                                                    }`}
                                                    onClick={() => {
                                                        if (event === 'ALL') {
                                                            setSelectedEvents(selectedEvents.includes('ALL') ? [] : [...EVO_GO_EVENTS]);
                                                        } else {
                                                            toggleEvent(event);
                                                        }
                                                    }}
                                                >
                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                                                        event === 'ALL'
                                                            ? (selectedEvents.includes('ALL') ? 'bg-indigo-500 border-indigo-500' : 'bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-500')
                                                            : (selectedEvents.includes(event) ? 'bg-emerald-500 border-emerald-500' : 'bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-500')
                                                    }`}>
                                                        {(selectedEvents.includes(event)) && <Check size={10} className="text-white" strokeWidth={4} />}
                                                    </div>
                                                    <span className={`text-[11px] font-medium ${event === 'ALL' ? 'text-indigo-700 dark:text-indigo-400 font-bold' : 'text-gray-600 dark:text-gray-400'}`}>
                                                        {event}{event === 'ALL' ? ' (Todos)' : ''}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* EvoGo Advanced Config - checkbox list style */}
                                    <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
                                        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">Configurações Avançadas</h3>
                                        <div className="divide-y divide-gray-100 dark:divide-slate-700 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800">
                                            {[
                                                { label: 'Always Online', sub: 'Manter sempre online no WhatsApp', val: evoGoAlwaysOnline, set: setEvoGoAlwaysOnline },
                                                { label: 'Reject Call', sub: 'Rejeitar chamadas automaticamente', val: evoGoRejectCall, set: setEvoGoRejectCall },
                                                { label: 'Read Messages', sub: 'Marcar mensagens como lidas', val: evoGoReadMessages, set: setEvoGoReadMessages },
                                                { label: 'Ignore Groups', sub: 'Ignorar mensagens de grupos', val: evoGoIgnoreGroups, set: setEvoGoIgnoreGroups },
                                                { label: 'Ignore Status', sub: 'Ignorar atualizações de status', val: evoGoIgnoreStatus, set: setEvoGoIgnoreStatus },
                                            ].map(({ label, sub, val, set }) => (
                                                <div
                                                    key={label}
                                                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                                                    onClick={() => set(!val)}
                                                >
                                                    <div>
                                                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{label}</p>
                                                        <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                                                    </div>
                                                    {/* Checkbox estilo imagem */}
                                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ml-6 ${
                                                        val
                                                            ? 'bg-emerald-500 border-emerald-500'
                                                            : 'border-gray-300 dark:border-slate-500 bg-white dark:bg-slate-700'
                                                    }`}>
                                                        {val && <Check size={12} className="text-white" strokeWidth={3} />}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {/* Msg Reject Call */}
                                        {evoGoRejectCall && (
                                            <div className="mt-3">
                                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Mensagem ao rejeitar chamada</label>
                                                <input
                                                    type="text"
                                                    value={evoGoMsgRejectCall}
                                                    onChange={(e) => setEvoGoMsgRejectCall(e.target.value)}
                                                    placeholder="Ex: No momento não posso atender. Envie uma mensagem!"
                                                    className="w-full rounded-lg border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 py-2 px-3 focus:ring-2 focus:ring-emerald-500 text-sm"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* RabbitMQ / WebSocket / NATS */}
                                    <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
                                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Transporte de Eventos</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            {[
                                                { label: 'RabbitMQ', val: evoGoRabbitMQ, set: setEvoGoRabbitMQ },
                                                { label: 'WebSocket', val: evoGoWebSocket, set: setEvoGoWebSocket },
                                                { label: 'NATS', val: evoGoNats, set: setEvoGoNats },
                                            ].map(({ label, val, set }) => (
                                                <div key={label}>
                                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
                                                    <select
                                                        value={val}
                                                        onChange={(e) => set(e.target.value)}
                                                        className="w-full rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 py-2 px-3 text-sm text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                                                    >
                                                        <option value="default">Padrão</option>
                                                        <option value="enabled">Habilitado</option>
                                                        <option value="disabled">Desabilitado</option>
                                                    </select>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Botão Salvar Avançadas */}
                                    <div className="flex justify-end mt-6 pt-4 border-t border-gray-150 dark:border-slate-700">
                                        <Button
                                            type="submit"
                                            isLoading={isCreating}
                                            disabled={isLimitReached}
                                            className={`${isLimitReached ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'} text-white px-6 h-10 text-sm font-bold flex items-center gap-2 rounded-xl transition-all`}
                                        >
                                            <Check size={16} strokeWidth={3} />
                                            Salvar Avançadas
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                /* ===== EVO API ADVANCED SETTINGS ===== */
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            URL do Webhook Evolution
                                        </label>
                                        <input
                                            type="url"
                                            value={evoWebhookUrl}
                                            onChange={(e) => setEvoWebhookUrl(e.target.value)}
                                            placeholder="https://seu-n8n.com/webhook/whatsapp"
                                            className="w-full rounded-lg border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 py-2.5 px-4 focus:ring-2 focus:ring-emerald-500 text-sm"
                                        />
                                        <p className="mt-2 text-[11px] text-gray-400">
                                            A URL onde a Evolution API enviará os eventos em tempo real.
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Eventos Monitorados
                                            </label>
                                            <button
                                                type="button"
                                                onClick={handleMarkAll}
                                                className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-wider"
                                            >
                                                {selectedEvents.length === ALL_EVENTS.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 overflow-y-auto max-h-[150px] p-2 bg-white dark:bg-slate-800 rounded-lg border border-gray-100 dark:border-slate-700">
                                            {ALL_EVENTS.map(event => (
                                                <label
                                                    key={event}
                                                    className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors ${selectedEvents.includes(event) ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                                                >
                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedEvents.includes(event) ? 'bg-emerald-500 border-emerald-500' : 'bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-500'}`}>
                                                        {selectedEvents.includes(event) && <Check size={10} className="text-white" strokeWidth={4} />}
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        className="hidden"
                                                        checked={selectedEvents.includes(event)}
                                                        onChange={() => toggleEvent(event)}
                                                    />
                                                    <span className="text-[10px] font-medium truncate text-gray-600 dark:text-gray-400">
                                                        {event}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                        <div className="flex flex-col sm:flex-row gap-4">
                                            <div
                                                className="flex items-center gap-2 cursor-pointer"
                                                onClick={() => setWebhookEnabled(!webhookEnabled)}
                                            >
                                                <div className={`w-8 h-4 rounded-full relative transition-colors ${webhookEnabled ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                                                    <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${webhookEnabled ? 'right-0.5' : 'left-0.5'}`} />
                                                </div>
                                                <span className="text-[11px] text-gray-500">Enable or disable the webhook</span>
                                            </div>
                                            <div
                                                className="flex items-center gap-2 cursor-pointer"
                                                onClick={() => setWebhookBase64(!webhookBase64)}
                                            >
                                                <div className={`w-8 h-4 rounded-full relative transition-colors ${webhookBase64 ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                                                    <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${webhookBase64 ? 'right-0.5' : 'left-0.5'}`} />
                                                </div>
                                                <span className="text-[11px] text-gray-500">Send media base64 data in webhook</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </form>
            </div>

            {/* Lista de Instâncias */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {instances.length === 0 && !loading ? (
                    <div className="col-span-full py-12 text-center bg-gray-50 dark:bg-slate-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-700">
                        <MessageSquare size={48} className="mx-auto mb-4 text-gray-300" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Nenhuma instância encontrada</h3>
                        <p className="text-gray-500">Comece criando sua primeira instância acima.</p>
                    </div>
                ) : (
                    instances.map((instance: Instance) => (
                        <div key={instance.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-md border border-gray-100 dark:border-slate-700 group">
                            <div className="p-5">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-2 truncate">
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                                            {instance.instance_name}
                                        </h3>
                                        <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider flex-shrink-0 ${instance.provider === 'evolution_go' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'}`}>
                                            {instance.provider === 'evolution_go' ? 'Evo GO' : 'Evo API'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Tooltip content="Sincronizar Agora">
                                            <button
                                                onClick={async () => {
                                                    notify('info', 'Sincronizando...', 'Aguarde');
                                                    await syncInstanceWithEvolution(instance);
                                                    fetchInstances();
                                                }}
                                                className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                                            >
                                                <RefreshCw size={18} />
                                            </button>
                                        </Tooltip>
                                        <Tooltip content="Editar Configurações">
                                            <button
                                                onClick={() => handleEditInstance(instance)}
                                                className="p-1.5 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-md transition-colors"
                                            >
                                                <Pencil size={18} />
                                            </button>
                                        </Tooltip>
                                        <StatusBadge status={instance.status} />
                                    </div>
                                </div>

                                <div className="space-y-3 text-sm text-gray-500 dark:text-gray-400 mb-6">
                                    <div className="bg-gray-50 dark:bg-slate-900/50 p-2 rounded-lg border border-gray-100 dark:border-slate-700">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">ID Técnico</span>
                                            <Tooltip content="Copiar ID">
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(instance.evolution_instance_id);
                                                        notify('success', 'ID copiado para a área de transferência!', 'Copiado');
                                                    }}
                                                    className="hover:text-emerald-500 transition-colors"
                                                >
                                                    <Copy size={12} />
                                                </button>
                                            </Tooltip>
                                        </div>
                                        <code className="text-[13px] font-bold font-mono break-all text-emerald-600 dark:text-emerald-400">
                                            {instance.evolution_instance_id}
                                        </code>
                                    </div>
                                    <div className={`space-y-2 p-3 rounded-xl border ${instance.status === 'connected' ? 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/50'}`}>
                                        <div className="flex items-center gap-2">
                                            <Smartphone size={14} className={instance.status === 'connected' ? 'text-emerald-500' : 'text-amber-500'} />
                                            {instance.status === 'connected' ? (
                                                <span className="text-sm font-bold tracking-wide text-slate-700 dark:text-slate-200">
                                                    {instance.phone_number || 'Número Pendente'}
                                                </span>
                                            ) : (
                                                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                                                    Não conectado - Ler QR Code
                                                </span>
                                            )}
                                        </div>

                                        {instance.status === 'connected' && instance.whatsapp_name && (
                                            <div className="flex items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                                                <MessageSquare size={14} className="text-blue-500" />
                                                <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                                    <span className="font-medium mr-1">No WhatsApp:</span>
                                                    {instance.whatsapp_name}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 px-1">
                                        <LinkIcon size={14} className="text-gray-400" />
                                        <span className="text-xs truncate">Webhooks habilitados</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-900/30 rounded-xl border border-gray-100 dark:border-slate-800 mb-4">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Disparos Ativos</span>
                                        <span className="text-[10px] text-gray-400">Permite enviar notas/mensagens</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            const newActive = instance.is_active === false ? true : false;
                                            // 1. Atualizar localmente
                                            setInstances(instances.map(i => i.id === instance.id ? { ...i, is_active: newActive } : i));
                                            // 2. Salvar no banco
                                            const { error } = await supabase
                                                .from('instances')
                                                .update({ is_active: newActive })
                                                .eq('id', instance.id);
                                            if (error) {
                                                notify('error', 'Erro ao atualizar status do disparo.', 'Erro');
                                                // Reverter
                                                setInstances(instances.map(i => i.id === instance.id ? { ...i, is_active: !newActive } : i));
                                            } else {
                                                notify('success', `Disparos ${newActive ? 'ativados' : 'desativados'} com sucesso.`, 'Atualizado');
                                            }
                                        }}
                                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${instance.is_active !== false ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-slate-700'}`}
                                    >
                                        <span
                                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${instance.is_active !== false ? 'translate-x-5' : 'translate-x-0'}`}
                                        />
                                    </button>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <Button
                                        variant="outline"
                                        className="w-full text-emerald-600 hover:bg-emerald-50 border-emerald-100"
                                        onClick={() => handleTestConnection(instance)}
                                    >
                                        <Activity size={16} className="mr-2" />
                                        Testar Conexão
                                    </Button>

                                    {instance.status !== 'connected' && (
                                        <Button
                                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20"
                                            onClick={() => handleConnect(instance)}
                                        >
                                            <QrCode size={16} className="mr-2" />
                                            Conectar WhatsApp
                                        </Button>
                                    )}
                                    {instance.status === 'connected' && (
                                        <Button
                                            className="w-full bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-600/20"
                                            onClick={() => handleDisconnect(instance)}
                                        >
                                            <LogOut size={16} className="mr-2" />
                                            Desconectar
                                        </Button>
                                    )}
                                    <Button
                                        variant="outline"
                                        className="w-full text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 border-red-100"
                                        onClick={() => handleDeleteInstance(instance)}
                                    >
                                        <Trash2 size={16} className="mr-2" />
                                        Excluir Instância
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* QR Code Modal - PREMIUM */}
            <Modal
                isOpen={showQRModal}
                onClose={() => {
                    setShowQRModal(false);
                    fetchInstances();

                    // Polling para garantir que o número seja salvo após a conexão
                    // Tenta em 3s, 6s e 10s (Verifica se componente ainda está montado)
                    [3000, 6000, 10000].forEach(delay => {
                        setTimeout(() => {
                            if (isMounted.current) fetchInstances();
                        }, delay);
                    });
                }}
                title="Conectar WhatsApp"
                subtitle="Escaneie o QR Code abaixo com o seu celular para ativar a instância"
                icon={QrCode}
            >
                <div className="flex flex-col items-center">
                    <div className="relative w-64 h-64 bg-gray-50 dark:bg-slate-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shadow-inner">
                        {qrCode ? (
                            <img src={qrCode} alt="QR Code" className="w-full h-full p-4 animate-in zoom-in duration-300" />
                        ) : (
                            <div className="flex flex-col items-center gap-3">
                                <RefreshCw className="animate-spin text-emerald-500" size={32} />
                                <span className="text-sm text-gray-400 font-medium">Buscando token...</span>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 w-full space-y-6">
                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-100 dark:border-slate-700">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Instância Ativa</span>
                            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{currentInstance?.instance_name}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                variant="outline"
                                className="w-full h-11"
                                onClick={() => handleConnect(currentInstance!)}
                            >
                                <RefreshCw size={18} className="mr-2" />
                                Gerar Novo
                            </Button>
                            <Button
                                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20"
                                onClick={() => {
                                    notify('info', 'Verificando conexão...', 'Aguarde');
                                    if (currentInstance) {
                                        syncInstanceWithEvolution(currentInstance).then(() => {
                                            fetchInstances();
                                            setShowQRModal(false);
                                        });
                                    }
                                }}
                            >
                                Já Escaneiei
                            </Button>
                            <Button
                                className="col-span-2 w-full h-11 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200"
                                onClick={() => setShowQRModal(false)}
                            >
                                Fechar
                            </Button>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Edit Instance Modal */}
            <Modal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                title="Editar Instância"
                subtitle="Atualize as configurações da sua instância de WhatsApp"
                icon={Settings2}
            >
                <form onSubmit={handleUpdateInstance} className="space-y-6">
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Nome Amigável (Sistema)
                            </label>
                            <input
                                type="text"
                                value={friendlyName}
                                onChange={(e) => setFriendlyName(e.target.value)}
                                placeholder="Ex: WhatsApp Principal"
                                className="w-full rounded-lg border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 py-2.5 px-4 focus:ring-2 focus:ring-emerald-500"
                                required
                            />
                        </div>

                        {!isEvoGo && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Nome no WhatsApp (O que os outros veem)
                                </label>
                                <input
                                    type="text"
                                    value={waProfileName}
                                    onChange={(e) => setWaProfileName(e.target.value)}
                                    placeholder="Seu Nome ou Empresa"
                                    className="w-full rounded-lg border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 py-2.5 px-4 focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                        )}

                        {isEvoGo ? (
                            /* ===== EVO GO EDIT SETTINGS ===== */
                            <div className="space-y-5 pt-2">
                                {/* Webhook URL */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        URL do Webhook
                                    </label>
                                    <input
                                        type="url"
                                        value={evoWebhookUrl}
                                        onChange={(e) => setEvoWebhookUrl(e.target.value)}
                                        placeholder="https://seu-servidor.com/webhook"
                                        className="w-full rounded-lg border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 py-2.5 px-4 focus:ring-2 focus:ring-emerald-500 text-sm"
                                    />
                                    <p className="mt-1 text-[11px] text-gray-400">URL que receberá os eventos do WhatsApp</p>
                                </div>

                                {/* EvoGo Events */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Eventos para Webhook</label>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedEvents(
                                                selectedEvents.length === EVO_GO_EVENTS.length
                                                    ? []
                                                    : [...EVO_GO_EVENTS]
                                            )}
                                            className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-wider"
                                        >
                                            {selectedEvents.length === EVO_GO_EVENTS.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2 bg-gray-50 dark:bg-slate-900/50 rounded-lg border border-gray-100 dark:border-slate-700">
                                        {EVO_GO_EVENTS.map(event => (
                                            <label
                                                key={event}
                                                className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                                                    event === 'ALL'
                                                        ? (selectedEvents.includes('ALL') ? 'bg-indigo-50 dark:bg-indigo-900/20 col-span-2 sm:col-span-3 border border-indigo-200 dark:border-indigo-700' : 'col-span-2 sm:col-span-3 hover:bg-gray-100 dark:hover:bg-slate-700')
                                                        : (selectedEvents.includes(event) ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-gray-100 dark:hover:bg-slate-700')
                                                }`}
                                                onClick={() => {
                                                    if (event === 'ALL') {
                                                        setSelectedEvents(selectedEvents.includes('ALL') ? [] : [...EVO_GO_EVENTS]);
                                                    } else {
                                                        toggleEvent(event);
                                                    }
                                                }}
                                            >
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                                                    event === 'ALL'
                                                        ? (selectedEvents.includes('ALL') ? 'bg-indigo-500 border-indigo-500' : 'bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-500')
                                                        : (selectedEvents.includes(event) ? 'bg-emerald-500 border-emerald-500' : 'bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-500')
                                                }`}>
                                                    {(selectedEvents.includes(event)) && <Check size={10} className="text-white" strokeWidth={4} />}
                                                </div>
                                                <span className={`text-[11px] font-medium ${event === 'ALL' ? 'text-indigo-700 dark:text-indigo-400 font-bold' : 'text-gray-600 dark:text-gray-400'}`}>
                                                    {event}{event === 'ALL' ? ' (Todos)' : ''}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* EvoGo Advanced Config - checkbox list style */}
                                <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
                                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Configurações Avançadas</h3>
                                    <div className="divide-y divide-gray-100 dark:divide-slate-700 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden bg-gray-50 dark:bg-slate-900/50">
                                        {[
                                            { label: 'Always Online', sub: 'Manter sempre online no WhatsApp', val: evoGoAlwaysOnline, set: setEvoGoAlwaysOnline },
                                            { label: 'Reject Call', sub: 'Rejeitar chamadas automaticamente', val: evoGoRejectCall, set: setEvoGoRejectCall },
                                            { label: 'Read Messages', sub: 'Marcar mensagens como lidas', val: evoGoReadMessages, set: setEvoGoReadMessages },
                                            { label: 'Ignore Groups', sub: 'Ignorar mensagens de grupos', val: evoGoIgnoreGroups, set: setEvoGoIgnoreGroups },
                                            { label: 'Ignore Status', sub: 'Ignorar atualizações de status', val: evoGoIgnoreStatus, set: setEvoGoIgnoreStatus },
                                        ].map(({ label, sub, val, set }) => (
                                            <div
                                                key={label}
                                                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors"
                                                onClick={() => set(!val)}
                                            >
                                                <div>
                                                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{label}</p>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
                                                </div>
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ml-6 ${
                                                    val
                                                        ? 'bg-emerald-500 border-emerald-500'
                                                        : 'border-gray-300 dark:border-slate-500 bg-white dark:bg-slate-700'
                                                }`}>
                                                    {val && <Check size={10} className="text-white" strokeWidth={3} />}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {/* Msg Reject Call */}
                                    {evoGoRejectCall && (
                                        <div className="mt-3 animate-in fade-in slide-in-from-top-1">
                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Mensagem ao rejeitar chamada</label>
                                            <input
                                                type="text"
                                                value={evoGoMsgRejectCall}
                                                onChange={(e) => setEvoGoMsgRejectCall(e.target.value)}
                                                placeholder="Ex: No momento não posso atender. Envie uma mensagem!"
                                                className="w-full rounded-lg border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 py-2 px-3 focus:ring-2 focus:ring-emerald-500 text-sm"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* RabbitMQ / WebSocket / NATS */}
                                <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Transporte de Eventos</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        {[
                                            { label: 'RabbitMQ', val: evoGoRabbitMQ, set: setEvoGoRabbitMQ },
                                            { label: 'WebSocket', val: evoGoWebSocket, set: setEvoGoWebSocket },
                                            { label: 'NATS', val: evoGoNats, set: setEvoGoNats },
                                        ].map(({ label, val, set }) => (
                                            <div key={label}>
                                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
                                                <select
                                                    value={val}
                                                    onChange={(e) => set(e.target.value)}
                                                    className="w-full rounded-lg border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 py-2 px-3 text-sm text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                                                >
                                                    <option value="default">Padrão</option>
                                                    <option value="enabled">Habilitado</option>
                                                    <option value="disabled">Desabilitado</option>
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* ===== EVO API EDIT SETTINGS ===== */
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        URL do Webhook Evolution
                                    </label>
                                    <input
                                        type="url"
                                        value={evoWebhookUrl}
                                        onChange={(e) => setEvoWebhookUrl(e.target.value)}
                                        placeholder="https://seu-n8n.com/webhook/whatsapp"
                                        className="w-full rounded-lg border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 py-2.5 px-4 focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Eventos Monitorados
                                        </label>

                                        <div className="flex items-center gap-3">
                                            <Tooltip content={!evoWebhookUrl ? "Configure uma URL para testar" : "Envia um evento de teste para a URL configurada"}>
                                                <button
                                                    type="button"
                                                    onClick={handleTestWebhook}
                                                    disabled={isTestingWebhook || !evoWebhookUrl}
                                                    className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors ${!evoWebhookUrl ? 'text-gray-300 cursor-not-allowed' : 'text-amber-600 hover:text-amber-700'}`}
                                                >
                                                    {isTestingWebhook ? (
                                                        <RefreshCw size={12} className="animate-spin" />
                                                    ) : (
                                                        <Send size={12} />
                                                    )}
                                                    {isTestingWebhook ? 'Enviando...' : 'Testar Integração'}
                                                </button>
                                            </Tooltip>
                                            <span className="text-gray-300">|</span>
                                            <button
                                                type="button"
                                                onClick={handleMarkAll}
                                                className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-wider"
                                            >
                                                {selectedEvents.length === ALL_EVENTS.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 overflow-y-auto max-h-[200px] p-2 bg-gray-50 dark:bg-slate-900/50 rounded-lg border border-gray-100 dark:border-slate-700">
                                        {ALL_EVENTS.map(event => (
                                            <label
                                                key={event}
                                                className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors ${selectedEvents.includes(event) ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-gray-100 dark:hover:bg-slate-700'}`}
                                            >
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedEvents.includes(event) ? 'bg-emerald-500 border-emerald-500' : 'bg-white dark:bg-slate-600 border-gray-300 dark:border-slate-500'}`}>
                                                    {selectedEvents.includes(event) && <Check size={10} className="text-white" strokeWidth={4} />}
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    className="hidden"
                                                    checked={selectedEvents.includes(event)}
                                                    onChange={() => toggleEvent(event)}
                                                />
                                                <span className="text-[10px] font-medium truncate text-gray-600 dark:text-gray-400">
                                                    {event}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-4 pt-2">
                                    <div
                                        className="flex items-center gap-2 cursor-pointer"
                                        onClick={() => setWebhookEnabled(!webhookEnabled)}
                                    >
                                        <div className={`w-8 h-4 rounded-full relative transition-colors ${webhookEnabled ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                                            <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${webhookEnabled ? 'right-0.5' : 'left-0.5'}`} />
                                        </div>
                                        <span className="text-[11px] text-gray-500">Enable or disable the webhook</span>
                                    </div>
                                    <div
                                        className="flex items-center gap-2 cursor-pointer"
                                        onClick={() => setWebhookBase64(!webhookBase64)}
                                    >
                                        <div className={`w-8 h-4 rounded-full relative transition-colors ${webhookBase64 ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                                            <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${webhookBase64 ? 'right-0.5' : 'left-0.5'}`} />
                                        </div>
                                        <span className="text-[11px] text-gray-500">Send media base64 data in webhook</span>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => setShowEditModal(false)}
                            type="button"
                        >
                            Cancelar
                        </Button>
                        <Button
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20"
                            type="submit"
                            isLoading={isUpdating}
                        >
                            Salvar Alterações
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Modal de Instância Duplicada */}
            <Modal
                isOpen={showDuplicateModal}
                onClose={() => setShowDuplicateModal(false)}
                title="Instância já cadastrada"
                subtitle="Não é possível criar esta instância pois os dados coincidem com uma existente"
                icon={AlertTriangle}
                variant="danger"
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        Já existe uma instância configurada no sistema com as mesmas informações:
                    </p>
                    
                    <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-xl border border-red-100 dark:border-red-900/50 space-y-2">
                        {duplicateInfo.name && (
                            <div className="flex justify-between text-sm">
                                <span className="font-medium text-gray-500">Nome Amigável:</span>
                                <span className="font-bold text-red-700 dark:text-red-400">{duplicateInfo.name}</span>
                            </div>
                        )}
                        {duplicateInfo.techId && (
                            <div className="flex flex-col gap-1 text-sm pt-1">
                                <span className="font-medium text-gray-500">ID Técnico:</span>
                                <code className="font-mono font-bold text-xs bg-red-100 dark:bg-red-900/40 p-1.5 rounded break-all text-red-700 dark:text-red-400">
                                    {duplicateInfo.techId}
                                </code>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button
                            className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20 px-6"
                            onClick={() => setShowDuplicateModal(false)}
                        >
                            Entendi
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    switch (status) {
        case 'connected':
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Conectado
                </span>
            );
        case 'connecting':
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-bounce"></span>
                    Conectando
                </span>
            );
        default:
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                    Desconectado
                </span>
            );
    }
}
