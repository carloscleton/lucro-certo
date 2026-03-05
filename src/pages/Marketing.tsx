import React, { useState, useEffect } from "react";

import { supabase } from "../lib/supabase";
import { useEntity } from "../context/EntityContext";
import { useAuth } from "../context/AuthContext";
import {
  Sparkles,
  Save,
  Megaphone,
  Instagram,
  Facebook,
  Image as ImageIcon,
  UploadCloud,
  Unplug,
  Rocket,
  Video,
  User,
  Palette,
  Trash2,
  Calendar,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  FileText,
  BarChart3,
  TrendingUp,
  Users,
  Heart,
  MessageCircle,
  Zap,
  ShieldCheck,
  DollarSign,
  Target,
  AlertCircle,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { SocialProfile, SocialPost } from "../types/marketing";

export function Marketing() {
  const { currentEntity } = useEntity();
  const { user } = useAuth();

  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State
  const [niche, setNiche] = useState("");
  const [tone, setTone] = useState("");
  const [audience, setAudience] = useState("");
  const [approvalWhatsapp, setApprovalWhatsapp] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [hasWhatsappConnection, setHasWhatsappConnection] = useState(true);
  const [connectingMeta, setConnectingMeta] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  // Manual Post creation
  const [isCreatingManualPost, setIsCreatingManualPost] = useState(false);
  const [manualFile, setManualFile] = useState<File | null>(null);
  const [manualPreview, setManualPreview] = useState<string | null>(null);
  const [manualContent, setManualContent] = useState("");
  const [manualMediaType, setManualMediaType] = useState<
    "feed" | "story" | "reels"
  >("feed");
  const [savingManualPost, setSavingManualPost] = useState(false);
  const [isGeneratingMagic, setIsGeneratingMagic] = useState(false);

  const [editingPost, setEditingPost] = useState<SocialPost | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editMediaType, setEditMediaType] = useState<
    "feed" | "story" | "reels"
  >("feed");
  const [showInstructions, setShowInstructions] = useState(false);

  // Campaign State
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const [campaignTheme, setCampaignTheme] = useState("");
  const [campaignCount, setCampaignCount] = useState<number>(3);
  const [savingCampaign, setSavingCampaign] = useState(false);

  // Studio Mode
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [studioScript, setStudioScript] = useState("");
  const [isGeneratingStudio, setIsGeneratingStudio] = useState(false);
  const [isFinalizingStudio, setIsFinalizingStudio] = useState(false);

  // Video/Avatar Settings
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [avatarGender, setAvatarGender] = useState("male");
  const [avatarStyle, setAvatarStyle] = useState("professional");
  const [language, setLanguage] = useState("pt-BR");

  // Auto-Pilot State
  const [autopilotEnabled, setAutopilotEnabled] = useState(false);
  const [autopilotFrequency, setAutopilotFrequency] = useState<
    "daily" | "thrice_weekly" | "weekly"
  >("thrice_weekly");

  // Blog Auto-Pilot State (Phase 9)
  const [blogAutopilotEnabled, setBlogAutopilotEnabled] = useState(false);
  const [blogAutopilotFrequency, setBlogAutopilotFrequency] = useState<
    "daily" | "thrice_weekly" | "weekly"
  >("weekly");

  // Brand Kit State
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [brandPrimaryColor, setBrandPrimaryColor] = useState("#4f46e5");
  const [brandSecondaryColor, setBrandSecondaryColor] = useState("#f43f5e");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // View State
  const [viewMode, setViewMode] = useState<"feed" | "calendar">("feed");
  const [activeApp, setActiveApp] = useState<"social" | "blog" | "analytics">(
    "social",
  );
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Blog App State
  const [blogTopic, setBlogTopic] = useState("");
  const [blogContent, setBlogContent] = useState("");
  const [isGeneratingBlog, setIsGeneratingBlog] = useState(false);
  const [isBlogModalOpen, setIsBlogModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [executionTime, setExecutionTime] = useState(0);

  // Analytics State
  const [metrics, setMetrics] = useState<any>(null);
  const [syncingMetrics, setSyncingMetrics] = useState(false);

  const formatWhatsAppMask = (value: string) => {
    let v = value.replace(/\D/g, "");
    if (v.startsWith("55")) v = v.substring(2);
    v = v.substring(0, 11);

    if (v.length === 0) return "55 ";

    let formatted = "55 ";
    if (v.length > 0) formatted += `(${v.slice(0, 2)}`;
    if (v.length > 2) formatted += `) ${v.slice(2, 3)}`;
    if (v.length > 3) formatted += ` ${v.slice(3, 7)}`;
    if (v.length > 7) formatted += `-${v.slice(7, 11)}`;
    return formatted;
  };

  useEffect(() => {
    let interval: any;
    if (isFinalizingStudio) {
      setExecutionTime(0);
      interval = setInterval(() => {
        setExecutionTime((t) => t + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isFinalizingStudio]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    // Load FB SDK
    if (!(window as any).FB) {
      (window as any).fbAsyncInit = function () {
        (window as any).FB.init({
          appId: import.meta.env.VITE_META_APP_ID || "897720413143999",
          cookie: true,
          xfbml: true,
          version: "v19.0",
        });
      };
      (function (d, s, id) {
        var js,
          fjs = d.getElementsByTagName(s)[0];
        if (d.getElementById(id)) {
          return;
        }
        js = d.createElement(s) as HTMLScriptElement;
        js.id = id;
        js.src = "https://connect.facebook.net/pt_BR/sdk.js";
        fjs?.parentNode?.insertBefore(js, fjs);
      })(document, "script", "facebook-jssdk");
    }

    if (currentEntity.type === "company" && user) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [currentEntity.id, user]);

  const fetchProfile = async () => {
    try {
      // Check WhatsApp connection
      const { data: instances } = await supabase
        .from("instances")
        .select("id")
        .eq("company_id", currentEntity.id)
        .eq("status", "connected")
        .limit(1);
      setHasWhatsappConnection(Boolean(instances && instances.length > 0));

      const { data, error } = await supabase
        .from("social_profiles")
        .select("*")
        .eq("company_id", currentEntity.id)
        .limit(1);

      if (error) {
        console.error("Error fetching social profile:", error);
        return;
      }

      const profileData = data && data.length > 0 ? data[0] : null;

      if (profileData) {
        setProfile(profileData);
        setNiche(profileData.niche);
        setTone(profileData.tone);
        setAudience(profileData.target_audience);
        setApprovalWhatsapp(
          formatWhatsAppMask(profileData.approval_whatsapp || ""),
        );
        setVideoEnabled(profileData.video_enabled || false);
        setAvatarGender(profileData.avatar_gender || "male");
        setAvatarStyle(profileData.avatar_style || "professional");
        setLanguage(profileData.language || "pt-BR");
        setBrandLogo(
          profileData.brand_logo_url || currentEntity.logo_url || null,
        );
        setBrandPrimaryColor(profileData.brand_primary_color || "#4f46e5");
        setBrandSecondaryColor(profileData.brand_secondary_color || "#f43f5e");
        setAutopilotEnabled(profileData.autopilot_enabled || false);
        setAutopilotFrequency(
          profileData.autopilot_frequency || "thrice_weekly",
        );
        setBlogAutopilotEnabled(profileData.blog_autopilot_enabled || false);
        setBlogAutopilotFrequency(
          profileData.blog_autopilot_frequency || "weekly",
        );
        await fetchPosts();
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async () => {
    const { data } = await supabase
      .from("social_posts")
      .select("*")
      .eq("company_id", currentEntity.id)
      .order("created_at", { ascending: false });
    if (data) setPosts(data);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!niche || !tone || !audience) {
      alert("Preencha todos os campos do perfil.");
      return;
    }

    setSaving(true);
    try {
      const cleanPhone = approvalWhatsapp.replace(/\D/g, "");
      if (profile) {
        // Update
        const { error } = await supabase
          .from("social_profiles")
          .update({
            niche,
            tone,
            target_audience: audience,
            approval_whatsapp: cleanPhone,
            video_enabled: videoEnabled,
            avatar_gender: avatarGender,
            avatar_style: avatarStyle,
            language: language,
            brand_logo_url: brandLogo,
            brand_primary_color: brandPrimaryColor,
            brand_secondary_color: brandSecondaryColor,
            autopilot_enabled: autopilotEnabled,
            autopilot_frequency: autopilotFrequency,
            blog_autopilot_enabled: blogAutopilotEnabled,
            blog_autopilot_frequency: blogAutopilotFrequency,
          })
          .eq("id", profile.id);
        if (error) throw error;
      } else {
        // Create
        const { error } = await supabase.from("social_profiles").insert({
          company_id: currentEntity.id,
          niche,
          tone,
          target_audience: audience,
          approval_whatsapp: cleanPhone,
          video_enabled: videoEnabled,
          avatar_gender: avatarGender,
          avatar_style: avatarStyle,
          language: language,
          brand_logo_url: brandLogo,
          brand_primary_color: brandPrimaryColor,
          brand_secondary_color: brandSecondaryColor,
          autopilot_enabled: autopilotEnabled,
          autopilot_frequency: autopilotFrequency,
          blog_autopilot_enabled: blogAutopilotEnabled,
          blog_autopilot_frequency: blogAutopilotFrequency,
        });
        if (error) throw error;
      }

      // Also ensure the company has the social copilot flag enabled
      const { error: cmpError } = await supabase
        .from("companies")
        .update({ has_social_copilot: true })
        .eq("id", currentEntity.id);
      if (cmpError)
        console.error("Error enabling social copilot on company:", cmpError);

      alert("Perfil salvo com sucesso!");
      if (!profile) await fetchProfile(); // refresh to get ID
    } catch (error: any) {
      console.error("Error saving profile", error);
      alert("Erro ao salvar o perfil. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleConnectMeta = () => {
    if (!profile) {
      alert("Por favor, primeiro preencha e salve o Perfil da Marca.");
      return;
    }

    const FB = (window as any).FB;
    if (!FB) {
      alert(
        "Facebook SDK ainda não carregado. Aguarde um instante ou verifique extensões de bloqueio/AD Blocker.",
      );
      return;
    }

    setConnectingMeta(true);
    FB.login(
      (response: any) => {
        if (response.authResponse) {
          const accessToken = response.authResponse.accessToken;
          (async () => {
            try {
              const { data: session } = await supabase.auth.getSession();
              const token = session.session?.access_token;

              const res = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/social-meta-connect`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    short_lived_token: accessToken,
                    company_id: currentEntity.id,
                  }),
                },
              );

              if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Erro ao conectar");
              }

              const metaData = await res.json();
              alert(
                `Sucesso! Conectado comercialmente à conta Instagram: @${metaData.ig_username}`,
              );
              fetchProfile(); // refresh data to show IG info
            } catch (error: any) {
              console.error("Meta connect error", error);
              alert(`Falha ao conectar na API do Meta: ${error.message}`);
            } finally {
              setConnectingMeta(false);
            }
          })();
        } else {
          setConnectingMeta(false);
          console.log("Usuário cancelou o login no FB.");
        }
      },
      {
        scope:
          "pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish,business_management",
      },
    );
  };

  const handleDisconnectMeta = async () => {
    if (
      !confirm(
        "Tem certeza que deseja desconectar o Instagram? Isso pausará as postagens automáticas.",
      )
    )
      return;

    try {
      setConnectingMeta(true);
      const { error } = await supabase
        .from("social_profiles")
        .update({
          fb_access_token: null,
          fb_page_id: null,
          fb_page_name: null,
          ig_account_id: null,
          ig_username: null,
        })
        .eq("company_id", currentEntity.id);

      if (error) throw error;

      alert("Conta desconectada com sucesso.");
      fetchProfile(); // Atualiza a tela limpando o cache
    } catch (err: any) {
      console.error("Error disconnecting meta:", err);
      alert("Erro ao desconectar.");
    } finally {
      setConnectingMeta(false);
    }
  };

  const handlePublishNow = async (postId: string) => {
    const isConfirmed = window.confirm(
      "⚠️ ATENÇÃO: Esta postagem ainda está PENDENTE e pode não ter sido aprovada pelo cliente no WhatsApp.\n\nSe der continuídade, ela será postada IMEDIATAMENTE no Instagram.\n\nTem certeza que deseja forçar a publicação agora?",
    );
    if (!isConfirmed) return;

    try {
      setPublishingId(postId);
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/social-post-publisher`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ post_id: postId }),
        },
      );

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erro ao publicar.");

      alert("Sucesso! A postagem foi publicada no Instagram 🚀");
      await fetchPosts();
    } catch (error: any) {
      console.error("Falha ao publicar manualmente:", error);
      alert(`Falha ao publicar a postagem: ${error.message}`);
    } finally {
      setPublishingId(null);
    }
  };

  const handleGenerateStudio = async () => {
    try {
      setIsGeneratingStudio(true);
      setIsStudioOpen(true);

      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/social-script-generator`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({ company_id: currentEntity.id }),
        }
      );

      const res = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(res.error || "Erro desconhecido na geração");
      }

      setStudioScript(res.script || "");
    } catch (error: any) {
      console.error("Falha ao gerar roteiro:", error);
      alert(`Erro na IA do Google: ${error.message}`);
    } finally {
      setIsGeneratingStudio(false);
    }
  };

  const handleFinalizeStudio = async () => {
    if (!studioScript) return;
    try {
      setIsFinalizingStudio(true);

      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/social-post-finalizer`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            company_id: currentEntity.id,
            content: studioScript,
          }),
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Function error details:", errorData);
        throw new Error(`Erro na API (${res.status}): ${errorData.error || "Erro desconhecido"}`);
      }

      setIsStudioOpen(false);
      setStudioScript("");
      alert(
        "A IA está finalizando a mídia (imagem/vídeo) e enviará para seu WhatsApp!",
      );
      await fetchPosts();
    } catch (error: any) {
      console.error("Falha ao finalizar post do Studio:", error);
      alert("Erro ao tentar finalizar a postagem.");
    } finally {
      setIsFinalizingStudio(false);
    }
  };

  const handleSaveCampaign = async () => {
    if (!campaignTheme) {
      alert("Você precisa informar um tema para a campanha.");
      return;
    }
    try {
      setSavingCampaign(true);
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/social-copilot-campaign`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            company_id: currentEntity.id,
            theme: campaignTheme,
            post_count: campaignCount,
          }),
        },
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar campanha.");

      alert(
        `Campanha criada e salva com sucesso! Foram gerados ${data.count || campaignCount} posts.`,
      );
      setIsCreatingCampaign(false);
      setCampaignTheme("");
      setCampaignCount(3);
      await fetchPosts();
    } catch (error: any) {
      console.error("Erro ao gerar campanha:", error);
      alert("Falha ao gerar os posts da campanha. " + (error.message || ""));
    } finally {
      setSavingCampaign(false);
    }
  };

  const handleSavePostEdit = async () => {
    if (!editingPost) return;
    try {
      const { error } = await supabase
        .from("social_posts")
        .update({
          content: editContent,
          media_type: editMediaType,
        })
        .eq("id", editingPost.id);

      if (error) throw error;

      setPosts(
        posts.map((p) =>
          p.id === editingPost.id
            ? {
              ...p,
              content: editContent,
              media_type: editMediaType,
            }
            : p,
        ),
      );

      setEditingPost(null);
      alert("Postagem atualizada com sucesso!");
    } catch (error) {
      console.error("Erro ao editar post:", error);
      alert("Falha ao editar a postagem.");
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm("Tem certeza que deseja excluir esta postagem?"))
      return;
    try {
      const postToDelete = posts.find((p) => p.id === postId);

      // Excluir a imagem do Storage do Supabase se ela existir
      if (postToDelete?.image_url) {
        try {
          const urlParts = postToDelete.image_url.split(
            "/social_media_assets/",
          );
          if (urlParts.length > 1) {
            const filePath = urlParts[1];
            console.log("Removendo ativo do disco:", filePath);
            await supabase.storage
              .from("social_media_assets")
              .remove([filePath]);
          }
        } catch (storageError) {
          console.error(
            "Erro ignorado ao excluir imagem do storage:",
            storageError,
          );
        }
      }

      const { error } = await supabase
        .from("social_posts")
        .delete()
        .eq("id", postId);
      if (error) throw error;
      setPosts(posts.filter((p) => p.id !== postId));
    } catch (error) {
      console.error("Erro ao excluir post:", error);
      alert("Falha ao excluir o post.");
    }
  };

  const handleManualFileSelection = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
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
            topic: manualContent,
          }),
        },
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar postagem.");

      setManualContent(data.caption);
      setManualPreview(data.image_url);
      setManualFile(null);
    } catch (error: any) {
      console.error("Magic gen error:", error);
      alert("Falha ao gerar o conteúdo mágico. Tente novamente.");
    } finally {
      setIsGeneratingMagic(false);
    }
  };

  const handleSaveManualPost = async () => {
    if (!manualFile && !manualContent && !manualPreview) {
      alert(
        "Você precisa enviar uma imagem/vídeo ou preencher o texto da postagem.",
      );
      return;
    }

    try {
      setSavingManualPost(true);
      let publicUrl = null;

      if (manualFile) {
        const fileExt = manualFile.name.split(".").pop();
        const fileName = `${currentEntity.id}/${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("social_media_assets")
          .upload(fileName, manualFile);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from("social_media_assets")
          .getPublicUrl(fileName);
        publicUrl = data.publicUrl;
      } else if (manualPreview && manualPreview.startsWith("http")) {
        publicUrl = manualPreview;
      }

      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/social-post-publisher`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "create_manual_post",
            company_id: currentEntity.id,
            content: manualContent,
            image_url: publicUrl,
            media_type: manualMediaType,
            scheduled_for: selectedDate,
          }),
        },
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao publicar.");

      alert("Postagem criada e salva com sucesso!");
      setIsCreatingManualPost(false);
      setManualFile(null);
      setManualPreview(null);
      setManualContent("");
      setManualMediaType("feed");
      setSelectedDate(null);
      await fetchPosts();
    } catch (error: any) {
      console.error("Erro ao salvar post manual:", error);
      alert("Falha ao criar postagem manual.");
    } finally {
      setSavingManualPost(false);
    }
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || currentEntity.type !== "company") return;
    try {
      setUploadingLogo(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `${currentEntity.id}/brand-logo-${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("social_media_assets")
        .upload(fileName, file);
      if (uploadError) throw uploadError;
      const {
        data: { publicUrl },
      } = supabase.storage.from("social_media_assets").getPublicUrl(fileName);
      setBrandLogo(publicUrl);
    } catch (error) {
      console.error("Error uploading logo:", error);
      alert("Falha ao subir o logotipo.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleGenerateBlog = async () => {
    if (!blogTopic) return;
    setIsGeneratingBlog(true);
    setIsBlogModalOpen(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "social-blog-generator",
        {
          body: { company_id: currentEntity.id, topic: blogTopic },
        },
      );
      if (error) throw error;
      setBlogContent(data.content);
    } catch (err) {
      console.error("Error generating blog:", err);
      alert("Falha ao gerar o artigo.");
    } finally {
      setIsGeneratingBlog(false);
    }
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || currentEntity.type !== "company") return;

    try {
      setUploadingImage(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `${currentEntity.id}/${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      // 1. Fazer upload da imagem pro Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("social_media_assets")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Pegar a URL pública
      const {
        data: { publicUrl },
      } = supabase.storage.from("social_media_assets").getPublicUrl(filePath);

      console.log("Imagem enviada com sucesso: ", publicUrl);

      // Invocar a inteligência!
      const { error: visionError } = await supabase.functions.invoke(
        "social-copilot-vision",
        {
          body: { company_id: currentEntity.id, image_url: publicUrl },
        },
      );

      if (visionError) throw visionError;

      alert(
        "Tudo Certo! A IA leu sua foto e já enviou a postagem para aprovação no seu WhatsApp!",
      );

      // Recarregar posts
      await fetchPosts();
    } catch (error: any) {
      console.error("Erro no upload da imagem:", error);
      alert("Falha ao enviar e gerar a partir da foto.");
    } finally {
      setUploadingImage(false);
      // Reset input
      e.target.value = "";
    }
  };

  const fetchMetrics = async () => {
    setSyncingMetrics(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "social-metrics-sync",
        {
          body: { company_id: currentEntity.id },
        },
      );
      if (error) throw error;
      setMetrics(data);
    } catch (err) {
      console.error("Error fetching metrics:", err);
    } finally {
      setSyncingMetrics(false);
    }
  };

  useEffect(() => {
    if (activeApp === "analytics" && !metrics) {
      fetchMetrics();
    }
  }, [activeApp]);

  if (currentEntity.type !== "company") {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-full">
        <Sparkles size={48} className="text-gray-300 dark:text-gray-600 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Marketing IA
        </h2>
        <p className="text-gray-500">
          Selecione uma empresa para configurar o Copiloto Social.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-rose-500 to-orange-500 text-white rounded-2xl shadow-lg shadow-rose-500/20">
            <Sparkles size={32} className="animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white mt-1 uppercase tracking-tighter italic">
              Marketing Copilot <span className="text-rose-600">IA</span>
            </h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Inteligência Artificial para Negócios
            </p>
          </div>
        </div>

        {/* App Switcher */}
        <div className="flex items-center bg-gray-50 dark:bg-slate-900 p-1.5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveApp("social")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${activeApp === "social" ? "bg-white dark:bg-slate-700 text-rose-600 shadow-xl scale-[1.05] ring-1 ring-black/5" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800"}`}
          >
            <Instagram size={18} />
            Social IA
          </button>
          <button
            type="button"
            onClick={() => setActiveApp("blog")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${activeApp === "blog" ? "bg-white dark:bg-slate-700 text-rose-600 shadow-xl scale-[1.05] ring-1 ring-black/5" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800"}`}
          >
            <FileText size={18} />
            Blog IA
          </button>
          <button
            type="button"
            onClick={() => setActiveApp("analytics")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${activeApp === "analytics" ? "bg-white dark:bg-slate-700 text-rose-600 shadow-xl scale-[1.05] ring-1 ring-black/5" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800"}`}
          >
            <BarChart3 size={18} />
            Métricas
          </button>
        </div>
      </div>

      {activeApp === "social" && (
        <div className="animate-in fade-in slide-in-from-bottom-6 duration-1000 space-y-12">
          {/* TOP SECTION: PROFILE & CONNECTION */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Brand Profile */}
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 shadow-xl shadow-black/5 border border-gray-100 dark:border-slate-700 h-full">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-rose-500/10 rounded-2xl">
                    <Megaphone size={24} className="text-rose-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                      Perfil da Marca
                    </h2>
                    <p className="text-xs text-gray-500 font-medium tracking-tight">
                      Personalize como a IA deve se comportar e falar pela sua
                      empresa.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSave} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-6">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 px-1">
                          Nicho da Empresa
                        </label>
                        <Input
                          value={niche}
                          onChange={(e) => setNiche(e.target.value)}
                          placeholder="Ex: Consultório Odontológico..."
                          className="h-14 rounded-2xl border-gray-100 dark:border-slate-800 focus:ring-rose-500 bg-gray-50/50 dark:bg-slate-900/50 font-medium shadow-inner"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 px-1">
                          Tom de Voz
                        </label>
                        <Input
                          value={tone}
                          onChange={(e) => setTone(e.target.value)}
                          placeholder="Ex: Formal e educativo..."
                          className="h-14 rounded-2xl border-gray-100 dark:border-slate-800 focus:ring-rose-500 bg-gray-50/50 dark:bg-slate-900/50 font-medium shadow-inner"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 px-1">
                          Idioma de Geração
                        </label>
                        <select
                          value={language}
                          onChange={(e) => setLanguage(e.target.value)}
                          className="w-full h-14 px-4 rounded-2xl border border-gray-100 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-gray-50/50 dark:bg-slate-900/50 font-medium shadow-inner"
                        >
                          <option value="pt-BR">Português (Brasil)</option>
                          <option value="en-US">Inglês (EUA)</option>
                          <option value="es-ES">Espanhol (Espanha)</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 px-1">
                          Público-Alvo
                        </label>
                        <Input
                          value={audience}
                          onChange={(e) => setAudience(e.target.value)}
                          placeholder="Ex: Mães de 25 a 40 anos..."
                          className="h-14 rounded-2xl border-gray-100 dark:border-slate-800 focus:ring-rose-500 bg-gray-50/50 dark:bg-slate-900/50 font-medium shadow-inner"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 px-1">
                          WhatsApp Aprovação
                        </label>
                        <Input
                          value={approvalWhatsapp}
                          onChange={(e) =>
                            setApprovalWhatsapp(
                              formatWhatsAppMask(e.target.value),
                            )
                          }
                          placeholder="55 (00) 0 0000-0000"
                          maxLength={20}
                          className="h-14 rounded-2xl border-gray-100 dark:border-slate-800 focus:ring-rose-500 bg-gray-50/50 dark:bg-slate-900/50 font-mono font-bold shadow-inner"
                        />
                      </div>
                    </div>
                  </div>

                  {!hasWhatsappConnection ? (
                    <div className="p-4 bg-rose-50 dark:bg-rose-900/10 rounded-2xl border border-rose-100 dark:border-rose-800/50 flex items-start gap-3">
                      <AlertCircle
                        size={18}
                        className="text-rose-500 shrink-0 mt-0.5"
                      />
                      <div>
                        <p className="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-tight mb-1">
                          WhatsApp Desconectado
                        </p>
                        <p className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">
                          As postagens diárias não poderão ser enviadas. Conecte
                          no menu lateral.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800/50 flex items-start gap-3">
                      <ShieldCheck
                        size={18}
                        className="text-emerald-500 shrink-0 mt-0.5"
                      />
                      <div>
                        <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-tight mb-1">
                          Aprovação Ativa
                        </p>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          Você receberá as postagens matinais neste número para
                          aprovação.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="pt-8 border-t border-gray-100 dark:border-slate-700 mt-6 bg-slate-50/50 dark:bg-slate-900/30 p-6 rounded-3xl border border-gray-100 dark:border-slate-800">
                    <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2 mb-6 uppercase tracking-widest">
                      <Palette size={20} className="text-rose-500" />
                      Brand Kit & Estilo (Vídeo IA)
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                          Logotipo Principal
                        </label>
                        <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm">
                          <div className="w-16 h-16 rounded-xl bg-gray-50 dark:bg-slate-900 border border-dashed border-gray-200 dark:border-slate-700 flex items-center justify-center overflow-hidden relative group shrink-0">
                            {brandLogo ? (
                              <>
                                <img
                                  src={brandLogo}
                                  alt="Brand Logo"
                                  className="w-full h-full object-contain p-2"
                                />
                                <button
                                  type="button"
                                  onClick={() => setBrandLogo(null)}
                                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </>
                            ) : (
                              <ImageIcon size={20} className="text-gray-300" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <input
                              type="file"
                              id="brand-logo-upload"
                              className="hidden"
                              accept="image/*"
                              onChange={handleUploadLogo}
                              disabled={uploadingLogo}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                document
                                  .getElementById("brand-logo-upload")
                                  ?.click()
                              }
                              disabled={uploadingLogo}
                              className="w-full text-[10px] font-black uppercase h-10 rounded-xl bg-gray-50/50 border-gray-100 dark:bg-slate-900 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800"
                            >
                              {uploadingLogo
                                ? "Sincronizando..."
                                : "Alterar Logo"}
                            </Button>
                            <p className="text-[9px] text-gray-400 mt-2 font-medium">
                              PNG com fundo transparente.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                          Cores da Identidade
                        </label>
                        <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <input
                                type="color"
                                value={brandPrimaryColor}
                                onChange={(e) =>
                                  setBrandPrimaryColor(e.target.value)
                                }
                                className="w-12 h-12 rounded-xl cursor-pointer border-2 border-white dark:border-slate-700 bg-transparent transition-transform hover:scale-105"
                              />
                              <div className="min-w-0">
                                <p className="text-[9px] font-black uppercase text-gray-400">
                                  Principal
                                </p>
                                <span className="text-[10px] font-mono font-bold text-gray-600 dark:text-gray-400">
                                  {brandPrimaryColor}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="w-px h-8 bg-gray-100 dark:bg-slate-700"></div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <input
                                type="color"
                                value={brandSecondaryColor}
                                onChange={(e) =>
                                  setBrandSecondaryColor(e.target.value)
                                }
                                className="w-12 h-12 rounded-xl cursor-pointer border-2 border-white dark:border-slate-700 bg-transparent transition-transform hover:scale-105"
                              />
                              <div className="min-w-0">
                                <p className="text-[9px] font-black uppercase text-gray-400">
                                  Destaque
                                </p>
                                <span className="text-[10px] font-mono font-bold text-gray-600 dark:text-gray-400">
                                  {brandSecondaryColor}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 pt-8 border-t border-gray-100 dark:border-slate-700 animate-in fade-in slide-in-from-top-4 duration-500">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 px-1 flex items-center gap-1.5">
                            <User size={12} /> Gênero do Avatar (Apresentador)
                          </label>
                          <select
                            className="w-full h-12 px-4 border border-gray-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 text-xs font-bold text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all shadow-inner"
                            value={avatarGender}
                            onChange={(e) => setAvatarGender(e.target.value)}
                          >
                            <option value="male">
                              Masculino
                            </option>
                            <option value="female">
                              Feminino
                            </option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 px-1">
                            Estilo Visual da IA
                          </label>
                          <select
                            className="w-full h-12 px-4 border border-gray-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 text-xs font-bold text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all shadow-inner"
                            value={avatarStyle}
                            onChange={(e) => setAvatarStyle(e.target.value)}
                          >
                            <option value="professional">
                              Profissional / Corporativo
                            </option>
                            <option value="news">
                              Notícias / Jornalístico
                            </option>
                            <option value="casual">
                              Casual / Descontraído
                            </option>
                            <option value="educational">
                              Educativo / Aula
                            </option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-6 border-t border-gray-100 dark:border-slate-800 mt-8">
                      <div className="flex flex-wrap items-center gap-6">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setAutopilotEnabled(!autopilotEnabled)
                            }
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 ${autopilotEnabled ? "bg-amber-500" : "bg-gray-200 dark:bg-slate-700"}`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-all shadow-md ${autopilotEnabled ? "translate-x-6" : "translate-x-1"}`}
                            />
                          </button>
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                            Postar em Vídeo
                          </span>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        disabled={saving}
                        className="h-14 px-10 rounded-[1.25rem] bg-rose-600 hover:bg-rose-700 text-white font-black uppercase tracking-widest text-[10px] shadow-xl shadow-rose-500/20 transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-2"
                      >
                        <Save size={18} />
                        {saving ? "Gravando..." : "Salvar Perfil IA"}
                      </Button>
                    </div>
                  </div>
                </form>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2.5rem] p-8 shadow-xl shadow-indigo-500/10 text-white relative overflow-hidden group">
                <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/10 rounded-full blur-[80px] group-hover:bg-white/20 transition-all duration-700"></div>
                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm">
                      <Instagram size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black uppercase tracking-tighter leading-none">
                        Conectar IA
                      </h2>
                      <p className="text-[10px] text-indigo-100 font-medium opacity-80 mt-1">
                        Integração oficial via Meta Graph
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 mb-8">
                    {[
                      {
                        text: "Instagram como Conta Profissional",
                        icon: ShieldCheck,
                      },
                      {
                        text: "Vinculado à uma Página do Facebook",
                        icon: User,
                      },
                      {
                        text: "Permissões de mídia autorizadas",
                        icon: Sparkles,
                      },
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 text-xs font-medium text-indigo-50"
                      >
                        <div className="w-5 h-5 rounded-full bg-indigo-400/20 flex items-center justify-center shrink-0">
                          <item.icon size={12} className="text-white" />
                        </div>
                        {item.text}
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto space-y-4">
                    {!profile?.ig_account_id ? (
                      <>
                        <Button
                          onClick={handleConnectMeta}
                          disabled={connectingMeta || !profile}
                          className="w-full h-14 bg-white text-indigo-600 hover:bg-indigo-50 rounded-2xl flex items-center justify-center gap-3 font-black uppercase tracking-widest text-[10px] shadow-xl transition-all"
                        >
                          <Facebook size={18} />
                          {connectingMeta
                            ? "Sincronizando..."
                            : "Login com Meta"}
                        </Button>
                        {!profile && (
                          <p className="text-center text-[10px] text-indigo-200 font-bold uppercase tracking-tight">
                            Salve o perfil da marca primeiro
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="bg-emerald-50/20 p-5 rounded-3xl border border-emerald-400/30 backdrop-blur-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-yellow-400 via-rose-500 to-purple-600 flex items-center justify-center shadow-lg transform -rotate-3">
                          <Instagram size={24} className="text-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] uppercase tracking-widest text-emerald-200 font-black mb-0.5">
                            @perfil ativo
                          </p>
                          <p className="font-black text-white leading-none truncate text-sm">
                            @{profile.ig_username}
                          </p>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => setShowInstructions(true)}
                      className="w-full text-center text-[9px] font-black uppercase tracking-widest text-indigo-200/60 hover:text-white transition-colors py-2"
                    >
                      Precisa de ajuda? Ver tutorial
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm">
                <p className="text-xs text-gray-500 font-medium mb-3 pb-3 border-b border-gray-100 dark:border-slate-700">
                  Página Vinculada:{" "}
                  <strong className="text-gray-900 dark:text-white">
                    {profile?.fb_page_name || "Nenhuma"}
                  </strong>
                </p>
                <button
                  onClick={handleDisconnectMeta}
                  type="button"
                  disabled={connectingMeta}
                  className="w-full py-3 bg-gray-50 hover:bg-rose-50 dark:bg-slate-900 dark:hover:bg-rose-900/20 text-gray-400 hover:text-rose-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-gray-100 dark:border-slate-800"
                >
                  <Unplug size={14} />
                  {connectingMeta ? "Aguarde..." : "Desconectar Conta"}
                </button>
              </div>
            </div>
          </div>

          {profile && (
            <div className="mt-12 animate-in fade-in slide-in-from-bottom-7 duration-1000">
              <div className="flex flex-col lg:flex-row items-center justify-between mb-8 gap-6 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm">
                <div className="flex flex-col md:flex-row items-center gap-4">
                  <div className="bg-rose-500/10 p-3 rounded-2xl">
                    <Sparkles
                      size={24}
                      className="text-rose-500 animate-pulse"
                    />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-gray-900 dark:text-white leading-tight">
                      Conteúdo Gerado pela IA
                    </h2>
                    <p className="text-xs text-gray-500 font-medium">
                      Gerencie suas postagens agendadas e automáticas
                    </p>
                  </div>
                </div>

                <div className="flex items-center bg-gray-50 dark:bg-slate-900 p-1.5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-inner">
                  <button
                    onClick={() => setViewMode("feed")}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${viewMode === "feed" ? "bg-white dark:bg-slate-700 text-rose-600 shadow-md scale-[1.02]" : "text-gray-400 hover:text-gray-600"}`}
                  >
                    <LayoutGrid size={16} />
                    Feed
                  </button>
                  <button
                    onClick={() => setViewMode("calendar")}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${viewMode === "calendar" ? "bg-white dark:bg-slate-700 text-rose-600 shadow-md scale-[1.02]" : "text-gray-400 hover:text-gray-600"}`}
                  >
                    <Calendar size={16} />
                    Calendário
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 mb-8">
                <div className="flex flex-wrap items-center gap-3">
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
                      onClick={() =>
                        document.getElementById("image-upload")?.click()
                      }
                      disabled={uploadingImage}
                      variant="outline"
                      className="h-12 border-indigo-100 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-900/50 dark:text-indigo-400 dark:hover:bg-indigo-900/30 text-xs font-bold px-6 rounded-2xl transition-all hover:scale-[1.02]"
                    >
                      {uploadingImage ? (
                        <UploadCloud size={16} className="animate-pulse mr-2" />
                      ) : (
                        <ImageIcon size={16} className="mr-2" />
                      )}
                      {uploadingImage
                        ? "Lendo a Foto..."
                        : "Enviar Foto Real e Gerar"}
                    </Button>
                  </div>
                  <Button
                    onClick={() => setIsCreatingManualPost(true)}
                    variant="outline"
                    className="h-12 border-purple-100 text-purple-700 hover:bg-purple-50 dark:border-purple-900/50 dark:text-purple-400 dark:hover:bg-purple-900/30 text-xs font-bold px-6 rounded-2xl transition-all hover:scale-[1.02]"
                  >
                    <UploadCloud size={16} className="mr-2" />
                    Nova Postagem Manual
                  </Button>
                </div>

                <div className="flex-1 min-w-[20px] hidden md:block border-t border-dashed border-gray-200 dark:border-slate-700 opacity-50"></div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    onClick={handleGenerateStudio}
                    disabled={saving || uploadingImage}
                    className="h-12 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-6 rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all hover:scale-[1.02] active:scale-95"
                  >
                    🎬 Modo Studio (Gerar Roteiro)
                  </Button>
                  <Button
                    onClick={() => setIsCreatingCampaign(true)}
                    className="h-12 bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-700 hover:to-indigo-700 text-white text-xs font-bold px-6 rounded-2xl shadow-lg shadow-purple-200 dark:shadow-none transition-all hover:scale-[1.02] active:scale-95"
                  >
                    <Rocket size={16} className="mr-2" />
                    Lançar Campanha IA
                  </Button>
                </div>
              </div>

              {posts.length === 0 ? (
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-8 text-center border border-dashed border-gray-300 dark:border-slate-700">
                  <p className="text-gray-500">
                    Nenhuma postagem gerada ainda. Nossa IA vai trabalhar na
                    primeira durante a madrugada!
                  </p>
                </div>
              ) : viewMode === "feed" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400">
                              {new Date(post.created_at).toLocaleDateString()}
                            </span>
                            <select
                              className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold px-1 py-0.5 rounded border-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                              value={post.media_type || "feed"}
                              onChange={async (e) => {
                                const newType = e.target.value as
                                  | "feed"
                                  | "story"
                                  | "reels";
                                setPosts(
                                  posts.map((p) =>
                                    p.id === post.id
                                      ? { ...p, media_type: newType }
                                      : p,
                                  ),
                                );
                                await supabase
                                  .from("social_posts")
                                  .update({ media_type: newType })
                                  .eq("id", post.id);
                              }}
                            >
                              <option value="feed">FEED</option>
                              <option value="story">STORY</option>
                              <option value="reels">REELS</option>
                            </select>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${post.status === "pending"
                              ? "bg-yellow-100 text-yellow-700"
                              : post.status === "posted"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-gray-100 text-gray-700"
                              }`}
                          >
                            {post.status.toUpperCase()}
                          </span>
                        </div>
                        {post.image_url && (
                          <div className="mb-4 rounded-lg overflow-hidden border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
                            {post.media_type === "reels" ||
                              post.image_url.toLowerCase().endsWith(".mp4") ? (
                              <video
                                src={post.image_url}
                                controls
                                className="w-full h-auto object-cover max-h-64 bg-black"
                              />
                            ) : (
                              <img
                                src={post.image_url}
                                alt="Post asset"
                                className="w-full h-auto object-cover max-h-48"
                              />
                            )}
                          </div>
                        )}
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {post.content}
                        </p>
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            onClick={() => {
                              setEditingPost(post);
                              setEditContent(post.content);
                              setEditMediaType(
                                (post.media_type as any) || "feed",
                              );
                            }}
                          >
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs text-red-500 hover:bg-red-50 border-red-200"
                            onClick={() => handleDeletePost(post.id)}
                          >
                            Excluir
                          </Button>
                        </div>
                        {post.status === "pending" && (
                          <Button
                            size="sm"
                            disabled={publishingId === post.id}
                            onClick={() => handlePublishNow(post.id)}
                            className="bg-rose-500 hover:bg-rose-600 text-white text-xs disabled:opacity-50"
                          >
                            {publishingId === post.id
                              ? "Publicando..."
                              : "Postar Agora"}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Premium Calendar View Implementation */
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
                  {/* Calendar Header */}
                  <div className="flex items-center justify-between mb-6 px-2">
                    <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                      {calendarDate
                        .toLocaleString("pt-BR", {
                          month: "long",
                          year: "numeric",
                        })
                        .toUpperCase()}
                    </h3>
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-900 p-1.5 rounded-2xl border border-gray-100 dark:border-slate-800">
                      <button
                        onClick={() => {
                          const d = new Date(calendarDate);
                          d.setMonth(d.getMonth() - 1);
                          setCalendarDate(d);
                        }}
                        className="p-2 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm rounded-xl transition-all text-gray-500"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <button
                        onClick={() => setCalendarDate(new Date())}
                        className="px-3 py-1 text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                      >
                        Hoje
                      </button>
                      <button
                        onClick={() => {
                          const d = new Date(calendarDate);
                          d.setMonth(d.getMonth() + 1);
                          setCalendarDate(d);
                        }}
                        className="p-2 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm rounded-xl transition-all text-gray-500"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-px bg-gray-100 dark:bg-slate-700 border border-gray-100 dark:border-slate-700 rounded-2xl overflow-hidden shadow-inner">
                    {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(
                      (day) => (
                        <div
                          key={day}
                          className="bg-gray-50 dark:bg-slate-900/50 p-3 text-center border-b border-gray-100 dark:border-slate-800"
                        >
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            {day}
                          </span>
                        </div>
                      ),
                    )}
                    {Array.from({ length: 42 }).map((_, i) => {
                      const firstDayOfMonth = new Date(
                        calendarDate.getFullYear(),
                        calendarDate.getMonth(),
                        1,
                      );
                      const date = new Date(firstDayOfMonth);
                      date.setDate(date.getDate() - date.getDay() + i);

                      const dateStr = date.toISOString().split("T")[0];
                      const dayPosts = posts.filter(
                        (p) =>
                          (p.scheduled_for?.split("T")[0] ||
                            p.created_at.split("T")[0]) === dateStr,
                      );
                      const isToday =
                        new Date().toISOString().split("T")[0] === dateStr;
                      const isCurrentMonth =
                        date.getMonth() === calendarDate.getMonth();

                      return (
                        <div
                          key={i}
                          onClick={() => {
                            if (!isCurrentMonth) return;
                            setSelectedDate(dateStr);
                            setIsCreatingManualPost(true);
                          }}
                          className={`bg-white dark:bg-slate-800 min-h-[140px] p-3 relative hover:bg-rose-50/20 dark:hover:bg-rose-900/5 transition-colors border-r border-b border-gray-50 dark:border-slate-800/50 cursor-pointer group/day ${!isCurrentMonth ? "opacity-30 pointer-events-none" : "opacity-100"} ${isToday ? "bg-rose-50/10" : ""}`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span
                              className={`text-xs font-black ${isToday ? "bg-rose-500 text-white w-7 h-7 flex items-center justify-center rounded-full shadow-lg shadow-rose-500/40 animate-in zoom-in-50" : isCurrentMonth ? "text-gray-900 dark:text-white" : "text-gray-300"}`}
                            >
                              {date.getDate()}
                            </span>
                          </div>
                          <div className="space-y-1.5 overflow-y-auto max-h-[100px] custom-scrollbar">
                            {dayPosts.map((post) => (
                              <div
                                key={post.id}
                                onClick={() => {
                                  setEditingPost(post);
                                  setEditContent(post.content);
                                  setEditMediaType(
                                    (post.media_type as any) || "feed",
                                  );
                                }}
                                className={`text-[9px] p-2.5 rounded-2xl border leading-tight truncate cursor-pointer transition-all hover:scale-[1.04] active:scale-95 shadow-sm active:shadow-inner ${post.status === "approved"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400"
                                  : post.status === "posted"
                                    ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400"
                                    : post.status === "pending"
                                      ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400"
                                      : "bg-gray-50 text-gray-500 border-gray-100 dark:bg-slate-900 dark:border-slate-800"
                                  }`}
                              >
                                <div className="flex items-center gap-1.5">
                                  <div className="shrink-0">
                                    {post.media_type === "reels" ? "🎬" : "🖼️"}
                                  </div>
                                  <span className="font-bold opacity-90">
                                    {post.content.slice(0, 18)}...
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                          {isCurrentMonth &&
                            dayPosts.length === 0 &&
                            isToday && (
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-white/20 backdrop-blur-[1px] pointer-events-none">
                                <Sparkles
                                  size={24}
                                  className="text-rose-500/30"
                                />
                              </div>
                            )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeApp === "blog" && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl">
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-3xl font-black mb-4">
                  Gerador de Artigos IA (Blog IA)
                </h2>
                <p className="text-indigo-100 text-lg mb-6 leading-relaxed">
                  Transforme ideias em artigos otimizados para SEO que trazem
                  clientes orgânicos para o seu site no piloto automático.
                </p>

                <div className="max-w-xl mx-auto md:mx-0 space-y-4">
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Sparkles className="h-5 w-5 text-indigo-400 group-focus-within:text-white transition-colors" />
                    </div>
                    <input
                      type="text"
                      value={blogTopic}
                      onChange={(e) => setBlogTopic(e.target.value)}
                      placeholder="Sobre o que você quer escrever hoje?"
                      className="block w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white/20 transition-all shadow-lg"
                    />
                  </div>
                  <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                    <Button
                      onClick={handleGenerateBlog}
                      disabled={!blogTopic || isGeneratingBlog}
                      className="bg-white text-indigo-600 hover:bg-gray-50 font-black px-8 py-6 rounded-2xl shadow-lg shadow-black/20 text-md"
                    >
                      {isGeneratingBlog
                        ? "Gerando Mágica..."
                        : "Escrever Artigo Agora"}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="w-full md:w-64 h-auto bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 flex flex-col items-center justify-center p-6 text-center">
                <Zap size={48} className="text-amber-300 mb-4" />
                <p className="text-sm font-black mb-2">
                  Piloto Automático (Blog)
                </p>
                <button
                  onClick={() => setBlogAutopilotEnabled(!blogAutopilotEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${blogAutopilotEnabled ? "bg-amber-500" : "bg-white/20"}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${blogAutopilotEnabled ? "translate-x-6" : "translate-x-1"}`}
                  />
                </button>
                <p className="text-[10px] text-indigo-200 mt-3 font-semibold uppercase tracking-tighter">
                  Postagem semanal automática de SEO
                </p>
              </div>
            </div>
            <div className="absolute -top-12 -right-12 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl"></div>
          </div>
        </div>
      )}

      {activeApp === "analytics" && (
        <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 space-y-6">
          <div className="flex items-center justify-between mb-8 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-500/10 p-3 rounded-2xl">
                <BarChart3 size={24} className="text-indigo-600" />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white leading-tight uppercase tracking-tighter">
                  Performance & ROI
                </h2>
                <p className="text-xs text-gray-500 font-medium">
                  Dados reais sincronizados do Instagram Business
                </p>
              </div>
            </div>
            <Button
              onClick={fetchMetrics}
              disabled={syncingMetrics}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl px-6 h-12 text-xs font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all hover:scale-[1.02]"
            >
              {syncingMetrics ? "Sincronizando..." : "Sincronizar Agora"}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm transition-all hover:shadow-lg">
                <div className="flex items-center gap-3 mb-2 text-rose-500">
                  <Heart size={20} />
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400">
                    Curtidas
                  </span>
                </div>
                <div className="text-3xl font-black text-gray-900 dark:text-white">
                  {syncingMetrics
                    ? "..."
                    : metrics?.summary?.total_likes || "0"}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm transition-all hover:shadow-lg">
                <div className="flex items-center gap-3 mb-2 text-indigo-500">
                  <Users size={20} />
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400">
                    Alcance
                  </span>
                </div>
                <div className="text-3xl font-black text-gray-900 dark:text-white">
                  {syncingMetrics
                    ? "..."
                    : metrics?.summary?.total_reach || "0"}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm transition-all hover:shadow-lg">
                <div className="flex items-center gap-3 mb-2 text-amber-500">
                  <MessageCircle size={20} />
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400">
                    Comentários
                  </span>
                </div>
                <div className="text-3xl font-black text-gray-900 dark:text-white">
                  {syncingMetrics
                    ? "..."
                    : metrics?.summary?.total_comments || "0"}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm transition-all hover:shadow-lg">
                <div className="flex items-center gap-3 mb-2 text-purple-500">
                  <TrendingUp size={20} />
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400">
                    Engajamento
                  </span>
                </div>
                <div className="text-3xl font-black text-gray-900 dark:text-white">
                  {syncingMetrics
                    ? "..."
                    : metrics?.summary?.avg_engagement || "0%"}
                </div>
              </div>
            </div>

            {/* ROI Dashboard Card (Phase 9) */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-3xl text-white shadow-lg relative overflow-hidden group">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                    <DollarSign size={20} />
                  </div>
                  <span className="text-[10px] font-black uppercase bg-emerald-400/30 px-2 py-1 rounded-lg">
                    Inteligência ROI
                  </span>
                </div>
                <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest mb-1">
                  Retorno Estimado (LCR)
                </p>
                <div className="text-4xl font-black mb-4">
                  {syncingMetrics
                    ? "..."
                    : `R$ ${metrics?.summary?.total_roi?.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) || "0,00"}`}
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-50 bg-white/10 p-2 rounded-xl border border-white/10">
                  <Target size={14} />
                  <span>
                    {syncingMetrics
                      ? "..."
                      : metrics?.summary?.total_conversions || "0"}{" "}
                    Conversões de Venda
                  </span>
                </div>
              </div>
              <div className="absolute -bottom-4 -right-4 text-white/5 group-hover:text-white/10 transition-colors">
                <TrendingUp size={120} />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-gray-100 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                  Evolução de Performance
                </h3>
                <p className="text-gray-500 text-sm">
                  Visualização de curtidas e alcance das últimas 7 postagens
                </p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                  <span className="text-[10px] font-bold uppercase text-gray-400">
                    Curtidas
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                  <span className="text-[10px] font-bold uppercase text-gray-400">
                    Alcance
                  </span>
                </div>
              </div>
            </div>

            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={[...posts]
                    .filter(
                      (p) =>
                        p.status === "posted" && p.likes_count !== undefined,
                    )
                    .reverse()
                    .slice(-7)
                    .map((p) => ({
                      name: new Date(
                        p.posted_at || p.created_at,
                      ).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                      }),
                      likes: p.likes_count || 0,
                      reach:
                        p.reach_count || Math.floor((p.likes_count || 0) * 8.5), // Alcance estimado se não houver real
                    }))}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorLikes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorReach" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f1f5f9"
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "16px",
                      border: "none",
                      boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
                    }}
                    itemStyle={{ fontSize: "12px", fontWeight: 800 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="likes"
                    stroke="#f43f5e"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorLikes)"
                  />
                  <Area
                    type="monotone"
                    dataKey="reach"
                    stroke="#6366f1"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorReach)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criação de Post Manual */}
      {isCreatingManualPost && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-gray-100 dark:border-slate-700 my-8">
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
              <UploadCloud size={20} className="text-purple-500" />
              Criar Postagem Manualmente
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              Monte a sua postagem e ela ficará pendente na lista para
              publicação no Instagram.
            </p>

            <div className="space-y-4">
              {/* Upload da Imagem */}
              <div
                className="border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900/50 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer relative overflow-hidden"
                onClick={() =>
                  document.getElementById("manual-image-upload")?.click()
                }
              >
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
                    <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                      Criando Imagem e Legenda...
                    </p>
                  </div>
                ) : manualPreview ? (
                  <img
                    src={manualPreview}
                    alt="Preview"
                    className="absolute inset-0 w-full h-full object-contain bg-black/5"
                  />
                ) : (
                  <>
                    <ImageIcon size={32} className="text-gray-400 mb-2" />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      Clique para enviar Imagem/Vídeo
                    </span>
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
                  onChange={(e) => setManualMediaType(e.target.value as any)}
                >
                  <option value="feed">Feed (Instagram Feed)</option>
                  <option value="story">Story</option>
                  <option value="reels">
                    Reels (Certifique-se de enviar um Vídeo!)
                  </option>
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
                    {isGeneratingMagic
                      ? "Criando Mágica..."
                      : "Varinha Mágica (IA)"}
                  </button>
                </div>
                <textarea
                  className="w-full h-32 p-3 border border-gray-200 dark:border-slate-700 rounded-xl resize-none bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-sm"
                  value={manualContent}
                  onChange={(e) => setManualContent(e.target.value)}
                  placeholder="Escreva a legenda da postagem aqui..."
                />
              </div>
            </div>

            <div className="flex justify-between items-center mt-6">
              {selectedDate && (
                <div className="text-[10px] font-black uppercase tracking-widest text-purple-600 bg-purple-50 dark:bg-purple-900/30 px-3 py-1.5 rounded-lg border border-purple-100 dark:border-purple-800">
                  📅 Agendado para:{" "}
                  {new Date(selectedDate + "T12:00:00").toLocaleDateString(
                    "pt-BR",
                  )}
                </div>
              )}
              <div className="flex gap-3 ml-auto">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreatingManualPost(false);
                    setManualPreview(null);
                    setManualFile(null);
                    setManualContent("");
                    setManualMediaType("feed");
                    setSelectedDate(null);
                  }}
                  className="dark:border-slate-600 dark:text-slate-300"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveManualPost}
                  disabled={savingManualPost}
                  className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/30"
                >
                  {savingManualPost ? "Salvando..." : "Salvar Postagem"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição de Post (Autogerados) */}
      {editingPost && (
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
                  onChange={(e) => setEditMediaType(e.target.value as any)}
                >
                  <option value="feed">Feed (Instagram Feed)</option>
                  <option value="story">Story</option>
                  <option value="reels">
                    Reels (Certifique-se de enviar um Vídeo!)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Legenda
                </label>
                <textarea
                  className="w-full h-56 p-4 border border-gray-200 dark:border-slate-700 rounded-xl resize-none bg-gray-50 dark:bg-slate-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all font-medium"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Escreva a legenda incrível aqui..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setEditingPost(null)}
                className="dark:border-slate-600 dark:text-slate-300"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSavePostEdit}
                className="bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-500/30"
              >
                Salvar Alterações
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Instruções Face/Insta */}
      {showInstructions && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-2xl shadow-2xl border border-gray-100 dark:border-slate-700 my-8">
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
              <Instagram size={24} className="text-pink-500" />
              Como Preparar seu Instagram para a Automação
            </h3>

            <div className="space-y-6 text-sm text-gray-700 dark:text-gray-300">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/50">
                <p className="font-semibold text-blue-800 dark:text-blue-300 mb-1">
                  Por que preciso fazer isso?
                </p>
                <p className="text-xs">
                  Para que nosso sistema (ou qualquer outro sistema de
                  inteligência) consiga postar no seu Instagram automaticamente
                  sem precisar da sua senha, o Facebook exige que a conta siga
                  regras profissionais de segurança.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-2 flex gap-2">
                  <span className="bg-gray-200 dark:bg-slate-700 w-5 h-5 rounded-full flex items-center justify-center text-xs">
                    1
                  </span>{" "}
                  Mudar para Conta Profissional
                </h4>
                <ol className="list-decimal list-inside space-y-1 ml-2 text-xs">
                  <li>Abra o aplicativo do Instagram no seu celular.</li>
                  <li>
                    Vá no seu <strong>Perfil</strong> e toque nos{" "}
                    <strong>3 tracinhos</strong> (Menu) no canto superior
                    direito.
                  </li>
                  <li>
                    Vá em <strong>Configurações</strong> {">"} Tipo de conta e
                    ferramentas.
                  </li>
                  <li>
                    Toque em{" "}
                    <strong>Mudar para conta profissional / empresarial</strong>{" "}
                    e siga até o final.
                  </li>
                </ol>
              </div>

              <hr className="border-gray-100 dark:border-slate-700" />

              <div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-2 flex gap-2">
                  <span className="bg-gray-200 dark:bg-slate-700 w-5 h-5 rounded-full flex items-center justify-center text-xs">
                    2
                  </span>{" "}
                  Vincular a uma Página do Facebook
                </h4>
                <p className="text-xs mb-2 italic">
                  Dica: É muito mais fácil fazer isso pelo Computador!
                </p>
                <ol className="list-decimal list-inside space-y-1 ml-2 text-xs">
                  <li>
                    Acesse o <strong>Facebook.com</strong> e abra a Página da
                    sua empresa.
                  </li>
                  <li>
                    No menu lateral esquerdo, clique em{" "}
                    <strong>Configurações</strong>.
                  </li>
                  <li>
                    Procure por <strong>Contas Vinculadas</strong>.
                  </li>
                  <li>
                    Clique em <strong>Instagram</strong> e botão{" "}
                    <strong>Conectar Conta</strong>.
                  </li>
                  <li>Coloque a senha do seu Insta e confirme.</li>
                </ol>
              </div>

              <hr className="border-gray-100 dark:border-slate-700" />

              <div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-2 flex gap-2">
                  <span className="bg-gray-200 dark:bg-slate-700 w-5 h-5 rounded-full flex items-center justify-center text-xs">
                    3
                  </span>{" "}
                  Fazer o Vínculo Final aqui no Lucro Certo
                </h4>
                <ol className="list-decimal list-inside space-y-1 ml-2 text-xs">
                  <li>Feche esta janela.</li>
                  <li>
                    Clique no botão branco de{" "}
                    <strong>Fazer Login com Meta</strong>.
                  </li>
                  <li>
                    O Facebook vai abrir. Clique em{" "}
                    <strong>
                      Editar configurações / Escolher o que permitir
                    </strong>
                    .
                  </li>
                  <li>
                    Tenha a certeza absoluta de{" "}
                    <strong>
                      marcar a caixinha do seu Instagram e da sua página do
                      Facebook
                    </strong>{" "}
                    em todas as telas que aparecerem.
                  </li>
                  <li>Conclua!</li>
                </ol>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <Button
                onClick={() => setShowInstructions(false)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto"
              >
                Entendi, vou configurar!
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Nova Campanha IA */}
      {isCreatingCampaign && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-gray-100 dark:border-slate-700 my-8">
            <h3 className="text-lg font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-600 to-indigo-600 flex items-center gap-2">
              <Rocket size={24} className="text-fuchsia-600" />
              Lançar Campanha de Marketing
            </h3>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              Nossa Inteligência Artificial criará um pacote rápido de
              publicações super interligadas para sua marca num piscar de olhos.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tema da Campanha
                </label>
                <Input
                  placeholder="Ex: Liquidação de Inverno, Semana do Consumidor, Oferta de Relógios..."
                  value={campaignTheme}
                  onChange={(e) => setCampaignTheme(e.target.value)}
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
                  onClick={() => {
                    setIsCreatingCampaign(false);
                    setCampaignTheme("");
                    setCampaignCount(3);
                  }}
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
                  ) : (
                    "Lançar Foguete 🚀"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Studio Modal */}
      {isStudioOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-500/10 to-transparent">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <Video size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-none">
                    Studio de Criação
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Refine o roteiro da IA antes de gerar o vídeo/imagem final.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsStudioOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2"
              >
                <Save size={20} className="rotate-45" />{" "}
                {/* Close icon workaround if X not in imports */}
              </button>
            </div>

            <div className="p-6 space-y-4">
              {isGeneratingStudio ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-4">
                  <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-indigo-600 font-medium animate-pulse">
                    A IA está escrevendo o seu roteiro perfeito...
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Roteiro Sugerido (Você pode editar aqui embaixo)
                    </label>
                    <textarea
                      className="w-full h-80 p-5 border border-gray-200 dark:border-slate-700 rounded-2xl resize-none bg-gray-50 dark:bg-slate-950 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium leading-relaxed"
                      value={studioScript}
                      onChange={(e) => setStudioScript(e.target.value)}
                      placeholder="A IA vai colocar o texto aqui..."
                    />
                  </div>

                  <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800/50 flex items-start gap-3">
                    <Sparkles
                      size={18}
                      className="text-indigo-500 mt-0.5 shrink-0"
                    />
                    <p className="text-xs text-indigo-700 dark:text-indigo-300">
                      <strong>Dica do Mentor:</strong> Tente manter o texto
                      entre 30 e 60 segundos de fala para melhor engajamento.
                      Adicione ganchos mentais nos primeiros 3 segundos!
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="p-6 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-800 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsStudioOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={
                  isGeneratingStudio || isFinalizingStudio || !studioScript
                }
                onClick={handleFinalizeStudio}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-lg shadow-indigo-500/20 px-8"
              >
                {isFinalizingStudio ? (
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Gerando Postagem...</span>
                    </div>
                    <span className="text-[10px] opacity-70 mt-0.5 font-mono">
                      Tempo Decorrido: {formatTime(executionTime)}
                    </span>
                  </div>
                ) : (
                  <>
                    <Rocket size={18} />
                    Finalizar Postagem 🚀
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Studio de Criação de Blog */}
      {isBlogModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-500/10 to-transparent">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <FileText size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-none">
                    Editor de Artigo IA
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Revise seu artigo otimizado para SEO antes de publicar.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBlogModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2 border border-gray-100 dark:border-slate-800 rounded-xl"
              >
                <Save size={18} className="rotate-45" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              {isGeneratingBlog ? (
                <div className="py-24 flex flex-col items-center justify-center space-y-4">
                  <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-indigo-600 font-bold text-xl animate-pulse">
                    A IA está pesquisando e escrevendo seu artigo...
                  </p>
                  <p className="text-gray-400 text-sm">
                    Isso pode levar até 30 segundos devido ao tamanho do
                    conteúdo.
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-2xl border border-amber-100 dark:border-amber-800/50 flex items-start gap-3 mb-2">
                    <Sparkles
                      size={18}
                      className="text-amber-500 mt-0.5 shrink-0"
                    />
                    <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                      <strong>Dica de SEO:</strong> Este artigo foi estruturado
                      com H1, H2 e palavras-chave semânticas. Você pode copiar
                      este texto e colar no seu WordPress, Wix ou Blog próprio.
                    </p>
                  </div>

                  <div className="flex-1 min-h-[400px]">
                    <textarea
                      className="w-full h-full min-h-[500px] p-8 border border-gray-200 dark:border-slate-700 rounded-3xl resize-none bg-gray-50 dark:bg-slate-950 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-serif text-lg leading-relaxed shadow-inner"
                      value={blogContent}
                      onChange={(e) => setBlogContent(e.target.value)}
                      placeholder="Seu artigo vai aparecer aqui..."
                    />
                  </div>
                </>
              )}
            </div>

            <div className="p-6 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-800 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setIsBlogModalOpen(false)}
                className="rounded-2xl px-6"
              >
                Fechar
              </Button>
              <Button
                disabled={isGeneratingBlog || !blogContent}
                onClick={() => {
                  navigator.clipboard.writeText(blogContent);
                  alert(
                    "Artigo copiado para a área de transferência! Cole no seu blog.",
                  );
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-lg shadow-indigo-500/20 px-8 rounded-2xl"
              >
                <Save size={18} />
                Copiar e Finalizar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
