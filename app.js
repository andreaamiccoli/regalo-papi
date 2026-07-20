(function () {
  "use strict";

  const canvas = document.getElementById("scratch-canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const BRUSH_RADIUS = 22;      // raggio del "gratta" in pixel CSS
  const REVEAL_THRESHOLD = 80;  // % di area grattata oltre la quale si rivela tutto

  let isScratching = false;
  let lastX = 0;
  let lastY = 0;
  let moveCount = 0;
  let hasRevealed = false;

  /* ---------------------------------------------------------
     STATO PER LA FUNZIONALITÀ "GIRA LA CARD"
  --------------------------------------------------------- */
  const flipCard = document.getElementById("flip-card");
  const shakeHint = document.getElementById("shake-hint");
  const backHint = document.getElementById("back-hint");

  let isFlipped = false;

  /* ---------------------------------------------------------
     DIMENSIONI REALI DELLA VIEWPORT
     window.innerWidth/innerHeight non sempre corrispondono all'area
     davvero visibile su mobile (es. quando la barra indirizzi di
     Safari si mostra/nasconde). window.visualViewport, dove
     disponibile, riflette lo spazio effettivamente visibile.
  --------------------------------------------------------- */
  function getViewportSize() {
    if (window.visualViewport) {
      return {
        width: window.visualViewport.width,
        height: window.visualViewport.height,
      };
    }
    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

/* ---------------------------------------------------------
     INIZIALIZZAZIONE / RESIZE DEL CANVAS
  --------------------------------------------------------- */
  function setupCanvas() {
    const dpr = window.devicePixelRatio || 1;

    // Rileva la dimensione REALE del contenitore padre (100% dello schermo)
    const parent = canvas.parentElement;
    const width = parent ? parent.clientWidth : window.innerWidth;
    const height = parent ? parent.clientHeight : window.innerHeight;

    // Risoluzione bitmap interna del canvas per schermi HD / Retina
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    // Forziamo il CSS al 100% invece dei pixel fissi
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    // Reset della trasformazione ad ogni resize
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    hasRevealed = false;
    moveCount = 0;
    canvas.classList.remove("is-revealed");
    canvas.style.pointerEvents = "auto";

    drawGoldLayer(width, height);
  }

  /* ---------------------------------------------------------
     DISEGNO DELLA PATINA D'ORO EPICA + TESTO D'INVITO
  --------------------------------------------------------- */
  function drawGoldLayer(width, height) {
    ctx.globalCompositeOperation = "source-over";

    // Gradiente metallico dorato (diagonale, effetto "riflesso")
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#8a6d1d");
    gradient.addColorStop(0.15, "#d4af37");
    gradient.addColorStop(0.35, "#fdf3c7");
    gradient.addColorStop(0.5, "#f0c14b");
    gradient.addColorStop(0.65, "#fdf3c7");
    gradient.addColorStop(0.85, "#d4af37");
    gradient.addColorStop(1, "#8a6d1d");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Sottili righe diagonali per simulare una texture metallica spazzolata
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 2;
    for (let x = -height; x < width; x += 14) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + height, height);
      ctx.stroke();
    }

    // Leggera vignettatura per profondità
    const vignette = ctx.createRadialGradient(
      width / 2, height / 2, Math.min(width, height) * 0.2,
      width / 2, height / 2, Math.max(width, height) * 0.75
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.22)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    drawInviteText(width, height);
  }

  function drawInviteText(width, height) {
    const text = "GRATTA E VINCI IL TUO REGALO!";
    const maxTextWidth = width * 0.86; // margine di sicurezza sui lati

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Il font parte proporzionale alla larghezza schermo, poi si riduce
    // finché il testo non entra in una singola riga: non va mai a capo.
    let fontSize = Math.round(width * 0.065);
    fontSize = Math.max(16, Math.min(fontSize, 46));

    const buildFont = (size) =>
      `bold ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

    ctx.font = buildFont(fontSize);
    while (ctx.measureText(text).width > maxTextWidth && fontSize > 10) {
      fontSize -= 1;
      ctx.font = buildFont(fontSize);
    }

    // Ombra per leggibilità sopra il gradiente dorato
    ctx.fillStyle = "rgba(70, 48, 8, 0.55)";
    ctx.fillText(text, width / 2 + 2, height / 2 + 2);

    ctx.fillStyle = "rgba(55, 38, 6, 0.95)";
    ctx.fillText(text, width / 2, height / 2);
  }

  /* ---------------------------------------------------------
     CALCOLO COORDINATE (MOUSE + TOUCH)
  --------------------------------------------------------- */
  function getPointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    let clientX;
    let clientY;

    if (event.touches && event.touches.length > 0) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else if (event.changedTouches && event.changedTouches.length > 0) {
      clientX = event.changedTouches[0].clientX;
      clientY = event.changedTouches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  /* ---------------------------------------------------------
     EFFETTO "GRATTA E VINCI"
     destination-out rende trasparenti i pixel disegnati,
     rivelando il livello sottostante (.prize-layer).
  --------------------------------------------------------- */
  function scratchAt(x, y) {
    ctx.globalCompositeOperation = "destination-out";
    // Alpha piena obbligatoria: il fillStyle potrebbe aver ereditato un
    // colore semi-trasparente dal testo disegnato in precedenza. Con
    // "destination-out" l'alpha del fillStyle determina QUANTO viene
    // cancellato: se non è 1 il pixel non torna mai del tutto trasparente.
    ctx.fillStyle = "rgba(0, 0, 0, 1)";
    ctx.beginPath();
    ctx.arc(x, y, BRUSH_RADIUS, 0, Math.PI * 2, false);
    ctx.fill();
  }

  // Interpola tanti cerchi lungo il segmento per non lasciare "buchi"
  // quando il dito/mouse si muove velocemente.
  function scratchLine(x0, y0, x1, y1) {
    const distance = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.floor(distance / (BRUSH_RADIUS / 2)));

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      scratchAt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
    }
  }

  /* ---------------------------------------------------------
     RIVELAZIONE COMPLETA
     Quando la percentuale grattata supera la soglia, il canvas
     sparisce del tutto con una dissolvenza (bonus UX).
  --------------------------------------------------------- */
  function checkRevealProgress() {
    if (hasRevealed) return;

    moveCount++;
    if (moveCount % 15 !== 0) return; // throttling per non appesantire la CPU

    const w = canvas.width;
    const h = canvas.height;
    const imageData = ctx.getImageData(0, 0, w, h);
    const pixels = imageData.data;

    let transparent = 0;
    let sampled = 0;
    const step = 40; // campiona un pixel ogni 10 (4 canali x 10) per performance

    for (let i = 3; i < pixels.length; i += step) {
      sampled++;
      if (pixels[i] === 0) transparent++;
    }

    const percentScratched = (transparent / sampled) * 100;

    if (percentScratched >= REVEAL_THRESHOLD) {
      revealAll();
    }
  }

  function revealAll() {
    hasRevealed = true;
    canvas.classList.add("is-revealed");
    canvas.style.pointerEvents = "none";

    // Pulisce del tutto il canvas dopo la dissolvenza CSS
    window.setTimeout(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, 850);

    // Da qui in poi si può toccare il pulsante per vedere i biglietti
    if (shakeHint) {
      shakeHint.hidden = false;
    }
  }

  /* ---------------------------------------------------------
     CAPOVOLGIMENTO DELLA CARD (biglietti / regalo)
  --------------------------------------------------------- */
  function toggleFlip() {
    if (!flipCard) return;
    isFlipped = !isFlipped;
    flipCard.classList.toggle("is-flipped", isFlipped);
  }

  /* ---------------------------------------------------------
     GESTORI EVENTI (comuni a mouse e touch)
  --------------------------------------------------------- */
  function handleStart(event) {
    if (hasRevealed) return;
    event.preventDefault();
    isScratching = true;

    const pos = getPointerPosition(event);
    lastX = pos.x;
    lastY = pos.y;
    scratchAt(pos.x, pos.y);
  }

  function handleMove(event) {
    if (!isScratching || hasRevealed) return;
    event.preventDefault();

    const pos = getPointerPosition(event);
    scratchLine(lastX, lastY, pos.x, pos.y);
    lastX = pos.x;
    lastY = pos.y;

    checkRevealProgress();
  }

  function handleEnd() {
    isScratching = false;
  }

  function debounce(fn, delay) {
    let timer = null;
    return function debounced(...args) {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => fn.apply(null, args), delay);
    };
  }

  /* ---------------------------------------------------------
     REGISTRAZIONE EVENTI
  --------------------------------------------------------- */
  // --- Mouse (desktop) ---
  canvas.addEventListener("mousedown", handleStart);
  canvas.addEventListener("mousemove", handleMove);
  window.addEventListener("mouseup", handleEnd);
  canvas.addEventListener("mouseleave", handleEnd);

  // --- Touch (mobile) ---
  canvas.addEventListener("touchstart", handleStart, { passive: false });
  canvas.addEventListener("touchmove", handleMove, { passive: false });
  canvas.addEventListener("touchend", handleEnd, { passive: false });
  canvas.addEventListener("touchcancel", handleEnd, { passive: false });

  // --- Resize / cambio orientamento ---
  window.addEventListener("resize", debounce(setupCanvas, 200));
  window.addEventListener("orientationchange", debounce(setupCanvas, 200));

  // --- Barra indirizzi mobile che si mostra/nasconde (Safari iOS e simili):
  //     cambia le dimensioni della visual viewport senza sempre generare
  //     un evento "resize" sulla window in modo affidabile. ---
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", debounce(setupCanvas, 200));
  }

  // --- Pulsanti di fallback (tocco) per chi non ha/non concede i sensori di movimento ---
  if (shakeHint) {
    shakeHint.addEventListener("click", toggleFlip);
  }
  if (backHint) {
    backHint.addEventListener("click", toggleFlip);
  }

  /* ---------------------------------------------------------
     AVVIO
  --------------------------------------------------------- */
  setupCanvas();

  /* ---------------------------------------------------------
     REGISTRAZIONE SERVICE WORKER (percorso relativo!)
  --------------------------------------------------------- */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./sw.js")
        .then((registration) => {
          console.log("Service Worker registrato:", registration.scope);
        })
        .catch((error) => {
          console.error("Registrazione Service Worker fallita:", error);
        });
    });
  }
})();