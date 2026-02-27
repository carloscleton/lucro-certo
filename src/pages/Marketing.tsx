import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useEntity } from '../context/EntityContext';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Save, Megaphone, Instagram, Facebook } from 'lucide-react';
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

    useEffect(() => {
        if (currentEntity.type === 'company' && user) {
            fetchProfile();
        } else {
            setLoading(false);
        }
    }, [currentEntity.id, user]);

    const fetchProfile = async () => {
        try {
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
                setApprovalWhatsapp(profileData.approval_whatsapp || '');
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
            if (profile) {
                // Update
                const { error } = await supabase
                    .from('social_profiles')
                    .update({ niche, tone, target_audience: audience, approval_whatsapp: approvalWhatsapp })
                    .eq('id', profile.id);
                if (error) throw error;
            } else {
                // Create
                const { error } = await supabase
                    .from('social_profiles')
                    .insert({ company_id: currentEntity.id, niche, tone, target_audience: audience, approval_whatsapp: approvalWhatsapp });
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
                                    onChange={(e) => setApprovalWhatsapp(e.target.value)}
                                    placeholder="Ex: 5511999999999"
                                    maxLength={20}
                                />
                                <p className="text-xs text-gray-500 mt-1">Este número receberá a notificação matinal com a postagem pronta.</p>
                                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs rounded-lg border border-blue-100 dark:border-blue-800/50">
                                    <strong>Atenção:</strong> Para que a notificação de aprovação seja enviada com sucesso, sua empresa precisa ter pelo menos <strong>uma conexão de WhatsApp ativa</strong> configurada no módulo "WhatsApp".
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
                        <p className="text-sm text-indigo-100 mb-6 relative z-10">
                            Para publicar automaticamente, conecte sua conta comercial do Instagram/Facebook aqui.
                        </p>

                        <Button
                            className="w-full bg-white text-indigo-600 hover:bg-gray-50 flex items-center justify-center gap-2 font-bold shadow-lg"
                        >
                            <Facebook size={18} />
                            Fazer Login com Meta
                        </Button>
                        <p className="text-[10px] text-center mt-3 text-indigo-200 opacity-80">
                            Integração 100% oficial e segura. (Em breve nas próximas Fases)
                        </p>
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
                        <Button
                            onClick={handleGenerateNow}
                            disabled={saving}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm whitespace-nowrap"
                        >
                            🤖 Gerar Postagem IA Agora
                        </Button>
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
                                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{post.content}</p>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between">
                                        <Button size="sm" variant="outline" className="text-xs">Editar</Button>
                                        {post.status === 'pending' && <Button size="sm" className="bg-rose-500 hover:bg-rose-600 text-white text-xs">Postar Agora</Button>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
