const TAU = Math.PI * 2;

function hash(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cacheFor(channel) {
  if (!channel._cache) channel._cache = {};
  return channel._cache;
}

function cache(channel, key, factory) {
  const store = cacheFor(channel);
  if (!(key in store)) store[key] = factory();
  return store[key];
}

function rgba(hex, alpha) {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function font(size, weight = 700, family = 'Arial, Helvetica, sans-serif') {
  return `${weight} ${size}px ${family}`;
}

function label(ctx, text, x, y, size, color, options = {}) {
  ctx.save();
  ctx.font = font(size, options.weight ?? 700, options.family);
  ctx.fillStyle = color;
  ctx.textAlign = options.align ?? 'left';
  ctx.textBaseline = options.baseline ?? 'alphabetic';
  if ('letterSpacing' in ctx && options.spacing != null) ctx.letterSpacing = `${options.spacing}px`;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function vignette(ctx, width, height, strength = 0.5) {
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.24,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.72
  );
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(0.72, 'rgba(0, 0, 0, 0.08)');
  gradient.addColorStop(1, `rgba(0, 0, 0, ${strength})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function grain(ctx, channel, width, height, amount = 0.055) {
  const noise = cache(channel, 'grain', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const source = canvas.getContext('2d');
    const image = source.createImageData(128, 128);
    const random = hash(0x1f3d5b79);
    for (let index = 0; index < image.data.length; index += 4) {
      const value = Math.floor(random() * 255);
      image.data[index] = value;
      image.data[index + 1] = value;
      image.data[index + 2] = value;
      image.data[index + 3] = 60;
    }
    source.putImageData(image, 0, 0);
    return canvas;
  });
  const pattern = ctx.createPattern(noise, 'repeat');
  ctx.save();
  ctx.globalAlpha = amount;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function stars(channel, width, height, count = 90) {
  return cache(channel, `stars-${width}-${height}-${count}`, () => {
    const random = hash(width * 31 + height * 17 + count);
    return Array.from({ length: count }, () => ({
      x: random() * width,
      y: random() * height * 0.72,
      r: 0.4 + random() * 1.5,
      phase: random() * TAU,
      speed: 0.4 + random() * 1.6
    }));
  });
}

function drawStars(ctx, list, time, color = '#ffffff') {
  ctx.save();
  for (const star of list) {
    ctx.globalAlpha = 0.25 + 0.65 * (0.5 + 0.5 * Math.sin(time * star.speed + star.phase));
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function skyline(channel, width, height) {
  return cache(channel, `skyline-${width}-${height}`, () => {
    const random = hash(0x5f2a91 + width);
    const buildings = [];
    let x = -10;
    while (x < width + 20) {
      const w = 14 + random() * 42;
      const h = height * (0.14 + random() * 0.36);
      const windows = [];
      const columns = Math.max(1, Math.floor(w / 9));
      const rows = Math.max(1, Math.floor(h / 12));
      for (let cx = 0; cx < columns; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          if (random() > 0.42) {
            windows.push({
              x: x + 4 + cx * 9,
              y: height - h + 6 + cy * 12,
              w: 3 + random() * 2,
              h: 4 + random() * 2,
              flicker: random() * TAU
            });
          }
        }
      }
      buildings.push({ x, w, h, windows });
      x += w + 2 + random() * 4;
    }
    return buildings;
  });
}

/* ------------------------------------------------------------------ */
/* 02 — Late night                                                     */
/* ------------------------------------------------------------------ */

function lateNight(ctx, width, height, time, channel) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#060a20');
  sky.addColorStop(0.55, '#181038');
  sky.addColorStop(1, '#3a1734');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  drawStars(ctx, stars(channel, width, height, 80), time);

  const moonX = width * 0.77;
  const moonY = height * 0.24;
  const moonR = height * 0.12;
  const glow = ctx.createRadialGradient(moonX, moonY, moonR * 0.4, moonX, moonY, moonR * 2.8);
  glow.addColorStop(0, 'rgba(255, 236, 192, 0.22)');
  glow.addColorStop(1, 'rgba(255, 236, 192, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(moonX - moonR * 3, moonY - moonR * 3, moonR * 6, moonR * 6);

  ctx.fillStyle = '#ffe9bd';
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR, 0, TAU);
  ctx.fill();

  ctx.fillStyle = 'rgba(183, 157, 116, 0.32)';
  ctx.beginPath();
  ctx.arc(moonX - moonR * 0.3, moonY - moonR * 0.16, moonR * 0.2, 0, TAU);
  ctx.arc(moonX + moonR * 0.32, moonY + moonR * 0.28, moonR * 0.13, 0, TAU);
  ctx.arc(moonX + moonR * 0.05, moonY - moonR * 0.4, moonR * 0.09, 0, TAU);
  ctx.fill();

  const horizon = height * 0.73;
  const haze = ctx.createLinearGradient(0, horizon - height * 0.16, 0, horizon);
  haze.addColorStop(0, 'rgba(255, 128, 82, 0)');
  haze.addColorStop(1, 'rgba(255, 128, 82, 0.18)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon - height * 0.16, width, height * 0.16);

  const buildings = skyline(channel, width, height);
  for (const building of buildings) {
    const top = height - building.h;
    ctx.fillStyle = '#050711';
    ctx.fillRect(building.x, top, building.w, building.h + 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.fillRect(building.x, top, 1, building.h);
    for (const windowRect of building.windows) {
      const brightness = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(time * 0.7 + windowRect.flicker));
      ctx.fillStyle = `rgba(255, 189, 102, ${brightness})`;
      ctx.fillRect(windowRect.x, windowRect.y, windowRect.w, windowRect.h);
    }
  }

  const desk = ctx.createLinearGradient(0, height * 0.8, 0, height);
  desk.addColorStop(0, '#0b0710');
  desk.addColorStop(1, '#030205');
  ctx.fillStyle = desk;
  ctx.fillRect(0, height * 0.82, width, height * 0.18);

  const spot = ctx.createLinearGradient(width * 0.18, 0, width * 0.32, height);
  spot.addColorStop(0, 'rgba(255, 196, 120, 0.12)');
  spot.addColorStop(1, 'rgba(255, 196, 120, 0)');
  ctx.fillStyle = spot;
  ctx.beginPath();
  ctx.moveTo(width * 0.16, 0);
  ctx.lineTo(width * 0.42, 0);
  ctx.lineTo(width * 0.52, height);
  ctx.lineTo(width * 0.22, height);
  ctx.closePath();
  ctx.fill();

  const hostX = width * 0.33;
  const hostBase = height * 0.94;
  ctx.fillStyle = '#09060d';
  ctx.beginPath();
  ctx.ellipse(hostX, hostBase - height * 0.19, width * 0.072, height * 0.18, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(hostX, hostBase - height * 0.29, height * 0.085, 0, TAU);
  ctx.fill();

  ctx.fillStyle = '#120b18';
  roundRect(ctx, width * 0.13, height * 0.86, width * 0.42, height * 0.09, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 194, 110, 0.25)';
  ctx.fillRect(width * 0.13, height * 0.86, width * 0.42, 1);

  ctx.strokeStyle = 'rgba(255, 226, 184, 0.55)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(width * 0.55, height * 0.85);
  ctx.lineTo(width * 0.57, height * 0.75);
  ctx.stroke();
  ctx.fillStyle = '#1b1420';
  ctx.beginPath();
  ctx.ellipse(width * 0.57, height * 0.73, width * 0.018, height * 0.033, -0.15, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 226, 184, 0.3)';
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 182, 96, 0.1)';
  ctx.fillRect(0, 0, width, height * 0.012);

  label(ctx, 'NIGHT OWL', width * 0.06, height * 0.14, height * 0.055, 'rgba(255, 236, 210, 0.32)', {
    weight: 900,
    spacing: 3
  });
  label(ctx, 'AFTER HOURS', width * 0.06, height * 0.2, height * 0.028, 'rgba(255, 182, 96, 0.5)', {
    weight: 700,
    spacing: 2
  });
}

/* ------------------------------------------------------------------ */
/* 04 — Weather                                                        */
/* ------------------------------------------------------------------ */

function weather(ctx, width, height, time, channel) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#031a2d');
  sky.addColorStop(0.6, '#052235');
  sky.addColorStop(1, '#04121c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.strokeStyle = 'rgba(89, 183, 208, 0.12)';
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += width / 16) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += height / 10) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();

  const land = cache(channel, `coast-${width}-${height}`, () => {
    const random = hash(0x0912ab);
    return Array.from({ length: 30 }, (_, index) => ({
      x: (index / 29) * width,
      y: height * (0.28 + random() * 0.34)
    }));
  });

  ctx.beginPath();
  ctx.moveTo(-10, height);
  for (const point of land) ctx.lineTo(point.x, point.y);
  ctx.lineTo(width + 10, height);
  ctx.closePath();
  const landFill = ctx.createLinearGradient(0, height * 0.25, 0, height);
  landFill.addColorStop(0, 'rgba(18, 62, 76, 0.85)');
  landFill.addColorStop(1, 'rgba(7, 30, 40, 0.95)');
  ctx.fillStyle = landFill;
  ctx.fill();
  ctx.strokeStyle = 'rgba(95, 214, 235, 0.35)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  const cells = cache(channel, 'storm-cells', () => {
    const random = hash(0x77e1c4);
    return Array.from({ length: 7 }, () => ({
      x: random(),
      y: 0.26 + random() * 0.46,
      r: 0.04 + random() * 0.075,
      phase: random() * TAU,
      color: random() > 0.72 ? '255, 91, 91' : random() > 0.4 ? '255, 213, 79' : '72, 219, 141'
    }));
  });

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const cell of cells) {
    const x = (cell.x + Math.sin(time * 0.05 + cell.phase) * 0.025) * width;
    const y = (cell.y + Math.cos(time * 0.04 + cell.phase) * 0.02) * height;
    const radius = cell.r * width;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(${cell.color}, 0.38)`);
    gradient.addColorStop(0.5, `rgba(${cell.color}, 0.14)`);
    gradient.addColorStop(1, `rgba(${cell.color}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  ctx.restore();

  const radarX = width * 0.71;
  const radarY = height * 0.53;
  const radarR = Math.min(width, height) * 0.27;

  ctx.save();
  ctx.strokeStyle = 'rgba(111, 227, 255, 0.22)';
  ctx.lineWidth = 1;
  for (let ring = 1; ring <= 3; ring += 1) {
    ctx.beginPath();
    ctx.arc(radarX, radarY, (radarR * ring) / 3, 0, TAU);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(radarX - radarR, radarY);
  ctx.lineTo(radarX + radarR, radarY);
  ctx.moveTo(radarX, radarY - radarR);
  ctx.lineTo(radarX, radarY + radarR);
  ctx.stroke();
  ctx.restore();

  const sweepAngle = time * 0.9;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(radarX, radarY);
  ctx.arc(radarX, radarY, radarR, sweepAngle - 0.55, sweepAngle);
  ctx.closePath();
  const sweep = ctx.createRadialGradient(radarX, radarY, 0, radarX, radarY, radarR);
  sweep.addColorStop(0, 'rgba(111, 227, 255, 0.32)');
  sweep.addColorStop(1, 'rgba(111, 227, 255, 0.02)');
  ctx.fillStyle = sweep;
  ctx.fill();
  ctx.strokeStyle = 'rgba(160, 245, 255, 0.75)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(radarX, radarY);
  ctx.lineTo(radarX + Math.cos(sweepAngle) * radarR, radarY + Math.sin(sweepAngle) * radarR);
  ctx.stroke();
  ctx.restore();

  const blips = cache(channel, 'radar-blips', () => {
    const random = hash(0x41ac09);
    return Array.from({ length: 9 }, () => ({
      angle: random() * TAU,
      distance: 0.18 + random() * 0.74,
      phase: random() * TAU
    }));
  });
  for (const blip of blips) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 2 + blip.phase);
    const x = radarX + Math.cos(blip.angle) * radarR * blip.distance;
    const y = radarY + Math.sin(blip.angle) * radarR * blip.distance;
    ctx.fillStyle = `rgba(255, 214, 102, ${0.25 + pulse * 0.7})`;
    ctx.beginPath();
    ctx.arc(x, y, 1.5 + pulse, 0, TAU);
    ctx.fill();
  }

  const rainRandom = hash(0x0ea77b);
  ctx.save();
  ctx.strokeStyle = 'rgba(126, 224, 255, 0.28)';
  ctx.lineWidth = 1;
  for (let index = 0; index < 46; index += 1) {
    const x = ((rainRandom() * width + time * 18) % (width + 40)) - 20;
    const y = ((rainRandom() * height + time * 75) % (height + 40)) - 20;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 2, y + 7);
    ctx.stroke();
  }
  ctx.restore();

  label(ctx, 'STORM DESK', width * 0.055, height * 0.13, height * 0.05, 'rgba(214, 247, 255, 0.92)', {
    weight: 900,
    spacing: 2
  });
  label(ctx, 'LIVE DOPPLER', width * 0.057, height * 0.19, height * 0.027, 'rgba(111, 227, 255, 0.65)', {
    spacing: 2
  });
  label(ctx, '72°', width * 0.07, height * 0.86, height * 0.055, 'rgba(255, 255, 255, 0.78)', {
    weight: 700
  });
  label(ctx, '62°', width * 0.28, height * 0.9, height * 0.038, 'rgba(126, 224, 255, 0.55)', {
    weight: 700
  });
  label(ctx, 'RAIN', width * 0.7, height * 0.86, height * 0.024, 'rgba(126, 224, 255, 0.55)', {
    spacing: 1.5
  });
}

/* ------------------------------------------------------------------ */
/* 05 — Public access                                                  */
/* ------------------------------------------------------------------ */

function access(ctx, width, height, time, channel) {
  ctx.fillStyle = '#030205';
  ctx.fillRect(0, 0, width, height);

  const blobs = cache(channel, 'blobs', () => {
    const random = hash(0x5e11c3);
    return Array.from({ length: 6 }, (_, index) => ({
      x: 0.18 + random() * 0.64,
      y: 0.25 + random() * 0.5,
      r: 0.18 + random() * 0.24,
      speed: 0.16 + random() * 0.35,
      phase: random() * TAU,
      colors: [
        ['255, 94, 219', '124, 92, 255'],
        ['92, 255, 214', '34, 211, 238'],
        ['255, 179, 71', '255, 94, 219'],
        ['124, 92, 255', '72, 219, 141']
      ][index % 4]
    }));
  });

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const blob of blobs) {
    const x = (blob.x + Math.sin(time * blob.speed + blob.phase) * 0.09) * width;
    const y = (blob.y + Math.cos(time * blob.speed * 0.8 + blob.phase) * 0.08) * height;
    const radius = blob.r * width;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(${blob.colors[0]}, 0.4)`);
    gradient.addColorStop(0.5, `rgba(${blob.colors[1]}, 0.17)`);
    gradient.addColorStop(1, `rgba(${blob.colors[1]}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  ctx.restore();

  ctx.save();
  ctx.translate(width * 0.5, height * 0.5);
  ctx.rotate(time * 0.11);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1;
  for (let index = 0; index < 3; index += 1) {
    const size = width * (0.15 + index * 0.09);
    ctx.beginPath();
    for (let point = 0; point < 3; point += 1) {
      const angle = (point / 3) * TAU - Math.PI / 2;
      const x = Math.cos(angle) * size;
      const y = Math.sin(angle) * size;
      if (point === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();

  const wobble = Math.sin(time * 2.2) * 2;
  label(ctx, 'PUBLIC', width * 0.5, height * 0.44 + wobble, height * 0.17, 'rgba(255, 245, 255, 0.93)', {
    weight: 900,
    align: 'center',
    spacing: 2
  });
  label(ctx, 'ACCESS', width * 0.5, height * 0.62 + wobble, height * 0.17, 'rgba(255, 94, 219, 0.92)', {
    weight: 900,
    align: 'center',
    spacing: 5
  });
  label(ctx, 'CHANNEL 05', width * 0.5, height * 0.79, height * 0.034, 'rgba(255, 255, 255, 0.55)', {
    align: 'center',
    spacing: 4
  });

  const bandY = ((time * 36) % (height * 1.5)) - height * 0.25;
  ctx.save();
  ctx.globalAlpha = 0.17;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, bandY, width, height * 0.055);
  ctx.globalAlpha = 0.08;
  ctx.fillRect(0, bandY + height * 0.06, width, height * 0.012);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = '#ffffff';
  for (let index = 0; index < 4; index += 1) {
    const y = height * (0.12 + index * 0.24) + Math.sin(time * 0.7 + index) * 4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= width; x += width / 12) {
      ctx.lineTo(x, y + Math.sin(x * 0.05 + time * 1.4 + index) * 2.5);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* 07 — Infomercial                                                    */
/* ------------------------------------------------------------------ */

function infomercial(ctx, width, height, time, channel) {
  const background = ctx.createRadialGradient(width * 0.42, height * 0.4, 0, width * 0.42, height * 0.4, width * 0.75);
  background.addColorStop(0, '#ffe9a8');
  background.addColorStop(0.52, '#ffc247');
  background.addColorStop(1, '#e87a1f');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(width * 0.46, height * 0.47);
  ctx.rotate(time * 0.06);
  for (let ray = 0; ray < 18; ray += 1) {
    ctx.rotate(TAU / 18);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width * 0.62, -width * 0.035);
    ctx.lineTo(width * 0.62, width * 0.035);
    ctx.closePath();
    ctx.fillStyle = ray % 2 ? 'rgba(255, 247, 219, 0.24)' : 'rgba(255, 255, 255, 0.08)';
    ctx.fill();
  }
  ctx.restore();

  const shadow = ctx.createRadialGradient(width * 0.47, height * 0.82, 0, width * 0.47, height * 0.82, width * 0.26);
  shadow.addColorStop(0, 'rgba(97, 41, 0, 0.32)');
  shadow.addColorStop(1, 'rgba(97, 41, 0, 0)');
  ctx.fillStyle = shadow;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(width * 0.46, height * 0.5);
  ctx.rotate(Math.sin(time * 0.7) * 0.06 - 0.04);

  ctx.fillStyle = 'rgba(83, 39, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(0, height * 0.28, width * 0.24, height * 0.05, 0, 0, TAU);
  ctx.fill();

  const body = ctx.createLinearGradient(-width * 0.16, -height * 0.22, width * 0.18, height * 0.22);
  body.addColorStop(0, '#fffdf5');
  body.addColorStop(0.36, '#d9dde2');
  body.addColorStop(0.7, '#8a939d');
  body.addColorStop(1, '#4c555e');
  ctx.fillStyle = body;
  roundRect(ctx, -width * 0.15, -height * 0.17, width * 0.3, height * 0.38, width * 0.035);
  ctx.fill();

  ctx.fillStyle = '#2c333b';
  roundRect(ctx, -width * 0.12, -height * 0.12, width * 0.24, height * 0.16, width * 0.018);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
  roundRect(ctx, -width * 0.1, -height * 0.095, width * 0.2, height * 0.025, 2);
  ctx.fill();

  const handle = ctx.createLinearGradient(0, -height * 0.3, 0, -height * 0.17);
  handle.addColorStop(0, '#eef1f4');
  handle.addColorStop(1, '#77808a');
  ctx.strokeStyle = handle;
  ctx.lineWidth = width * 0.032;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -height * 0.15);
  ctx.lineTo(0, -height * 0.34);
  ctx.stroke();

  ctx.fillStyle = '#ff5a1f';
  roundRect(ctx, -width * 0.075, height * 0.04, width * 0.15, height * 0.055, 2);
  ctx.fill();
  label(ctx, 'AS SEEN ON TV', 0, height * 0.078, height * 0.022, '#fff8ea', {
    weight: 800,
    align: 'center',
    spacing: 1
  });

  ctx.restore();

  const sparkleRandom = hash(0x77bb13);
  for (let index = 0; index < 16; index += 1) {
    const angle = sparkleRandom() * TAU + time * (0.2 + sparkleRandom() * 0.3);
    const distance = width * (0.18 + sparkleRandom() * 0.26);
    const x = width * 0.46 + Math.cos(angle) * distance;
    const y = height * 0.48 + Math.sin(angle) * distance * 0.72;
    const size = 1.2 + sparkleRandom() * 2.6;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(-size, -0.5, size * 2, 1);
    ctx.fillRect(-0.5, -size, 1, size * 2);
    ctx.restore();
  }

  label(ctx, 'VALUE VISION', width * 0.06, height * 0.13, height * 0.052, 'rgba(74, 35, 0, 0.86)', {
    weight: 900,
    spacing: 2
  });
  label(ctx, 'THE MIRACLE MOP', width * 0.06, height * 0.19, height * 0.028, 'rgba(92, 43, 0, 0.62)', {
    weight: 800,
    spacing: 2
  });

  ctx.fillStyle = 'rgba(35, 17, 0, 0.84)';
  roundRect(ctx, width * 0.55, height * 0.68, width * 0.39, height * 0.24, 5);
  ctx.fill();
  label(ctx, 'ONLY', width * 0.575, height * 0.735, height * 0.028, 'rgba(255, 226, 147, 0.9)', {
    spacing: 2
  });
  label(ctx, '$19.99', width * 0.575, height * 0.855, height * 0.095, '#fff3cd', {
    weight: 900,
    spacing: -2
  });
  label(ctx, 'CALL NOW', width * 0.575, height * 0.9, height * 0.024, 'rgba(255, 184, 71, 0.88)', {
    weight: 800,
    spacing: 3
  });
}

/* ------------------------------------------------------------------ */
/* 09 — Synth / music                                                  */
/* ------------------------------------------------------------------ */

function synth(ctx, width, height, time, channel) {
  const sky = ctx.createLinearGradient(0, 0, 0, height * 0.72);
  sky.addColorStop(0, '#130a2e');
  sky.addColorStop(0.45, '#40126c');
  sky.addColorStop(0.75, '#b02b7b');
  sky.addColorStop(1, '#ff8a3d');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  drawStars(ctx, stars(channel, width, height, 55), time * 0.55, '#ffe8ff');

  const sunX = width * 0.5;
  const sunY = height * 0.58;
  const sunR = Math.min(width, height) * 0.2;
  const halo = ctx.createRadialGradient(sunX, sunY, sunR * 0.4, sunX, sunY, sunR * 2.4);
  halo.addColorStop(0, 'rgba(255, 160, 92, 0.42)');
  halo.addColorStop(1, 'rgba(255, 160, 92, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(sunX - sunR * 2.4, sunY - sunR * 2.4, sunR * 4.8, sunR * 4.8);

  const sun = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
  sun.addColorStop(0, '#ffd36e');
  sun.addColorStop(0.55, '#ff7d5a');
  sun.addColorStop(1, '#c22f8a');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, TAU);
  ctx.fill();

  ctx.fillStyle = 'rgba(35, 8, 53, 0.88)';
  for (let index = 0; index < 7; index += 1) {
    const y = sunY + sunR * (0.06 + index * 0.135);
    ctx.fillRect(sunX - sunR, y, sunR * 2, 2 + index * 1.5);
  }

  const horizon = height * 0.68;
  ctx.fillStyle = '#1a0a30';
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  for (let x = 0; x <= width; x += 6) {
    const y = horizon - 18 - Math.abs(Math.sin(x * 0.011 + 1.2)) * height * 0.13;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();

  const gridBottom = height;
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 94, 219, 0.4)';
  ctx.lineWidth = 1;
  const scroll = (time * 0.4) % 1;
  for (let index = -9; index <= 9; index += 1) {
    const bottomX = width * 0.5 + index * width * 0.13;
    ctx.beginPath();
    ctx.moveTo(width * 0.5, horizon);
    ctx.lineTo(bottomX, gridBottom);
    ctx.stroke();
  }
  for (let index = 0; index < 12; index += 1) {
    const progress = (index + scroll) / 12;
    const y = horizon + Math.pow(progress, 2.1) * (gridBottom - horizon);
    const half = (y - horizon) * 1.35;
    ctx.beginPath();
    ctx.moveTo(width * 0.5 - half, y);
    ctx.lineTo(width * 0.5 + half, y);
    ctx.stroke();
  }
  ctx.restore();

  const barCount = 26;
  const barWidth = width / barCount;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let index = 0; index < barCount; index += 1) {
    const wave = Math.sin(time * 2.6 + index * 0.56) * 0.5 + 0.5;
    const wave2 = Math.sin(time * 1.3 + index * 0.21) * 0.5 + 0.5;
    const barHeight = height * (0.025 + wave * 0.085 * (0.4 + wave2));
    const x = index * barWidth + barWidth * 0.24;
    const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
    gradient.addColorStop(0, 'rgba(111, 227, 255, 0.9)');
    gradient.addColorStop(1, 'rgba(255, 94, 219, 0.15)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, height - barHeight, barWidth * 0.52, barHeight);
  }
  ctx.restore();

  label(ctx, 'NEON FM', width * 0.06, height * 0.14, height * 0.056, 'rgba(255, 235, 255, 0.9)', {
    weight: 900,
    spacing: 4
  });
  label(ctx, '89.9 MHz', width * 0.062, height * 0.2, height * 0.026, 'rgba(255, 172, 230, 0.72)', {
    spacing: 2
  });

  const scanY = ((time * 9) % (height + 20)) - 10;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
  ctx.fillRect(0, scanY, width, 2);
}

/* ------------------------------------------------------------------ */
/* 11 — News                                                           */
/* ------------------------------------------------------------------ */

function news(ctx, width, height, time, channel) {
  const background = ctx.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, '#071527');
  background.addColorStop(0.55, '#0a2039');
  background.addColorStop(1, '#05101d');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.strokeStyle = 'rgba(111, 184, 255, 0.08)';
  ctx.lineWidth = 1;
  for (let index = 0; index < 12; index += 1) {
    const y = (index / 11) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  for (let index = 0; index < 18; index += 1) {
    const x = (index / 17) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  ctx.restore();

  const globeX = width * 0.69;
  const globeY = height * 0.44;
  const globeR = Math.min(width, height) * 0.23;

  const glow = ctx.createRadialGradient(globeX, globeY, globeR * 0.3, globeX, globeY, globeR * 2);
  glow.addColorStop(0, 'rgba(66, 150, 255, 0.28)');
  glow.addColorStop(1, 'rgba(66, 150, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(globeX - globeR * 2, globeY - globeR * 2, globeR * 4, globeR * 4);

  ctx.save();
  ctx.beginPath();
  ctx.arc(globeX, globeY, globeR, 0, TAU);
  ctx.clip();

  const ocean = ctx.createLinearGradient(globeX - globeR, globeY - globeR, globeX + globeR, globeY + globeR);
  ocean.addColorStop(0, '#1a5f9e');
  ocean.addColorStop(0.55, '#0b3560');
  ocean.addColorStop(1, '#051a31');
  ctx.fillStyle = ocean;
  ctx.fillRect(globeX - globeR, globeY - globeR, globeR * 2, globeR * 2);

  const random = hash(0x39d1e0);
  ctx.fillStyle = 'rgba(54, 165, 128, 0.55)';
  for (let index = 0; index < 14; index += 1) {
    const x = globeX - globeR + random() * globeR * 2;
    const y = globeY - globeR + random() * globeR * 2;
    const w = 8 + random() * 26;
    const h = 6 + random() * 18;
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, random() * TAU, 0, TAU);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(140, 208, 255, 0.26)';
  ctx.lineWidth = 1;
  const rotation = (time * 0.12) % TAU;
  for (let index = 0; index < 6; index += 1) {
    const rx = Math.abs(Math.cos(rotation + (index / 6) * Math.PI)) * globeR;
    ctx.beginPath();
    ctx.ellipse(globeX, globeY, Math.max(1, rx), globeR, 0, 0, TAU);
    ctx.stroke();
  }
  for (let index = -3; index <= 3; index += 1) {
    const y = globeY + (index / 4) * globeR;
    const rx = globeR * Math.sqrt(Math.max(0, 1 - Math.pow((y - globeY) / globeR, 2)));
    ctx.beginPath();
    ctx.ellipse(globeX, y, rx, rx * 0.14, 0, 0, TAU);
    ctx.stroke();
  }

  const shade = ctx.createLinearGradient(globeX - globeR, 0, globeX + globeR, 0);
  shade.addColorStop(0, 'rgba(0, 0, 0, 0.42)');
  shade.addColorStop(0.4, 'rgba(0, 0, 0, 0)');
  shade.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
  ctx.fillStyle = shade;
  ctx.fillRect(globeX - globeR, globeY - globeR, globeR * 2, globeR * 2);
  ctx.restore();

  ctx.strokeStyle = 'rgba(140, 208, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(globeX, globeY, globeR, 0, TAU);
  ctx.stroke();

  const orbitX = globeX + Math.cos(time * 0.5) * globeR * 1.5;
  const orbitY = globeY + Math.sin(time * 0.5) * globeR * 0.52;
  ctx.strokeStyle = 'rgba(255, 179, 71, 0.2)';
  ctx.beginPath();
  ctx.ellipse(globeX, globeY, globeR * 1.5, globeR * 0.55, -0.25, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = '#ffce7a';
  ctx.beginPath();
  ctx.arc(orbitX, orbitY, 2.5, 0, TAU);
  ctx.fill();

  const thirdY = height * 0.72;
  const slide = Math.sin(time * 0.45) * width * 0.05;
  ctx.fillStyle = channel.accent;
  ctx.fillRect(width * 0.055 + slide, thirdY, width * 0.33, height * 0.075);
  label(ctx, 'ACTION NEWS', width * 0.075 + slide, thirdY + height * 0.052, height * 0.04, '#ffffff', {
    weight: 900,
    spacing: 2
  });

  ctx.fillStyle = 'rgba(7, 18, 31, 0.92)';
  ctx.fillRect(width * 0.055 + slide, thirdY + height * 0.075, width * 0.62, height * 0.085);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.strokeRect(width * 0.055 + slide, thirdY + height * 0.075, width * 0.62, height * 0.085);
  label(ctx, 'CITY COUNCIL DEBATE ENTERS HOUR SIX', width * 0.075 + slide, thirdY + height * 0.13, height * 0.032, 'rgba(255, 255, 255, 0.92)', {
    weight: 700,
    spacing: 0.5
  });

  const tickerY = height * 0.9;
  ctx.fillStyle = 'rgba(255, 77, 77, 0.92)';
  ctx.fillRect(0, tickerY, width, height * 0.1);
  const headline = 'WEATHER ALERT  ·  TRAFFIC DELAYS  ·  MARKETS CLOSE HIGHER  ·  SPORTS AT 11  ·  ';
  const offset = (time * 55) % (width * 1.4);
  label(ctx, headline + headline, width - offset, tickerY + height * 0.064, height * 0.026, '#fff7ee', {
    weight: 700,
    spacing: 1
  });

  label(ctx, 'ACTION 11', width * 0.055, height * 0.12, height * 0.052, 'rgba(255, 255, 255, 0.92)', {
    weight: 900,
    spacing: 2
  });
  label(ctx, 'LIVE', width * 0.058, height * 0.18, height * 0.028, 'rgba(255, 120, 120, 0.85)', {
    weight: 800,
    spacing: 3
  });
}

/* ------------------------------------------------------------------ */
/* 13 — Cartoons                                                       */
/* ------------------------------------------------------------------ */

function cartoons(ctx, width, height, time, channel) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#4ed6ff');
  sky.addColorStop(0.6, '#9aecff');
  sky.addColorStop(1, '#ffe493');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const sunX = width * 0.79;
  const sunY = height * 0.2;
  const sunR = height * 0.09;
  ctx.fillStyle = 'rgba(255, 240, 133, 0.9)';
  for (let ray = 0; ray < 12; ray += 1) {
    const angle = (ray / 12) * TAU + time * 0.08;
    ctx.save();
    ctx.translate(sunX, sunY);
    ctx.rotate(angle);
    ctx.fillRect(sunR * 1.3, -2, sunR * 0.7, 4);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, TAU);
  ctx.fill();

  const cloudRandom = hash(0x11aaee);
  for (let index = 0; index < 4; index += 1) {
    const speed = 5 + cloudRandom() * 9;
    const x = ((cloudRandom() * width + time * speed) % (width + 160)) - 80;
    const y = height * (0.14 + cloudRandom() * 0.22);
    const scale = 0.7 + cloudRandom() * 0.7;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.86)';
    ctx.beginPath();
    ctx.ellipse(x, y, 28 * scale, 12 * scale, 0, 0, TAU);
    ctx.ellipse(x + 20 * scale, y - 5 * scale, 20 * scale, 12 * scale, 0, 0, TAU);
    ctx.ellipse(x - 20 * scale, y - 2 * scale, 17 * scale, 10 * scale, 0, 0, TAU);
    ctx.fill();
  }

  const hill = (offsetX, amp, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x <= width; x += 8) {
      const y = height * 0.72 + Math.sin((x + offsetX) * 0.009) * amp + Math.sin(x * 0.023) * amp * 0.3;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
  };
  hill(0, height * 0.07, '#63c968');
  hill(180, height * 0.05, '#3ea84d');

  const characters = cache(channel, 'characters', () => {
    const random = hash(0x11bb22);
    return Array.from({ length: 3 }, (_, index) => ({
      x: 0.2 + index * 0.27,
      color: ['#ff7a8a', '#ffcf4a', '#8a6bff'][index],
      phase: random() * TAU,
      size: 0.72 + random() * 0.5
    }));
  });

  for (const character of characters) {
    const bounce = Math.abs(Math.sin(time * 2.1 + character.phase)) * height * 0.09;
    const x = width * (character.x + Math.sin(time * 0.5 + character.phase) * 0.02);
    const y = height * 0.79 - bounce;
    const size = height * 0.075 * character.size;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(23, 90, 44, 0.18)';
    ctx.beginPath();
    ctx.ellipse(0, height * 0.79 - y, size * 1.2, size * 0.32, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = character.color;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-size * 0.32, -size * 0.18, size * 0.32, 0, TAU);
    ctx.arc(size * 0.32, -size * 0.18, size * 0.32, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#171024';
    ctx.beginPath();
    ctx.arc(-size * 0.26, -size * 0.18, size * 0.13, 0, TAU);
    ctx.arc(size * 0.38, -size * 0.18, size * 0.13, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#171024';
    ctx.lineWidth = Math.max(1.4, size * 0.09);
    ctx.beginPath();
    ctx.arc(0, size * 0.08, size * 0.38, 0.2, Math.PI - 0.2);
    ctx.stroke();
    ctx.strokeStyle = '#171024';
    ctx.lineWidth = Math.max(1.4, size * 0.08);
    ctx.beginPath();
    ctx.moveTo(-size * 0.8, size * 0.25);
    ctx.lineTo(-size * 1.15, size * (0.05 + Math.sin(time * 4 + character.phase) * 0.18));
    ctx.moveTo(size * 0.8, size * 0.25);
    ctx.lineTo(size * 1.15, size * (0.05 - Math.sin(time * 4 + character.phase) * 0.18));
    ctx.stroke();
    ctx.restore();
  }

  const confettiRandom = hash(0x33cc11);
  for (let index = 0; index < 24; index += 1) {
    const x = (confettiRandom() * width + Math.sin(time * 0.3 + index) * 8) % width;
    const y = ((confettiRandom() * height + time * (14 + confettiRandom() * 18)) % (height + 20)) - 10;
    ctx.fillStyle = ['#ff5e6c', '#ffd93d', '#6b8cff', '#4cf0b0'][index % 4];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(time + index);
    ctx.fillRect(-2, -3, 4, 6);
    ctx.restore();
  }

  ctx.save();
  ctx.translate(width * 0.5, height * 0.17);
  ctx.rotate(-0.04);
  ctx.fillStyle = 'rgba(23, 16, 36, 0.88)';
  roundRect(ctx, -width * 0.18, -height * 0.085, width * 0.36, height * 0.16, 8);
  ctx.fill();
  label(ctx, 'TOON LOOP', 0, height * 0.035, height * 0.075, '#ffe66b', {
    weight: 900,
    align: 'center',
    spacing: 1
  });
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* 17 — Grindhouse                                                     */
/* ------------------------------------------------------------------ */

function grindhouse(ctx, width, height, time, channel) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#2b0c0c');
  sky.addColorStop(0.45, '#7a210f');
  sky.addColorStop(0.72, '#d05b1c');
  sky.addColorStop(1, '#3c1409');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const sunY = height * 0.52;
  const sunR = height * 0.16;
  const sunGlow = ctx.createRadialGradient(width * 0.55, sunY, 0, width * 0.55, sunY, sunR * 2.8);
  sunGlow.addColorStop(0, 'rgba(255, 189, 89, 0.42)');
  sunGlow.addColorStop(1, 'rgba(255, 120, 30, 0)');
  ctx.fillStyle = sunGlow;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#ffbd59';
  ctx.beginPath();
  ctx.arc(width * 0.55, sunY, sunR, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(82, 22, 7, 0.55)';
  for (let index = 0; index < 5; index += 1) {
    ctx.fillRect(width * 0.32, sunY + sunR * (0.05 + index * 0.17), width * 0.46, 2 + index);
  }

  const horizon = height * 0.64;
  ctx.fillStyle = '#2a1008';
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  ctx.lineTo(width * 0.1, horizon - height * 0.09);
  ctx.lineTo(width * 0.16, horizon - height * 0.05);
  ctx.lineTo(width * 0.25, horizon - height * 0.12);
  ctx.lineTo(width * 0.3, horizon);
  ctx.lineTo(width, horizon);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#180a05';
  ctx.beginPath();
  ctx.moveTo(0, horizon + 4);
  ctx.lineTo(width, horizon + 4);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 196, 111, 0.65)';
  ctx.lineWidth = 2;
  const center = width * 0.52;
  ctx.beginPath();
  ctx.moveTo(center, horizon + 6);
  ctx.lineTo(center, height);
  ctx.stroke();
  for (let index = 0; index < 7; index += 1) {
    const progress = (index + ((time * 1.4) % 1)) / 7;
    const y = horizon + Math.pow(progress, 1.8) * (height - horizon);
    const length = 2 + progress * 12;
    ctx.strokeStyle = `rgba(255, 196, 111, ${0.25 + progress * 0.55})`;
    ctx.lineWidth = 1 + progress * 2;
    ctx.beginPath();
    ctx.moveTo(center, y);
    ctx.lineTo(center, y + length);
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(width * 0.5 + Math.sin(time * 1.3) * 1.5, height * 0.76);
  const carShake = Math.sin(time * 6) * 0.6;
  ctx.rotate(carShake * 0.004);
  ctx.fillStyle = '#0b0504';
  ctx.beginPath();
  ctx.moveTo(-width * 0.16, height * 0.06);
  ctx.lineTo(-width * 0.1, -height * 0.055);
  ctx.lineTo(width * 0.05, -height * 0.07);
  ctx.lineTo(width * 0.14, -height * 0.015);
  ctx.lineTo(width * 0.17, height * 0.06);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#160907';
  roundRect(ctx, -width * 0.17, height * 0.025, width * 0.34, height * 0.065, 5);
  ctx.fill();
  ctx.fillStyle = '#ff3a1f';
  ctx.fillRect(-width * 0.12, height * 0.04, width * 0.035, 3);
  ctx.fillRect(width * 0.085, height * 0.04, width * 0.035, 3);
  ctx.fillStyle = '#ffcf7a';
  ctx.beginPath();
  ctx.arc(-width * 0.12, height * 0.05, 3, 0, TAU);
  ctx.arc(width * 0.12, height * 0.05, 3, 0, TAU);
  ctx.fill();

  const beamGradient = ctx.createLinearGradient(0, 0, 0, height * 0.12);
  beamGradient.addColorStop(0, 'rgba(255, 226, 158, 0.28)');
  beamGradient.addColorStop(1, 'rgba(255, 226, 158, 0)');
  ctx.fillStyle = beamGradient;
  ctx.beginPath();
  ctx.moveTo(-width * 0.17, height * 0.04);
  ctx.lineTo(-width * 0.42, height * 0.2);
  ctx.lineTo(-width * 0.3, height * 0.23);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const scratchRandom = hash(0x9ad3c1);
  ctx.save();
  for (let index = 0; index < 6; index += 1) {
    const x = scratchRandom() * width;
    const alpha = 0.05 + scratchRandom() * 0.18;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fillRect(x, 0, 0.5 + scratchRandom(), height);
  }
  ctx.restore();

  ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
  ctx.fillRect(0, 0, width, height * 0.085);
  ctx.fillRect(0, height * 0.915, width, height * 0.085);

  label(ctx, 'DRIVE INTO DARKNESS', width * 0.06, height * 0.17, height * 0.06, 'rgba(255, 237, 200, 0.95)', {
    weight: 900,
    spacing: 1
  });
  label(ctx, 'A KGRD GRINDHOUSE PRESENTATION', width * 0.062, height * 0.225, height * 0.022, 'rgba(255, 179, 95, 0.72)', {
    spacing: 1.5
  });

  ctx.strokeStyle = 'rgba(255, 240, 214, 0.65)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(width * 0.84, height * 0.13, width * 0.055, height * 0.085);
  label(ctx, 'R', width * 0.8675, height * 0.2, height * 0.07, 'rgba(255, 240, 214, 0.9)', {
    weight: 900,
    align: 'center'
  });

  grain(ctx, channel, width, height, 0.1);
}

/* ------------------------------------------------------------------ */
/* 21 — Deep field                                                     */
/* ------------------------------------------------------------------ */

function starfield(ctx, width, height, time, channel) {
  ctx.fillStyle = '#01030b';
  ctx.fillRect(0, 0, width, height);

  const nebula = cache(channel, 'nebula', () => {
    const random = hash(0x51e0a2);
    return Array.from({ length: 5 }, () => ({
      x: random(),
      y: random(),
      r: 0.18 + random() * 0.3,
      color: random() > 0.5 ? '105, 80, 255' : '34, 130, 200'
    }));
  });
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const cloud of nebula) {
    const radius = cloud.r * width;
    const x = cloud.x * width;
    const y = cloud.y * height;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(${cloud.color}, 0.14)`);
    gradient.addColorStop(1, `rgba(${cloud.color}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  ctx.restore();

  const warpStars = cache(channel, 'warp', () => {
    const random = hash(0x7ac31b);
    return Array.from({ length: 130 }, () => ({
      angle: random() * TAU,
      distance: random(),
      speed: 0.02 + random() * 0.11,
      size: 0.4 + random() * 1.3
    }));
  });

  const centerX = width * 0.43;
  const centerY = height * 0.47;
  const maxRadius = Math.hypot(width, height) * 0.62;
  ctx.save();
  for (const star of warpStars) {
    const travel = (star.distance + time * star.speed) % 1;
    const radius = travel * maxRadius;
    const previous = Math.max(0, radius - (8 + travel * 26));
    const x = centerX + Math.cos(star.angle) * radius;
    const y = centerY + Math.sin(star.angle) * radius;
    const px = centerX + Math.cos(star.angle) * previous;
    const py = centerY + Math.sin(star.angle) * previous;
    ctx.strokeStyle = `rgba(215, 234, 255, ${0.15 + travel * 0.75})`;
    ctx.lineWidth = star.size;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  ctx.restore();

  const planetX = width * 0.76;
  const planetY = height * 0.55;
  const planetR = Math.min(width, height) * 0.16;

  ctx.save();
  ctx.strokeStyle = 'rgba(150, 180, 255, 0.26)';
  ctx.lineWidth = planetR * 0.18;
  ctx.beginPath();
  ctx.ellipse(planetX, planetY, planetR * 1.85, planetR * 0.55, -0.32, 0, TAU);
  ctx.stroke();
  ctx.restore();

  const planet = ctx.createRadialGradient(
    planetX - planetR * 0.35,
    planetY - planetR * 0.4,
    planetR * 0.1,
    planetX,
    planetY,
    planetR
  );
  planet.addColorStop(0, '#b9d9ff');
  planet.addColorStop(0.35, '#5585d8');
  planet.addColorStop(0.72, '#203a7c');
  planet.addColorStop(1, '#080f27');
  ctx.fillStyle = planet;
  ctx.beginPath();
  ctx.arc(planetX, planetY, planetR, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = 'rgba(150, 180, 255, 0.42)';
  ctx.lineWidth = planetR * 0.16;
  ctx.beginPath();
  ctx.ellipse(planetX, planetY, planetR * 1.85, planetR * 0.55, -0.32, 0.25, Math.PI - 0.25);
  ctx.stroke();

  const flare = ctx.createRadialGradient(planetX + planetR * 0.7, planetY - planetR * 0.8, 0, planetX + planetR * 0.7, planetY - planetR * 0.8, planetR * 1.1);
  flare.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
  flare.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = flare;
  ctx.fillRect(0, 0, width, height);

  const shipX = width * ((time * 0.02) % 1.3) - width * 0.15;
  const shipY = height * 0.78 + Math.sin(time * 0.5) * 3;
  ctx.fillStyle = 'rgba(5, 8, 16, 0.95)';
  ctx.beginPath();
  ctx.moveTo(shipX, shipY);
  ctx.lineTo(shipX - 20, shipY + 5);
  ctx.lineTo(shipX - 11, shipY + 7);
  ctx.lineTo(shipX - 18, shipY + 11);
  ctx.lineTo(shipX + 5, shipY + 5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = `rgba(111, 227, 255, ${0.35 + 0.4 * Math.abs(Math.sin(time * 3))})`;
  ctx.fillRect(shipX - 9, shipY + 4, 2, 1);
  ctx.fillRect(shipX - 15, shipY + 6, 2, 1);

  label(ctx, 'DEEP FIELD', width * 0.055, height * 0.13, height * 0.05, 'rgba(230, 242, 255, 0.88)', {
    weight: 900,
    spacing: 5
  });
  label(ctx, 'BEYOND THE SIGNAL', width * 0.057, height * 0.19, height * 0.022, 'rgba(142, 195, 255, 0.55)', {
    spacing: 2
  });
}

/* ------------------------------------------------------------------ */
/* 28 — Sitcom                                                         */
/* ------------------------------------------------------------------ */

function sitcom(ctx, width, height, time, channel) {
  const wall = ctx.createLinearGradient(0, 0, 0, height);
  wall.addColorStop(0, '#5e2f22');
  wall.addColorStop(0.6, '#422017');
  wall.addColorStop(1, '#25110d');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(255, 210, 150, 0.05)';
  for (let index = 0; index < 12; index += 1) {
    ctx.fillRect(0, (index / 12) * height, width, 1);
  }

  ctx.fillStyle = '#1a2438';
  roundRect(ctx, width * 0.07, height * 0.14, width * 0.24, height * 0.36, 3);
  ctx.fill();
  const windowGlow = ctx.createLinearGradient(0, height * 0.14, 0, height * 0.5);
  windowGlow.addColorStop(0, 'rgba(37, 72, 128, 0.9)');
  windowGlow.addColorStop(1, 'rgba(8, 15, 30, 0.95)');
  ctx.fillStyle = windowGlow;
  ctx.fillRect(width * 0.085, height * 0.16, width * 0.21, height * 0.32);

  const cityRandom = hash(0x19bc83);
  for (let index = 0; index < 7; index += 1) {
    const buildingW = width * (0.012 + cityRandom() * 0.02);
    const buildingH = height * (0.08 + cityRandom() * 0.14);
    const x = width * 0.09 + index * width * 0.028;
    ctx.fillStyle = '#0a1020';
    ctx.fillRect(x, height * 0.48 - buildingH, buildingW, buildingH);
    ctx.fillStyle = 'rgba(255, 213, 143, 0.55)';
    for (let w = 0; w < 3; w += 1) {
      ctx.fillRect(x + 2, height * 0.48 - buildingH + 4 + w * 6, 2, 2);
    }
  }

  ctx.fillStyle = '#ffe9b5';
  ctx.beginPath();
  ctx.arc(width * 0.245, height * 0.22, height * 0.03, 0, TAU);
  ctx.fill();

  ctx.fillStyle = '#94402f';
  ctx.beginPath();
  ctx.moveTo(width * 0.055, height * 0.16);
  ctx.lineTo(width * 0.085, height * 0.14);
  ctx.lineTo(width * 0.085, height * 0.51);
  ctx.lineTo(width * 0.055, height * 0.53);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#b65439';
  ctx.beginPath();
  ctx.moveTo(width * 0.295, height * 0.15);
  ctx.lineTo(width * 0.325, height * 0.17);
  ctx.lineTo(width * 0.325, height * 0.54);
  ctx.lineTo(width * 0.295, height * 0.52);
  ctx.closePath();
  ctx.fill();

  const lampX = width * 0.85;
  const lampY = height * 0.46;
  const lampGlow = ctx.createRadialGradient(lampX, lampY, 0, lampX, lampY, width * 0.2);
  lampGlow.addColorStop(0, 'rgba(255, 205, 117, 0.5)');
  lampGlow.addColorStop(1, 'rgba(255, 205, 117, 0)');
  ctx.fillStyle = lampGlow;
  ctx.fillRect(lampX - width * 0.2, lampY - width * 0.2, width * 0.4, width * 0.4);
  ctx.fillStyle = '#1a0e0a';
  ctx.fillRect(lampX - 2, height * 0.46, 4, height * 0.27);
  ctx.fillStyle = '#ffdf9e';
  ctx.beginPath();
  ctx.moveTo(lampX - width * 0.045, height * 0.4);
  ctx.lineTo(lampX + width * 0.045, height * 0.4);
  ctx.lineTo(lampX + width * 0.06, height * 0.47);
  ctx.lineTo(lampX - width * 0.06, height * 0.47);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#2f1510';
  roundRect(ctx, width * 0.31, height * 0.63, width * 0.48, height * 0.2, 10);
  ctx.fill();

  const couch = ctx.createLinearGradient(0, height * 0.58, 0, height * 0.85);
  couch.addColorStop(0, '#b56848');
  couch.addColorStop(1, '#6d2f22');
  ctx.fillStyle = couch;
  roundRect(ctx, width * 0.29, height * 0.64, width * 0.5, height * 0.15, 8);
  ctx.fill();
  roundRect(ctx, width * 0.3, height * 0.55, width * 0.09, height * 0.15, 6);
  ctx.fill();
  roundRect(ctx, width * 0.7, height * 0.55, width * 0.09, height * 0.15, 6);
  ctx.fill();

  ctx.fillStyle = '#d18a63';
  for (let index = 0; index < 3; index += 1) {
    roundRect(ctx, width * (0.35 + index * 0.14), height * 0.61, width * 0.12, height * 0.08, 6);
    ctx.fill();
  }

  const person = (x, color, phase) => {
    const bob = Math.sin(time * 1.4 + phase) * 1.5;
    ctx.save();
    ctx.translate(x, height * 0.6 + bob);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, height * 0.052, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, height * 0.11, height * 0.075, height * 0.1, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#2b1410';
    ctx.beginPath();
    ctx.arc(-height * 0.017, -height * 0.005, 1.6, 0, TAU);
    ctx.arc(height * 0.017, -height * 0.005, 1.6, 0, TAU);
    ctx.fill();
    ctx.restore();
  };
  person(width * 0.42, '#3e2a29', 0);
  person(width * 0.61, '#58302a', 1.8);

  ctx.fillStyle = '#3a1711';
  roundRect(ctx, width * 0.15, height * 0.86, width * 0.7, height * 0.06, 4);
  ctx.fill();

  const signAlpha = 0.4 + 0.5 * (0.5 + 0.5 * Math.sin(time * 3.1));
  ctx.fillStyle = `rgba(20, 8, 5, ${0.8})`;
  roundRect(ctx, width * 0.38, height * 0.08, width * 0.24, height * 0.07, 3);
  ctx.fill();
  ctx.strokeStyle = `rgba(255, 205, 117, ${signAlpha})`;
  ctx.lineWidth = 1;
  ctx.strokeRect(width * 0.38, height * 0.08, width * 0.24, height * 0.07);
  label(ctx, 'LIVE AUDIENCE', width * 0.5, height * 0.128, height * 0.028, `rgba(255, 217, 143, ${0.4 + signAlpha * 0.6})`, {
    weight: 800,
    align: 'center',
    spacing: 2
  });

  label(ctx, 'RETRO ACTIVE', width * 0.055, height * 0.93, height * 0.034, 'rgba(255, 224, 190, 0.55)', {
    weight: 900,
    spacing: 2
  });
}

/* ------------------------------------------------------------------ */
/* 33 — Cooking                                                        */
/* ------------------------------------------------------------------ */

function cooking(ctx, width, height, time, channel) {
  const background = ctx.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, '#3f1d12');
  background.addColorStop(0.55, '#2b120b');
  background.addColorStop(1, '#160806');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 196, 128, 0.07)';
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += width / 14) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height * 0.66);
    ctx.stroke();
  }
  for (let y = 0; y < height * 0.66; y += height / 9) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();

  const glow = ctx.createRadialGradient(width * 0.55, height * 0.64, 0, width * 0.55, height * 0.64, width * 0.38);
  glow.addColorStop(0, 'rgba(255, 150, 55, 0.32)');
  glow.addColorStop(1, 'rgba(255, 150, 55, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#24110b';
  ctx.fillRect(0, height * 0.68, width, height * 0.32);

  ctx.fillStyle = '#120705';
  roundRect(ctx, width * 0.27, height * 0.58, width * 0.5, height * 0.16, 10);
  ctx.fill();
  ctx.fillStyle = '#2c1810';
  roundRect(ctx, width * 0.29, height * 0.6, width * 0.46, height * 0.12, 8);
  ctx.fill();

  const panX = width * 0.51;
  const panY = height * 0.64;
  const panR = width * 0.18;
  ctx.fillStyle = '#0b0908';
  ctx.beginPath();
  ctx.ellipse(panX, panY, panR, panR * 0.32, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#d0a15e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(panX, panY, panR, panR * 0.32, 0, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = '#24120c';
  ctx.lineWidth = width * 0.014;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(panX + panR * 0.92, panY - 2);
  ctx.lineTo(panX + panR * 1.65, panY - height * 0.03);
  ctx.stroke();

  const flameRandom = hash(0x22ff88);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let index = 0; index < 10; index += 1) {
    const x = panX - panR * 0.8 + (index / 9) * panR * 1.6;
    const heightOffset = height * (0.04 + 0.03 * Math.abs(Math.sin(time * 3 + index * 1.2 + flameRandom())));
    const gradient = ctx.createLinearGradient(0, panY, 0, panY - heightOffset);
    gradient.addColorStop(0, 'rgba(255, 200, 60, 0.65)');
    gradient.addColorStop(1, 'rgba(255, 64, 24, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(x, panY);
    ctx.quadraticCurveTo(x - 5, panY - heightOffset * 0.6, x, panY - heightOffset);
    ctx.quadraticCurveTo(x + 6, panY - heightOffset * 0.5, x, panY);
    ctx.fill();
  }
  ctx.restore();

  const foodRandom = hash(0x44ac21);
  for (let index = 0; index < 7; index += 1) {
    const phase = (time * 0.9 + index * 0.37) % 1;
    const flip = Math.sin(phase * Math.PI);
    const x = panX - panR * 0.55 + (index / 6) * panR * 1.1;
    const y = panY - flip * height * 0.13;
    const size = 3 + (index % 3) * 2;
    ctx.fillStyle = ['#ffb347', '#e8722e', '#9bd15a'][index % 3];
    ctx.beginPath();
    ctx.arc(x, y, size, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 250, 220, 0.5)';
    ctx.fillRect(x - size * 0.2, y - size * 0.2, size * 0.4, size * 0.4);
  }

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 245, 220, 0.28)';
  ctx.lineWidth = 2;
  for (let index = 0; index < 3; index += 1) {
    const x = panX - panR * 0.4 + index * panR * 0.4;
    const drift = Math.sin(time * 1.5 + index) * 5;
    ctx.beginPath();
    ctx.moveTo(x, panY - 6);
    ctx.bezierCurveTo(x - 8, panY - height * 0.06, x + 9 + drift, panY - height * 0.11, x + drift, panY - height * 0.16);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = '#d7a961';
  roundRect(ctx, width * 0.05, height * 0.72, width * 0.19, height * 0.09, 4);
  ctx.fill();
  ctx.fillStyle = '#ff9a52';
  ctx.beginPath();
  ctx.arc(width * 0.09, height * 0.765, height * 0.022, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#78c94b';
  ctx.beginPath();
  ctx.arc(width * 0.135, height * 0.75, height * 0.018, 0, TAU);
  ctx.arc(width * 0.155, height * 0.79, height * 0.014, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#e6d4b5';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width * 0.17, height * 0.73);
  ctx.lineTo(width * 0.21, height * 0.7);
  ctx.stroke();

  label(ctx, 'CAST IRON', width * 0.055, height * 0.12, height * 0.052, 'rgba(255, 234, 198, 0.92)', {
    weight: 900,
    spacing: 3
  });
  label(ctx, 'SIZZLE & SERVE', width * 0.057, height * 0.18, height * 0.025, 'rgba(255, 190, 112, 0.7)', {
    weight: 800,
    spacing: 2
  });

  const timerAlpha = 0.7 + 0.3 * Math.sin(time * 2);
  ctx.fillStyle = `rgba(35, 14, 7, ${0.78})`;
  roundRect(ctx, width * 0.82, height * 0.1, width * 0.13, height * 0.09, 3);
  ctx.fill();
  label(ctx, '12:00', width * 0.885, height * 0.158, height * 0.038, `rgba(255, 209, 102, ${timerAlpha})`, {
    weight: 700,
    align: 'center',
    spacing: 1
  });
}

/* ------------------------------------------------------------------ */
/* 36 — Test pattern                                                   */
/* ------------------------------------------------------------------ */

function testpattern(ctx, width, height, time, channel) {
  const bars = ['#c8c8c8', '#d6d64a', '#48c8d6', '#4ad05a', '#c84ac8', '#d64a4a', '#4a4ad6'];
  const barWidth = width / bars.length;
  bars.forEach((color, index) => {
    ctx.fillStyle = color;
    ctx.fillRect(index * barWidth, 0, barWidth + 1, height * 0.68);
  });

  const lower = ['#3232b4', '#111111', '#b432b4', '#111111', '#32b4b4', '#111111', '#3232b4'];
  lower.forEach((color, index) => {
    ctx.fillStyle = color;
    ctx.fillRect(index * barWidth, height * 0.68, barWidth + 1, height * 0.09);
  });

  ctx.fillStyle = '#0b0b0b';
  ctx.fillRect(0, height * 0.77, width * 0.2, height * 0.23);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(width * 0.2, height * 0.77, width * 0.2, height * 0.23);
  ctx.fillStyle = '#1d1d1d';
  ctx.fillRect(width * 0.4, height * 0.77, width * 0.2, height * 0.23);
  ctx.fillStyle = '#101010';
  ctx.fillRect(width * 0.6, height * 0.77, width * 0.4, height * 0.23);

  ctx.save();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.lineWidth = 1;
  for (let index = 0; index < 18; index += 1) {
    ctx.beginPath();
    ctx.moveTo(0, (index / 18) * height);
    ctx.lineTo(width, (index / 18) * height);
    ctx.stroke();
  }
  ctx.restore();

  const centerX = width * 0.5;
  const centerY = height * 0.43;
  const radius = Math.min(width, height) * 0.24;
  ctx.fillStyle = 'rgba(8, 8, 10, 0.9)';
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerX - radius, centerY);
  ctx.lineTo(centerX + radius, centerY);
  ctx.moveTo(centerX, centerY - radius);
  ctx.lineTo(centerX, centerY + radius);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.62, 0, TAU);
  ctx.stroke();

  label(ctx, 'TVGRID', centerX, centerY + height * 0.03, height * 0.075, 'rgba(255, 255, 255, 0.95)', {
    weight: 900,
    align: 'center',
    spacing: 4
  });
  label(ctx, 'CHANNEL 36', centerX, centerY + height * 0.08, height * 0.028, 'rgba(255, 255, 255, 0.55)', {
    align: 'center',
    spacing: 3
  });

  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.beginPath();
  ctx.arc(centerX, centerY, 2.5, 0, TAU);
  ctx.fill();

  const clockRadius = radius * 0.82;
  const hand = time * 0.4;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(centerX + Math.cos(hand) * clockRadius, centerY + Math.sin(hand) * clockRadius);
  ctx.stroke();

  label(ctx, 'PLEASE STAND BY', width * 0.5, height * 0.88, height * 0.04, 'rgba(255, 255, 255, 0.88)', {
    weight: 800,
    align: 'center',
    spacing: 4
  });
  label(ctx, 'NO SIGNAL', width * 0.5, height * 0.825, height * 0.023, 'rgba(255, 255, 255, 0.45)', {
    align: 'center',
    spacing: 3
  });

  const random = hash(0x3cdde1);
  ctx.save();
  for (let index = 0; index < 40; index += 1) {
    const x = random() * width;
    const y = random() * height;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.03 + random() * 0.08})`;
    ctx.fillRect(x, y, 1 + random() * 2, 1);
  }
  ctx.restore();

  grain(ctx, channel, width, height, 0.07);
}

/* ------------------------------------------------------------------ */

const RENDERERS = {
  lateNight,
  weather,
  access,
  infomercial,
  synth,
  news,
  cartoons,
  grindhouse,
  starfield,
  sitcom,
  cooking,
  testpattern
};

export function drawChannel(channel, ctx, time, options = {}) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const renderer = RENDERERS[channel.theme] || testpattern;

  ctx.save();
  ctx.clearRect(0, 0, width, height);
  renderer(ctx, width, height, time, channel);
  vignette(ctx, width, height, options.vignette ?? 0.46);
  ctx.restore();
}

export { TAU };
