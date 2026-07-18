import { useState, useEffect } from 'react';
import { Mail, Save, ExternalLink, ShieldCheck, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useCompanies } from '../../hooks/useCompanies';
import { useEntity } from '../../context/EntityContext';
import { ResultModal } from '../ui/ResultModal';
import axios from 'axios';
import { API_BASE_URL } from '../../lib/constants';

const DEFAULT_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nota Fiscal Eletrônica</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);padding:40px 40px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">{{companyName}}</h1>
              <p style="margin:8px 0 0;color:#a8b4c8;font-size:14px;letter-spacing:1px;text-transform:uppercase;">{{invoiceLabel}} Eletrônica</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 8px;color:#64748b;font-size:14px;">Olá,</p>
              <h2 style="margin:0 0 24px;color:#1e293b;font-size:22px;font-weight:700;">{{clientName}} 👋</h2>
              <p style="margin:0 0 24px;color:#475569;font-size:16px;line-height:1.6;">
                Sua <strong>{{invoiceLabel}} Nº {{invoiceNumber}}</strong> foi emitida com sucesso e está disponível para acesso.
              </p>
              <!-- Destaque -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;margin-bottom:32px;">
                <tr>
                  <td style="padding:24px;">
                    <p style="margin:0 0 4px;color:#0369a1;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Documento Emitido</p>
                    <p style="margin:0;color:#0c4a6e;font-size:18px;font-weight:700;">{{invoiceLabel}} Nº {{invoiceNumber}}</p>
                  </td>
                </tr>
              </table>
              <!-- Botão PDF -->
              {{#if pdfUrl}}
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td align="center">
                    <a href="{{pdfUrl}}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#0f3460,#1a1a2e);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:0.5px;">
                      📄 Visualizar PDF da Nota
                    </a>
                  </td>
                </tr>
              </table>
              {{/if}}
              <!-- Botão XML -->
              {{#if xmlUrl}}
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td align="center">
                    <a href="{{xmlUrl}}" target="_blank" style="display:inline-block;background:#f1f5f9;color:#475569;text-decoration:none;padding:12px 32px;border-radius:10px;font-size:14px;font-weight:600;border:1px solid #e2e8f0;">
                      📁 Baixar XML
                    </a>
                  </td>
                </tr>
              </table>
              {{/if}}
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;" />
              <p style="margin:0;color:#94a3b8;font-size:13px;text-align:center;line-height:1.6;">
                Este e-mail foi enviado automaticamente por <strong>{{companyName}}</strong>.<br/>
                Em caso de dúvidas, entre em contato conosco.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#cbd5e1;font-size:12px;">Powered by <strong>Lucro Certo</strong> &bull; Sistema de Gestão Fiscal</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

export function EmailSettings() {
    const { currentEntity, refresh: refreshEntity } = useEntity();
    const { companies, updateCompany } = useCompanies();
    const [saving, setSaving] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [resendConfig, setResendConfig] = useState({
        provider: 'resend',
        apiKey: '',
        fromEmail: '',
        sent_count: 0,
        has_paid_plan: false,
        email_html_template: '',
        smtp_host: '',
        smtp_port: 587,
        smtp_user: '',
        smtp_pass: '',
        smtp_secure: false
    });

    const [resultModal, setResultModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'success' as 'success' | 'error' | 'info'
    });

    const currentCompany = companies.find(c => c.id === currentEntity.id);

    useEffect(() => {
        if (!currentCompany) return;
        const resend = currentCompany.settings?.resend_config || {};
        setResendConfig({
            provider: resend.provider || 'resend',
            apiKey: resend.apiKey || '',
            fromEmail: resend.fromEmail || '',
            sent_count: Number(resend.sent_count || 0),
            has_paid_plan: !!resend.has_paid_plan,
            email_html_template: resend.email_html_template || '',
            smtp_host: resend.smtp_host || '',
            smtp_port: Number(resend.smtp_port || 587),
            smtp_user: resend.smtp_user || '',
            smtp_pass: resend.smtp_pass || '',
            smtp_secure: !!resend.smtp_secure
        });
    }, [currentCompany?.id]);

    const [testing, setTesting] = useState(false);
    const [showTestModal, setShowTestModal] = useState(false);
    const [testEmail, setTestEmail] = useState('');

    const handleTestSend = async () => {
        if (!testEmail) {
            alert('Por favor, informe o e-mail de destino.');
            return;
        }

        setTesting(true);
        try {
            const base = API_BASE_URL.replace(/\/$/, '');
            const response = await axios.post(`${base}/send-email/test`, {
                provider: resendConfig.provider,
                to: testEmail,
                resendConfig,
                companyName: currentCompany?.trade_name || currentCompany?.legal_name || 'Minha Empresa'
            });

            if (response.data.success) {
                setShowTestModal(false);
                setResultModal({
                    isOpen: true,
                    title: 'Envio Realizado',
                    message: response.data.message || 'E-mail de teste enviado com sucesso!',
                    type: 'success'
                });
            }
        } catch (err: any) {
            console.error('Erro no envio de teste:', err);
            const detailedMessage = 
                err.response?.data?.detail?.message || 
                (typeof err.response?.data?.detail === 'string' ? err.response?.data?.detail : null) ||
                err.response?.data?.message || 
                err.response?.data?.error || 
                err.message || 
                'Erro ao enviar e-mail de teste.';
            setResultModal({
                isOpen: true,
                title: 'Falha no Teste',
                message: detailedMessage,
                type: 'error'
            });
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async () => {
        if (!currentEntity.id || currentEntity.type === 'personal') {
            setResultModal({
                isOpen: true,
                title: 'Aviso',
                message: 'Configurações de e-mail são exclusivas para empresas. Mude o contexto no topo.',
                type: 'info'
            });
            return;
        }

        setSaving(true);
        try {
            const updatedSettings = {
                ...(currentCompany?.settings || {}),
                resend_config: resendConfig
            };

            await updateCompany(currentEntity.id, {
                settings: updatedSettings
            });

            await refreshEntity();

            setResultModal({
                isOpen: true,
                title: 'Sucesso',
                message: 'As configurações de e-mail e template foram salvas.',
                type: 'success'
            });
        } catch (error: any) {
            console.error(error);
            setResultModal({
                isOpen: true,
                title: 'Erro ao Salvar',
                message: 'Não foi possível salvar as configurações: ' + (error.message || ''),
                type: 'error'
            });
        } finally {
            setSaving(false);
        }
    };

    const handleRestoreDefault = () => {
        setResendConfig(prev => ({
            ...prev,
            email_html_template: DEFAULT_HTML_TEMPLATE
        }));
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 text-blue-655 rounded-xl">
                    <Mail size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Configurações de E-mail</h1>
                    <p className="text-gray-500 font-bold">Gerencie o método de envio de e-mails da sua empresa e customize seus templates HTML.</p>
                </div>
            </div>

            {/* Seletor de Provedor */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
                <label className="block text-sm font-bold text-gray-900 dark:text-white">Selecione o Método de Envio de E-mail</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                        type="button"
                        onClick={() => setResendConfig(prev => ({ ...prev, provider: 'resend' }))}
                        className={`p-4 rounded-xl border flex flex-col items-start gap-2 text-left transition-all ${
                            resendConfig.provider === 'resend'
                                ? 'border-blue-600 bg-blue-50/30 ring-2 ring-blue-500/20'
                                : 'border-gray-200 hover:border-gray-300 dark:border-slate-700'
                        }`}
                    >
                        <span className="font-bold text-sm text-gray-900 dark:text-white">Resend API (Domínio Próprio)</span>
                        <span className="text-xs text-gray-500 font-medium">Recomendado para quem possui domínio próprio (White-label). Entrega profissional rápida.</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setResendConfig(prev => ({ ...prev, provider: 'smtp' }))}
                        className={`p-4 rounded-xl border flex flex-col items-start gap-2 text-left transition-all ${
                            resendConfig.provider === 'smtp'
                                ? 'border-blue-600 bg-blue-50/30 ring-2 ring-blue-500/20'
                                : 'border-gray-200 hover:border-gray-300 dark:border-slate-700'
                        }`}
                    >
                        <span className="font-bold text-sm text-gray-900 dark:text-white">Servidor SMTP (Gmail, Outlook, etc.)</span>
                        <span className="text-xs text-gray-500 font-medium">Ideal para quem usa e-mail comum (@gmail, @outlook). Sem custo e não exige domínio próprio.</span>
                    </button>
                </div>
            </div>

            {/* Credenciais e Cota */}
            {resendConfig.provider === 'smtp' ? (
                /* SMTP credentials card */
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-6 animate-in fade-in duration-300">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl">
                            <ShieldCheck size={24} />
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900 dark:text-white">Configuração do Servidor SMTP</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Insira as credenciais do seu e-mail para que o sistema realize os disparos diretamente através da sua conta.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Input
                            label="Servidor SMTP (Host)"
                            value={resendConfig.smtp_host || ''}
                            onChange={(e: any) => setResendConfig({ ...resendConfig, smtp_host: e.target.value })}
                            placeholder="smtp.gmail.com"
                            preserveCase={true}
                            helpText="Endereço do servidor (ex: smtp.gmail.com para Gmail)."
                        />

                        <Input
                            label="Porta SMTP"
                            type="number"
                            value={resendConfig.smtp_port || 587}
                            onChange={(e: any) => setResendConfig({ ...resendConfig, smtp_port: Number(e.target.value) })}
                            placeholder="587"
                            helpText="Geralmente 587 (TLS) ou 465 (SSL)."
                        />

                        <Input
                            label="E-mail do Remetente"
                            value={resendConfig.fromEmail || ''}
                            onChange={(e: any) => setResendConfig({ ...resendConfig, fromEmail: e.target.value })}
                            placeholder="Ex: Notas <empresa@gmail.com>"
                            preserveCase={true}
                            helpText="O mesmo e-mail do usuário de envio."
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input
                            label="Usuário SMTP (E-mail)"
                            value={resendConfig.smtp_user || ''}
                            onChange={(e: any) => setResendConfig({ ...resendConfig, smtp_user: e.target.value })}
                            placeholder="empresa@gmail.com"
                            preserveCase={true}
                            helpText="Seu endereço de e-mail completo."
                        />

                        <div className="relative">
                            <Input
                                label="Senha / Senha de App"
                                type={showApiKey ? 'text' : 'password'}
                                value={resendConfig.smtp_pass || ''}
                                onChange={(e: any) => setResendConfig({ ...resendConfig, smtp_pass: e.target.value })}
                                placeholder="Sua senha..."
                                preserveCase={true}
                                helpText="No Gmail, use uma 'Senha de App' gerada na sua Conta Google."
                            />
                            <button
                                type="button"
                                onClick={() => setShowApiKey(!showApiKey)}
                                className="absolute right-3 top-[32px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                {showApiKey ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-slate-900/40 rounded-xl border border-gray-150 dark:border-slate-800">
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={resendConfig.smtp_secure || false}
                                onChange={(e) => setResendConfig({ ...resendConfig, smtp_secure: e.target.checked })}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                        <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">Conexão Segura (SSL/TLS)</p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold">Ative obrigatoriamente se estiver utilizando a porta 465.</p>
                        </div>
                    </div>
                </div>
            ) : (
                /* Credenciais e Cota Resend */
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl">
                            <ShieldCheck size={24} />
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900 dark:text-white">Credenciais do Resend</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Configure sua API Key e domínio de remetente para permitir que a plataforma envie e-mails em seu nome.
                            </p>
                        </div>
                    </div>

                    {!resendConfig.apiKey && (
                        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 p-4 rounded-xl flex items-start gap-3">
                            <AlertCircle className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" size={18} />
                            <div>
                                <p className="text-xs font-bold text-blue-800 dark:text-blue-400 uppercase tracking-wider">Servidor Padrão Ativo</p>
                                <p className="text-xs text-blue-700 dark:text-blue-500 mt-0.5 font-bold">
                                    Sua empresa está utilizando o servidor de e-mail compartilhado da plataforma. Caso queira utilizar a sua própria marca e domínio personalizado como remetente (White-label), preencha sua API Key e E-mail de Remetente do Resend abaixo.
                                </p>
                            </div>
                        </div>
                    )}

                    {resendConfig.apiKey && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
                                <span>Consumo Mensal de E-mails</span>
                                <span>
                                    {resendConfig.has_paid_plan ? (
                                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold">
                                            <ShieldCheck size={14} /> Plano Pago (Sem Limites)
                                        </span>
                                    ) : (
                                        `${resendConfig.sent_count} / 3.000`
                                    )}
                                </span>
                            </div>
                            {!resendConfig.has_paid_plan && (
                                <div className="w-full bg-gray-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full transition-all duration-500 rounded-full ${
                                            resendConfig.sent_count >= 2700 
                                                ? 'bg-rose-500' 
                                                : resendConfig.sent_count >= 2000 
                                                    ? 'bg-amber-500' 
                                                    : 'bg-blue-650'
                                        }`}
                                        style={{ width: `${Math.min(100, (resendConfig.sent_count / 3000) * 100)}%` }}
                                    ></div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="relative">
                            <Input
                                label="Chave de API do Resend"
                                type={showApiKey ? 'text' : 'password'}
                                value={resendConfig.apiKey}
                                onChange={(e: any) => setResendConfig({ ...resendConfig, apiKey: e.target.value })}
                                placeholder="re_..."
                                preserveCase={true}
                                helpText="Insira sua API Key gerada no painel do Resend (resend.com)."
                            />
                            <button
                                type="button"
                                onClick={() => setShowApiKey(!showApiKey)}
                                className="absolute right-3 top-[32px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                {showApiKey ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>

                        <Input
                            label="E-mail do Remetente"
                            value={resendConfig.fromEmail}
                            onChange={(e: any) => setResendConfig({ ...resendConfig, fromEmail: e.target.value })}
                            placeholder="Ex: Notas Fiscais <nfe@suaempresa.com.br>"
                            preserveCase={true}
                            helpText="Deve ser um domínio configurado e verificado no seu painel do Resend."
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-slate-900/40 rounded-xl border border-gray-150 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={resendConfig.has_paid_plan || false}
                                    onChange={(e) => setResendConfig({ ...resendConfig, has_paid_plan: e.target.checked })}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                            </label>
                            <div>
                                <p className="text-sm font-bold text-gray-900 dark:text-white">Possuo Plano Pago no Resend</p>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold">Ative para remover a trava de 3.000 envios de e-mail gratuitos da plataforma.</p>
                            </div>
                        </div>

                        <a 
                            href="https://resend.com/pricing" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs font-extrabold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 self-start sm:self-auto"
                        >
                            <ExternalLink size={14} />
                            Fazer Upgrade no Resend
                        </a>
                    </div>
                </div>
            )}

            {/* Template HTML */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-xl">
                            <Mail size={24} />
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900 dark:text-white">Template HTML do E-mail</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Personalize o corpo do e-mail de envio da Nota Fiscal. Use HTML válido e as variáveis suportadas.
                            </p>
                        </div>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleRestoreDefault}
                        className="text-xs font-bold border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                    >
                        Restaurar Padrão
                    </Button>
                </div>

                {/* Placeholders list */}
                <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                    <p className="text-xs font-bold text-indigo-800 dark:text-indigo-400 uppercase tracking-wider mb-2">Variáveis Dinâmicas Disponíveis</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px] font-mono font-bold text-indigo-700 dark:text-indigo-300">
                        <div>{"{{companyName}}"} - Sua empresa</div>
                        <div>{"{{clientName}}"} - Destinatário</div>
                        <div>{"{{invoiceNumber}}"} - Número da Nota</div>
                        <div>{"{{invoiceLabel}}"} - Tipo (NF-e/NFS-e)</div>
                        <div>{"{{pdfUrl}}"} - Link do PDF</div>
                        <div>{"{{xmlUrl}}"} - Link do XML</div>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Código HTML Customizado</label>
                    <textarea
                        className="w-full h-80 font-mono text-xs p-4 bg-gray-50 dark:bg-slate-900 text-gray-800 dark:text-slate-200 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        value={resendConfig.email_html_template}
                        onChange={(e) => setResendConfig({ ...resendConfig, email_html_template: e.target.value })}
                        placeholder="Cole aqui seu código HTML..."
                    />
                </div>
            </div>

            <div className="flex justify-end gap-3">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                        setTestEmail('');
                        setShowTestModal(true);
                    }}
                    className="border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 font-extrabold text-sm rounded-xl px-6 py-2.5 flex items-center gap-2"
                >
                    <Mail size={18} />
                    Testar Envio
                </Button>
                <Button
                    type="button"
                    onClick={handleSave}
                    isLoading={saving}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-xl px-6 py-2.5 flex items-center gap-2 shadow-sm"
                >
                    <Save size={18} />
                    Salvar Configurações
                </Button>
            </div>

            {/* Modal de Digitar E-mail de Teste */}
            {showTestModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-250 dark:border-slate-700 shadow-2xl p-6 max-w-md w-full space-y-4 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl">
                                <Mail size={22} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Enviar E-mail de Teste</h3>
                                <p className="text-xs text-gray-500">Valide suas credenciais antes de salvar.</p>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">Endereço de E-mail de Destino</label>
                            <input
                                type="email"
                                value={testEmail}
                                onChange={(e) => setTestEmail(e.target.value)}
                                placeholder="exemplo@gmail.com"
                                className="w-full text-sm p-3 bg-gray-50 dark:bg-slate-900 text-gray-800 dark:text-slate-200 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowTestModal(false)}
                                className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleTestSend}
                                disabled={testing}
                                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-extrabold text-xs rounded-xl px-4 py-2 flex items-center gap-2 shadow-sm"
                            >
                                {testing ? 'Enviando...' : 'Enviar Teste'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Resultado */}
            <ResultModal
                isOpen={resultModal.isOpen}
                onClose={() => setResultModal(prev => ({ ...prev, isOpen: false }))}
                title={resultModal.title}
                message={resultModal.message}
                type={resultModal.type}
            />
        </div>
    );
}
