const canvas = document.getElementById('scratch-canvas');
const ctx = canvas.getContext('2d');
let isDrawing = false;

// Adatta il canvas alle dimensioni reali del contenitore
function initCanvas() {
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  
  // Creiamo una patina dorata/metallica epica
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#d4af37'); // Oro
  gradient.addColorStop(0.5, '#aa7c11');
  gradient.addColorStop(1, '#d4af37');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Testo d'invito sopra la patina
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GRATTA QUI IL TUO REGALO', canvas.width / 2, canvas.height / 2);
}

window.addEventListener('load', initCanvas);

// Funzione core per cancellare i pixel (grattare)
function scratch(x, y) {
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(x, y, 30, 0, Math. PI * 2); // Raggio del "tocco" per grattare
  ctx.fill();
}

// Eventi Mouse (Desktop)
canvas.addEventListener('mousedown', (e) => { isDrawing = true; scratch(e.offsetX, e.offsetY); });
canvas.addEventListener('mousemove', (e) => { if (isDrawing) scratch(e.offsetX, e.offsetY); });
window.addEventListener('mouseup', () => isDrawing = false);

// Eventi Touch (Mobile)
canvas.addEventListener('touchstart', (e) => {
  isDrawing = true;
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];
  scratch(touch.clientX - rect.left, touch.clientY - rect.top);
});
canvas.addEventListener('touchmove', (e) => {
  if (!isDrawing) return;
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];
  scratch(touch.clientX - rect.left, touch.clientY - rect.top);
});
window.addEventListener('touchend', () => isDrawing = false);

// Registrazione del Service Worker per la PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('SW registrato!', reg))
      .catch(err => console.err('Errore SW', err));
  });
}