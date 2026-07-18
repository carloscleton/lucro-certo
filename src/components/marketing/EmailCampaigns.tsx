import { useState, useRef } from "react";
import {
  Mail,
  Send,
  Sparkles,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  CheckSquare,
  Square,
  Copy,
  Wand2,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { ResultModal } from "../ui/ResultModal";
import { useContacts } from "../../hooks/useContacts";
import { useEntity } from "../../context/EntityContext";
import { useCompanies } from "../../hooks/useCompanies";
import axios from "axios";
import { API_BASE_URL } from "../../lib/constants";
import { supabase } from "../../lib/supabase";

// 📧 Modelos padrão de e-mail
const TEMPLATES = {
  marketing: {
    id: "marketing",
    name: "Marketing & Novidades",
    icon: Sparkles,
    badgeColor: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/30",
    subject: "Novidades Imperdíveis da {{companyName}}!",
    html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Novidades de {{companyName}}</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
          <!-- Header banner with gradient -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1 0%,#4f46e5 100%);padding:48px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.5px;">{{companyName}}</h1>
              <p style="margin:10px 0 0;color:#c7d2fe;font-size:14px;font-weight:650;text-transform:uppercase;letter-spacing:1.5px;">Novidade Exclusiva para Você</p>
            </td>
          </tr>
          <!-- Content Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 12px;color:#4f46e5;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Olá, {{name}}!</p>
              <h2 style="margin:0 0 20px;color:#1e293b;font-size:24px;font-weight:800;line-height:1.25;">Temos uma novidade incrível para compartilhar hoje!</h2>
              <p style="margin:0 0 24px;color:#475569;font-size:16px;line-height:1.6;">
                Estamos muito felizes em apresentar nossa mais nova linha de soluções projetada especialmente para ajudar o seu negócio a crescer com eficiência e lucratividade. Queremos acompanhar sua jornada e oferecer o que há de melhor.
              </p>
              <!-- Feature Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f9ff;border:1px dashed #bae6fd;border-radius:12px;margin-bottom:32px;">
                <tr>
                  <td style="padding:24px;text-align:center;">
                    <p style="margin:0 0 8px;color:#0369a1;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Oferta de Lançamento</p>
                    <p style="margin:0 0 16px;color:#0c4a6e;font-size:20px;font-weight:800;">Ganhe 20% de Desconto na primeira adesão!</p>
                    <a href="#" style="display:inline-block;background-color:#0284c7;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;box-shadow:0 4px 6px rgba(2,132,199,0.2);">Aproveitar Agora</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 24px;color:#475569;font-size:16px;line-height:1.6;">
                Se tiver qualquer dúvida, basta responder a este e-mail. Nossa equipe está pronta para te atender.
              </p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;" />
              <p style="margin:0;color:#94a3b8;font-size:13px;text-align:center;line-height:1.6;">
                Este e-mail foi enviado por <strong>{{companyName}}</strong> para o endereço {{email}}.<br/>
                Para cancelar o recebimento, <a href="#" style="color:#6366f1;text-decoration:underline;">clique aqui</a>.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f1f5f9;padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Powered by Lucro Certo</p>
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
    icon: Mail,
    badgeColor: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400 border-rose-200 dark:border-rose-900/30",
    subject: "Lembrete Importante: Fatura em Aberto - {{companyName}}",
    html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lembrete de Pagamento</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
          <!-- Header border alert type -->
          <tr>
            <td style="background-color:#ef4444;height:6px;"></td>
          </tr>
          <!-- Content Body -->
          <tr>
            <td style="padding:40px;">
              <div style="text-align:center;margin-bottom:32px;">
                <div style="display:inline-block;background-color:#fee2e2;padding:16px;border-radius:50%;margin-bottom:16px;">
                  <span style="font-size:32px;line-height:1;">⚠️</span>
                </div>
                <h1 style="margin:0;color:#1e293b;font-size:24px;font-weight:800;letter-spacing:-0.5px;">Lembrete de Pagamento</h1>
                <p style="margin:6px 0 0;color:#ef4444;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Fatura em Aberto</p>
              </div>
              <p style="margin:0 0 16px;color:#475569;font-size:16px;line-height:1.6;">
                Prezado(a) <strong>{{name}}</strong>,
              </p>
              <p style="margin:0 0 24px;color:#475569;font-size:16px;line-height:1.6;">
                Gostaríamos de lembrar que consta em nosso sistema uma fatura em aberto com vencimento pendente emitida por <strong>{{companyName}}</strong>. Para garantir a continuidade dos seus serviços ou a quitação dos seus débitos, por favor realize o pagamento através do link abaixo.
              </p>
              <!-- Invoice Details Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:32px;border-collapse:separate;">
                <tr>
                  <td style="padding:16px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:14px;"><strong>Empresa Emissora:</strong></td>
                  <td style="padding:16px;border-bottom:1px solid #e2e8f0;color:#1e293b;font-size:14px;text-align:right;">{{companyName}}</td>
                </tr>
                <tr>
                  <td style="padding:16px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:14px;"><strong>Destinatário:</strong></td>
                  <td style="padding:16px;border-bottom:1px solid #e2e8f0;color:#1e293b;font-size:14px;text-align:right;">{{name}} ({{email}})</td>
                </tr>
                <tr>
                  <td style="padding:16px;color:#64748b;font-size:14px;"><strong>Telefone cadastrado:</strong></td>
                  <td style="padding:16px;color:#1e293b;font-size:14px;text-align:right;">{{phone}}</td>
                </tr>
              </table>
              <!-- Pay Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td align="center">
                    <a href="#" style="display:inline-block;background-color:#ef4444;color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:12px;font-size:16px;font-weight:700;box-shadow:0 6px 12px rgba(239,68,68,0.25);">
                      💳 Acessar Link de Pagamento
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;text-align:center;">
                Se você já efetuou o pagamento, favor desconsiderar este e-mail.<br/>
                Para dúvidas, entre em contato diretamente conosco.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#cbd5e1;font-size:12px;">Powered by <strong>{{companyName}}</strong> &bull; Lucro Certo</p>
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
    icon: Sparkles,
    badgeColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200 dark:border-amber-900/30",
    subject: "Feliz Aniversário! Um presente especial da {{companyName}} 🥳",
    html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Feliz Aniversário!</title>
</head>
<body style="margin:0;padding:0;background-color:#fff5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff5f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 8px 30px rgba(244,63,94,0.08);">
          <!-- Festive banner with balloons -->
          <tr>
            <td style="background:linear-gradient(135deg,#f43f5e 0%,#ec4899 100%);padding:60px 40px;text-align:center;">
              <span style="font-size:48px;display:block;margin-bottom:12px;line-height:1;">🎉 🎂 🥳</span>
              <h1 style="margin:0;color:#ffffff;font-size:32px;font-weight:900;letter-spacing:-0.5px;">Feliz Aniversário!</h1>
              <p style="margin:8px 0 0;color:#ffe4e6;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Um dia muito especial</p>
            </td>
          </tr>
          <!-- Content Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 16px;color:#f43f5e;font-size:16px;font-weight:700;">Olá, {{name}}! 👋</p>
              <p style="margin:0 0 20px;color:#475569;font-size:16px;line-height:1.6;">
                Nós da <strong>{{companyName}}</strong> queremos celebrar esta data tão especial com você! Esperamos que seu dia seja repleto de sorrisos, abraços, paz e muita alegria.
              </p>
              <p style="margin:0 0 24px;color:#475569;font-size:16px;line-height:1.6;">
                Como forma de agradecimento por nos permitir fazer parte da sua história, preparamos um presente especial para celebrar o seu aniversário:
              </p>
              <!-- Gift Coupon Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff1f2;border:2px dashed #fecdd3;border-radius:16px;margin-bottom:32px;">
                <tr>
                  <td style="padding:32px;text-align:center;">
                    <p style="margin:0 0 4px;color:#e11d48;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;">Seu Cupom de Aniversário</p>
                    <h3 style="margin:0 0 12px;color:#9f1239;font-size:28px;font-weight:900;">PARABENS20</h3>
                    <p style="margin:0 0 20px;color:#be123c;font-size:14px;font-weight:650;">Ganhe R$ 20,00 de desconto em qualquer compra nesta semana!</p>
                    <a href="#" style="display:inline-block;background-color:#f43f5e;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:10px;font-size:14px;font-weight:700;box-shadow:0 4px 10px rgba(244,63,94,0.3);">Resgatar Meu Presente</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 24px;color:#475569;font-size:16px;line-height:1.6;">
                Desejamos muito sucesso, saúde e prosperidade no seu novo ano de vida!
              </p>
              <hr style="border:none;border-top:1px solid #f1f5f9;margin:32px 0;" />
              <p style="margin:0;color:#94a3b8;font-size:13px;text-align:center;line-height:1.6;">
                Com carinho,<br/>
                <strong>Equipe {{companyName}}</strong>
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
  custom: {
    id: "custom",
    name: "Modelo em Branco",
    icon: Mail,
    badgeColor: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    subject: "Aviso Importante - {{companyName}}",
    html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mensagem de {{companyName}}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.03);border:1px solid #e2e8f0;">
          <!-- Content Body -->
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 8px;color:#1e293b;font-size:24px;font-weight:700;letter-spacing:-0.5px;">{{companyName}}</h1>
              <p style="margin:0 0 32px;color:#64748b;font-size:14px;border-bottom:1px solid #e2e8f0;padding-bottom:16px;">Comunicado Importante</p>
              
              <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">
                Olá, {{name}},
              </p>
              
              <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">
                Escreva sua mensagem personalizada aqui. Este modelo é totalmente customizável e você pode usar tags dinâmicas como {{name}} para o nome do contato, {{email}} para o e-mail dele e {{phone}} para o telefone do contato.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0 16px;">
                <tr>
                  <td align="center">
                    <a href="#" style="display:inline-block;background-color:#0f172a;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:14px;font-weight:600;">
                      Clique Aqui
                    </a>
                  </td>
                </tr>
              </table>
              
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;" />
              <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;line-height:1.6;">
                Atenciosamente,<br/>
                <strong>{{companyName}}</strong>
              </p>
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

export function EmailCampaigns() {
  const { contacts, loading: loadingContacts } = useContacts();
  const { currentEntity } = useEntity();
  const { companies } = useCompanies();

  const [selectedTemplateKey, setSelectedTemplateKey] = useState<keyof typeof TEMPLATES>("marketing");
  const [subject, setSubject] = useState(TEMPLATES.marketing.subject);
  const [htmlBody, setHtmlBody] = useState(TEMPLATES.marketing.html);

  // Filters for Contacts
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "client" | "supplier">("all");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);

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

  // Filtrar contatos
  const filteredContacts = contacts.filter((c) => {
    const matchesFilter =
      filterType === "all" ||
      (filterType === "client" && (c.type === "client" || c.type === "both")) ||
      (filterType === "supplier" && (c.type === "supplier" || c.type === "both"));

    const matchesSearch =
      !searchTerm ||
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  // Toggle selecionar contatos individuais
  const handleToggleContact = (id: string) => {
    setSelectedContacts((prev) =>
      prev.includes(id) ? prev.filter((cid) => cid !== id) : [...prev, id]
    );
  };

  // Selecionar todos os filtrados que têm e-mail
  const handleToggleSelectAll = () => {
    const contactsWithEmail = filteredContacts.filter((c) => c.email && c.email.trim() !== "");
    const allSelected = contactsWithEmail.every((c) => selectedContacts.includes(c.id));

    if (allSelected) {
      // Deselecionar todos os filtrados
      const idsToRemove = contactsWithEmail.map((c) => c.id);
      setSelectedContacts((prev) => prev.filter((id) => !idsToRemove.includes(id)));
    } else {
      // Selecionar todos os filtrados com e-mail
      const idsToAdd = contactsWithEmail.map((c) => c.id).filter((id) => !selectedContacts.includes(id));
      setSelectedContacts((prev) => [...prev, ...idsToAdd]);
    }
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
    if (selectedContacts.length === 0) {
      setResultModal({
        isOpen: true,
        title: "Campo Obrigatório",
        message: "Por favor, selecione ao menos um contato para o disparo.",
        type: "error",
      });
      return;
    }

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

    const targetContacts = contacts.filter((c) => selectedContacts.includes(c.id));
    
    // Inicializar os logs de progresso
    const initialLogs = targetContacts.map((c) => ({
      name: c.name,
      email: c.email || "",
      status: "idle" as const,
    }));
    setSendLogs(initialLogs);

    // Enviar recursivamente ou em loop iterativo para mostrar progresso visual fluído
    for (let i = 0; i < targetContacts.length; i++) {
      const contact = targetContacts[i];
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

      // Pequeno delay entre e-mails para ser gentil com o servidor e APIs
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    setCurrentSendIndex(targetContacts.length);
  };

  const contactsWithEmailFiltered = filteredContacts.filter((c) => c.email && c.email.trim() !== "");
  const allFilteredSelected =
    contactsWithEmailFiltered.length > 0 &&
    contactsWithEmailFiltered.every((c) => selectedContacts.includes(c.id));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* 🌟 1. SELETOR DE TEMPLATE COM CARDS PREMIUM */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-slate-700 shadow-xl shadow-gray-150/30 dark:shadow-none space-y-4">
        <div>
          <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter">
            Escolha um Modelo de E-mail
          </h3>
          <p className="text-xs text-gray-500 font-medium">
            Selecione uma base otimizada para começar a redigir sua campanha
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(Object.keys(TEMPLATES) as Array<keyof typeof TEMPLATES>).map((key) => {
            const temp = TEMPLATES[key];
            const TempIcon = temp.icon;
            const isSelected = selectedTemplateKey === key;

            return (
              <button
                key={key}
                onClick={() => handleSelectTemplate(key)}
                className={`p-5 rounded-3xl border-2 flex flex-col items-start gap-3 text-left transition-all duration-300 ${
                  isSelected
                    ? "border-rose-500 bg-rose-50/20 dark:bg-rose-950/10 ring-2 ring-rose-500/20 scale-[1.02]"
                    : "border-gray-100 hover:border-gray-200 hover:bg-gray-50/30 dark:border-slate-700 dark:hover:border-slate-600"
                }`}
              >
                <div
                  className={`p-3 rounded-2xl shadow-sm ${
                    isSelected ? "bg-rose-500 text-white" : "bg-gray-100 text-gray-500 dark:bg-slate-900"
                  }`}
                >
                  <TempIcon size={20} />
                </div>
                <div>
                  <p className="font-black text-sm text-gray-900 dark:text-white leading-tight">
                    {temp.name}
                  </p>
                  <span className={`inline-block mt-2 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider border ${temp.badgeColor}`}>
                    {key}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 💻 2. EDITORA E PREVIEW LADO A LADO */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        
        {/* Lado Esquerdo: Editor HTML */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-slate-700 shadow-xl shadow-gray-150/30 dark:shadow-none space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                  Editor HTML Customizado
                </h3>
                <p className="text-xs text-gray-500 font-medium">
                  Escreva e customize o conteúdo usando tags dinâmicas
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <Input
                label="Assunto do E-mail"
                value={subject}
                onChange={(e: any) => setSubject(e.target.value)}
                placeholder="Digite o assunto do e-mail..."
                preserveCase={true}
              />

              {/* Botões de Variáveis Rápidas */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Variáveis Dinâmicas Disponíveis (Clique para Inserir)
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Nome do Cliente", tag: "name" },
                    { label: "E-mail", tag: "email" },
                    { label: "Telefone/WhatsApp", tag: "phone" },
                    { label: "Sua Empresa", tag: "companyName" },
                  ].map((item) => (
                    <button
                      key={item.tag}
                      type="button"
                      onClick={() => handleInsertTag(item.tag)}
                      className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 dark:bg-slate-900 dark:hover:bg-slate-950 border border-gray-200 dark:border-slate-700 text-[10px] font-bold text-gray-700 dark:text-gray-300 rounded-xl transition-all flex items-center gap-1.5"
                    >
                      <Copy size={10} />
                      {"{{"}
                      {item.tag}
                      {"}}"} ({item.label})
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                    Código HTML
                  </label>
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
                  className="w-full h-96 font-mono text-xs p-4 bg-gray-50 dark:bg-slate-950 text-gray-800 dark:text-slate-200 border border-gray-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-rose-500 focus:outline-none resize-none shadow-inner"
                  placeholder="Escreva seu código HTML aqui..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Lado Direito: Live Preview */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-slate-700 shadow-xl shadow-gray-150/30 dark:shadow-none space-y-6">
          <div>
            <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter">
              Visualização em Tempo Real (Preview)
            </h3>
            <p className="text-xs text-gray-500 font-medium">
              Veja exatamente como o e-mail será renderizado para os destinatários
            </p>
          </div>

          {/* Email client mockup */}
          <div className="border border-gray-200 dark:border-slate-700 rounded-3xl overflow-hidden bg-gray-50 dark:bg-slate-900 shadow-sm flex flex-col">
            {/* Inbox header mockup */}
            <div className="bg-white dark:bg-slate-850 p-4 border-b border-gray-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-gray-400 w-12 text-right">De:</span>
                <span className="text-gray-800 dark:text-gray-200 font-bold">
                  {companyName} &lt;contato@suaempresa.com.br&gt;
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-gray-400 w-12 text-right">Para:</span>
                <span className="text-gray-800 dark:text-gray-200 font-medium">
                  {DUMMY_PLACEHOLDERS.name} &lt;{DUMMY_PLACEHOLDERS.email}&gt;
                </span>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-gray-100 dark:border-slate-800">
                <span className="font-extrabold text-gray-400 w-12 text-right">Assunto:</span>
                <span className="text-rose-600 dark:text-rose-400 font-black">
                  {getPreviewSubject() || "(Sem Assunto)"}
                </span>
              </div>
            </div>
            {/* Live iframe */}
            <div className="p-4 bg-gray-100 dark:bg-slate-950 flex-1">
              <iframe
                title="Email Template Live Preview"
                srcDoc={getPreviewHtml()}
                className="w-full h-[380px] border border-gray-200 dark:border-slate-800 rounded-2xl bg-white"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 👥 3. SELEÇÃO DE DESTINATÁRIOS */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-slate-700 shadow-xl shadow-gray-150/30 dark:shadow-none space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter">
              Selecionar Destinatários ({selectedContacts.length} selecionados)
            </h3>
            <p className="text-xs text-gray-500 font-medium">
              Escolha quais contatos da sua agenda receberão este e-mail
            </p>
          </div>

          <Button
            onClick={handleStartSending}
            disabled={selectedContacts.length === 0 || isSending}
            className="bg-rose-500 hover:bg-rose-600 disabled:bg-gray-300 dark:disabled:bg-slate-700 text-white rounded-2xl px-8 h-12 text-xs font-black uppercase tracking-widest shadow-lg shadow-rose-500/20 dark:shadow-none flex items-center gap-2"
          >
            <Send size={16} />
            Disparar E-mails em Massa
          </Button>
        </div>

        {/* Filtros e Busca */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-gray-50 dark:bg-slate-900 p-4 rounded-3xl border border-gray-100 dark:border-slate-700">
          <div className="relative w-full md:w-[350px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por nome ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 pl-11 pr-4 bg-white dark:bg-slate-850 border border-gray-250 dark:border-slate-800 rounded-2xl outline-none focus:border-rose-500 transition-all text-xs font-bold"
            />
          </div>

          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1 rounded-2xl border border-gray-150 dark:border-slate-700">
            <button
              onClick={() => setFilterType("all")}
              className={`h-9 px-5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                filterType === "all"
                  ? "bg-rose-500 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterType("client")}
              className={`h-9 px-5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                filterType === "client"
                  ? "bg-rose-500 text-white shadow-sm"
                  : "text-gray-500 hover:text-rose-500"
              }`}
            >
              Clientes
            </button>
            <button
              onClick={() => setFilterType("supplier")}
              className={`h-9 px-5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                filterType === "supplier"
                  ? "bg-rose-500 text-white shadow-sm"
                  : "text-gray-500 hover:text-rose-500"
              }`}
            >
              Fornecedores
            </button>
          </div>
        </div>

        {/* Tabela de Contatos */}
        <div className="border border-gray-150 dark:border-slate-700 rounded-3xl overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 dark:bg-slate-900 border-b border-gray-150 dark:border-slate-700 text-gray-400 font-black uppercase tracking-widest text-[9px]">
              <tr>
                <th className="px-6 py-4 w-12 text-center">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="p-1 text-gray-400 hover:text-rose-500"
                  >
                    {allFilteredSelected ? <CheckSquare size={18} className="text-rose-500" /> : <Square size={18} />}
                  </button>
                </th>
                <th className="px-6 py-4">Nome</th>
                <th className="px-6 py-4">E-mail</th>
                <th className="px-6 py-4">Tipo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {loadingContacts ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-gray-500">
                    <Loader2 className="animate-spin inline-block mr-2" size={16} /> Carregando contatos...
                  </td>
                </tr>
              ) : filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                    Nenhum contato correspondente encontrado
                  </td>
                </tr>
              ) : (
                filteredContacts.map((contact) => {
                  const isSelected = selectedContacts.includes(contact.id);
                  const hasEmail = !!contact.email && contact.email.trim() !== "";

                  return (
                    <tr
                      key={contact.id}
                      onClick={() => hasEmail && handleToggleContact(contact.id)}
                      className={`group hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition-all cursor-pointer ${
                        !hasEmail ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          disabled={!hasEmail}
                          onClick={() => handleToggleContact(contact.id)}
                          className="p-1 text-gray-400 disabled:opacity-30 hover:text-rose-500"
                        >
                          {isSelected ? (
                            <CheckSquare size={18} className="text-rose-500" />
                          ) : (
                            <Square size={18} />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        {contact.name}
                        {!hasEmail && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 text-[8px] font-black uppercase">
                            <AlertTriangle size={8} /> Sem e-mail
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-500 font-medium">
                        {contact.email || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                            contact.type === "client"
                              ? "bg-blue-50 border-blue-100 text-blue-600 dark:bg-blue-900/20 dark:border-blue-900/30 dark:text-blue-400"
                              : contact.type === "supplier"
                              ? "bg-purple-50 border-purple-100 text-purple-600 dark:bg-purple-900/20 dark:border-purple-900/30 dark:text-purple-400"
                              : "bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-900/30 dark:text-emerald-400"
                          }`}
                        >
                          {contact.type === "client" ? "Cliente" : contact.type === "supplier" ? "Fornecedor" : "Ambos"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🗳️ 4. MODAL DE STATUS DO DISPARO EM MASSA */}
      {isSending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-gray-200 dark:border-slate-700 shadow-2xl p-8 max-w-xl w-full space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-500/10 text-rose-500 rounded-2xl">
                  <Mail size={24} className="animate-bounce" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                    Status do Disparo em Massa
                  </h3>
                  <p className="text-xs text-gray-500 font-medium">
                    Enviando e-mails iterativamente para evitar limites e falhas
                  </p>
                </div>
              </div>
            </div>

            {/* Barra de Progresso */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-black text-gray-500 uppercase tracking-widest">
                <span>Progresso Geral</span>
                <span>
                  {currentSendIndex} / {selectedContacts.length} e-mails
                </span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-slate-700 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-rose-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${(currentSendIndex / selectedContacts.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Console de Envios */}
            <div className="bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 h-64 overflow-y-auto font-mono text-[10px] space-y-2 shadow-inner">
              {sendLogs.map((log, idx) => (
                <div key={idx} className="flex items-start justify-between gap-4 py-1 border-b border-gray-100 dark:border-slate-900 last:border-0">
                  <div className="truncate">
                    <span className="font-bold text-gray-700 dark:text-gray-300">{log.name}</span>
                    <span className="text-gray-400 dark:text-gray-500 ml-2">&lt;{log.email}&gt;</span>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    {log.status === "idle" && (
                      <span className="text-gray-400 font-bold uppercase tracking-wider">Aguardando</span>
                    )}
                    {log.status === "sending" && (
                      <span className="text-blue-500 font-bold uppercase tracking-wider flex items-center gap-1">
                        <Loader2 className="animate-spin" size={10} /> Enviando
                      </span>
                    )}
                    {log.status === "success" && (
                      <span className="text-emerald-500 font-bold uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle2 size={10} /> Sucesso
                      </span>
                    )}
                    {log.status === "error" && (
                      <span className="text-rose-500 font-bold uppercase tracking-wider flex items-center gap-1" title={log.error}>
                        <XCircle size={10} /> Falha
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Ações de Fechamento */}
            <div className="flex justify-end">
              <Button
                disabled={currentSendIndex < selectedContacts.length}
                onClick={() => {
                  setIsSending(false);
                  setSelectedContacts([]);
                }}
                className="bg-gray-900 hover:bg-black text-white px-8 h-12 rounded-2xl font-black uppercase text-xs tracking-widest shadow-md transition-all"
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
  );
}
