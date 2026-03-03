import React, { useState, useEffect } from 'react';

import { supabase } from '../lib/supabase';
import { useEntity } from '../context/EntityContext';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Save, Megaphone, Instagram, Facebook, Image as ImageIcon, UploadCloud, Unplug, Rocket, Video, User } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import type { SocialProfile, SocialPost } from '../types/marketing';

export function Marketing() {
    const { currentEntity } = useEntity();
    const { user } = useAuth();

    const [profile, setProfile] = useState<SocialProfile | null>(null);
    const [posts, setPosts] = useState<SocialPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form State
    const [niche, setNiche] = useState('');
    const [tone, setTone] = useState('');
    const [audience, setAudience] = useState('');
    const [approvalWhatsapp, setApprovalWhatsapp] = useState('');
    const [uploadingImage, setUploadingImage] = useState(false);
    const [hasWhatsappConnection, setHasWhatsappConnection] = useState(true);
    const [connectingMeta, setConnectingMeta] = useState(false);
    const [publishingId, setPublishingId] = useState<string | null>(null);

    // Manual Post creation
    const [isCreatingManualPost, setIsCreatingManualPost] = useState(false);
    const [manualFile, setManualFile] = useState<File | null>(null);
    const [manualPreview, setManualPreview] = useState<string | null>(null);
    const [manualContent, setManualContent] = useState('');
    const [manualMediaType, setManualMediaType] = useState<'feed' | 'story' | 'reels'>('feed');
    const [savingManualPost, setSavingManualPost] = useState(false);
    const [isGeneratingMagic, setIsGeneratingMagic] = useState(false);

    const [editingPost, setEditingPost] = useState<SocialPost | null>(null);
    const [editContent, setEditContent] = useState('');
    const [editMediaType, setEditMediaType] = useState<'feed' | 'story' | 'reels'>('feed');
    const [showInstructions, setShowInstructions] = useState(false);

    // Campaign State
    const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
    const [campaignTheme, setCampaignTheme] = useState('');
    const [campaignCount, setCampaignCount] = useState<number>(3);
    const [savingCampaign, setSavingCampaign] = useState(false);

    // Video/Avatar Settings
    const [videoEnabled, setVideoEnabled] = useState(false);
    const [avatarGender, setAvatarGender] = useState('male');
    const [avatarStyle, setAvatarStyle] = useState('professional');

    const formatWhatsAppMask = (value: string) => {
        let v = value.replace(/\D/g, '');
        if (v.startsWith('55')) v = v.substring(2);
        v = v.substring(0, 11);

        if (v.length === 0) return '55 ';

        let formatted = '55 ';
        if (v.length > 0) formatted += `(${v.slice(0, 2)}`;
        if (v.length > 2) formatted += `) ${v.slice(2, 3)}`;
        if (v.length > 3) formatted += ` ${v.slice(3, 7)}`;
        if (v.length > 7) formatted += `-${v.slice(7, 11)}`;
        return formatted;
    };

    useEffect(() => {
        // Load FB SDK
        if (!(window as any).FB) {
            (window as any).fbAsyncInit = function () {
                (window as any).FB.init({
                    appId: import.meta.env.VITE_META_APP_ID || '897720413143999',
                    cookie: true,
                    xfbml: true,
                    version: 'v19.0'
                });
            };
            (function (d, s, id) {
                var js, fjs = d.getElementsByTagName(s)[0];
                if (d.getElementById(id)) { return; }
                js = d.createElement(s) as HTMLScriptElement; js.id = id;
                js.src = "https://connect.facebook.net/pt_BR/sdk.js";
                fjs?.parentNode?.insertBefore(js, fjs);
            }(document, 'script', 'facebook-jssdk'));
        }

        if (currentEntity.type === 'company' && user) {
            fetchProfile();
        } else {
            setLoading(false);
        }
    }, [currentEntity.id, user]);

    const fetchProfile = async () => {
        try {
            // Check WhatsApp connection
            const { data: instances } = await supabase
                .from('instances')
                .select('id')
                .eq('company_id', currentEntity.id)
                .eq('status', 'connected')
                .limit(1);
            setHasWhatsappConnection(Boolean(instances && instances.length > 0));

            const { data, error } = await supabase
                .from('social_profiles')
                .select('*')
                .eq('company_id', currentEntity.id)
                .limit(1);

            if (error) {
                console.error('Error fetching social profile:', error);
                return;
            }

            const profileData = data && data.length > 0 ? data[0] : null;

            if (profileData) {
                setProfile(profileData);
                setNiche(profileData.niche);
                setTone(profileData.tone);
                setAudience(profileData.target_audience);
                setApprovalWhatsapp(formatWhatsAppMask(profileData.approval_whatsapp || ''));
                setVideoEnabled(profileData.video_enabled || false);
                setAvatarGender(profileData.avatar_gender || 'male');
                setAvatarStyle(profileData.avatar_style || 'professional');
                await fetchPosts();
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchPosts = async () => {
        const { data } = await supabase
            .from('social_posts')
            .select('*')
            .eq('company_id', currentEntity.id)
            .order('created_at', { ascending: false });
        if (data) setPosts(data);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!niche || !tone || !audience) {
            alert('Preencha todos os campos do perfil.');
            return;
        }

        setSaving(true);
        try {
            const cleanPhone = approvalWhatsapp.replace(/\D/g, '');
            if (profile) {
                // Update
                const { error } = await supabase
                    .from('social_profiles')
                    .update({
                        niche,
                        tone,
                        target_audience: audience,
                        approval_whatsapp: cleanPhone,
                        video_enabled: videoEnabled,
                        avatar_gender: avatarGender,
                        avatar_style: avatarStyle
                    })
                    .eq('id', profile.id);
                if (error) throw error;
            } else {
                // Create
                const { error } = await supabase
                    .from('social_profiles')
                    .insert({
                        company_id: currentEntity.id,
                        niche,
                        tone,
                        target_audience: audience,
                        approval_whatsapp: cleanPhone,
                        video_enabled: videoEnabled,
                        avatar_gender: avatarGender,
                        avatar_style: avatarStyle
                    });
                if (error) throw error;
            }

            // Also ensure the company has the social copilot flag enabled
            const { error: cmpError } = await supabase
                .from('companies')
                .update({ has_social_copilot: true })
                .eq('id', currentEntity.id);
            if (cmpError) console.error('Error enabling social copilot on company:', cmpError);

            alert('Perfil salvo com sucesso!');
            if (!profile) await fetchProfile(); // refresh to get ID
        } catch (error: any) {
            console.error('Error saving profile', error);
            alert('Erro ao salvar o perfil. Tente novamente.');
        } finally {
            setSaving(false);
        }
    };

    const handleConnectMeta = () => {
        if (!profile) {
            alert('Por favor, primeiro preencha e salve o Perfil da Marca.');
            return;
        }

        const FB = (window as any).FB;
        if (!FB) {
            alert('Facebook SDK ainda não carregado. Aguarde um instante ou verifique extensões de bloqueio/AD Blocker.');
            return;
        }

        setConnectingMeta(true);
        FB.login((response: any) => {
            if (response.authResponse) {
                const accessToken = response.authResponse.accessToken;
                (async () => {
                    try {
                        const { data: session } = await supabase.auth.getSession();
                        const token = session.session?.access_token;

                        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/social-meta-connect`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                                short_lived_token: accessToken,
                                company_id: currentEntity.id
                            })
                        });

                        if (!res.ok) {
                            const err = await res.json();
                            throw new Error(err.error || 'Erro ao conectar');
                        }

                        const metaData = await res.json();
                        alert(`Sucesso! Conectado comercialmente à conta Instagram: @${metaData.ig_username}`);
                        fetchProfile(); // refresh data to show IG info
                    } catch (error: any) {
                        console.error('Meta connect error', error);
                        alert(`Falha ao conectar na API do Meta: ${error.message}`);
                    } finally {
                        setConnectingMeta(false);
                    }
                })();
            } else {
                setConnectingMeta(false);
                console.log('Usuário cancelou o login no FB.');
            }
        }, { scope: 'pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish,business_management' });
    };

    const handleDisconnectMeta = async () => {
        if (!confirm('Tem certeza que deseja desconectar o Instagram? Isso pausará as postagens automáticas.')) return;

        try {
            setConnectingMeta(true);
            const { error } = await supabase
                .from('social_profiles')
                .update({
                    fb_access_token: null,
                    fb_page_id: null,
                    fb_page_name: null,
                    ig_account_id: null,
                    ig_username: null
                })
                .eq('company_id', currentEntity.id);

            if (error) throw error;

            alert('Conta desconectada com sucesso.');
            fetchProfile(); // Atualiza a tela limpando o cache
        } catch (err: any) {
            console.error('Error disconnecting meta:', err);
            alert('Erro ao desconectar.');
        } finally {
            setConnectingMeta(false);
        }
    };

    const handlePublishNow = async (postId: string) => {
        const isConfirmed = window.confirm("⚠️ ATENÇÃO: Esta postagem ainda está PENDENTE e pode não ter sido aprovada pelo cliente no WhatsApp.\n\nSe der continuídade, ela será postada IMEDIATAMENTE no Instagram.\n\nTem certeza que deseja forçar a publicação agora?");
        if (!isConfirmed) return;

        try {
            setPublishingId(postId);
            const { data: session } = await supabase.auth.getSession();
            const token = session.session?.access_token;

            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/social-post-publisher`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ post_id: postId })
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Erro ao publicar.');

            alert('Sucesso! A postagem foi publicada no Instagram 🚀');
            await fetchPosts();
        } catch (error: any) {
            console.error('Falha ao publicar manualmente:', error);
            alert(`Falha ao publicar a postagem: ${error.message}`);
        } finally {
            setPublishingId(null);
        }
    };

    const handleGenerateNow = async () => {
        try {
            setSaving(true);
            const { data: session } = await supabase.auth.getSession();
            const token = session.session?.access_token;

            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/social-copilot-cron`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ company_id: currentEntity.id })
            });

            if (!res.ok) throw new Error('Não foi possível gerar no momento.');
            alert('A IA foi notificada e já deve ter gerado seu post! Confira o seu WhatsApp em instantes.');
            await fetchPosts();
        } catch (error: any) {
            console.error('Falha ao acionar webhook de geracao:', error);
            alert('Erro ao tentar gerar postagem agora.');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveCampaign = async () => {
        if (!campaignTheme) {
            alert('Você precisa informar um tema para a campanha.');
            return;
        }
        try {
            setSavingCampaign(true);
            const { data: session } = await supabase.auth.getSession();
            const token = session.session?.access_token;

            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/social-copilot-campaign`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    company_id: currentEntity.id,
                    theme: campaignTheme,
                    post_count: campaignCount
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao gerar campanha.');

            alert(`Campanha criada e salva com sucesso! Foram gerados ${data.count || campaignCount} posts.`);
            setIsCreatingCampaign(false);
            setCampaignTheme('');
            setCampaignCount(3);
            await fetchPosts();
        } catch (error: any) {
            console.error('Erro ao gerar campanha:', error);
            alert('Falha ao gerar os posts da campanha. ' + (error.message || ''));
        } finally {
            setSavingCampaign(false);
        }
    };

    const handleSavePostEdit = async () => {
        if (!editingPost) return;
        try {
            const { error } = await supabase.from('social_posts').update({
                content: editContent,
                media_type: editMediaType
            }).eq('id', editingPost.id);

            if (error) throw error;

            setPosts(posts.map(p => p.id === editingPost.id ? {
                ...p,
                content: editContent,
                media_type: editMediaType
            } : p));

            setEditingPost(null);
            alert('Postagem atualizada com sucesso!');
        } catch (error) {
            console.error('Erro ao editar post:', error);
            alert('Falha ao editar a postagem.');
        }
    };

    const handleDeletePost = async (postId: string) => {
        if (!window.confirm('Tem certeza que deseja excluir esta postagem?')) return;
        try {
            const postToDelete = posts.find(p => p.id === postId);

            // Excluir a imagem do Storage do Supabase se ela existir
            if (postToDelete?.image_url) {
                try {
                    const urlParts = postToDelete.image_url.split('/social_media_assets/');
                    if (urlParts.length > 1) {
                        const filePath = urlParts[1];
                        console.log('Removendo ativo do disco:', filePath);
                        await supabase.storage.from('social_media_assets').remove([filePath]);
                    }
                } catch (storageError) {
                    console.error('Erro ignorado ao excluir imagem do storage:', storageError);
                }
            }

            const { error } = await supabase.from('social_posts').delete().eq('id', postId);
            if (error) throw error;
            setPosts(posts.filter(p => p.id !== postId));
        } catch (error) {
            console.error('Erro ao excluir post:', error);
            alert('Falha ao excluir o post.');
        }
    };

    const handleManualFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setManualFile(file);
            setManualPreview(URL.createObjectURL(file));
        }
    };

    const handleGenerateMagic = async () => {
        try {
            setIsGeneratingMagic(true);
            const { data: session } = await supabase.auth.getSession();
            const token = session.session?.access_token;

            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/social-copilot-magic`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    company_id: currentEntity.id,
                    topic: manualContent
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao gerar postagem.');

            setManualContent(data.caption);
            setManualPreview(data.image_url);
            setManualFile(null);

        } catch (error: any) {
            console.error('Magic gen error:', error);
            alert('Falha ao gerar o conteúdo mágico. Tente novamente.');
        } finally {
            setIsGeneratingMagic(false);
        }
    };

    const handleSaveManualPost = async () => {
        if (!manualFile && !manualContent && !manualPreview) {
            alert('Você precisa enviar uma imagem/vídeo ou preencher o texto da postagem.');
            return;
        }

        try {
            setSavingManualPost(true);
            let publicUrl = null;

            if (manualFile) {
                const fileExt = manualFile.name.split('.').pop();
                const fileName = `${currentEntity.id}/${Math.random()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('social_media_assets')
                    .upload(fileName, manualFile);

                if (uploadError) throw uploadError;

                const { data } = supabase.storage
                    .from('social_media_assets')
                    .getPublicUrl(fileName);
                publicUrl = data.publicUrl;
            } else if (manualPreview && manualPreview.startsWith('http')) {
                publicUrl = manualPreview;
            }

            const { data: session } = await supabase.auth.getSession();
            const token = session.session?.access_token;

            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/social-post-publisher`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'create_manual_post',
                    company_id: currentEntity.id,
                    content: manualContent,
                    image_url: publicUrl,
                    media_type: manualMediaType
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao publicar.');

            alert('Postagem criada e salva com sucesso!');
            setIsCreatingManualPost(false);
            setManualFile(null);
            setManualPreview(null);
            setManualContent('');
            setManualMediaType('feed');
            await fetchPosts();
        } catch (error: any) {
            console.error('Erro ao salvar post manual:', error);
            alert('Falha ao criar postagem manual.');
        } finally {
            setSavingManualPost(false);
        }
    };

    const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || currentEntity.type !== 'company') return;

        try {
            setUploadingImage(true);
            const fileExt = file.name.split('.').pop();
            const fileName = `${currentEntity.id}/${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            // 1. Fazer upload da imagem pro Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('social_media_assets')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Pegar a URL pública
            const { data: { publicUrl } } = supabase.storage
                .from('social_media_assets')
                .getPublicUrl(filePath);

            console.log('Imagem enviada com sucesso: ', publicUrl);

            // Invocar a inteligência!
            const { error: visionError } = await supabase.functions.invoke('social-copilot-vision', {
                body: { company_id: currentEntity.id, image_url: publicUrl }
            });

            if (visionError) throw visionError;

            alert('Tudo Certo! A IA leu sua foto e já enviou a postagem para aprovação no seu WhatsApp!');

            // Recarregar posts
            await fetchPosts();

        } catch (error: any) {
            console.error('Erro no upload da imagem:', error);
            alert('Falha ao enviar e gerar a partir da foto.');
        } finally {
            setUploadingImage(false);
            // Reset input
            e.target.value = '';
        }
    };

    if (currentEntity.type !== 'company') {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center h-full">
                <Sparkles size={48} className="text-gray-300 dark:text-gray-600 mb-4" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Marketing IA</h2>
                <p className="text-gray-500">Selecione uma empresa para configurar o Copiloto Social.</p>
            </div>
        );
    }

    if (loading) {
        return <div className="p-8 flex justify-center"><div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div></div>;
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-12">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-rose-100 text-rose-600 rounded-xl dark:bg-rose-900/30 dark:text-rose-400">
                        <Sparkles size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">Marketing Copilot AI</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Seu assistente virtual de inteligência artificial para mídias sociais.</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column: Form Settings */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-slate-700">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                            <Megaphone size={18} className="text-rose-500" />
                            Perfil da Marca
                        </h2>
                        <p className="text-sm text-gray-500 mb-6">Ensine a Inteligência Artificial sobre o seu negócio para que ela possa criar postagens perfeitas pra você todos os dias.</p>

                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Qual o Nicho da Empresa?
                                </label>
                                <Input
                                    value={niche}
                                    onChange={(e) => setNiche(e.target.value)}
                                    placeholder="Ex: Consultório Odontológico, Loja de Roupas, Pizzaria..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Tom de Voz (Personalidade)
                                </label>
                                <Input
                                    value={tone}
                                    onChange={(e) => setTone(e.target.value)}
                                    placeholder="Ex: Formal e educativo, Engraçado e dinâmico, Motivacional..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Público-Alvo
                                </label>
                                <Input
                                    value={audience}
                                    onChange={(e) => setAudience(e.target.value)}
                                    placeholder="Ex: Mães de 25 a 40 anos, Homens interessados em carros esportivos..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    WhatsApp para Aprovação (Seu Celular)
                                </label>
                                <Input
                                    value={approvalWhatsapp}
                                    onChange={(e) => setApprovalWhatsapp(formatWhatsAppMask(e.target.value))}
                                    placeholder="Ex: 55 (84) 9 9807-1213"
                                    maxLength={20}
                                />
                                <p className="text-xs text-gray-500 mt-1">Este número receberá a notificação matinal com a postagem pronta.</p>
                                {!hasWhatsappConnection ? (
                                    <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 text-xs rounded-lg border border-rose-200 dark:border-rose-800/50 flex flex-col gap-2">
                                        <div>
                                            <strong>⚠️ WhatsApp Desconectado:</strong> Identificamos que sua empresa <strong>não</strong> possui um WhatsApp gerador online.
                                            As mensagens de aprovação não chegarão no seu celular sem isso.
                                        </div>
                                        <p className="font-semibold text-rose-800 dark:text-rose-300">Acesse o menu WhatsApp ao lado e leia o QRCode para conectar a inteligência.</p>
                                    </div>
                                ) : (
                                    <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-xs rounded-lg border border-emerald-100 dark:border-emerald-800/50">
                                        <strong>✅ WhatsApp Conectado:</strong> Tudo certo! Você já possui conectividade ativa e começará a receber as postagens para aprovação automaticamente neste celular.
                                    </div>
                                )}
                            </div>

                            <div className="pt-6 border-t border-gray-100 dark:border-slate-700 mt-6">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                                    <Video size={18} className="text-indigo-500" />
                                    Configuração de Avatar de Vídeo (IA)
                                </h3>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
                                        <div>
                                            <p className="text-sm font-bold text-indigo-900 dark:text-indigo-300">Ativar Postagens com Vídeo</p>
                                            <p className="text-xs text-indigo-700/70 dark:text-indigo-400/70">A IA gerará vídeos com avatar falando o roteiro em vez de imagens.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setVideoEnabled(!videoEnabled)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${videoEnabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-slate-700'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${videoEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>

                                    {videoEnabled && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                                                    <User size={14} /> Gênero do Avatar
                                                </label>
                                                <select
                                                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
                                                    value={avatarGender}
                                                    onChange={e => setAvatarGender(e.target.value)}
                                                >
                                                    <option value="male">Masculino (Apresentador)</option>
                                                    <option value="female">Feminino (Apresentadora)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Estilo do Vídeo
                                                </label>
                                                <select
                                                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
                                                    value={avatarStyle}
                                                    onChange={e => setAvatarStyle(e.target.value)}
                                                >
                                                    <option value="professional">Profissional / Executivo</option>
                                                    <option value="news">Telejornal / Notícias</option>
                                                    <option value="casual">Casual / Descontraído</option>
                                                    <option value="educational">Educativo / Professor</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end">
                                <Button
                                    type="submit"
                                    disabled={saving}
                                    className="bg-rose-600 hover:bg-rose-700 text-white gap-2 flex items-center shadow-lg shadow-rose-500/30"
                                >
                                    <Save size={16} />
                                    {saving ? 'Salvando...' : 'Salvar Perfil IA'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Right Column: Connection / Status */}
                <div className="space-y-6">
                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 shadow-sm text-white relative overflow-hidden group">
                        <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all"></div>
                        <h2 className="text-lg font-bold flex items-center gap-2 mb-2">
                            <Instagram size={20} /> Conectar Conta
                        </h2>
                        <div className="text-sm text-indigo-100 mb-6 relative z-10 space-y-2">
                            <p>Para publicar automaticamente, siga os três passos:</p>
                            <ul className="list-disc list-inside text-xs opacity-90 space-y-1">
                                <li>Tenha seu <strong>Instagram como Conta Profissional</strong></li>
                                <li>Tenha seu Instagram <strong>vinculado à uma Página do Facebook</strong></li>
                                <li>Faça login abaixo garantindo que marcou todas as permissões do Facebook.</li>
                            </ul>
                            <button
                                onClick={() => setShowInstructions(true)}
                                className="mt-3 text-[11px] underline text-indigo-200 hover:text-white transition-colors"
                            >
                                Não sabe como fazer? Ver tutorial detalhado
                            </button>
                        </div>

                        {!profile?.ig_account_id ? (
                            <>
                                <Button
                                    onClick={handleConnectMeta}
                                    disabled={connectingMeta || !profile}
                                    className="w-full bg-white text-indigo-600 hover:bg-gray-50 flex items-center justify-center gap-2 font-bold shadow-lg disabled:opacity-80"
                                >
                                    <Facebook size={18} />
                                    {connectingMeta ? 'Conectando...' : 'Fazer Login com Meta'}
                                </Button>
                                {!profile && <p className="text-center text-xs text-indigo-200 mt-2">Salve o Perfil da Marca primeiro.</p>}
                                <p className="text-[10px] text-center mt-3 text-indigo-200 opacity-80">
                                    Integração 100% oficial e segura com a API Graph Meta.
                                </p>
                            </>
                        ) : (
                            <div className="bg-white/20 p-4 rounded-xl border border-white/30 backdrop-blur-sm z-10 relative">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 flex items-center justify-center shadow-lg">
                                        <Instagram size={20} className="text-white" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider text-indigo-100 font-bold mb-0.5">Conectado Oficial</p>
                                        <p className="font-bold text-white leading-none">@{profile.ig_username}</p>
                                    </div>
                                </div>
                                <p className="text-xs text-indigo-100/90 mt-3 pt-3 border-t border-white/20">
                                    Página Vinculada: <strong>{profile.fb_page_name}</strong>
                                </p>
                                <button
                                    onClick={handleDisconnectMeta}
                                    type="button"
                                    disabled={connectingMeta}
                                    className="mt-3 w-full py-2 bg-black/20 hover:bg-rose-500/80 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2"
                                >
                                    <Unplug size={14} />
                                    {connectingMeta ? 'Aguarde...' : 'Desconectar Conta'}
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/50 rounded-2xl p-5">
                        <h3 className="font-bold text-orange-800 dark:text-orange-400 text-sm mb-2">💡 Como Funciona?</h3>
                        <ol className="text-xs text-orange-700/80 dark:text-orange-300/80 space-y-2 list-decimal list-inside">
                            <li>Preencha o perfil da sua marca aqui.</li>
                            <li>A IA "Aplica" essa personalidade todo dia de madrugada.</li>
                            <li>Pela manhã você recebe uma notificação no WhatsApp com a Postagem pronta.</li>
                            <li>Aprove digitando "1" e nós publicamos no seu Instagram automaticamente.</li>
                        </ol>
                    </div>
                </div>

                {/* Bottom Row/Section for Past/Generated Posts showing under left col or full width */}
            </div>

            {/* Generated Posts Section */}
            {profile && (
                <div className="mt-8">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-4 gap-4">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 whitespace-nowrap">
                            <Sparkles size={18} className="text-rose-500" />
                            Suas Postagens Geradas pela IA
                        </h2>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto justify-start lg:justify-end">
                            <div>
                                <input
                                    type="file"
                                    id="image-upload"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleUploadImage}
                                    disabled={uploadingImage}
                                />
                                <Button
                                    onClick={() => document.getElementById('image-upload')?.click()}
                                    disabled={uploadingImage}
                                    variant="outline"
                                    className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-900/30 text-sm whitespace-nowrap"
                                >
                                    {uploadingImage ? (
                                        <UploadCloud size={16} className="animate-pulse mr-2 inline" />
                                    ) : (
                                        <ImageIcon size={16} className="mr-2 inline" />
                                    )}
                                    {uploadingImage ? 'Lendo a Foto...' : 'Enviar Foto Real e Gerar'}
                                </Button>
                            </div>
                            <Button
                                onClick={() => setIsCreatingManualPost(true)}
                                variant="outline"
                                className="border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-400 dark:hover:bg-purple-900/30 text-sm whitespace-nowrap"
                            >
                                <UploadCloud size={16} className="mr-2 inline" />
                                Nova Postagem Manual
                            </Button>
                            <Button
                                onClick={handleGenerateNow}
                                disabled={saving || uploadingImage}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm whitespace-nowrap"
                            >
                                🤖 Gerar Postagem IA Agora
                            </Button>
                            <Button
                                onClick={() => setIsCreatingCampaign(true)}
                                className="bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-700 hover:to-indigo-700 text-white text-sm whitespace-nowrap"
                            >
                                <Rocket size={16} className="mr-2 inline" />
                                Lançar Campanha IA
                            </Button>
                        </div>
                    </div>

                    {posts.length === 0 ? (
                        <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-8 text-center border border-dashed border-gray-300 dark:border-slate-700">
                            <p className="text-gray-500">Nenhuma postagem gerada ainda. Nossa IA vai trabalhar na primeira durante a madrugada!</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {posts.map(post => (
                                <div key={post.id} className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-gray-400">
                                                    {new Date(post.created_at).toLocaleDateString()}
                                                </span>
                                                <select
                                                    className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold px-1 py-0.5 rounded border-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                                    value={post.media_type || 'feed'}
                                                    onChange={async (e) => {
                                                        const newType = e.target.value as 'feed' | 'story' | 'reels';
                                                        setPosts(posts.map(p => p.id === post.id ? { ...p, media_type: newType } : p));
                                                        await supabase.from('social_posts').update({ media_type: newType }).eq('id', post.id);
                                                    }}
                                                >
                                                    <option value="feed">FEED</option>
                                                    <option value="story">STORY</option>
                                                    <option value="reels">REELS</option>
                                                </select>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${post.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                post.status === 'posted' ? 'bg-emerald-100 text-emerald-700' :
                                                    'bg-gray-100 text-gray-700'
                                                }`}>
                                                {post.status.toUpperCase()}
                                            </span>
                                        </div>
                                        {post.image_url && (
                                            <div className="mb-4 rounded-lg overflow-hidden border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
                                                <img src={post.image_url} alt="Post asset" className="w-full h-auto object-cover max-h-48" />
                                            </div>
                                        )}
                                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{post.content}</p>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between">
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="outline" className="text-xs" onClick={() => {
                                                setEditingPost(post);
                                                setEditContent(post.content);
                                                setEditMediaType(post.media_type as any || 'feed');
                                            }}>Editar</Button>
                                            <Button size="sm" variant="outline" className="text-xs text-red-500 hover:bg-red-50 border-red-200" onClick={() => handleDeletePost(post.id)}>Excluir</Button>
                                        </div>
                                        {post.status === 'pending' && (
                                            <Button
                                                size="sm"
                                                disabled={publishingId === post.id}
                                                onClick={() => handlePublishNow(post.id)}
                                                className="bg-rose-500 hover:bg-rose-600 text-white text-xs disabled:opacity-50"
                                            >
                                                {publishingId === post.id ? 'Publicando...' : 'Postar Agora'}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )
            }

            {/* Modal de Criação de Post Manual */}
            {
                isCreatingManualPost && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-gray-100 dark:border-slate-700 my-8">
                            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                                <UploadCloud size={20} className="text-purple-500" />
                                Criar Postagem Manualmente
                            </h3>
                            <p className="text-sm text-gray-500 mb-6">Monte a sua postagem e ela ficará pendente na lista para publicação no Instagram.</p>

                            <div className="space-y-4">
                                {/* Upload da Imagem */}
                                <div className="border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900/50 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer relative overflow-hidden"
                                    onClick={() => document.getElementById('manual-image-upload')?.click()}>
                                    <input
                                        type="file"
                                        id="manual-image-upload"
                                        className="hidden"
                                        accept="image/*,video/*"
                                        onChange={handleManualFileSelection}
                                        disabled={isGeneratingMagic}
                                    />
                                    {isGeneratingMagic ? (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50/90 dark:bg-slate-900/90 z-10 backdrop-blur-sm">
                                            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                                            <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">Criando Imagem e Legenda...</p>
                                        </div>
                                    ) : manualPreview ? (
                                        <img src={manualPreview} alt="Preview" className="absolute inset-0 w-full h-full object-contain bg-black/5" />
                                    ) : (
                                        <>
                                            <ImageIcon size={32} className="text-gray-400 mb-2" />
                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Clique para enviar Imagem/Vídeo</span>
                                        </>
                                    )}
                                </div>

                                {/* Type Selector */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Onde vai postar?
                                    </label>
                                    <select
                                        className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        value={manualMediaType}
                                        onChange={e => setManualMediaType(e.target.value as any)}
                                    >
                                        <option value="feed">Feed (Instagram Feed)</option>
                                        <option value="story">Story</option>
                                        <option value="reels">Reels (Certifique-se de enviar um Vídeo!)</option>
                                    </select>
                                </div>

                                {/* Caption Textarea */}
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Legenda (Opcional)
                                        </label>
                                        <button
                                            onClick={handleGenerateMagic}
                                            disabled={isGeneratingMagic}
                                            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 flex items-center gap-1 disabled:opacity-50"
                                        >
                                            <Sparkles size={14} />
                                            {isGeneratingMagic ? 'Criando Mágica...' : 'Varinha Mágica (IA)'}
                                        </button>
                                    </div>
                                    <textarea
                                        className="w-full h-32 p-3 border border-gray-200 dark:border-slate-700 rounded-xl resize-none bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-sm"
                                        value={manualContent}
                                        onChange={e => setManualContent(e.target.value)}
                                        placeholder="Escreva a legenda da postagem aqui..."
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <Button variant="outline" onClick={() => { setIsCreatingManualPost(false); setManualPreview(null); setManualFile(null); setManualContent(''); setManualMediaType('feed'); }} className="dark:border-slate-600 dark:text-slate-300">Cancelar</Button>
                                <Button onClick={handleSaveManualPost} disabled={savingManualPost} className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/30">
                                    {savingManualPost ? 'Salvando...' : 'Salvar Postagem'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modal de Edição de Post (Autogerados) */}
            {
                editingPost && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-gray-100 dark:border-slate-700">
                            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                                <Megaphone size={20} className="text-rose-500" />
                                Editar Legenda da Postagem
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Onde vai postar?
                                    </label>
                                    <select
                                        className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
                                        value={editMediaType}
                                        onChange={e => setEditMediaType(e.target.value as any)}
                                    >
                                        <option value="feed">Feed (Instagram Feed)</option>
                                        <option value="story">Story</option>
                                        <option value="reels">Reels (Certifique-se de enviar um Vídeo!)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Legenda
                                    </label>
                                    <textarea
                                        className="w-full h-56 p-4 border border-gray-200 dark:border-slate-700 rounded-xl resize-none bg-gray-50 dark:bg-slate-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all font-medium"
                                        value={editContent}
                                        onChange={e => setEditContent(e.target.value)}
                                        placeholder="Escreva a legenda incrível aqui..."
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <Button variant="outline" onClick={() => setEditingPost(null)} className="dark:border-slate-600 dark:text-slate-300">Cancelar</Button>
                                <Button onClick={handleSavePostEdit} className="bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-500/30">Salvar Alterações</Button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modal de Instruções Face/Insta */}
            {
                showInstructions && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-2xl shadow-2xl border border-gray-100 dark:border-slate-700 my-8">
                            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                                <Instagram size={24} className="text-pink-500" />
                                Como Preparar seu Instagram para a Automação
                            </h3>

                            <div className="space-y-6 text-sm text-gray-700 dark:text-gray-300">
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/50">
                                    <p className="font-semibold text-blue-800 dark:text-blue-300 mb-1">Por que preciso fazer isso?</p>
                                    <p className="text-xs">Para que nosso sistema (ou qualquer outro sistema de inteligência) consiga postar no seu Instagram automaticamente sem precisar da sua senha, o Facebook exige que a conta siga regras profissionais de segurança.</p>
                                </div>

                                <div>
                                    <h4 className="font-bold text-gray-900 dark:text-white mb-2 flex gap-2"><span className="bg-gray-200 dark:bg-slate-700 w-5 h-5 rounded-full flex items-center justify-center text-xs">1</span> Mudar para Conta Profissional</h4>
                                    <ol className="list-decimal list-inside space-y-1 ml-2 text-xs">
                                        <li>Abra o aplicativo do Instagram no seu celular.</li>
                                        <li>Vá no seu <strong>Perfil</strong> e toque nos <strong>3 tracinhos</strong> (Menu) no canto superior direito.</li>
                                        <li>Vá em <strong>Configurações</strong> {'>'} Tipo de conta e ferramentas.</li>
                                        <li>Toque em <strong>Mudar para conta profissional / empresarial</strong> e siga até o final.</li>
                                    </ol>
                                </div>

                                <hr className="border-gray-100 dark:border-slate-700" />

                                <div>
                                    <h4 className="font-bold text-gray-900 dark:text-white mb-2 flex gap-2"><span className="bg-gray-200 dark:bg-slate-700 w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span> Vincular a uma Página do Facebook</h4>
                                    <p className="text-xs mb-2 italic">Dica: É muito mais fácil fazer isso pelo Computador!</p>
                                    <ol className="list-decimal list-inside space-y-1 ml-2 text-xs">
                                        <li>Acesse o <strong>Facebook.com</strong> e abra a Página da sua empresa.</li>
                                        <li>No menu lateral esquerdo, clique em <strong>Configurações</strong>.</li>
                                        <li>Procure por <strong>Contas Vinculadas</strong>.</li>
                                        <li>Clique em <strong>Instagram</strong> e botão <strong>Conectar Conta</strong>.</li>
                                        <li>Coloque a senha do seu Insta e confirme.</li>
                                    </ol>
                                </div>

                                <hr className="border-gray-100 dark:border-slate-700" />

                                <div>
                                    <h4 className="font-bold text-gray-900 dark:text-white mb-2 flex gap-2"><span className="bg-gray-200 dark:bg-slate-700 w-5 h-5 rounded-full flex items-center justify-center text-xs">3</span> Fazer o Vínculo Final aqui no Lucro Certo</h4>
                                    <ol className="list-decimal list-inside space-y-1 ml-2 text-xs">
                                        <li>Feche esta janela.</li>
                                        <li>Clique no botão branco de <strong>Fazer Login com Meta</strong>.</li>
                                        <li>O Facebook vai abrir. Clique em <strong>Editar configurações / Escolher o que permitir</strong>.</li>
                                        <li>Tenha a certeza absoluta de <strong>marcar a caixinha do seu Instagram e da sua página do Facebook</strong> em todas as telas que aparecerem.</li>
                                        <li>Conclua!</li>
                                    </ol>
                                </div>
                            </div>

                            <div className="mt-8 flex justify-end">
                                <Button onClick={() => setShowInstructions(false)} className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto">
                                    Entendi, vou configurar!
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modal de Nova Campanha IA */}
            {
                isCreatingCampaign && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-gray-100 dark:border-slate-700 my-8">
                            <h3 className="text-lg font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-600 to-indigo-600 flex items-center gap-2">
                                <Rocket size={24} className="text-fuchsia-600" />
                                Lançar Campanha de Marketing
                            </h3>

                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                                Nossa Inteligência Artificial criará um pacote rápido de publicações super interligadas para sua marca num piscar de olhos.
                            </p>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Tema da Campanha
                                    </label>
                                    <Input
                                        placeholder="Ex: Liquidação de Inverno, Semana do Consumidor, Oferta de Relógios..."
                                        value={campaignTheme}
                                        onChange={e => setCampaignTheme(e.target.value)}
                                        className="w-full text-base"
                                        disabled={savingCampaign}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Quantidade de Postagens (Máx 7)
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="range"
                                            min="1"
                                            max="7"
                                            value={campaignCount}
                                            onChange={(e) => setCampaignCount(Number(e.target.value))}
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-fuchsia-600"
                                            disabled={savingCampaign}
                                        />
                                        <span className="font-bold text-fuchsia-600 dark:text-fuchsia-400 min-w-[30px] text-center">
                                            {campaignCount}x
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
                                    <Button
                                        variant="outline"
                                        onClick={() => { setIsCreatingCampaign(false); setCampaignTheme(''); setCampaignCount(3); }}
                                        disabled={savingCampaign}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        onClick={handleSaveCampaign}
                                        className="bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-700 hover:to-indigo-700 text-white"
                                        disabled={savingCampaign}
                                    >
                                        {savingCampaign ? (
                                            <span className="flex items-center gap-2">
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                Gerando Mágica...
                                            </span>
                                        ) : 'Lançar Foguete 🚀'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
        </div>
    );
}
