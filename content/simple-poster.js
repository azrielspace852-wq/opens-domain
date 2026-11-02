/**
 * Contoh komposisi statis berbasis bentuk geometri.
 * Tambahkan font berlisensi dan registerFont() sendiri bila membutuhkan teks.
 */

export default {
  render({ ctx, width, height }) {
    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, '#101827');
    background.addColorStop(1, '#283b63');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    const shortSide = Math.min(width, height);
    const margin = shortSide * 0.1;
    const centerX = width / 2;
    const centerY = height / 2;

    ctx.strokeStyle = 'rgba(255,255,255,0.72)';
    ctx.lineWidth = Math.max(2, shortSide * 0.003);
    ctx.strokeRect(margin, margin, width - margin * 2, height - margin * 2);

    ctx.fillStyle = '#fca311';
    ctx.beginPath();
    ctx.arc(centerX, centerY, shortSide * 0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, shortSide * 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.42)';
    ctx.lineWidth = Math.max(1, shortSide * 0.002);
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8;
      const startX = centerX + Math.cos(angle) * shortSide * 0.24;
      const startY = centerY + Math.sin(angle) * shortSide * 0.24;
      const endX = centerX + Math.cos(angle) * shortSide * 0.34;
      const endY = centerY + Math.sin(angle) * shortSide * 0.34;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
  },
};
