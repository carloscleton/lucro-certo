import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { CheckCircle, XCircle, Loader } from 'lucide-react';

export function AcceptInvite() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();
    const { user, loading: authLoading, signOut } = useAuth();

    const [status, setStatus] = useState<'validating' | 'success' | 'error'>('validating');
    const [message, setMessage] = useState('Validando convite...');

    const [debugLog, setDebugLog] = useState<string[]>([]);

    const addLog = (msg: string) => setDebugLog(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);

    useEffect(() => {
        if (authLoading) return;

        if (!user) {
            setStatus('error');
            setMessage('Você precisa estar logado para aceitar o convite.');
            addLog('User not logged in.');
            return;
        }

        if (!token) {
            setStatus('error');
            setMessage('Token de convite não encontrado.');
            addLog('Invite token not found in URL.');
            return;
        }

        const validateAndAccept = async () => {
            addLog(`User: ${user.email} (${user.id})`);
            addLog(`Token: ${token}`);

            try {
                // 1. Check existing membership
                const { data: existingMembers, error: memberError } = await supabase
                    .from('company_members')
                    .select('*')
                    .eq('user_id', user.id);

                addLog(`Existing memberships: ${existingMembers?.length || 0} rows. Error: ${memberError?.message || 'none'}`);
                if (existingMembers && existingMembers.length > 0) {
                    addLog(`Member of: ${JSON.stringify(existingMembers)}`);
                }

                // 2. Fetch invite details (using RPC to bypass RLS)
                const { data: inviteData, error: inviteError } = await supabase
                    .rpc('get_invite_by_token', { check_token: token });

                const invite = inviteData && inviteData.length > 0 ? inviteData[0] : null;

                addLog(`Invite search result: ${invite ? 'Found' : 'Not Found'}. Error: ${inviteError?.message || 'none'}`);

                if (invite) {
                    addLog(`Invite for: ${invite.email}`);
                    // Check expiration
                    if (new Date(invite.expires_at) < new Date()) {
                        setStatus('error');
                        setMessage('Este convite expirou.');
                        addLog('Invite expired.');
                        return;
                    }

                    // Check email mismatch
                    if (invite.email.toLowerCase() !== user.email?.toLowerCase()) {
                        setStatus('error');
                        setMessage(`Este convite foi enviado para ${invite.email}, mas você está logado como ${user.email}. Por favor, saia e entre com a conta correta.`);
                        addLog('Email mismatch detected.');
                        return;
                    }
                } else {
                    setStatus('error');
                    setMessage('Convite não encontrado ou já utilizado.');
                    addLog('Invite not found or already used.');
                    return;
                }

                // 3. Attempt RPC
                addLog('Calling accept_invite RPC...');
                const { data, error } = await supabase.rpc('accept_invite', {
                    token_input: token
                });

                if (error) {
                    addLog(`RPC Error: ${error.message}`);
                    throw error;
                }

                addLog(`RPC Result: ${JSON.stringify(data)}`);

                if (data && data.success) {
                    setStatus('success');
                    setMessage('Convite aceito com sucesso! Redirecionando...');
                    // Don't redirect immediately so user can see logs
                    // setTimeout(() => {
                    //     navigate('/');
                    //     window.location.reload();
                    // }, 5000);
                } else {
                    setStatus('error');
                    setMessage(data?.message || 'Erro ao aceitar convite.');
                    addLog(`RPC returned success: false. Message: ${data?.message || 'No message'}`);
                }
            } catch (err: any) {
                console.error('Invite Error:', err);
                setStatus('error');
                setMessage('Erro ao processar convite: ' + err.message);
                addLog(`Exception: ${err.message}`);
            }
        };

        validateAndAccept();
    }, [user, authLoading, token, navigate]);

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
                <div className="text-center">
                    <Loader className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-300">Carregando...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-4">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg max-w-md w-full text-center space-y-6">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto">
                        <UserIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Faça Login</h1>
                        <p className="text-gray-500 dark:text-gray-400">
                            Para aceitar o convite, você precisa entrar na sua conta com o email convidado.
                        </p>
                    </div>
                    <div className="space-y-3">
                        <Button
                            onClick={() => navigate('/login?mode=signup&redirectTo=' + encodeURIComponent(window.location.search))}
                            className="w-full"
                        >
                            Criar Conta Agora
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => navigate('/login?redirectTo=' + encodeURIComponent(window.location.search))}
                            className="w-full"
                        >
                            Já tenho conta
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900 p-4">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg max-w-md w-full text-center space-y-6 mb-8">
                {status === 'validating' && (
                    <>
                        <Loader className="w-16 h-16 text-blue-600 animate-spin mx-auto" />
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Processando convite...</h2>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                            <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Sucesso!</h2>
                            <p className="text-gray-500 dark:text-gray-400">{message}</p>
                        </div>
                        <Button onClick={() => { navigate('/'); window.location.reload(); }} className="w-full">
                            Ir para o Dashboard
                        </Button>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto">
                            <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Ops!</h2>
                            <p className="text-red-500 dark:text-red-400 font-medium">{message}</p>
                        </div>
                        <div className="space-y-3">
                            {message.includes('você está logado como') ? (
                                <Button
                                    onClick={async () => {
                                        await signOut(); // Ensure signOut from context is used
                                        navigate('/login?redirectTo=' + encodeURIComponent(window.location.search));
                                    }}
                                    className="w-full bg-red-600 hover:bg-red-700 text-white"
                                >
                                    Sair e Entrar com a conta correta
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        onClick={() => navigate('/login?mode=signup&redirectTo=' + encodeURIComponent(window.location.search))}
                                        className="w-full"
                                    >
                                        Criar Conta Agora
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => navigate('/login?redirectTo=' + encodeURIComponent(window.location.search))}
                                        className="w-full"
                                    >
                                        Já tenho conta
                                    </Button>
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Debug Log Section */}
            <div className="w-full max-w-2xl bg-black text-green-400 p-4 rounded-lg font-mono text-xs overflow-auto max-h-64 shadow-2xl border border-gray-700">
                <h3 className="text-white font-bold mb-2 border-b border-gray-700 pb-1">Diagnóstico (Debug Log)</h3>
                {debugLog.map((log, i) => (
                    <div key={i} className="whitespace-nowrap">{log}</div>
                ))}
                {debugLog.length === 0 && <div>Aguardando logs...</div>}
            </div>
        </div>
    );
}

function UserIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    )
}
