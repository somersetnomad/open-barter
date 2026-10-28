// Sharing and promotion tools: share links, QR codes and downloadable
// images for listings, the community link preview and posters.
import qrcode from './vendor/qrcode.mjs';
import cfg from '../config.js';

// ------------------------------------------------------------------ links
export function siteUrl() {
  const base = cfg.siteUrl || (location.origin + location.pathname.replace(/index\.html$/, ''));
  return base.endsWith('/') ? base : base + '/';
}
export const shortUrl = () => siteUrl().replace(/^https?:\/\//, '').replace(/\/$/, '');
// Query-string links survive social apps that drop the #fragment; app.js redirects them.
export const listingUrl = l => `${siteUrl()}?l=${l.id}`;

export function listingText(l) {
  const where = l.delivery === 'local' ? (l.area ? ` in ${l.area}` : '') : l.delivery === 'post' ? ' (can post)' : ' (online)';
  return l.kind === 'offer'
    ? `On offer at ${cfg.name}: ${l.title}${where}. Swap something of yours, a skill or some ${cfg.creditName} for it. No money needed.`
    : `Wanted at ${cfg.name}: ${l.title}${where}. Can you help? You'd get something back in return. No money needed.`;
}

export function shareLinks(text, url, subject) {
  const e = encodeURIComponent;
  return {
    whatsapp: `https://wa.me/?text=${e(text + ' ' + url)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${e(url)}`,
    x: `https://twitter.com/intent/tweet?text=${e(text)}&url=${e(url)}`,
    email: `mailto:?subject=${e(subject)}&body=${e(text + '\n\n' + url)}`
  };
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.append(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  }
}

// ---------------------------------------------------------------- QR codes
function qrMatrix(text) {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  const n = q.getModuleCount();
  return { n, dark: (r, c) => q.isDark(r, c) };
}
// Inline SVG QR code (scales to its container).
export function qrSvg(text, label = 'QR code') {
  const { n, dark } = qrMatrix(text);
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (dark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
  return `<svg viewBox="0 0 ${n + 8} ${n + 8}" role="img" aria-label="${label}" shape-rendering="crispEdges">
    <rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#111"/></svg>`;
}
function drawQr(ctx, text, x, y, size) {
  const { n, dark } = qrMatrix(text);
  const cell = size / (n + 8);
  ctx.fillStyle = '#fff'; ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#111';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
    if (dark(r, c)) ctx.fillRect(Math.floor(x + (c + 4) * cell), Math.floor(y + (r + 4) * cell), Math.ceil(cell), Math.ceil(cell));
}

// ---------------------------------------------------------------- drawing
const C = { paper: '#EDF0EA', ink: '#1E2B23', soft: '#55625A', offer: '#2448C9', want: '#E3A92B', wantText: '#8A5A0B', coin: '#E3A92B', white: '#FFFFFF' };
const DISPLAY = '"Bricolage Grotesque", "Segoe UI", sans-serif';
const BODY = '"Atkinson Hyperlegible", "Segoe UI", sans-serif';

async function fontsReady() {
  try {
    await Promise.all([
      document.fonts.load(`800 80px "Bricolage Grotesque"`), document.fonts.load(`700 40px "Atkinson Hyperlegible"`),
      document.fonts.load(`400 40px "Atkinson Hyperlegible"`)]);
  } catch { /* fall back to system fonts */ }
}
function wrap(ctx, text, maxWidth, maxLines) {
  const words = String(text).split(/\s+/); const lines = []; let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    let last = lines[maxLines - 1];
    while (ctx.measureText(last + '…').width > maxWidth && last.includes(' ')) last = last.slice(0, last.lastIndexOf(' '));
    lines[maxLines - 1] = last + '…';
  }
  return lines;
}
function brand(ctx, x, y, scale = 1) {
  ctx.lineWidth = 7 * scale; ctx.strokeStyle = C.offer;
  ctx.beginPath(); ctx.arc(x, y, 18 * scale, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = C.coin; ctx.beginPath(); ctx.arc(x - 4 * scale, y - 20 * scale, 7 * scale, 0, Math.PI * 2); ctx.fill();
}
function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => res(img); img.onerror = rej; img.src = src;
  });
}
const toBlob = canvas => new Promise((res, rej) => {
  try { canvas.toBlob(b => (b ? res(b) : rej(new Error('Could not make the image.'))), 'image/png'); }
  catch (e) { rej(e); }
});

