// Dessin de la forme d'onde d'un pad : un trait vertical min→max par pixel.

export function drawWaveform(canvas, samples) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (!samples) return;
  const step = Math.max(1, Math.ceil(samples.length / w));
  const amp = h / 2;
  ctx.strokeStyle = '#39ff6a';
  ctx.shadowColor = '#39ff6a';
  ctx.shadowBlur = 4;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < w; x++) {
    let min = 1;
    let max = -1;
    for (let j = 0; j < step; j++) {
      const idx = x * step + j;
      if (idx >= samples.length) break;
      const v = samples[idx];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (min > max) { min = 0; max = 0; }
    ctx.moveTo(x, (1 + min) * amp);
    ctx.lineTo(x, (1 + max) * amp);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
}
