// Effet machine 3D : le boîtier (.win) s'incline selon la position de la
// souris ; ses enfants ayant chacun un translateZ différent (en CSS), ils se
// décalent les uns par rapport aux autres, donnant un vrai effet de
// profondeur façon boîtier de pédale d'effet, sans dupliquer le layout.

export function initParallax(win, windowRef, doc) {
  if (!win) return;
  let raf = null;
  function apply(mx, my) {
    win.style.setProperty('--mx', mx.toFixed(3));
    win.style.setProperty('--my', my.toFixed(3));
  }
  function onMove(e) {
    const rect = win.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const mx = Math.max(-1, Math.min(1, (e.clientX - cx) / (rect.width / 2)));
    const my = Math.max(-1, Math.min(1, (e.clientY - cy) / (rect.height / 2)));
    if (raf) windowRef.cancelAnimationFrame(raf);
    raf = windowRef.requestAnimationFrame(function () { apply(mx, my); });
  }
  function onLeave() {
    if (raf) windowRef.cancelAnimationFrame(raf);
    raf = windowRef.requestAnimationFrame(function () { apply(0, 0); });
  }
  windowRef.addEventListener('mousemove', onMove, { passive: true });
  doc.addEventListener('mouseleave', onLeave);
}
