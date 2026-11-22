/**
 * 3D ASCII Flower Bouquet Engine in JavaScript
 * Ported & enhanced from Python bouquet3d.py
 * Supports realistic BLOOM ANIMATION (growth from bud to full blossom)
 * Optimized for Mobile/Canvas 60fps rendering with Touch Controls
 */

export class BouquetEngine {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // Configuration & State
    this.spinSpeed = options.spinSpeed !== undefined ? options.spinSpeed : 0.5;
    this.autoSpin = true;
    this.tilt = 0.28;
    this.camDist = 4.0;
    this.pivotY = 0.2;
    this.message = options.message || "for you Levina";
    
    // Bloom animation state
    // bloomProgress: 0.0 (uncut bud inside wrap) -> 1.0 (fully blossomed)
    this.bloomProgress = options.initialBloom !== undefined ? options.initialBloom : 1.0;
    this.targetBloom = 1.0;
    this.isBlooming = false;
    this.bloomSpeed = 0.35; // completes in ~2.8 seconds

    // Customization state
    this.state = {
      flowerType: 'mixed', // 'mixed', 'daisy', 'tulip', 'rose_red', 'all_pink'
      flowerCount: 10,     // 6 - 14
      hasBabyBreath: true,
      hasSparkles: true,
      hasHearts: true,
      wrapColor: 'kraft',  // 'kraft', 'pink', 'dark', 'white'
      ribbonColor: 'red',  // 'red', 'gold', 'lavender', 'rose'
      ...options.state
    };

    // Palettes
    this.PALETTES = {
      WHITE: ["#6b7280", "#9ca3af", "#d1d5db", "#e5e7eb", "#f3f4f6", "#ffffff"],
      PINK: ["#831843", "#9d174d", "#be185d", "#db2777", "#f472b6", "#fbcfe8", "#fff1f2"],
      ROSE_RED: ["#450a0a", "#7f1d1d", "#991b1b", "#dc2626", "#ef4444", "#f87171"],
      PURPLE: ["#3b0764", "#581c87", "#7e22ce", "#a855f7", "#c084fc", "#e9d5ff"],
      YELLOW: ["#713f12", "#a16207", "#ca8a04", "#eab308", "#facc15", "#fef08a"],
      ORANGE: ["#7c2d12", "#c2410c", "#ea580c", "#f97316", "#fb923c", "#fed7aa"],
      GOLD_CENTER: ["#78350f", "#b45309", "#d97706", "#f59e0b", "#fde68a"],
      DARK_CENTER: ["#1c1917", "#292524", "#44403c", "#78716c", "#a8a29e"],
      GREENS: ["#14532d", "#166534", "#15803d", "#16a34a", "#22c55e", "#4ade80", "#86efac"],
      PAPER_KRAFT: ["#451a03", "#78350f", "#92400e", "#b45309", "#d97706", "#fde68a"],
      PAPER_PINK: ["#500724", "#831843", "#9d174d", "#be185d", "#f472b6", "#fce7f3"],
      PAPER_DARK: ["#09090b", "#18181b", "#27272a", "#3f3f46", "#52525b", "#71717a"],
      PAPER_WHITE: ["#374151", "#4b5563", "#6b7280", "#9ca3af", "#d1d5db", "#f9fafb"],
      RIBBON_RED: ["#450a0a", "#7f1d1d", "#dc2626", "#ef4444", "#f87171", "#fca5a5"],
      RIBBON_GOLD: ["#713f12", "#a16207", "#ca8a04", "#eab308", "#facc15", "#fef08a"],
      RIBBON_LAVENDER: ["#3b0764", "#6b21a8", "#9333ea", "#c084fc", "#e9d5ff", "#f5f3ff"],
      RIBBON_ROSE: ["#831843", "#be185d", "#e11d48", "#fb7185", "#fda4af", "#ffe4e6"],
      HEARTS: ["#e11d48", "#f43f5e", "#fb7185", "#fda4af", "#ff758f", "#ff8fa3"],
      MSG_COLORS: ["#f43f5e", "#fb7185", "#f472b6", "#c084fc", "#a78bfa", "#818cf8", "#f472b6", "#fb7185"]
    };

    this.SHADE = ".:-=+*%@";
    this.PETAL_SHADE = "+*#%";
    
