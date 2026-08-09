import { trackEvent } from "./analytics.js";

document.documentElement.classList.add("js");

const fontStylesheet = document.querySelector("[data-font-stylesheet]");
if (fontStylesheet) {
  const activateFontStylesheet = () => {
    fontStylesheet.media = "all";
  };

  if (fontStylesheet.sheet) activateFontStylesheet();
  else fontStylesheet.addEventListener("load", activateFontStylesheet, { once: true });
}

const root = document.querySelector(".home-clarity");

if (root) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const themeToggle = document.querySelector("[data-theme-toggle]");
  const themeColor = document.querySelector("[data-theme-color]");
  const header = document.querySelector("[data-home-header]");
  const stage = document.querySelector("[data-hero-stage]");
  const browserFrame = stage?.querySelector(".hc-browser");
  const demoButtons = [...document.querySelectorAll("[data-demo-target]")];
  const demoShots = [...document.querySelectorAll("[data-demo-shot]")];
  const activeDemoLink = document.querySelector("[data-active-demo-link]");
  const typewriter = document.querySelector("[data-typewriter]");
  let demoRequest = 0;
  let activeDemoIndex = 0;

  if (typewriter) {
    const words = (typewriter.dataset.words || "")
      .split("|")
      .map((word) => word.trim())
      .filter(Boolean);

    if (words.length) {
      typewriter.textContent = words[0];

      if (!reduceMotion && words.length > 1) {
        let wordIndex = 0;
        let characterIndex = 0;
        let deleting = false;

        const typeNextCharacter = () => {
          const word = words[wordIndex];

          if (!deleting) {
            characterIndex += 1;
            typewriter.textContent = word.slice(0, characterIndex);

            if (characterIndex === word.length) {
              deleting = true;
              window.setTimeout(typeNextCharacter, 1300);
              return;
            }

            window.setTimeout(typeNextCharacter, 90);
            return;
          }

          characterIndex -= 1;
          typewriter.textContent = word.slice(0, characterIndex);

          if (characterIndex === 0) {
            deleting = false;
            wordIndex = (wordIndex + 1) % words.length;
            window.setTimeout(typeNextCharacter, 240);
            return;
          }

          window.setTimeout(typeNextCharacter, 50);
        };

        typewriter.textContent = "";
        window.setTimeout(typeNextCharacter, 320);
      }
    }
  }

  const syncThemeControl = () => {
    const isDark = document.documentElement.dataset.theme === "dark";
    const nextLabel = isDark ? "Activar modo claro" : "Activar modo oscuro";
    themeToggle?.setAttribute("aria-label", nextLabel);
    themeToggle?.setAttribute("title", nextLabel);
    themeToggle?.setAttribute("aria-pressed", String(isDark));
    themeColor?.setAttribute("content", isDark ? "#071426" : "#f6f8fc");
  };

  syncThemeControl();
  themeToggle?.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;

    try {
      localStorage.setItem("luenio-theme", nextTheme);
    } catch {
      // The theme still works for this visit when storage is unavailable.
    }
    syncThemeControl();
  });

  const syncHeader = () => header?.classList.toggle("is-scrolled", window.scrollY > 18);
  syncHeader();
  window.addEventListener("scroll", syncHeader, { passive: true });

  function loadDemoShot(shot) {
    if (!shot || shot.currentSrc || shot.src) return shot?.decode?.().catch(() => {});

    const source = shot.dataset.src;
    if (!source) return Promise.resolve();

    const fallback = shot.dataset.fallbackSrc;
    if (fallback) {
      shot.addEventListener(
        "error",
        () => {
          if (!shot.src.endsWith(fallback)) shot.src = fallback;
        },
        { once: true },
      );
    }
    shot.src = source;
    return shot.decode?.().catch(() => {}) || Promise.resolve();
  }

  async function showDemo(index) {
    const next = (index + demoButtons.length) % demoButtons.length;
    const button = demoButtons[next];
    const target = button?.dataset.demoTarget;
    if (!button || !target) return;
    const shot = demoShots.find((item) => item.dataset.demoShot === target);
    const request = ++demoRequest;
    browserFrame?.setAttribute(
      "data-motion-direction",
      next >= activeDemoIndex ? "forward" : "backward",
    );

    demoButtons.forEach((item, itemIndex) => {
      const selected = itemIndex === next;
      item.classList.toggle("is-active", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    browserFrame?.setAttribute("aria-busy", "true");
    await loadDemoShot(shot);
    if (request !== demoRequest) return;
    demoShots.forEach((shot) => {
      const selected = shot.dataset.demoShot === target;
      shot.classList.toggle("is-active", selected);
      shot.setAttribute("aria-hidden", String(!selected));
    });
    browserFrame?.removeAttribute("aria-busy");
    activeDemoIndex = next;

    if (activeDemoLink) {
      activeDemoLink.href = button.dataset.demoHref || "#demos";
      activeDemoLink.dataset.demoCase = button.dataset.demoCaseId || target;
      activeDemoLink.setAttribute(
        "aria-label",
        `Abrir demo ficticia de ${button.textContent.trim()}`,
      );
    }
  }

  demoButtons.forEach((button, index) => {
    button.addEventListener("click", () => {
      void showDemo(index);
      trackEvent("demo_selector_change", {
        case: button.dataset.demoCaseId || button.dataset.demoTarget,
        sector: button.dataset.demoTarget,
      });
    });
    const preload = () => {
      const shot = demoShots.find((item) => item.dataset.demoShot === button.dataset.demoTarget);
      void loadDemoShot(shot);
    };
    button.addEventListener("pointerenter", preload, { once: true });
    button.addEventListener("focus", preload, { once: true });
  });
  void showDemo(0);

  if (!reduceMotion && stage && browserFrame && window.matchMedia("(pointer: fine)").matches) {
    stage.addEventListener("pointermove", (event) => {
      const bounds = stage.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      browserFrame.style.transform = `rotateX(${(-y * 1.6).toFixed(2)}deg) rotateY(${(x * 2).toFixed(2)}deg) translateY(-2px)`;
    });
    stage.addEventListener("pointerleave", () => {
      browserFrame.style.transform = "";
    });
  }

  const observed = document.querySelectorAll("[data-reveal], [data-flow-track]");
  if ("IntersectionObserver" in window && !reduceMotion) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" },
    );
    observed.forEach((element) => revealObserver.observe(element));
  } else {
    observed.forEach((element) => element.classList.add("is-visible"));
  }

  const motionScenes = [...document.querySelectorAll("[data-motion-scene]")];
  if ("IntersectionObserver" in window && !reduceMotion) {
    const sceneObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle(
            "is-motion-active",
            entry.isIntersecting && !document.hidden,
          );
        });
      },
      { threshold: 0.08 },
    );
    motionScenes.forEach((scene) => sceneObserver.observe(scene));
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        motionScenes.forEach((scene) => scene.classList.remove("is-motion-active"));
        return;
      }
      motionScenes.forEach((scene) => {
        const bounds = scene.getBoundingClientRect();
        scene.classList.toggle(
          "is-motion-active",
          bounds.bottom > 0 && bounds.top < window.innerHeight,
        );
      });
    });
  }

  document.querySelectorAll(".hc-accordion details").forEach((details) => {
    details.addEventListener("toggle", () => {
      if (!details.open) return;
      document.querySelectorAll(".hc-accordion details[open]").forEach((item) => {
        if (item !== details) item.open = false;
      });
    });
  });
}
