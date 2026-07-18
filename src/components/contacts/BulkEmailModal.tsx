import { useState, useRef } from "react";
import {
  Mail,
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  Wand2,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { ResultModal } from "../ui/ResultModal";
import type { Contact } from "../../hooks/useContacts";
import { useEntity } from "../../context/EntityContext";
import { useCompanies } from "../../hooks/useCompanies";
import axios from "axios";
import { API_BASE_URL } from "../../lib/constants";
import { supabase } from "../../lib/supabase";

interface BulkEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedContacts: Contact[];
  onSuccess?: () => void;
}

const TEMPLATES = {
  marketing: {
    id: "marketing",
    name: "Marketing & Novidades",
    badgeColor: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/30",
    subject: "Novidades Imperdíveis da {{companyName}}!",
    html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Novidades de {{companyName}}</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1 0%,#4f46e5 100%);padding:48px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;">{{companyName}}</h1>
              <p style="margin:10px 0 0;color:#c7d2fe;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Novidade Exclusiva para Você</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 12px;color:#4f46e5;font-size:14px;font-weight:700;text-transform:uppercase;">Olá, {{name}}!</p>
              <h2 style="margin:0 0 20px;color:#1e293b;font-size:22px;font-weight:800;">Temos uma novidade incrível para compartilhar!</h2>
              <p style="margin:0 0 24px;color:#475569;font-size:16px;line-height:1.6;">
                Estamos muito felizes em apresentar nossa mais nova linha de soluções projetada especialmente para ajudar o seu negócio a crescer com eficiência e lucratividade.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f9ff;border:1px dashed #bae6fd;border-radius:12px;margin-bottom:32px;">
                <tr>
                  <td style="padding:24px;text-align:center;">
                    <p style="margin:0 0 8px;color:#0369a1;font-size:13px;font-weight:800;text-transform:uppercase;">Oferta de Lançamento</p>
                    <p style="margin:0 0 16px;color:#0c4a6e;font-size:20px;font-weight:850;">Ganhe 20% de Desconto na primeira adesão!</p>
                    <a href="#" style="display:inline-block;background-color:#0284c7;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;">Aproveitar Agora</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;color:#94a3b8;font-size:13px;text-align:center;">
                Este e-mail foi enviado por <strong>{{companyName}}</strong> para {{email}}.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  cobranca: {
    id: "cobranca",
    name: "Lembrete de Cobrança",
    badgeColor: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400 border-rose-200 dark:border-rose-900/30",
    subject: "Lembrete Importante: Fatura em Aberto - {{companyName}}",
    html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Lembrete de Pagamento</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
          <tr><td style="background-color:#ef4444;height:6px;"></td></tr>
          <tr>
            <td style="padding:40px;">
              <div style="text-align:center;margin-bottom:32px;">
                <span style="font-size:32px;line-height:1;">⚠️</span>
                <h1 style="margin:12px 0 0;color:#1e293b;font-size:22px;font-weight:800;">Lembrete de Pagamento</h1>
                <p style="margin:4px 0 0;color:#ef4444;font-size:12px;font-weight:700;text-transform:uppercase;">Fatura em Aberto</p>
              </div>
              <p style="margin:0 0 16px;color:#475569;font-size:16px;line-height:1.6;">Olá, <strong>{{name}}</strong>,</p>
              <p style="margin:0 0 24px;color:#475569;font-size:16px;line-height:1.6;">
                Lembramos que consta em nosso sistema uma fatura pendente emitida por <strong>{{companyName}}</strong>. Para realizar o pagamento, clique no botão abaixo.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:32px;border-collapse:separate;">
                <tr>
                  <td style="padding:16px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:14px;"><strong>Emissor:</strong></td>
                  <td style="padding:16px;border-bottom:1px solid #e2e8f0;color:#1e293b;font-size:14px;text-align:right;">{{companyName}}</td>
                </tr>
                <tr>
                  <td style="padding:16px;color:#64748b;font-size:14px;"><strong>Destinatário:</strong></td>
                  <td style="padding:16px;color:#1e293b;font-size:14px;text-align:right;">{{name}}</td>
                </tr>
              </table>
              <div style="text-align:center;margin-bottom:24px;">
                <a href="#" style="display:inline-block;background-color:#ef4444;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;">
                  💳 Acessar Fatura para Pagamento
                </a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  parabens: {
    id: "parabens",
    name: "Parabéns & Aniversário",
    badgeColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200 dark:border-amber-900/30",
    subject: "Feliz Aniversário! Um presente especial da {{companyName}} 🥳",
    html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Feliz Aniversário!</title>
</head>
<body style="margin:0;padding:0;background-color:#fff5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff5f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 8px 30px rgba(244,63,94,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#f43f5e 0%,#ec4899 100%);padding:48px;text-align:center;">
              <span style="font-size:40px;display:block;margin-bottom:8px;line-height:1;">🎉 🎂</span>
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:900;">Feliz Aniversário!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 16px;color:#f43f5e;font-size:16px;font-weight:700;">Olá, {{name}}! 👋</p>
              <p style="margin:0 0 24px;color:#475569;font-size:16px;line-height:1.6;">
                Nós da <strong>{{companyName}}</strong> queremos celebrar esta data tão especial com você! Desejamos muito sucesso, saúde e alegria.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff1f2;border:2px dashed #fecdd3;border-radius:16px;margin-bottom:32px;">
                <tr>
                  <td style="padding:24px;text-align:center;">
                    <p style="margin:0 0 4px;color:#e11d48;font-size:11px;font-weight:800;text-transform:uppercase;">Seu Cupom Presente</p>
                    <h3 style="margin:0 0 8px;color:#9f1239;font-size:24px;font-weight:900;">PARABENS20</h3>
                    <p style="margin:0;color:#be123c;font-size:13px;font-weight:600;">Ganhe R$ 20,00 de desconto em nosso site!</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  custom: {
    id: "custom",
    name: "Modelo em Branco",
    badgeColor: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    subject: "Aviso Importante - {{companyName}}",
    html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Mensagem de {{companyName}}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.03);border:1px solid #e2e8f0;">
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 8px;color:#1e293b;font-size:24px;font-weight:700;">{{companyName}}</h1>
              <p style="margin:0 0 24px;color:#64748b;font-size:14px;border-bottom:1px solid #e2e8f0;padding-bottom:16px;">Comunicado</p>
              <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">Olá, {{name}},</p>
              <p style="margin:0;color:#334155;font-size:15px;line-height:1.6;">Escreva sua mensagem personalizada aqui...</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  }
};

const DUMMY_PLACEHOLDERS = {
  name: "Carlos da Silva",
  email: "carlos.silva@exemplo.com",
  phone: "(11) 99999-8888",
  companyName: "Minha Empresa"
};

export function BulkEmailModal({ isOpen, onClose, selectedContacts, onSuccess }: BulkEmailModalProps) {
  const { currentEntity } = useEntity();
  const { companies } = useCompanies();

  const [selectedTemplateKey, setSelectedTemplateKey] = useState<keyof typeof TEMPLATES>("marketing");
  const [subject, setSubject] = useState(TEMPLATES.marketing.subject);
  const [htmlBody, setHtmlBody] = useState(TEMPLATES.marketing.html);

  // Sending progress
  const [isSending, setIsSending] = useState(false);
  const [sendLogs, setSendLogs] = useState<{
    name: string;
    email: string;
    status: "idle" | "sending" | "success" | "error";
    error?: string;
  }[]>([]);
  const [currentSendIndex, setCurrentSendIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [aiPrompt, setAiPrompt] = useState("");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const [resultModal, setResultModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "info";
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "success",
  });

  const handleGenerateWithAi = async () => {
    if (!aiPrompt.trim()) return;

    setIsGeneratingAi(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        setResultModal({
          isOpen: true,
          title: "Sessão Expirada",
          message: "Sessão expirada. Faça login novamente.",
          type: "error",
        });
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/social-copilot-magic`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            company_id: currentEntity.id,
            topic: aiPrompt,
            mode: "email_template_magic",
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar com IA.");

      if (data.html) {
        setHtmlBody(data.html);
        setAiPrompt("");
      } else {
        setResultModal({
          isOpen: true,
          title: "Falha na IA",
          message: "Nenhum HTML retornado pela IA. Certifique-se de que a função de borda (Edge Function) social-copilot-magic foi implantada com a nova versão.",
          type: "error",
        });
      }
    } catch (err: any) {
      console.error("AI Email Generation error:", err);
      setResultModal({
        isOpen: true,
        title: "Erro de Geração",
        message: err.message || "Erro ao gerar e-mail com IA. Tente novamente.",
        type: "error",
      });
    } finally {
      setIsGeneratingAi(false);
    }
  };

  if (!isOpen) return null;

  const currentCompany = companies.find((c) => c.id === currentEntity.id);
  const companyName = currentCompany?.trade_name || currentCompany?.legal_name || "Sua Empresa";

  // Trocar template e repopular assunto/corpo
  const handleSelectTemplate = (key: keyof typeof TEMPLATES) => {
    setSelectedTemplateKey(key);
    setSubject(TEMPLATES[key].subject);
    setHtmlBody(TEMPLATES[key].html);
  };

  // Inserir tag dinâmica na posição atual do cursor
  const handleInsertTag = (tag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const replacement = `{{${tag}}}`;

    const newHtml = text.substring(0, start) + replacement + text.substring(end);
    setHtmlBody(newHtml);

    // Ajustar o cursor após inserção
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + replacement.length, start + replacement.length);
    }, 10);
  };

  // Compilar HTML com mock data para o preview
  const getPreviewHtml = () => {
    let preview = htmlBody;
    preview = preview.replace(/\{\{\s*companyName\s*\}\}/g, companyName);
    preview = preview.replace(/\{\{\s*name\s*\}\}/g, DUMMY_PLACEHOLDERS.name);
    preview = preview.replace(/\{\{\s*email\s*\}\}/g, DUMMY_PLACEHOLDERS.email);
    preview = preview.replace(/\{\{\s*phone\s*\}\}/g, DUMMY_PLACEHOLDERS.phone);
    return preview;
  };

  const getPreviewSubject = () => {
    let previewSub = subject;
    previewSub = previewSub.replace(/\{\{\s*companyName\s*\}\}/g, companyName);
    previewSub = previewSub.replace(/\{\{\s*name\s*\}\}/g, DUMMY_PLACEHOLDERS.name);
    return previewSub;
  };

  // Executar o envio em lote
  const handleStartSending = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      setResultModal({
        isOpen: true,
        title: "Sessão Expirada",
        message: "Sessão expirada. Por favor, faça login novamente.",
        type: "error",
      });
      return;
    }

    setIsSending(true);
    setCurrentSendIndex(0);
    
    // Inicializar os logs de progresso
    const initialLogs = selectedContacts.map((c) => ({
      name: c.name,
      email: c.email || "",
      status: "idle" as const,
    }));
    setSendLogs(initialLogs);

    // Enviar recursivamente para mostrar progresso visual fluído
    for (let i = 0; i < selectedContacts.length; i++) {
      const contact = selectedContacts[i];
      setCurrentSendIndex(i);

      setSendLogs((prev) => {
        const copy = [...prev];
        copy[i].status = "sending";
        return copy;
      });

      // Compilar placeholders reais para esse contato
      let compiledHtml = htmlBody;
      compiledHtml = compiledHtml.replace(/\{\{\s*companyName\s*\}\}/g, companyName);
      compiledHtml = compiledHtml.replace(/\{\{\s*name\s*\}\}/g, contact.name);
      compiledHtml = compiledHtml.replace(/\{\{\s*email\s*\}\}/g, contact.email || "");
      compiledHtml = compiledHtml.replace(/\{\{\s*phone\s*\}\}/g, contact.whatsapp || contact.phone || "");

      let compiledSubject = subject;
      compiledSubject = compiledSubject.replace(/\{\{\s*companyName\s*\}\}/g, companyName);
      compiledSubject = compiledSubject.replace(/\{\{\s*name\s*\}\}/g, contact.name);

      try {
        const response = await axios.post(
          `${API_BASE_URL}/send-email/custom`,
          {
            to: contact.email,
            subject: compiledSubject,
            htmlBody: compiledHtml,
            companyId: currentEntity.id,
            companyName: companyName,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.data.success) {
          setSendLogs((prev) => {
            const copy = [...prev];
            copy[i].status = "success";
            return copy;
          });
        } else {
          throw new Error("Erro desconhecido ao enviar");
        }
      } catch (err: any) {
        console.error(`Erro ao enviar para ${contact.email}:`, err);
        const errMsg = err.response?.data?.error || err.response?.data?.message || err.message || "Erro no servidor";
        setSendLogs((prev) => {
          const copy = [...prev];
          copy[i].status = "error";
          copy[i].error = errMsg;
          return copy;
        });
      }

      // Pequeno delay entre e-mails
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    setCurrentSendIndex(selectedContacts.length);
    if (onSuccess) onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-gray-200 dark:border-slate-700 shadow-2xl p-6 md:p-8 max-w-5xl w-full max-h-[92vh] overflow-y-auto space-y-6 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-100 dark:bg-rose-950/20 text-rose-500 rounded-2xl">
              <Mail size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                Disparar E-mail em Massa
              </h3>
              <p className="text-xs text-gray-500 font-medium">
                Você selecionou <span className="font-bold text-rose-500">{selectedContacts.length}</span> contatos para o disparo.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2 border border-gray-150 dark:border-slate-700 rounded-xl"
          >
            <X size={20} />
          </button>
        </div>

        {/* 🌟 Templates presets */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">Escolha uma Base de E-mail:</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(Object.keys(TEMPLATES) as Array<keyof typeof TEMPLATES>).map((key) => {
              const temp = TEMPLATES[key];
              const isSelected = selectedTemplateKey === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectTemplate(key)}
                  className={`p-3 rounded-2xl border flex flex-col items-start gap-1 text-left transition-all ${
                    isSelected
                      ? "border-rose-500 bg-rose-50/20 dark:bg-rose-950/10 ring-1 ring-rose-500/20"
                      : "border-gray-150 hover:bg-gray-50 dark:border-slate-700 dark:hover:border-slate-600"
                  }`}
                >
                  <p className="font-bold text-xs text-gray-900 dark:text-white leading-tight">{temp.name}</p>
                  <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${temp.badgeColor}`}>
                    {key}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 💻 Split Editor & Preview */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Left Column: Editor */}
          <div className="space-y-4">
            <Input
              label="Assunto do E-mail"
              value={subject}
              onChange={(e: any) => setSubject(e.target.value)}
              placeholder="Digite o assunto do e-mail..."
              preserveCase={true}
            />

            {/* Dynamic Tags */}
            <div className="space-y-1">
              <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest">
                Inserir Variável Dinâmica:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "Nome", tag: "name" },
                  { label: "E-mail", tag: "email" },
                  { label: "Telefone", tag: "phone" },
                  { label: "Sua Empresa", tag: "companyName" },
                ].map((item) => (
                  <button
                    key={item.tag}
                    type="button"
                    onClick={() => handleInsertTag(item.tag)}
                    className="px-2 py-1 bg-gray-50 hover:bg-gray-100 dark:bg-slate-900 dark:hover:bg-slate-950 border border-gray-200 dark:border-slate-700 text-[9px] font-bold text-gray-700 dark:text-gray-300 rounded-lg transition-all"
                  >
                    {"{{"}
                    {item.tag}
                    {"}}"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">Corpo do E-mail (HTML)</label>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Escreva com IA (ex: Promoção de Natal)..."
                    className="flex-1 sm:w-60 px-3 py-1.5 text-xs border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-rose-500 text-gray-800 dark:text-slate-100"
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
                    className="px-3 py-1.5 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    {isGeneratingAi ? (
                      <Loader2 className="animate-spin" size={13} />
                    ) : (
                      <Wand2 size={13} />
                    )}
                    Gerar com IA
                  </button>
                </div>
              </div>
              <textarea
                ref={textareaRef}
                value={htmlBody}
                onChange={(e) => setHtmlBody(e.target.value)}
                className="w-full h-72 font-mono text-[11px] p-4 bg-gray-50 dark:bg-slate-950 text-gray-800 dark:text-slate-200 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none resize-none shadow-inner"
                placeholder="Escreva seu código HTML aqui..."
              />
            </div>
          </div>

          {/* Right Column: Preview */}
          <div className="space-y-2 flex flex-col justify-between">
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">Visualização em Tempo Real (Preview)</label>
            <div className="border border-gray-250 dark:border-slate-700 rounded-2xl overflow-hidden bg-gray-50 dark:bg-slate-900 flex-1 flex flex-col min-h-[350px]">
              {/* Inbox Mockup */}
              <div className="bg-white dark:bg-slate-800 p-3 border-b border-gray-150 dark:border-slate-700 space-y-1 text-[10px]">
                <div><span className="text-gray-400 font-bold">De:</span> <span className="text-gray-800 dark:text-gray-200 font-bold">{companyName} &lt;contato@suaempresa.com.br&gt;</span></div>
                <div><span className="text-gray-400 font-bold">Para:</span> <span className="text-gray-800 dark:text-gray-200">{DUMMY_PLACEHOLDERS.name} &lt;{DUMMY_PLACEHOLDERS.email}&gt;</span></div>
                <div><span className="text-gray-400 font-bold">Assunto:</span> <span className="text-rose-600 dark:text-rose-450 font-bold">{getPreviewSubject() || "(Sem Assunto)"}</span></div>
              </div>
              <div className="p-3 bg-gray-100 dark:bg-slate-950 flex-1 flex">
                <iframe
                  title="Bulk Email Setup Live Preview"
                  srcDoc={getPreviewHtml()}
                  className="w-full h-full min-h-[300px] border border-gray-250 dark:border-slate-800 rounded-xl bg-white"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-xl"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleStartSending}
            disabled={selectedContacts.length === 0}
            className="bg-rose-500 hover:bg-rose-600 text-white rounded-xl px-6 flex items-center gap-2 font-bold shadow-lg shadow-rose-500/10"
          >
            <Send size={16} />
            Confirmar e Enviar E-mails
          </Button>
        </div>

        {/* Sending overlay status */}
        {isSending && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-gray-200 dark:border-slate-700 shadow-2xl p-8 max-w-lg w-full space-y-6 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-500/10 text-rose-500 rounded-2xl">
                  <Mail size={24} className="animate-bounce" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                    Status do Disparo em Massa
                  </h3>
                  <p className="text-xs text-gray-500 font-medium">
                    Progresso de envios individuais
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-black text-gray-500 uppercase tracking-widest">
                  <span>Progresso Geral</span>
                  <span>{currentSendIndex} / {selectedContacts.length} e-mails</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-slate-700 h-3 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${(currentSendIndex / selectedContacts.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Log window */}
              <div className="bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 h-56 overflow-y-auto font-mono text-[10px] space-y-1.5 shadow-inner">
                {sendLogs.map((log, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-4 py-1 border-b border-gray-100 dark:border-slate-900 last:border-0">
                    <span className="truncate text-gray-700 dark:text-gray-300 font-bold">{log.name} &lt;{log.email}&gt;</span>
                    <span className="shrink-0 flex items-center gap-1.5 font-bold">
                      {log.status === "idle" && <span className="text-gray-400">Aguardando</span>}
                      {log.status === "sending" && <span className="text-blue-500 flex items-center gap-1"><Loader2 className="animate-spin" size={10} /> Enviando</span>}
                      {log.status === "success" && <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 size={10} /> Sucesso</span>}
                      {log.status === "error" && <span className="text-rose-500 flex items-center gap-1" title={log.error}><XCircle size={10} /> Falha</span>}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <Button
                  disabled={currentSendIndex < selectedContacts.length}
                  onClick={() => {
                    setIsSending(false);
                    onClose();
                  }}
                  className="bg-gray-900 hover:bg-black text-white px-8 h-12 rounded-2xl font-black uppercase text-xs tracking-widest shadow-md transition-all animate-pulse"
                >
                  Concluir & Fechar
                </Button>
              </div>
            </div>
          </div>
        )}

        <ResultModal
          isOpen={resultModal.isOpen}
          onClose={() => setResultModal((prev) => ({ ...prev, isOpen: false }))}
          title={resultModal.title}
          message={resultModal.message}
          type={resultModal.type === "info" ? "success" : resultModal.type}
        />
      </div>
    </div>
  );
}