    // Light vector normalized (-0.45, 0.6, 0.66)
    const lx = -0.45, ly = 0.6, lz = 0.66;
    const ln = Math.sqrt(lx*lx + ly*ly + lz*lz);
    this.LX = lx / ln;
    this.LY = ly / ln;
    this.LZ = lz / ln;

    // Camera angles
    this.rotY = 0;
    this.rotX = 0;
    this.isDragging = false;
    this.lastTouchX = 0;
    this.lastTouchY = 0;
    
    // Hearts state
    this.hearts = [];
    this.numHearts = 18;

    // Time tracking
    this.startTime = performance.now();
    this.lastTime = this.startTime;
    this.animId = null;

    // Callback when bloom completes
    this.onBloomComplete = null;

    // Build scene geometry
    this.rebuildScene();
    this.initInteraction();
  }

  // Smooth easing for organic petal opening
  easeOutBack(x) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  norm(v) {
    const m = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]) || 1.0;
    return [v[0]/m, v[1]/m, v[2]/m];
  }

  cross(a, b) {
    return [
      a[1]*b[2] - a[2]*b[1],
      a[2]*b[0] - a[0]*b[2],
      a[0]*b[1] - a[1]*b[0]
    ];
  }

  add(p, d, k) {
    return [p[0] + d[0]*k, p[1] + d[1]*k, p[2] + d[2]*k];
  }

  pseudoRnd(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  triggerBloom(onComplete) {
    this.bloomProgress = 0.0;
    this.targetBloom = 1.0;
    this.isBlooming = true;
    this.onBloomComplete = onComplete;
  }

  rebuildScene() {
    const rnd = this.pseudoRnd(42);
    const pts = [];
    const neck = [0.0, -0.12, 0.0];
    const C = [0.0, 0.12, 0.0];
    const D = 0.64;
    const N = this.state.flowerCount;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const rawHeads = [];

    for (let i = 0; i < N; i++) {
      const el = (88 - 60 * Math.sqrt(i / Math.max(1, N - 1))) * (Math.PI / 180);
      const az = i * golden;
      const d = [
        Math.cos(el) * Math.cos(az),
        Math.sin(el),
        Math.cos(el) * Math.sin(az)
      ];
      const dist = D * (0.92 + rnd() * 0.13);
      const pos = this.add(C, d, dist);
      rawHeads.push({ pos, axis: this.norm(d), baseDist: dist, index: i });
    }

    // Disc types
    const DISC_TYPES = [
      { petals: this.PALETTES.WHITE, center: this.PALETTES.GOLD_CENTER, n_pet: 13 },
      { petals: this.PALETTES.PINK, center: this.PALETTES.GOLD_CENTER, n_pet: 8 },
      { petals: this.PALETTES.ROSE_RED, center: this.PALETTES.DARK_CENTER, n_pet: 6 },
      { petals: this.PALETTES.PURPLE, center: this.PALETTES.GOLD_CENTER, n_pet: 7 },
      { petals: this.PALETTES.YELLOW, center: this.PALETTES.DARK_CENTER, n_pet: 12 },
      { petals: this.PALETTES.ORANGE, center: this.PALETTES.DARK_CENTER, n_pet: 9 },
    ];
    const TULIP_COLORS = [this.PALETTES.ROSE_RED, this.PALETTES.PINK, this.PALETTES.YELLOW];

    const rawFlowers = [];
    let disc_i = 0;

    rawHeads.forEach((h, idx) => {
      let isTulip = false;
      let pal = this.PALETTES.PINK;
      let cpal = this.PALETTES.GOLD_CENTER;
      let n_pet = 8;

      if (this.state.flowerType === 'daisy') {
        pal = this.PALETTES.WHITE;
        cpal = this.PALETTES.GOLD_CENTER;
        n_pet = 14;
      } else if (this.state.flowerType === 'rose_red') {
        isTulip = (idx % 2 === 0);
        pal = this.PALETTES.ROSE_RED;
        cpal = this.PALETTES.DARK_CENTER;
        n_pet = 7;
      } else if (this.state.flowerType === 'all_pink') {
        isTulip = (idx % 3 === 0);
        pal = this.PALETTES.PINK;
        cpal = this.PALETTES.GOLD_CENTER;
        n_pet = 9;
      } else if (this.state.flowerType === 'tulip') {
        isTulip = true;
        pal = TULIP_COLORS[idx % TULIP_COLORS.length];
      } else {
        isTulip = (idx === 2 || idx === 6 || idx === 8);
        if (isTulip) {
          pal = TULIP_COLORS[idx % TULIP_COLORS.length];
        } else {
          const dt = DISC_TYPES[disc_i % DISC_TYPES.length];
          disc_i++;
          pal = dt.petals;
          cpal = dt.center;
          n_pet = dt.n_pet;
        }
      }

      const baseRadius = isTulip ? 0.115 : (0.125 + rnd() * 0.02);
      rawFlowers.push({
        basePos: h.pos,
        axis: h.axis,
        kind: isTulip ? "tulip" : "disc",
        pal, cpal, n_pet,
        baseR: baseRadius,
        seed: rnd() * 6.28,
        bloomDelay: (idx / N) * 0.35 // staggered opening
      });
    });

    // Leaves
    const rawLeaves = [];
    for (let i = 0; i < 8; i++) {
      const a = (i + 0.4) / 8 * 2 * Math.PI;
      const c = Math.cos(a), s = Math.sin(a);
      const base = [0.26 * c, 0.30, 0.26 * s];
      const d = this.norm([c, 0.15, s]);
      const side = [-s, 0.0, c];
      const normVec = this.norm(this.cross(side, d));
      const L = 0.30, W = 0.07;
      for (let ti = 0; ti < 28; ti++) {
        const t = ti / 27;
        for (let wi = -4; wi <= 4; wi++) {
          const w = wi / 4;
          const curl = 0.025 * w * w;
          const p = [
            base[0] + d[0] * L * t + side[0] * W * Math.sin(Math.PI * t) * w + normVec[0] * curl,
            base[1] + d[1] * L * t - 0.10 * t * t + normVec[1] * curl,
            base[2] + d[2] * L * t + side[2] * W * Math.sin(Math.PI * t) * w + normVec[2] * curl
          ];
          const rib = wi === 0 ? -0.25 : 0.0;
          rawLeaves.push({
            p, n: normVec, pal: this.PALETTES.GREENS, tone: rib, twoSided: true, override: null
          });
        }
      }
    }

    // Wrap paper
    let paperPalette = this.PALETTES.PAPER_KRAFT;
    if (this.state.wrapColor === 'pink') paperPalette = this.PALETTES.PAPER_PINK;
    if (this.state.wrapColor === 'dark') paperPalette = this.PALETTES.PAPER_DARK;
    if (this.state.wrapColor === 'white') paperPalette = this.PALETTES.PAPER_WHITE;

    const y0 = -0.20, y1 = 0.30, r0 = 0.06, r1 = 0.36;
    const k = (r1 - r0) / (y1 - y0);
    const rings = 45;
    for (let i = 0; i < rings; i++) {
      const t = i / (rings - 1);
      const r = r0 + (r1 - r0) * t;
      const count = Math.max(8, Math.floor(150 * r));
      for (let j = 0; j < count; j++) {
        const ph = (j + rnd()) / count * 2 * Math.PI;
        const c = Math.cos(ph), s = Math.sin(ph);
        let y = y0 + (y1 - y0) * t;
        if (t > 0.9) y += 0.03 * Math.sin(9 * ph);
        const fold = 0.3 * (Math.abs(Math.sin(5 * ph)) - 0.6);
        const nn = this.norm([c, -k, s]);
        pts.push({
          p: [r * c, y, r * s], n: nn, pal: paperPalette, tone: fold, twoSided: false, override: null
        });
      }
    }

    // Stems sticking out the bottom
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * 2 * Math.PI;
      const sx = 0.025 * Math.cos(a), sz = 0.025 * Math.sin(a);
      for (let j = 0; j < 35; j++) {
        const t = j / 34;
        pts.push({
          p: [sx * (1 + 1.2 * t), -0.20 - 0.30 * t, sz * (1 + 1.2 * t)],
          n: [Math.cos(a), 0.0, Math.sin(a)],
          pal: this.PALETTES.GREENS, tone: -0.1, twoSided: true, override: null
        });
      }
    }

    // Ribbon & Knot
    let ribbonPalette = this.PALETTES.RIBBON_RED;
    if (this.state.ribbonColor === 'gold') ribbonPalette = this.PALETTES.RIBBON_GOLD;
    if (this.state.ribbonColor === 'lavender') ribbonPalette = this.PALETTES.RIBBON_LAVENDER;
    if (this.state.ribbonColor === 'rose') ribbonPalette = this.PALETTES.RIBBON_ROSE;

    const by = -0.12;
    const br = r0 + k * (by - y0) + 0.01;
    for (let j = 0; j < 80; j++) {
      const ph = (j / 80) * 2 * Math.PI;
      for (const dy of [-0.012, 0.0, 0.012]) {
        pts.push({
          p: [br * Math.cos(ph), by + dy, br * Math.sin(ph)],
          n: [Math.cos(ph), 0.0, Math.sin(ph)],
          pal: ribbonPalette, tone: 0.0, twoSided: false, override: null
        });
      }
    }

    const knot = [0.0, by, br + 0.01];
    for (const side of [-1, 1]) {
      for (let j = 0; j < 60; j++) {
        const a = (j / 60) * 2 * Math.PI;
        const lx = side * (0.07 + 0.07 * Math.cos(a));
        const ly = 0.04 * Math.sin(a) + 0.02 * (0.07 + 0.07 * Math.cos(a)) / 0.14;
        for (const fill of [1.0, 0.7]) {
          pts.push({
            p: [knot[0] + lx * fill, knot[1] + ly * fill, knot[2] + 0.01],
            n: [side * 0.3, 0.2, 0.93],
            pal: ribbonPalette, tone: 0.1, twoSided: true, override: null
          });
        }
      }
      for (let j = 0; j < 25; j++) {
        const t = j / 24;
        pts.push({
          p: [knot[0] + side * 0.06 * t, knot[1] - 0.15 * t, knot[2] + 0.015],
          n: [side * 0.2, 0.0, 0.98],
          pal: ribbonPalette, tone: -0.05 + 0.05 * Math.sin(t * 9), twoSided: true, override: null
        });
      }
    }
    for (const dx of [-0.01, 0.0, 0.01]) {
      pts.push({
        p: [dx, by, knot[2] + 0.02],
        n: [0, 0, 1],
        pal: ribbonPalette, tone: 0.2, twoSided: true, override: "@"
      });
    }

    // Baby's Breath
    const rawBabies = [];
    if (this.state.hasBabyBreath) {
      for (let i = 0; i < 90; i++) {
        const a = rnd() * 2 * Math.PI;
        const el = 0.3 + rnd() * 1.1;
        const rr = 0.40 + rnd() * 0.18;
        rawBabies.push({
          p: [rr * Math.cos(a) * Math.cos(el), C[1] + rr * Math.sin(el), rr * Math.sin(a) * Math.cos(el)],
          phase: rnd() * 6.28
        });
      }
    }

    // Sparkles
    const rawSparkles = [];
    if (this.state.hasSparkles) {
      for (let i = 0; i < 35; i++) {
        const a = rnd() * 2 * Math.PI;
        const rr = 0.75 + rnd() * 0.25;
        rawSparkles.push({
          p: [rr * Math.cos(a), -0.3 + rnd() * 1.3, rr * Math.sin(a)],
          phase: rnd() * 6.28,
          speed: 1.5 + rnd() * 2.5
        });
      }
    }

    this.scene = {
      basePts: pts,
      leaves: rawLeaves,
      flowers: rawFlowers,
      babies: rawBabies,
      sparkles: rawSparkles,
      neck,
      C
    };
  }

  initInteraction() {
    const startDrag = (x, y) => {
      this.isDragging = true;
      this.lastTouchX = x;
      this.lastTouchY = y;
    };

    const moveDrag = (x, y) => {
      if (!this.isDragging) return;
      const dx = x - this.lastTouchX;
      const dy = y - this.lastTouchY;
      this.lastTouchX = x;
      this.lastTouchY = y;

      this.rotY += dx * 0.015;
      this.rotX = Math.max(-0.4, Math.min(0.4, this.rotX - dy * 0.01));
    };

    const endDrag = () => {
      this.isDragging = false;
    };

    this.canvas.addEventListener('mousedown', e => startDrag(e.clientX, e.clientY));
    window.addEventListener('mousemove', e => moveDrag(e.clientX, e.clientY));
    window.addEventListener('mouseup', endDrag);

    this.canvas.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        startDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchmove', e => {
      if (e.touches.length === 1) {
        moveDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchend', endDrag);
  }

  updateHearts(dt) {
    if (!this.state.hasHearts) return;
    while (this.hearts.length < this.numHearts) {
      this.hearts.push({
        x: Math.random(),
        y: 1.0 + Math.random(),
        speed: 0.03 + Math.random() * 0.06,
        phase: Math.random() * 6.28,
        color: this.PALETTES.HEARTS[Math.floor(Math.random() * this.PALETTES.HEARTS.length)]
      });
    }
    for (const h of this.hearts) {
      h.y -= h.speed * dt;
      if (h.y < 0) {
        h.x = Math.random();
        h.y = 1.0;
        h.color = this.PALETTES.HEARTS[Math.floor(Math.random() * this.PALETTES.HEARTS.length)];
      }
    }
  }

  render(timeNow) {
    const t = (timeNow - this.startTime) / 1000;
    const dt = Math.min(0.1, (timeNow - this.lastTime) / 1000);
    this.lastTime = timeNow;

    // Handle Bloom Animation Step
    if (this.isBlooming) {
      this.bloomProgress += this.bloomSpeed * dt;
      if (this.bloomProgress >= this.targetBloom) {
        this.bloomProgress = this.targetBloom;
        this.isBlooming = false;
        if (this.onBloomComplete) {
          this.onBloomComplete();
          this.onBloomComplete = null;
        }
      }
    }

    if (this.autoSpin && !this.isDragging) {
      this.rotY += this.spinSpeed * dt;
    }

    this.updateHearts(dt);

    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx;

    const charW = Math.max(7, Math.floor(width / 68));
    const charH = Math.floor(charW * 1.55);
    const cols = Math.floor(width / charW);
    const rows = Math.floor(height / charH);

    const chars = new Array(rows);
    const colors = new Array(rows);
    const zbuf = new Array(rows);

    for (let r = 0; r < rows; r++) {
      chars[r] = new Array(cols).fill(" ");
      colors[r] = new Array(cols).fill("#000000");
      zbuf[r] = new Array(cols).fill(-1e9);
    }

    const view_rows = rows - 2;
    const scale = Math.max(1.0, Math.min((view_rows - 2) / 1.45, (cols - 2) / 2.7));
    const sx_scale = scale * 2.0;
    const cx = cols / 2;
    const cy = 1 + 0.78 * scale;

    const ang = this.rotY;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const currentTilt = this.tilt + this.rotX;
    const ct = Math.cos(currentTilt), st = Math.sin(currentTilt);

    const project = (x, y, z) => {
      const xr = x * ca - z * sa;
      const zr = x * sa + z * ca;
      const yp = y - this.pivotY;
      const yt = yp * ct - zr * st;
      const zt = yp * st + zr * ct;
      const f = this.camDist / (this.camDist - zt);
      return [
        Math.floor(cx + xr * f * sx_scale),
        Math.floor(cy - yt * f * scale),
        zt
      ];
    };

    const project_f = (x, y, z) => {
      const xr = x * ca - z * sa;
      const zr = x * sa + z * ca;
      const yp = y - this.pivotY;
      const yt = yp * ct - zr * st;
      const zt = yp * st + zr * ct;
      const f = this.camDist / (this.camDist - zt);
      return [
        cx + xr * f * sx_scale,
        cy - yt * f * scale,
        zt,
        f
      ];
    };

    const plot = (col, row, z, ch, color) => {
      if (row >= 0 && row < view_rows && col >= 0 && col < cols && z > zbuf[row][col]) {
        zbuf[row][col] = z;
        chars[row][col] = ch;
        colors[row][col] = color;
      }
    };

    // Plot Background Hearts (fades in as blooming progresses)
    if (this.state.hasHearts && this.bloomProgress > 0.3) {
      for (const h of this.hearts) {
        const col = Math.floor((h.x + 0.015 * Math.sin(t * 1.2 + h.phase)) * cols) % cols;
        const row = Math.floor(h.y * view_rows);
        plot(col, row, -50, "♥", h.color);
      }
    }

    const { basePts, leaves, flowers, babies, sparkles, neck, C } = this.scene;

    // 1. Plot Base Geometry (wrap, bottom stems, ribbons)
    for (const item of basePts) {
      const [col, row, zt] = project(item.p[0], item.p[1], item.p[2]);
      const nxr = item.n[0] * ca - item.n[2] * sa;
      const nzr = item.n[0] * sa + item.n[2] * ca;
      const nyt = item.n[1] * ct - nzr * st;
      const nzt = item.n[1] * st + nzr * ct;
      let dot = nxr * this.LX + nyt * this.LY + nzt * this.LZ;
      if (item.twoSided && dot < 0) {
        dot = -dot * 0.55;
      }
      let b = 0.25 + 0.75 * Math.max(0.0, dot) + item.tone;
      b = Math.min(0.999, Math.max(0.0, b));
      let ch = item.override || this.SHADE[Math.floor(b * this.SHADE.length)];
      plot(col, row, zt, ch, item.pal[Math.floor(b * item.pal.length)]);
    }

    // 2. Plot Dynamic Stems & Blooming Flower Heads
    for (const fl of flowers) {
      // Per-flower bloom factor with organic staggered delay
      const localProgress = Math.max(0.0, Math.min(1.0, (this.bloomProgress - fl.bloomDelay) / (1.0 - fl.bloomDelay)));
      const easedBloom = this.easeOutBack(localProgress);

      // Stems grow upward as flower buds rise
      const stemLengthFactor = 0.5 + 0.5 * Math.min(1.0, localProgress * 1.3);
      const currPos = [
        neck[0] + (fl.basePos[0] - neck[0]) * stemLengthFactor,
        neck[1] + (fl.basePos[1] - neck[1]) * stemLengthFactor,
        neck[2] + (fl.basePos[2] - neck[2]) * stemLengthFactor
      ];

      // Draw Stem lines
      const base = this.add(currPos, fl.axis, -0.03);
      for (let j = 0; j < 45; j++) {
        const stT = j / 44;
        const p = [
          base[0] + (neck[0] - base[0]) * stT,
          base[1] + (neck[1] - base[1]) * stT,
          base[2] + (neck[2] - base[2]) * stT
        ];
        const [scol, srow, szt] = project(p[0], p[1], p[2]);
        plot(scol, srow, szt, "|", this.PALETTES.GREENS[2]);
      }

      // Flower Radius blooms from tight bud (0.2x) to full (1.0x)
      const currentRadius = fl.baseR * Math.max(0.18, easedBloom);

      const [fx, fy, zt, f] = project_f(currPos[0], currPos[1], currPos[2]);
      const rx = currentRadius * f * sx_scale;
      const ry = currentRadius * f * scale;
      const dim = -0.4 * (1 - Math.min(1.0, Math.max(0.0, (zt + 0.6) / 1.2)));
      const rot = fl.seed + ang * 0.7;

      const rMin = Math.max(0, Math.floor(fy - ry) - 1);
      const rMax = Math.min(view_rows - 1, Math.floor(fy + ry) + 1);

      for (let row = rMin; row <= rMax; row++) {
        const dy = (row + 0.5 - fy) / ry;
        const cMin = Math.max(0, Math.floor(fx - rx) - 1);
        const cMax = Math.min(cols - 1, Math.floor(fx + rx) + 1);

        for (let col = cMin; col <= cMax; col++) {
          const dx = (col + 0.5 - fx) / rx;

          if (fl.kind === "disc") {
            const s = Math.sqrt(dx*dx + dy*dy);
            if (s > 1.0) continue;
            // Center
            if (s < 0.3) {
              let b = 0.55 - 0.35 * dx - 0.35 * dy + dim;
              b = Math.min(0.999, Math.max(0.0, b));
              plot(col, row, zt + 0.06, s < 0.17 ? "@" : "o", fl.cpal[Math.floor(b * fl.cpal.length)]);
              continue;
            }
            // Petals unfold
            const ph = Math.atan2(dy, dx);
            const petalDepth = 0.32 + 0.68 * Math.pow(Math.abs(Math.cos(fl.n_pet * (ph + rot) / 2)), 0.7);
            if (s > petalDepth) continue;
            const edge = s > petalDepth - 0.14 ? -0.22 : 0.0;
            let b = 0.62 - 0.22 * dx - 0.28 * dy + 0.12 * s + edge + dim;
            b = Math.min(0.999, Math.max(0.0, b));
            plot(col, row, zt + 0.04 * (1 - s),
                 this.PETAL_SHADE[Math.floor(b * this.PETAL_SHADE.length)],
                 fl.pal[Math.floor(b * fl.pal.length)]);
          } else {
            // Tulip unfolds
            const v = (1 - dy) / 2;
            if (v < 0 || v > 1) continue;
            const hw = 0.62 * Math.sin(Math.PI * 0.5 * Math.min(1.0, v * 1.5 + 0.05));
            if (hw <= 0 || Math.abs(dx) > hw) continue;
            const xn = dx / hw;
            if (v > 0.72 + 0.28 * Math.pow(Math.cos(1.5 * Math.PI * xn), 2)) continue;
            const seam = (Math.abs(Math.abs(xn) - 0.33) < 0.12 && v > 0.3) ? -0.25 : 0.0;
            let b = 0.55 - 0.3 * xn + 0.1 * v + seam + dim;
            b = Math.min(0.999, Math.max(0.0, b));
            plot(col, row, zt + 0.03,
                 this.PETAL_SHADE[Math.floor(b * this.PETAL_SHADE.length)],
                 fl.pal[Math.floor(b * fl.pal.length)]);
          }
        }
      }
    }

    // 3. Plot Leaves (uncurl with bloom)
    const leafProgress = Math.min(1.0, this.bloomProgress * 1.2);
    for (const lf of leaves) {
      const [col, row, zt] = project(lf.p[0] * leafProgress, lf.p[1], lf.p[2] * leafProgress);
      const nxr = lf.n[0] * ca - lf.n[2] * sa;
      const nzr = lf.n[0] * sa + lf.n[2] * ca;
      const nyt = lf.n[1] * ct - nzr * st;
      const nzt = lf.n[1] * st + nzr * ct;
      let dot = nxr * this.LX + nyt * this.LY + nzt * this.LZ;
      if (dot < 0) dot = -dot * 0.55;
      let b = Math.min(0.999, Math.max(0.0, 0.25 + 0.75 * Math.max(0.0, dot) + lf.tone));
      plot(col, row, zt, this.SHADE[Math.floor(b * this.SHADE.length)], lf.pal[Math.floor(b * lf.pal.length)]);
    }

    // 4. Plot Baby's breath (blooms as fine particles appear)
    if (this.state.hasBabyBreath && this.bloomProgress > 0.4) {
      const bbFactor = (this.bloomProgress - 0.4) / 0.6;
      const visibleCount = Math.floor(babies.length * bbFactor);
      for (let i = 0; i < visibleCount; i++) {
        const bb = babies[i];
        const [col, row, zt] = project(bb.p[0], bb.p[1], bb.p[2]);
        const star = Math.sin(t * 2 + bb.phase) > 0.6;
        plot(col, row, zt + 0.02, star ? "*" : "·", star ? "#ffffff" : "#f1f5f9");
      }
    }

    // 5. Plot Sparkles
    if (this.state.hasSparkles && this.bloomProgress > 0.6) {
      for (const sp of sparkles) {
        const [col, row, zt] = project(sp.p[0], sp.p[1], sp.p[2]);
        const tw = Math.sin(t * sp.speed + sp.phase);
        if (tw > 0.85) {
          plot(col, row, zt, "*", "#ffffff");
        } else if (tw > 0.4) {
          plot(col, row, zt, "+", "#fbcfe8");
        } else if (tw > 0.0) {
          plot(col, row, zt, "·", "#f472b6");
        }
      }
    }

    // 6. Plot Message under bouquet
    if (this.message && this.bloomProgress > 0.8) {
      const mrow = rows - 2;
      const start = Math.max(0, Math.floor((cols - this.message.length) / 2));
      const shift = Math.floor(t * 6);
      for (let i = 0; i < this.message.length; i++) {
        if (start + i < cols) {
          chars[mrow][start + i] = this.message[i];
          colors[mrow][start + i] = this.PALETTES.MSG_COLORS[(i + shift) % this.PALETTES.MSG_COLORS.length];
        }
      }
    }

    // RENDER TO CANVAS
    ctx.fillStyle = "#08080a";
    ctx.fillRect(0, 0, width, height);

    ctx.font = `${charH * 0.9}px 'Courier New', Courier, monospace`;
    ctx.textBaseline = "top";

    for (let r = 0; r < rows; r++) {
      const yPos = r * charH;
      for (let c = 0; c < cols; c++) {
        const ch = chars[r][c];
        if (ch !== " ") {
          ctx.fillStyle = colors[r][c];
          ctx.fillText(ch, c * charW, yPos);
        }
      }
    }
  }

  start() {
    const loop = (now) => {
      this.render(now);
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  updateConfig(newState) {
    this.state = { ...this.state, ...newState };
    this.rebuildScene();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
  }
}
