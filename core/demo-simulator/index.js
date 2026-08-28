export const demoTypes = [
  "restaurants",
  "real-estate",
  "gym",
  "ecommerce",
  "agencies",
  "veterinary",
  "aesthetics",
];

const CLASSIFICATION_LABELS = { hot: "CALIENTE", warm: "TIBIO", cold: "FRÍO" };

const demoAliases = {
  restaurant: "restaurants",
  restaurants: "restaurants",
  "real-estate": "real-estate",
  "real estate": "real-estate",
  gym: "gym",
  ecommerce: "ecommerce",
  agency: "agencies",
  agencies: "agencies",
  veterinary: "veterinary",
  veterinaria: "veterinary",
  veterinarias: "veterinary",
  aesthetics: "aesthetics",
  estetica: "aesthetics",
  estéticas: "aesthetics",
  esteticas: "aesthetics",
};

const demoConfigs = {
  restaurants: {
    label: "Restaurantes",
    headline: "Recupera pedidos perdidos por WhatsApp lento.",
    lead: {
      name: "Valentina Cruz",
      business: "Mesa Norte",
      service: "Pedido por WhatsApp",
      message: "Hola, estoy cerca de Chapinero. ¿Tienen menú para pedir ahora?",
      source: "WhatsApp",
      score: 94,
      classification: "hot",
    },
    aiReply:
      "Hola, sí. Te comparto el menú de hoy: hamburguesas, bowls, pastas y bebidas. Si estás en Chapinero podemos coordinar tu pedido ahora. ¿Qué te gustaría pedir?",
    captureLabel: "Pedido capturado",
    pain: "Cada WhatsApp sin respuesta puede convertirse en una mesa vacía o un pedido perdido.",
    automation: ["Confirmar disponibilidad", "Guardar reserva en CRM", "Enviar menú y ubicación"],
  },
  "real-estate": {
    label: "Inmobiliarias",
    headline: "Califica compradores antes de que el equipo comercial llame.",
    lead: {
      name: "Mateo Vargas",
      business: "Vivienda Capital",
      service: "Filtro de compradores",
      message:
        "Busco apartamento en el norte, máximo 320 mil dólares, y quiero visitar esta semana.",
      source: "Sitio web",
      score: 88,
      classification: "hot",
    },
    aiReply:
      "Perfecto. Con ese presupuesto puedo mostrarte apartamentos en el norte y filtrar opciones con visita esta semana. Te asigno un asesor con dos propiedades que encajan.",
    captureLabel: "Comprador calificado",
    crmStage: "Pipeline de compradores",
    pain: "Cuando una inmobiliaria responde tarde, pierde compradores con presupuesto claro y alta intención de visita.",
    properties: [
      {
        name: "Apartamento Norte · ejemplo ficticio",
        status: "Coincidencia",
        detail: "2 habitaciones · valor ilustrativo: $318k",
      },
      {
        name: "Proyecto Cedro · ejemplo ficticio",
        status: "Alternativa",
        detail: "Entrega ilustrativa 2027 · valor ilustrativo: $305k",
      },
      { name: "Visita", status: "Siguiente paso", detail: "Asesor asignado" },
    ],
    automation: ["Clasificar presupuesto por reglas", "Asignar asesor", "Crear oportunidad en CRM"],
  },
  gym: {
    label: "Gimnasios",
    headline: "Convierte preguntas por precio en membresías.",
    lead: {
      name: "Santiago León",
      business: "Pulse Gym",
      service: "Membresía mensual",
      message:
        "Hola, vivo cerca del gimnasio. ¿Cuánto cuesta la mensualidad y puedo hacer una clase de prueba hoy?",
      source: "WhatsApp",
      score: 90,
      classification: "hot",
    },
    aiReply:
      "Tenemos plan mensual desde $39, trimestral con descuento y premium con clases. Como estás cerca, puedo agendarte una visita o clase de prueba hoy. ¿Qué hora te sirve?",
    captureLabel: "Interesado en membresía",
    crmStage: "Leads interesados",
    pain: "Responder tarde una pregunta de precio deja que el interesado se enfríe o se inscriba en otro gimnasio.",
    pricing: [
      { name: "Mensual", price: "$39 ilustrativo", detail: "Acceso libre" },
      { name: "Trimestral", price: "$99 ilustrativo", detail: "Ahorro + seguimiento" },
      { name: "Premium", price: "$149 ilustrativo", detail: "Clases + evaluación" },
    ],
    automation: ["Enviar planes", "Sugerir visita", "Crear seguimiento de inscripción"],
  },
  ecommerce: {
    label: "Ecommerce",
    headline: "Recupera ventas perdidas por chats abandonados.",
    lead: {
      name: "Mariana Gil",
      business: "Casa Áurea",
      service: "Consulta de producto",
      message:
        "Hola, ¿tienes disponible este producto en negro? Lo necesito para regalo esta semana.",
      source: "Web chat",
      score: 91,
      classification: "hot",
    },
    aiReply:
      "Sí, está disponible en negro y llega esta semana. También tenemos una alternativa premium con envío gratis hoy. ¿Quieres que te comparta el enlace de compra?",
    captureLabel: "Compra recuperada",
    crmStage: "Pipeline de ventas",
    pain: "Cada chat de producto sin respuesta enfría la intención de compra y empuja al cliente hacia otra tienda.",
    inventory: [
      { name: "Producto consultado", status: "Disponible", detail: "Stock: 12 unidades" },
      { name: "Alternativa premium", status: "Recomendada", detail: "Envío gratis hoy" },
      { name: "Complemento", status: "Venta adicional", detail: "Aumenta ticket promedio" },
    ],
    automation: [
      "Confirmar disponibilidad",
      "Sugerir alternativa",
      "Guardar intención de compra",
      "Mover a pipeline de ventas",
    ],
  },
  agencies: {
    label: "Agencias",
    headline: "Clasifica leads mediante reglas y ofrece automatización como servicio.",
    lead: {
      name: "Nicolás Prieto",
      business: "BrandOps",
      service: "Calificación de leads para clientes",
      message:
        "Tengo clientes con campañas activas y quiero que reciban más clientes sin perder leads por WhatsApp.",
      source: "Formulario",
      score: 93,
      classification: "hot",
    },
    aiReply:
      "Entiendo. Tu oportunidad es convertir cada lead de campaña en una conversación atendida. Esta simulación muestra WhatsApp, clasificación por reglas y pipeline como ejemplo de un servicio mensual.",
    captureLabel: "Cliente de alto valor",
    crmStage: "Pipeline de agencia",
    pain: "Una agencia pierde margen cuando califica leads manualmente para cada cliente y no convierte esa operación en un servicio recurrente.",
    clients: [
      {
        name: "Clínica Nova · cuenta ficticia",
        status: "Anuncios de leads",
        detail: "Calificación automática activa",
      },
      {
        name: "LegalHub · cuenta ficticia",
        status: "WhatsApp",
        detail: "Briefing comercial simulado",
      },
      {
        name: "Studio Vega · cuenta ficticia",
        status: "CRM",
        detail: "Pipeline ilustrativo actualizado",
      },
    ],
    automation: [
      "Analizar intención",
      "Sugerir servicio",
      "Etiquetar cliente de alto valor",
      "Crear oportunidad en pipeline de agencia",
    ],
  },
  veterinary: {
    label: "Veterinarias",
    headline: "Convierte consultas de mascotas en citas atendidas.",
    lead: {
      name: "Laura Méndez",
      business: "Luna, beagle de 4 años",
      service: "Consulta veterinaria",
      message:
        "Hola, Luna está decaída y necesito saber si tienen cita hoy. También quisiera preguntar por la vacuna anual.",
      source: "WhatsApp",
      score: 96,
      classification: "hot",
    },
    aiReply:
      "Hola, Laura. Podemos revisar a Luna hoy. Te comparto los horarios disponibles y dejo anotada la consulta por la vacuna anual para que el equipo llegue preparado. ¿Qué hora te funciona mejor?",
    captureLabel: "Cita veterinaria capturada",
    crmStage: "Citas por confirmar",
    pain: "Cuando una consulta de mascota queda sin respuesta, la familia busca otra clínica antes de agendar.",
    services: [
      { name: "Consulta general", detail: "Agenda prioritaria", status: "Disponible" },
      { name: "Vacunación", detail: "Recordatorio anual", status: "Sugerida" },
      { name: "Seguimiento", detail: "Mensaje postconsulta", status: "Automático" },
    ],
    automation: [
      "Priorizar contacto por reglas",
      "Proponer horario",
      "Crear cita en CRM",
      "Programar recordatorio",
    ],
  },
  aesthetics: {
    label: "Estéticas",
    headline: "Lleva cada consulta de belleza hasta la agenda.",
    lead: {
      name: "Camila Rojas",
      business: "Valoración facial",
      service: "Tratamiento estético",
      message:
        "Hola, quiero una valoración para manchas y textura. ¿Qué tratamiento recomiendan y tienen espacio esta semana?",
      source: "Instagram",
      score: 92,
      classification: "hot",
    },
    aiReply:
      "Hola, Camila. Podemos empezar con una valoración personalizada y recomendarte el tratamiento adecuado después de revisar tu piel. Tengo espacios esta semana y te puedo reservar uno ahora.",
    captureLabel: "Valoración agendada",
    crmStage: "Valoraciones nuevas",
    pain: "Una respuesta tardía en Instagram deja la intención de cuidado personal en manos de otro centro.",
    services: [
      { name: "Valoración facial", detail: "Primera visita", status: "Recomendada" },
      { name: "Limpieza profunda", detail: "60 minutos", status: "Disponible" },
      { name: "Seguimiento", detail: "Rutina personalizada", status: "Automático" },
    ],
    automation: [
      "Entender necesidad",
      "Sugerir valoración",
      "Reservar espacio",
      "Activar seguimiento",
    ],
  },
};

