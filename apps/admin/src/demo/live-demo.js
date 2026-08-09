import { createDemoEvent, createDemoLead, getEventId } from "../lead-model.js";
import { demoLeads, state } from "../state.js";
import { markOnboardingStep } from "../onboarding-progress.js";

/**
 * Live demo runner. Inject UI hooks from admin.js to avoid circular deps.
 */
export function createLiveDemoController({ showLiveStatus, renderAll, renderOnboardingBanner }) {
  function clearDemoTimers() {
    state.demo.timers.forEach((timer) => window.clearTimeout(timer));
    state.demo.timers = [];
  }

  function addDemoEvent(type, lead, payload = {}) {
    const event = createDemoEvent(type, lead, payload);
    state.demoEvents.unshift(event);
    state.newEventIds.add(getEventId(event));
    return event;
  }

  function setDemoStep(index, lead, statusMessage) {
    state.demo.currentStep = index;
    if (statusMessage) showLiveStatus(statusMessage);
    if (lead) lead.timestamp = new Date().toISOString();
    renderAll();
  }

  function runLiveDemo() {
    markOnboardingStep("see_demo");
    renderOnboardingBanner();
    if (state.demo.running) return;

    clearDemoTimers();
    state.demo.active = true;
    state.demo.running = true;
    state.demo.currentStep = 0;
    state.demo.selectedIndex = (state.demo.selectedIndex + 1) % demoLeads.length;
    state.newLeadIds = new Set();
    state.newEventIds = new Set();
    state.updatedStages = new Set();

    const lead = createDemoLead(demoLeads[state.demo.selectedIndex], "new");
    state.demo.currentLeadId = lead.id;
    state.demoLeads.unshift(lead);
    state.newLeadIds.add(lead.id);
    state.selectedLeadId = lead.id;
    addDemoEvent("message.received", lead, { source: "whatsapp" });
    setDemoStep(0, lead, "Lead recibido...");

    const schedule = (delay, action) => {
      const timer = window.setTimeout(action, delay);
      state.demo.timers.push(timer);
    };

    schedule(900, () => {
      addDemoEvent("intent.classified", lead, {
        score: lead.score,
        classification: lead.classification,
      });
      setDemoStep(1, lead, "Analizando intención...");
    });

    schedule(1800, () => {
      setDemoStep(2, lead, `Lead calificado: ${String(lead.classification || "").toUpperCase()}`);
      showLiveStatus("Lead calificado: CALIENTE / TIBIO / FRÍO");
    });

    schedule(2700, () => {
      lead.status = "qualified";
      state.updatedStages = new Set(["qualified"]);
      addDemoEvent("crm.updated", lead, {
        action: "record_created",
        pipelineStage: "qualified",
      });
      setDemoStep(3, lead, "Enviado al CRM");
    });

    schedule(3600, () => {
      lead.status = "contacted";
      state.updatedStages = new Set(["contacted"]);
      addDemoEvent("followup.triggered", lead, { actions: ["send_whatsapp_notification"] });
      addDemoEvent("automation.triggered", lead, {
        integrations: ["whatsapp", "crm"],
      });
      setDemoStep(4, lead, "Automatización activada");
    });

    schedule(4800, () => {
      state.demo.running = false;
      state.demo.active = false;
      showLiveStatus("Demo en vivo completada");
      renderAll();
    });
  }

  return { clearDemoTimers, addDemoEvent, setDemoStep, runLiveDemo };
}
