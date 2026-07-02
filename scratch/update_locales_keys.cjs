const fs = require('fs');
const path = require('path');

const locales = {
  'pt-BR': {
    campaigns: {
      special_offer: "OFERTA ESPECIAL",
      news: "NOVIDADE",
      highlight: "DESTAQUE"
    },
    lead: {
      success_title: "Cadastro Confirmado!",
      success_subtitle: "Seus dados foram enviados com sucesso para processamento.",
      close: "Fechar",
      form_title: "Preencha seus dados",
      form_subtitle: "Por favor, insira as informações obrigatórias para prosseguir.",
      fullname_label: "Nome Completo *",
      fullname_placeholder: "SEU NOME COMPLETO",
      phone_label: "WhatsApp / Telefone *",
      phone_placeholder: "55(84) 9 9807-1213",
      email_label: "E-mail (Opcional)",
      email_placeholder: "SEU-EMAIL@DOMINIO.COM",
      back: "Voltar",
      submit: "Finalizar Cadastro"
    },
    pricing_period: {
      "mês": "mês",
      "ano": "ano",
      "month": "mês",
      "year": "ano"
    },
    video: {
      title: "Apresentação Lucro Certo"
    }
  },
  'pt-PT': {
    campaigns: {
      special_offer: "OFERTA ESPECIAL",
      news: "NOVIDADE",
      highlight: "DESTAQUE"
    },
    lead: {
      success_title: "Registo Confirmado!",
      success_subtitle: "Os seus dados foram enviados com sucesso para processamento.",
      close: "Fechar",
      form_title: "Preencha os seus dados",
      form_subtitle: "Por favor, introduza as informações obrigatórias para prosseguir.",
      fullname_label: "Nome Completo *",
      fullname_placeholder: "O SEU NOME COMPLETO",
      phone_label: "WhatsApp / Telefone *",
      phone_placeholder: "55(84) 9 9807-1213",
      email_label: "E-mail (Opcional)",
      email_placeholder: "O-SEU-EMAIL@DOMINIO.COM",
      back: "Voltar",
      submit: "Finalizar Registo"
    },
    pricing_period: {
      "mês": "mês",
      "ano": "ano",
      "month": "mês",
      "year": "ano"
    },
    video: {
      title: "Apresentação Lucro Certo"
    }
  },
  'en': {
    campaigns: {
      special_offer: "SPECIAL OFFER",
      news: "NEWS",
      highlight: "HIGHLIGHT"
    },
    lead: {
      success_title: "Registration Confirmed!",
      success_subtitle: "Your data has been successfully sent for processing.",
      close: "Close",
      form_title: "Fill in your details",
      form_subtitle: "Please enter the required information to proceed.",
      fullname_label: "Full Name *",
      fullname_placeholder: "YOUR FULL NAME",
      phone_label: "WhatsApp / Phone *",
      phone_placeholder: "55(84) 9 9807-1213",
      email_label: "Email (Optional)",
      email_placeholder: "YOUR-EMAIL@DOMAIN.COM",
      back: "Back",
      submit: "Finish Registration"
    },
    pricing_period: {
      "mês": "month",
      "ano": "year",
      "month": "month",
      "year": "year"
    },
    video: {
      title: "Lucro Certo Presentation"
    }
  },
  'es': {
    campaigns: {
      special_offer: "OFERTA ESPECIAL",
      news: "NOVEDAD",
      highlight: "DESTACADO"
    },
    lead: {
      success_title: "¡Registro Confirmado!",
      success_subtitle: "Sus datos han sido enviados con éxito para su procesamiento.",
      close: "Cerrar",
      form_title: "Complete sus datos",
      form_subtitle: "Por favor, ingrese la información obligatoria para continuar.",
      fullname_label: "Nombre Completo *",
      fullname_placeholder: "SU NOMBRE COMPLETO",
      phone_label: "WhatsApp / Teléfono *",
      phone_placeholder: "55(84) 9 9807-1213",
      email_label: "Correo Electrónico (Opcional)",
      email_placeholder: "SU-CORREO@DOMINIO.COM",
      back: "Volver",
      submit: "Finalizar Registro"
    },
    pricing_period: {
      "mês": "mes",
      "ano": "año",
      "month": "mes",
      "year": "año"
    },
    video: {
      title: "Presentación de Lucro Certo"
    }
  },
  'fr': {
    campaigns: {
      special_offer: "OFFRE SPÉCIALE",
      news: "NOUVEAUTÉ",
      highlight: "EN VEDETTE"
    },
    lead: {
      success_title: "Inscription Confirmée !",
      success_subtitle: "Vos données ont été envoyées avec succès pour traitement.",
      close: "Fermer",
      form_title: "Remplissez vos coordonnées",
      form_subtitle: "Veuillez saisir les informations obligatoires pour continuer.",
      fullname_label: "Nom Complet *",
      fullname_placeholder: "VOTRE NOM COMPLET",
      phone_label: "WhatsApp / Téléphone *",
      phone_placeholder: "55(84) 9 9807-1213",
      email_label: "E-mail (Optionnel)",
      email_placeholder: "VOTRE-EMAIL@DOMAINE.COM",
      back: "Retour",
      submit: "Finaliser l'Inscription"
    },
    pricing_period: {
      "mês": "mois",
      "ano": "an",
      "month": "mois",
      "year": "an"
    },
    video: {
      title: "Présentation de Lucro Certo"
    }
  }
};

const localesDir = 'c:/Projeto-antigravity/src/i18n/locales';

for (const [lang, data] of Object.entries(locales)) {
  const filePath = path.join(localesDir, `${lang}.json`);
  if (!fs.existsSync(filePath)) {
    console.error(`Arquivo não encontrado: ${filePath}`);
    continue;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  let json;
  try {
    json = JSON.parse(content);
  } catch (err) {
    console.error(`Erro ao fazer parse de ${filePath}:`, err);
    continue;
  }
  
  if (!json.landing) {
    console.error(`Chave 'landing' não encontrada em ${filePath}`);
    continue;
  }
  
  // Inserir/Atualizar chaves
  json.landing.campaigns = data.campaigns;
  json.landing.lead = data.lead;
  
  if (!json.landing.pricing) {
    json.landing.pricing = {};
  }
  json.landing.pricing.period = data.pricing_period;
  
  json.landing.video = data.video;
  
  // Gravar de volta preservando formatação de 4 espaços
  fs.writeFileSync(filePath, JSON.stringify(json, null, 4), 'utf8');
  console.log(`Sucesso ao atualizar ${filePath}`);
}