export function normalizeDemoType(type = "restaurants") {
  return demoAliases[String(type).trim().toLowerCase()] || "restaurants";
}

export function getDemoConfig(type = "restaurants") {
  return demoConfigs[normalizeDemoType(type)] || demoConfigs.restaurants;
}

export function createDemoScenario(type = "restaurants") {
  const normalizedType = normalizeDemoType(type);
  const config = getDemoConfig(normalizedType);
  const timestamp = new Date().toISOString();
  const lead = {
    id: `demo_${normalizedType}_${Date.now()}`,
    stage: "new",
    timestamp,
    ...config.lead,
  };

  return {
    type: normalizedType,
    label: config.label,
    headline: config.headline,
    aiReply: config.aiReply || null,
    captureLabel: config.captureLabel || "Lead capturado",
    crmStage: config.crmStage || "Leads calificados",
    pain: config.pain || null,
    pricing: config.pricing || [],
    inventory: config.inventory || [],
    clients: config.clients || [],
    properties: config.properties || [],
    services: config.services || [],
    lead,
    steps: [
      {
        key: "received",
        label: "Lead recibido...",
        stage: "new",
        event: `${lead.name} escribió desde ${lead.source}`,
      },
      {
        key: "intent",
        label: "Analizando intención...",
        stage: "new",
        event: "Clasificación simulada de intención mediante reglas deterministas",
      },
      {
        key: "score",
        label: `Lead calificado: ${CLASSIFICATION_LABELS[lead.classification] ?? lead.classification.toUpperCase()}${lead.classification === "hot" ? " 🔥" : ""}`,
        stage: "qualified",
        event: `Puntaje ilustrativo ${lead.score}/100`,
      },
      {
        key: "crm",
        label: "Enviado al CRM",
        stage: "qualified",
        event: "Registro creado con contexto y siguiente paso",
      },
      {
        key: "automation",
        label: "Automatización activada",
        stage: "contacted",
        event: config.automation.join(" · "),
      },
    ],
    automation: config.automation,
  };
}

export function advanceScenario(scenario, stepIndex) {
  const step = scenario.steps[Math.max(0, Math.min(stepIndex, scenario.steps.length - 1))];
  return {
    ...scenario,
    currentStep: stepIndex,
    lead: {
      ...scenario.lead,
      stage: step.stage,
      timestamp: new Date().toISOString(),
    },
    event: {
      id: `${scenario.lead.id}_${step.key}`,
      type: step.key,
      label: step.label,
      detail: step.event,
      timestamp: new Date().toISOString(),
    },
  };
}