// A 1080×1350 swing-tag image for a listing (good for Instagram, Facebook and WhatsApp).
export async function listingImage(l, { withPhoto = true } = {}) {
  await fontsReady();
  const W = 1080, H = 1350;
  const cv = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const ctx = cv.getContext('2d');
  const string = l.kind === 'offer' ? C.offer : C.want;
  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);

  // tag body with notched corners on the left
  const x = 90, y = 150, w = 900, h = 1000, notch = 50;
  ctx.save();
  ctx.shadowColor = 'rgba(30,43,35,.25)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14;
  ctx.fillStyle = C.white;
  ctx.beginPath();
  ctx.moveTo(x + notch, y); ctx.lineTo(x + w - 24, y); ctx.quadraticCurveTo(x + w, y, x + w, y + 24);
  ctx.lineTo(x + w, y + h - 24); ctx.quadraticCurveTo(x + w, y + h, x + w - 24, y + h);
  ctx.lineTo(x + notch, y + h); ctx.lineTo(x, y + h - notch); ctx.lineTo(x, y + notch); ctx.closePath();
  ctx.fill(); ctx.restore();
  ctx.save(); ctx.clip(); ctx.fillStyle = string; ctx.fillRect(x, y, 22, h); ctx.restore();
  // hole and string
  ctx.fillStyle = C.paper; ctx.beginPath(); ctx.arc(x + 62, y + 70, 18, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = string; ctx.lineWidth = 6; ctx.beginPath();
  ctx.moveTo(x + 62, y + 70); ctx.bezierCurveTo(x + 20, y - 30, x - 40, y - 60, x - 90, y - 150); ctx.stroke();

  let cy = y + 150;
  const left = x + 110, maxW = w - 170;
  ctx.fillStyle = l.kind === 'offer' ? C.offer : C.wantText;
  ctx.font = `700 44px ${BODY}`;
  ctx.fillText(l.kind === 'offer' ? 'On offer' : 'Wanted', left, cy);

  // optional photo
  if (withPhoto && l.photo_url) {
    try {
      const img = await loadImage(l.photo_url);
      const ph = 360, pw = maxW, r = Math.max(pw / img.width, ph / img.height);
      const sw = pw / r, sh = ph / r;
      cy += 34;
      ctx.save(); ctx.beginPath(); ctx.roundRect(left, cy, pw, ph, 18); ctx.clip();
      ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, left, cy, pw, ph); ctx.restore();
      cy += ph + 20;
    } catch { /* no photo */ }
  }

  ctx.fillStyle = C.ink;
  const big = withPhoto && l.photo_url ? 70 : 92;
  ctx.font = `800 ${big}px ${DISPLAY}`;
  const lines = wrap(ctx, l.title, maxW, l.photo_url && withPhoto ? 2 : 4);
  for (const ln of lines) { cy += big * 1.08; ctx.fillText(ln, left, cy); }

  ctx.font = `400 40px ${BODY}`; ctx.fillStyle = C.soft;
  const how = { local: 'In person', post: 'Can post', online: 'Online' }[l.delivery];
  cy += 70; ctx.fillText(`${l.category} · ${how}${l.area ? ' · ' + l.area : ''}`, left, cy);
  if (l.value_credits != null && l.kind === 'offer') {
    cy += 64;
    ctx.fillStyle = C.coin; ctx.beginPath(); ctx.arc(left + 16, cy - 13, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 40px ${BODY}`;
    ctx.fillText(`about ${l.value_credits} ${cfg.creditName}`, left + 46, cy);
  }

  // footer: community and QR
  const qr = 250, qx = x + w - qr - 50, qy = y + h - qr - 50;
  drawQr(ctx, listingUrl(l), qx, qy, qr);
  ctx.fillStyle = C.soft; ctx.font = `400 30px ${BODY}`; ctx.textAlign = 'center';
  ctx.fillText('Scan to swap', qx + qr / 2, qy - 14); ctx.textAlign = 'left';
  ctx.font = `800 48px ${DISPLAY}`;
  const nameLines = wrap(ctx, cfg.name, qx - left - 80, 2);
  const nameTop = y + h - 140 - nameLines.length * 52;
  brand(ctx, left + 18, nameTop + 36, 1.1);
  ctx.fillStyle = C.ink;
  nameLines.forEach((n, i) => ctx.fillText(n, left + 60, nameTop + 52 + i * 52));
  ctx.fillStyle = C.soft; ctx.font = `400 32px ${BODY}`;
  ctx.fillText('No money needed', left, y + h - 100);
  ctx.fillStyle = C.offer;
  let fs = 28; ctx.font = `700 ${fs}px ${BODY}`;
  while (ctx.measureText(shortUrl()).width > qx - left - 40 && fs > 16) ctx.font = `700 ${--fs}px ${BODY}`;
  ctx.fillText(shortUrl(), left, y + h - 56);

  try { return await toBlob(cv); }
  catch { return withPhoto ? listingImage(l, { withPhoto: false }) : Promise.reject(new Error('Could not make the image.')); }
}

// A 1200×630 link-preview image for the community (og:image).
export async function communityImage({ width = 1200, height = 630 } = {}) {
  await fontsReady();
  const cv = Object.assign(document.createElement('canvas'), { width, height });
  const ctx = cv.getContext('2d');
  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, width, height);
  const square = height >= width;
  // the trade circle motif
  const R = square ? 200 : 170, cx = square ? width / 2 : width - 280, cy = square ? height - 330 : height / 2 + 10;
  const nodes = [[C.offer, 'B'], [C.wantText, 'G'], ['#2B7148', 'M']];
  ctx.lineWidth = 9; ctx.strokeStyle = C.soft;
  for (let i = 0; i < 3; i++) {
    const a1 = -Math.PI / 2 + i * 2 * Math.PI / 3 + 0.42, a2 = a1 + 2 * Math.PI / 3 - 0.84;
    ctx.beginPath(); ctx.arc(cx, cy, R, a1, a2); ctx.stroke();
    const ex = cx + R * Math.cos(a2), ey = cy + R * Math.sin(a2), t = a2 + Math.PI / 2;
    ctx.fillStyle = C.soft; ctx.beginPath();
    ctx.moveTo(ex + 22 * Math.cos(t), ey + 22 * Math.sin(t));
    ctx.lineTo(ex + 14 * Math.cos(t - 2.2), ey + 14 * Math.sin(t - 2.2));
    ctx.lineTo(ex + 14 * Math.cos(t + 2.2), ey + 14 * Math.sin(t + 2.2)); ctx.fill();
  }
  nodes.forEach(([col, letter], i) => {
    const a = -Math.PI / 2 + i * 2 * Math.PI / 3, nx = cx + R * Math.cos(a), ny = cy + R * Math.sin(a);
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(nx, ny, 50, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `800 46px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(letter, nx, ny + 2);
  });
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const left = 80, maxW = square ? width - 160 : width - 600;
  brand(ctx, left + 20, 120, 1.3);
  ctx.fillStyle = C.ink; ctx.font = `800 48px ${DISPLAY}`;
  ctx.fillText(cfg.name, left + 72, 138);
  ctx.font = `800 ${square ? 76 : 68}px ${DISPLAY}`;
  let y = square ? 250 : 240;
  for (const ln of wrap(ctx, cfg.heroTitle || 'Trade what you have for what you need', maxW, 3)) { ctx.fillText(ln, left, y); y += square ? 82 : 74; }
  ctx.fillStyle = C.soft; ctx.font = `400 34px ${BODY}`;
  for (const ln of wrap(ctx, cfg.tagline, maxW, 2)) { y += 10; ctx.fillText(ln, left, y); y += 34; }
  if (!square) { ctx.font = `700 30px ${BODY}`; ctx.fillStyle = C.offer; ctx.fillText(shortUrl(), left, Math.max(y + 40, height - 56)); }
  return toBlob(cv);
}

export function download(blob, filename) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'listing';
