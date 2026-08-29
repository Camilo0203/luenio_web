/**
 * Banco de conversación de LUNA: habla con el bot como lo haría un cliente.
 *
 * El estado que devuelve cada turno se arrastra al siguiente, igual que hace el
 * chatbot con la fila del CRM. Así se ve si la conversación avanza o si el bot
 * se repite, se pierde o contesta algo que no viene a cuento. Los guiones no
 * son casos de laboratorio: cada uno salió de una forma real de escribir por
 * WhatsApp (contarlo todo de golpe, en mayúsculas, "no sé", volver al rato).
 *
 * Requiere el workflow `ZZ TEMP | Banco de conversación LUNA`, cuyo webhook
 * llama al mismo `Orquestar turno v3` que usa producción. Está en
 * `n8n/instance/zz-temp-banco-de-conversacion-luna-borrar.json` y se deja
 * DESACTIVADO: su webhook no pide autenticación, así que se activa para probar
 * y se vuelve a apagar al terminar.
 *
 *   N8N_URL=https://n8n.ejemplo.com node n8n/conversar.mjs            # todos
 *   N8N_URL=https://n8n.ejemplo.com node n8n/conversar.mjs restaurante # uno
 *
 * n8n guarda en memoria la definición de un workflow activo, así que tras
 * cambiar el cerebro hay que desactivar y reactivar, y mandar un mensaje de
 * calentamiento antes de fiarse del primero.
 */
const URL = process.env.N8N_URL + "/webhook/luna-conversar";

const GUIONES = {
  restaurante: [
    "hola",
    "tengo un restaurante",
    "quiero que me contesten los pedidos solos, se me pierden mensajes",
    "ahora contesto yo por el celular cuando puedo",
    "pierdo como 5 pedidos al día",
    "quiero no perder ninguno y que reserven solos",
    "sí, es urgente",
    "cuánto cuesta",
    "me parece caro",
    "ok, quiero la propuesta",
  ],
  "precio de una": ["hola", "cuánto vale una página web", "y qué incluye", "ok gracias"],
  humano: ["hola", "quiero hablar con una persona"],
  confuso: ["hola", "asdfgh", "???", "qué eres"],
  "no molestar": ["hola", "tengo una veterinaria", "no molestar"],
  cierre: [
    "hola",
    "tengo una clínica dental",
    "quiero que agenden solas las citas",
    "hoy la recepcionista contesta cuando puede",
    "se nos caen 3 citas por semana",
    "que nadie se quede sin agendar",
    "es urgente",
    "solo chatbot",
    "quiero la propuesta",
    "camilo@ejemplo.com",
  ],
  identidad: ["hola", "qué eres", "con quién hablo", "tengo una barbería"],

  // Guiones duros: gente que no sigue el guion del bot.
  "todo de golpe": [
    "hola, tengo una tienda de ropa y quiero una pagina para vender online, ahora vendo por instagram y se me pierden los pedidos, cuanto me sale?",
    "si, ambos",
    "quiero la propuesta",
    "no tengo correo",
    "ana.perez@tienda.co",
  ],
  "no sabe": [
    "hola",
    "tengo un taller mecanico",
    "no se",
    "pues no se, algo que me ayude",
    "que no se me pierdan clientes",
    "no se la verdad",
    "sí",
    "ambos",
  ],
  "mayusculas y typos": [
    "HOLA BUENAS",
    "TENGO UNA PANADERIA",
    "KIERO Q ME CONTESTEN LOS PEDIDOS",
    "AHORITA CONTESTO YO",
    "PIERDO PEDIDOS",
    "QUE NO SE PIERDA NINGUNO",
    "CUANTO SALE",
  ],
  "cambia de idea": [
    "hola",
    "tengo un gimnasio",
    "quiero una pagina web",
    "no espera, mejor el chatbot",
    "es que se me pierden los mensajes",
    "contesto yo",
    "que respondan solos",
    "si",
    "solo chatbot",
    "cuanto cuesta",
    "mejor hablo con alguien",
  ],
  // Preguntas de catálogo/KB que un cliente hace sin avisar.
  "preguntas sueltas": [
    "hola",
    "tengo un hotel",
    "en cuanto tiempo lo tienen listo?",
    "hacen descuento?",
    "donde estan ubicados?",
    "venden computadores?",
    "👍",
  ],
  "vuelve despues": ["hola", "tengo una floristeria", "quiero vender online", "hola", "seguimos?"],
};

const turno = async (mensaje, contexto) => {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_message: mensaje, context: contexto }),
  });
  const texto = await res.text();
  try {
    const j = JSON.parse(texto);
    return Array.isArray(j) ? j[0] : j;
  } catch {
    return { reply: `[respuesta no JSON: ${texto.slice(0, 120)}]`, estado: {} };
  }
};

const pedido = process.argv[2];
for (const [nombre, guion] of Object.entries(GUIONES)) {
  if (pedido && nombre !== pedido) continue;
  console.log(`\n${"=".repeat(72)}\nGUION: ${nombre}\n${"=".repeat(72)}`);
  let contexto = {};
  const vistas = [];
  for (const mensaje of guion) {
    const r = await turno(mensaje, contexto);
    contexto = { ...contexto, ...(r.estado || {}) };
    console.log(`\n👤 ${mensaje}`);
    console.log(`🤖 ${String(r.reply || "(sin respuesta)").replace(/\n/g, "\n   ")}`);
    const meta = [
      r.intent && `intent=${r.intent}`,
      r.next_question_code && `pregunta=${r.next_question_code}`,
      r.action && r.action !== "none" && `acción=${r.action}`,
      r.reason_code && `motivo=${r.reason_code}`,
    ]
      .filter(Boolean)
      .join("  ");
    if (meta) console.log(`   · ${meta}`);
    // Repetirse es el fallo que más pierde a un cliente.
    const clave = String(r.reply || "").slice(0, 60);
    if (vistas.includes(clave)) console.log("   ⚠️ RESPUESTA REPETIDA");
    vistas.push(clave);
    await new Promise((r) => setTimeout(r, 900));
  }
  console.log(`\n   estado final: ${JSON.stringify(contexto).slice(0, 220)}`);
}
