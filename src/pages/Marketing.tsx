import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useEntity } from '../context/EntityContext';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Save, Megaphone, Instagram, Facebook, Image as ImageIcon, UploadCloud, Unplug } from 'lucide-react';
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

    // Edit post state
    const [editingPost, setEditingPost] = useState<SocialPost | null>(null);
    const [editContent, setEditContent] = useState('');

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
                    .update({ niche, tone, target_audience: audience, approval_whatsapp: cleanPhone })
                    .eq('id', profile.id);
                if (error) throw error;
            } else {
                // Create
                const { error } = await supabase
                    .from('social_profiles')
                    .insert({ company_id: currentEntity.id, niche, tone, target_audience: audience, approval_whatsapp: cleanPhone });
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

    const handleGenerateNow = async () => {
        try {
            setSaving(true);
            const { data: session } = await supabase.auth.getSession();
            const token = session.session?.access_token;

            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/social-copilot-cron`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!res.ok) throw new Error('Não foi possível gerar no momento.');
            alert('A IA foi notificada e já deve ter gerado seu post! Confira o seu WhatsApp em instantes.');
            await fetchPosts();
        } catch (error: any) {
            console.error('Error triggering manual cron', error);
            alert('Falha ao acionar a Inteligência Artificial manualmente.');
        } finally {
            setSaving(false);
        }
    };

    const handleSavePostEdit = async () => {
        if (!editingPost) return;
        try {
            const { error } = await supabase.from('social_posts').update({ content: editContent }).eq('id', editingPost.id);
            if (error) throw error;
            setPosts(posts.map(p => p.id === editingPost.id ? { ...p, content: editContent } : p));
            setEditingPost(null);
            alert('Legenda atualizada com sucesso!');
        } catch (error) {
            console.error('Erro ao editar post:', error);
            alert('Falha ao editar a legenda.');
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
                        <p className="text-sm text-indigo-100 mb-6 relative z-10">
                            Para publicar automaticamente, conecte sua conta comercial do Instagram/Facebook aqui.
                        </p>

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
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Sparkles size={18} className="text-rose-500" />
                            Suas Postagens Geradas pela IA
                        </h2>
                        <div className="flex flex-col sm:flex-row gap-3">
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
                                onClick={handleGenerateNow}
                                disabled={saving || uploadingImage}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm whitespace-nowrap"
                            >
                                🤖 Gerar Postagem IA Agora
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
                                            <span className="text-xs font-bold text-gray-400">
                                                {new Date(post.created_at).toLocaleDateString()}
                                            </span>
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
                                            <Button size="sm" variant="outline" className="text-xs" onClick={() => { setEditingPost(post); setEditContent(post.content); }}>Editar</Button>
                                            <Button size="sm" variant="outline" className="text-xs text-red-500 hover:bg-red-50 border-red-200" onClick={() => handleDeletePost(post.id)}>Excluir</Button>
                                        </div>
                                        {post.status === 'pending' && <Button size="sm" className="bg-rose-500 hover:bg-rose-600 text-white text-xs">Postar Agora</Button>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Modal de Edição de Post */}
            {editingPost && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-gray-100 dark:border-slate-700">
                        <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                            <Megaphone size={20} className="text-rose-500" />
                            Editar Legenda da Postagem
                        </h3>
                        <textarea
                            className="w-full h-56 p-4 border border-gray-200 dark:border-slate-700 rounded-xl resize-none bg-gray-50 dark:bg-slate-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all font-medium"
                            value={editContent}
                            onChange={e => setEditContent(e.target.value)}
                            placeholder="Escreva a legenda incrível aqui..."
                        />
                        <div className="flex justify-end gap-3 mt-6">
                            <Button variant="outline" onClick={() => setEditingPost(null)} className="dark:border-slate-600 dark:text-slate-300">Cancelar</Button>
                            <Button onClick={handleSavePostEdit} className="bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-500/30">Salvar Alterações</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
