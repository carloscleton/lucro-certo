import { useState, useEffect } from 'react';
import { Mail, Save, ExternalLink, ShieldCheck, AlertCircle, Eye, EyeOff, Sparkles, Wand2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useCompanies } from '../../hooks/useCompanies';
import { useEntity } from '../../context/EntityContext';
import { ResultModal } from '../ui/ResultModal';
import axios from 'axios';
import { API_BASE_URL } from '../../lib/constants';
import { supabase } from '../../lib/supabase';

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


const PRESETS: Record<string, string> = {
  default: DEFAULT_HTML_TEMPLATE,
  marketing: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Nota Fiscal e Agradecimento</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1 0%,#4f46e5 100%);padding:40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;">{{companyName}}</h1>
              <p style="margin:8px 0 0;color:#c7d2fe;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">{{invoiceLabel}} Disponível</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#1e293b;font-size:22px;font-weight:800;">Olá, {{clientName}}!</h2>
              <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
                Agradecemos pela preferência e parceria! Sua <strong>{{invoiceLabel}} Nº {{invoiceNumber}}</strong> já foi emitida e está anexada abaixo para sua consulta.
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;border:1px dashed #c084fc;border-radius:12px;margin-bottom:32px;">
                <tr>
                  <td style="padding:20px;text-align:center;">
                    <p style="margin:0 0 4px;color:#7c3aed;font-size:11px;font-weight:800;text-transform:uppercase;">Documento</p>
                    <p style="margin:0;color:#5b21b6;font-size:18px;font-weight:800;">{{invoiceLabel}} Nº {{invoiceNumber}}</p>
                  </td>
                </tr>
              </table>

              {{#if pdfUrl}}
              <div style="text-align:center;margin-bottom:16px;">
                <a href="{{pdfUrl}}" target="_blank" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:700;">
                  📄 Visualizar PDF da Nota
                </a>
              </div>
              {{/if}}

              {{#if xmlUrl}}
              <div style="text-align:center;margin-bottom:24px;">
                <a href="{{xmlUrl}}" target="_blank" style="display:inline-block;background:#f1f5f9;color:#475569;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:600;border:1px solid #e2e8f0;">
                  📁 Baixar XML
                </a>
              </div>
              {{/if}}

              <hr style="border:none;border-top:1px solid #f1f5f9;margin:32px 0;" />
              <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
                Enviado automaticamente por <strong>{{companyName}}</strong>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  cobranca: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Notificação de Nota Fiscal e Cobrança</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
          <tr>
            <td style="background-color:#ef4444;height:6px;"></td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <div style="text-align:center;margin-bottom:32px;">
                <span style="font-size:32px;line-height:1;">⚠️</span>
                <h1 style="margin:12px 0 0;color:#1e293b;font-size:22px;font-weight:800;">Lembrete de Cobrança</h1>
                <p style="margin:4px 0 0;color:#ef4444;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">{{invoiceLabel}} Nº {{invoiceNumber}}</p>
              </div>
              
              <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.6;">
                Olá, <strong>{{clientName}}</strong>,
              </p>
              <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
                Informamos que a <strong>{{invoiceLabel}} Nº {{invoiceNumber}}</strong> no valor correspondente aos serviços prestados por <strong>{{companyName}}</strong> está disponível. Por favor, acesse o documento para verificar os detalhes da fatura e opções de pagamento.
              </p>

              {{#if pdfUrl}}
              <div style="text-align:center;margin-bottom:16px;">
                <a href="{{pdfUrl}}" target="_blank" style="display:inline-block;background:#ef4444;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:700;">
                  💳 Visualizar Nota e Fatura
                </a>
              </div>
              {{/if}}

              {{#if xmlUrl}}
              <div style="text-align:center;margin-bottom:24px;">
                <a href="{{xmlUrl}}" target="_blank" style="display:inline-block;background:#f1f5f9;color:#475569;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:600;border:1px solid #e2e8f0;">
                  📁 Baixar XML
                </a>
              </div>
              {{/if}}

              <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;" />
              <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;line-height:1.6;">
                Se você já efetuou o pagamento desta fatura, favor desconsiderar este e-mail.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  parabens: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Nota Fiscal e Parabéns</title>
</head>
<body style="margin:0;padding:0;background:#fff5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff5f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(244,63,94,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#f43f5e 0%,#ec4899 100%);padding:48px;text-align:center;">
              <span style="font-size:36px;display:block;margin-bottom:8px;line-height:1;">🎉</span>
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:900;">Um Presente para Você!</h1>
              <p style="margin:6px 0 0;color:#ffe4e6;font-size:12px;font-weight:700;text-transform:uppercase;">{{companyName}}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#f43f5e;font-size:20px;font-weight:800;">Olá, {{clientName}}!</h2>
              <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
                Junto com a emissão do seu documento fiscal <strong>{{invoiceLabel}} Nº {{invoiceNumber}}</strong>, gostaríamos de aproveitar para celebrar e deixar um agradecimento especial por sua fidelidade!
              </p>

              {{#if pdfUrl}}
              <div style="text-align:center;margin-bottom:16px;">
                <a href="{{pdfUrl}}" target="_blank" style="display:inline-block;background:#f43f5e;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:700;">
                  📄 Acessar PDF da Nota
                </a>
              </div>
              {{/if}}

              <hr style="border:none;border-top:1px solid #f1f5f9;margin:32px 0;" />
              <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;line-height:1.6;">
                Desejamos muito sucesso e prosperidade para você!
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
};

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
    const companyName = currentCompany?.trade_name || currentCompany?.legal_name || 'Minha Empresa';

    const getPreviewHtml = () => {
        let preview = resendConfig.email_html_template || DEFAULT_HTML_TEMPLATE;
        preview = preview.replace(/\{\{\s*companyName\s*\}\}/g, companyName);
        preview = preview.replace(/\{\{\s*clientName\s*\}\}/g, 'Carlos da Silva');
        preview = preview.replace(/\{\{\s*invoiceNumber\s*\}\}/g, '000123');
        preview = preview.replace(/\{\{\s*invoiceLabel\s*\}\}/g, 'NF-e');
        preview = preview.replace(/\{\{\s*pdfUrl\s*\}\}/g, 'https://exemplo.com/nota.pdf');
        preview = preview.replace(/\{\{\s*xmlUrl\s*\}\}/g, 'https://exemplo.com/nota.xml');
        
        // Parse conditional blocks
        const parseConditionalBlock = (html: string, variableName: string, value: any) => {
            const regex = new RegExp(`\\{\\{\\s*#if\\s+${variableName}\\s*\\}\\}([\\s\\S]*?)\\{\\{\\s*\\/if\\s*\\}\\}`, 'g');
            return value ? html.replace(regex, '$1') : html.replace(regex, '');
        };
        preview = parseConditionalBlock(preview, 'pdfUrl', true);
        preview = parseConditionalBlock(preview, 'xmlUrl', true);

        return preview;
    };

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

    const [aiPrompt, setAiPrompt] = useState('');
    const [isGeneratingAi, setIsGeneratingAi] = useState(false);

    const handleGenerateWithAi = async () => {
        if (!aiPrompt.trim()) return;

        setIsGeneratingAi(true);
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;

            if (!token) {
                alert('Sessão expirada. Faça login novamente.');
                return;
            }

            const res = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/social-copilot-magic`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        company_id: currentEntity.id,
                        topic: aiPrompt,
                        mode: 'email_template_magic'
                    })
                }
            );

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao gerar com IA.');

            if (data.html) {
                setResendConfig(prev => ({ ...prev, email_html_template: data.html }));
                setAiPrompt('');
            } else {
                alert('Nenhum HTML retornado pela IA.');
            }
        } catch (err: any) {
            console.error('AI Email Generation error:', err);
            alert(err.message || 'Erro ao gerar e-mail com IA. Tente novamente.');
        } finally {
            setIsGeneratingAi(false);
        }
    };

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
                companyName,
                subject: `[Teste de Layout] NF-e Nº 000123 - ${companyName}`,
                htmlBody: getPreviewHtml()
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

                    {/* Painel de Ajuda / Instruções do Gmail */}
                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 p-5 rounded-2xl space-y-2.5 text-amber-850 dark:text-amber-400">
                        <p className="font-extrabold flex items-center gap-1.5 text-amber-900 dark:text-amber-300 text-sm">
                            <AlertCircle size={16} /> Instruções para Configurar Contas do Gmail:
                        </p>
                        <ol className="list-decimal list-inside space-y-1.5 font-medium leading-relaxed text-xs">
                            <li>
                                <strong>Porta e Conexão Segura:</strong> Se preencher a porta como <strong>587</strong> (recomendado), o interruptor "Conexão Segura (SSL/TLS)" no final deve estar <strong>DESATIVADO</strong>. Se utilizar a porta <strong>465</strong>, o interruptor deve estar <strong>ATIVADO</strong>.
                            </li>
                            <li>
                                <strong>Senha Especial (Senha de App):</strong> O Gmail bloqueia conexões feitas com a sua senha comum de login. Você precisa obrigatoriamente criar uma <strong>Senha de App</strong> no Google:
                                <ul className="list-disc list-inside pl-5 mt-1.5 space-y-1 text-[11px] font-bold text-amber-800 dark:text-amber-450">
                                    <li>Acesse sua <a href="https://myaccount.google.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-950 dark:hover:text-amber-300">Conta Google (clique aqui)</a>.</li>
                                    <li>No menu esquerdo, vá em <strong>Segurança</strong> e certifique-se de que a <strong>Verificação em Duas Etapas</strong> está ativa.</li>
                                    <li>Pesquise por <strong>"Senhas de App"</strong> na barra de buscas superior e clique na opção.</li>
                                    <li>Digite um nome de identificação (ex: <code>Lucro Certo</code>) e clique em criar.</li>
                                    <li>O Google exibirá um código temporário de <strong>16 letras</strong>. Copie e cole esse código no campo <strong>Senha / Senha de App</strong> abaixo.</li>
                                </ul>
                            </li>
                        </ol>
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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

                {/* Presets Gallery */}
                <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">Escolha uma Base de Layout:</label>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setResendConfig(prev => ({ ...prev, email_html_template: PRESETS.default }))}
                            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/40 border border-indigo-150 dark:border-indigo-900/30 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5 transition-all"
                        >
                            <Mail size={14} /> Modelo Padrão
                        </button>
                        <button
                            type="button"
                            onClick={() => setResendConfig(prev => ({ ...prev, email_html_template: PRESETS.marketing }))}
                            className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/40 border border-purple-150 dark:border-purple-900/30 rounded-xl text-xs font-bold text-purple-700 dark:text-purple-400 flex items-center gap-1.5 transition-all"
                        >
                            <Sparkles size={14} /> Marketing / Agradecimento
                        </button>
                        <button
                            type="button"
                            onClick={() => setResendConfig(prev => ({ ...prev, email_html_template: PRESETS.cobranca }))}
                            className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/40 border border-rose-150 dark:border-rose-900/30 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5 transition-all"
                        >
                            <AlertCircle size={14} /> Lembrete de Cobrança
                        </button>
                        <button
                            type="button"
                            onClick={() => setResendConfig(prev => ({ ...prev, email_html_template: PRESETS.parabens }))}
                            className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/40 border border-amber-150 dark:border-amber-900/30 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 transition-all"
                        >
                            <Sparkles size={14} /> Notificação Festiva (Parabéns)
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* Left Column: Editor */}
                    <div className="space-y-4">
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
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Código HTML Customizado</label>
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <input
                                        type="text"
                                        value={aiPrompt}
                                        onChange={(e) => setAiPrompt(e.target.value)}
                                        placeholder="Escreva com IA (ex: E-mail azul formal)..."
                                        className="flex-1 sm:w-60 px-3 py-1.5 text-xs border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-800 dark:text-slate-100"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleGenerateWithAi();
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        disabled={isGeneratingAi || !aiPrompt.trim()}
                                        onClick={handleGenerateWithAi}
                                        className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                                    >
                                        {isGeneratingAi ? (
                                            <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                        ) : (
                                            <Wand2 size={13} />
                                        )}
                                        Gerar com IA
                                    </button>
                                </div>
                            </div>
                            <textarea
                                className="w-full h-[400px] font-mono text-xs p-4 bg-gray-50 dark:bg-slate-900 text-gray-800 dark:text-slate-200 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none shadow-inner"
                                value={resendConfig.email_html_template}
                                onChange={(e) => setResendConfig({ ...resendConfig, email_html_template: e.target.value })}
                                placeholder="Cole aqui seu código HTML..."
                            />
                        </div>
                    </div>

                    {/* Right Column: Live Preview */}
                    <div className="space-y-2 flex flex-col justify-between">
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Visualização em Tempo Real (Preview)</label>
                        <div className="border border-gray-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-gray-50 dark:bg-slate-900 flex-1 flex flex-col min-h-[400px]">
                            {/* Inbox header mockup */}
                            <div className="bg-white dark:bg-slate-800 p-3 border-b border-gray-150 dark:border-slate-700 space-y-1 text-[10px] font-medium">
                                <div><span className="text-gray-400 font-bold">De:</span> <span className="text-gray-850 dark:text-gray-200 font-bold">{companyName} &lt;nfe@suaempresa.com.br&gt;</span></div>
                                <div><span className="text-gray-400 font-bold">Para:</span> <span className="text-gray-855 dark:text-gray-200">Carlos da Silva &lt;carlos.silva@exemplo.com&gt;</span></div>
                                <div><span className="text-gray-400 font-bold">Assunto:</span> <span className="text-indigo-650 dark:text-indigo-400 font-bold">NF-e Nº 000123 - {companyName}</span></div>
                            </div>
                            <div className="p-3 bg-gray-100 dark:bg-slate-950 flex-1 flex">
                                <iframe
                                    title="Email Settings Live Preview"
                                    srcDoc={getPreviewHtml()}
                                    className="w-full h-full min-h-[380px] border border-gray-250 dark:border-slate-800 rounded-xl bg-white"
                                    sandbox="allow-same-origin"
                                />
                            </div>
                        </div>
                    </div>
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
