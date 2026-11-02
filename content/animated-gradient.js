/**
 * Contoh scene animasi yang hanya memakai Canvas 2D dasar dan gradient.
 * File ini menjadi MP4 pada mode video dan satu gambar pada mode foto.
 */

export async function setup({ width, height }) {
  return {
    centerX: width / 2,
    centerY: height / 2,
    radius: Math.max(width, height) * 0.28,
  };
}

export async function render({ ctx, width, height, time, state }) {
  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, '#143a57');
  background.addColorStop(1, '#211747');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const pulse = 0.88 + Math.sin(time * 2.2) * 0.08;
  const radius = state.radius * pulse;
  const offsetX = Math.sin(time * 1.4) * width * 0.035;
  const glow = ctx.createRadialGradient(
    state.centerX + offsetX,
    state.centerY,
    0,
    state.centerX + offsetX,
    state.centerY,
    radius,
  );
  glow.addColorStop(0, 'rgba(80, 220, 255, 0.62)');
  glow.addColorStop(0.58, 'rgba(95, 90, 255, 0.22)');
  glow.addColorStop(1, 'rgba(95, 90, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = Math.max(2, Math.min(width, height) * 0.004);
  ctx.beginPath();
  ctx.arc(state.centerX + offsetX, state.centerY, radius * 0.62, 0, Math.PI * 2);
  ctx.stroke();
}
