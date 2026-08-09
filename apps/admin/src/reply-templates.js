const TEMPLATES = {
  hot: `Hola {{name}}, vi tu interés en {{service}} para {{business}}. ¿Te parece si agendamos 15 min hoy o mañana para revisar la cotización?`,
  warm: `Hola {{name}}, gracias por escribirnos sobre {{service}}. Te puedo enviar un resumen claro de cómo lo resolveríamos para {{business}}. ¿Prefieres WhatsApp o una llamada corta?`,
  cold: `Hola {{name}}, te dejo info útil sobre {{service}} por si más adelante encaja con {{business}}. Cuando quieras profundizar, aquí estamos.`,
  generic: `Hola {{name}}, soy del equipo de Luenio. ¿En qué te puedo ayudar con {{service}} para {{business}}?`,
};

const EMAIL_TEMPLATES = {
  hot: {
    subject: `Cotización {{service}} — {{business}}`,
    body: `Hola {{name}},\n\nGracias por tu interés en {{service}} para {{business}}.\n\n¿Te parece si agendamos 15 minutos hoy o mañana para revisar alcance y tiempos?\n\nQuedo atento,\nEquipo Luenio`,
  },
  warm: {
    subject: `Información sobre {{service}}`,
    body: `Hola {{name}},\n\nTe escribo por tu consulta de {{service}} para {{business}}.\n\nPuedo enviarte un resumen claro de cómo lo implementaríamos. ¿Prefieres continuar por correo o WhatsApp?\n\nSaludos,\nEquipo Luenio`,
  },
  cold: {
    subject: `Material sobre {{service}}`,
    body: `Hola {{name}},\n\nTe dejo información útil sobre {{service}} por si más adelante encaja con {{business}}.\n\nCuando quieras profundizar, aquí estamos.\n\nSaludos,\nEquipo Luenio`,
  },
  generic: {
    subject: `Seguimiento Luenio — {{business}}`,
    body: `Hola {{name}},\n\nSoy del equipo de Luenio. ¿En qué te puedo ayudar con {{service}} para {{business}}?\n\nSaludos,\nEquipo Luenio`,
  },
};

function fill(template, lead = {}) {
  return template
    .replaceAll("{{name}}", lead.name || "allí")
    .replaceAll("{{business}}", lead.business || "tu negocio")
    .replaceAll("{{service}}", lead.service || "automatización");
}

export function getReplyTemplate(lead = {}) {
  const classification = lead.classification || "generic";
  const template = TEMPLATES[classification] || TEMPLATES.generic;
  return fill(template, lead);
}

export function getEmailTemplate(lead = {}) {
  const classification = lead.classification || "generic";
  const template = EMAIL_TEMPLATES[classification] || EMAIL_TEMPLATES.generic;
  return {
    subject: fill(template.subject, lead),
    body: fill(template.body, lead),
  };
}

export function buildMailtoUrl(lead = {}) {
  const email = getEmailTemplate(lead);
  return `mailto:?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
}

export function phoneDigitsForWhatsApp(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 10) return "";
  return digits;
}

export function buildWhatsAppUrl(lead = {}) {
  const digits = phoneDigitsForWhatsApp(lead.phone);
  if (!digits) return "";
  const text = encodeURIComponent(getReplyTemplate(lead));
  return `https://wa.me/${digits}?text=${text}`;
}

export { TEMPLATES };
