/* ═══════════════════════════════════════════════════════════════════════
   FERRE-ELÉCTRICA ACUÑA · app.js
   Dependencias externas (cargadas con defer en index.html):
     · GSAP + ScrollTrigger  → coreografía de scroll (pin, scrub, reveals)
     · Lenis                 → scroll suave y lento
   Si alguna falla, la página sigue siendo 100% funcional (sin animaciones
   de scroll): todo estado inicial oculto vive bajo la clase .gsap-on.
   No se usa ningún listener de "scroll": el scroll se lee dentro de un único
   bucle requestAnimationFrame y las animaciones las manejan ScrollTrigger y
   IntersectionObserver.
   ═══════════════════════════════════════════════════════════════════════ */
(() => {
    'use strict';

    /* ───────────────────────── CONFIGURACIÓN DEL NEGOCIO ─────────────────────────
       EDITAR AQUÍ: es el único lugar que hay que tocar para poner datos reales. */
    const CONFIG = {
        whatsapp: '520000000000',               // Número con lada de país, sin "+" ni espacios
        phoneDisplay: '+52 000 000 0000',       // Cómo se muestra el teléfono en la página
        defaultMessage: 'Hola, quiero cotizar material para mi obra.',
        address: '',                            // Ej. 'Calle Principal 123, Colonia Centro'. Vacío = texto genérico
        hours: '',                              // Ej. 'Lun a Sáb · 8:00 a 19:00'. Vacío = texto genérico
        mapsQuery: 'Ferre-Eléctrica Acuña',     // Texto que busca Google Maps (mejor con la dirección completa)
        social: { instagram: '', facebook: '', tiktok: '' }  // URLs completas; vacías = no se muestran
    };

    /* ───────────────────────── UTILIDADES ───────────────────────── */
    const $ = (s, c = document) => c.querySelector(s);
    const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const rand = (a, b) => a + Math.random() * (b - a);
    const TAU = Math.PI * 2;
    const root = document.documentElement;
    const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;

    const mulberry32 = (a) => () => {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };

    /* Bucle único de animación */
    const Loop = (() => {
        const fns = new Set();
        let last = performance.now();
        const frame = (now) => {
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            fns.forEach((f) => f(dt, now));
            requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
        return { add: (f) => fns.add(f), remove: (f) => fns.delete(f) };
    })();

    /* Divide un texto en palabras. mode 'mask' → .w > .wi (reveal con máscara),
       mode 'plain' → .mw (palabras que se encienden). Conserva elementos hijos. */
    function splitWords(el, mode = 'mask') {
        if (el.dataset.splitDone) return $$(mode === 'mask' ? '.wi' : '.mw', el);
        const walk = (node) => {
            Array.from(node.childNodes).forEach((child) => {
                if (child.nodeType === 3) {
                    const frag = document.createDocumentFragment();
                    child.textContent.split(/(\s+)/).forEach((part) => {
                        if (!part) return;
                        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                        if (mode === 'mask') {
                            const w = document.createElement('span'); w.className = 'w';
                            const i = document.createElement('span'); i.className = 'wi'; i.textContent = part;
                            w.appendChild(i); frag.appendChild(w);
                        } else {
                            const s = document.createElement('span'); s.className = 'mw'; s.textContent = part;
                            frag.appendChild(s);
                        }
                    });
                    node.replaceChild(frag, child);
                } else if (child.nodeType === 1 && child.tagName !== 'BR') {
                    walk(child);
                }
            });
        };
        walk(el);
        el.dataset.splitDone = '1';
        return $$(mode === 'mask' ? '.wi' : '.mw', el);
    }

    /* ───────────────────────── WHATSAPP Y DATOS DEL NEGOCIO ───────────────────────── */
    const waURL = (msg) => `https://wa.me/${CONFIG.whatsapp}` + (msg ? `?text=${encodeURIComponent(msg)}` : '');

    function applyConfig() {
        $$('[data-wa]').forEach((a) => {
            a.href = waURL(a.dataset.waMsg || CONFIG.defaultMessage);
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
        });
        $$('[data-cfg]').forEach((el) => { const v = CONFIG[el.dataset.cfg]; if (v) el.textContent = v; });
        const maps = $('#mapsLink');
        if (maps) maps.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CONFIG.mapsQuery)}`;
        let anySocial = false;
        $$('[data-social]').forEach((a) => {
            const url = CONFIG.social[a.dataset.social];
            if (url) { a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.hidden = false; anySocial = true; }
        });
        const card = $('#socialCard');
        if (card) card.hidden = !anySocial;
        $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
    }

    /* ═══════════════════════════════════════════════════════════════════
       CAMPO DE CIRCUITOS (canvas)
       Pistas tipo PCB con pulsos de energía, brasas, arcos eléctricos y una
       "linterna" que ilumina el circuito bajo el cursor. Se pausa fuera de
       pantalla y baja su calidad solo si detecta FPS bajos.
       ═══════════════════════════════════════════════════════════════════ */
    class CircuitField {
        constructor(canvas, opts = {}) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.o = Object.assign({ cell: 58, density: 1, pulses: 26, embers: 34, arcMin: 1.8, arcMax: 4.2, origin: null, pointerEl: null }, opts);
            this.w = 0; this.h = 0; this.dpr = 1;
            this.traces = []; this.pads = []; this.pulses = []; this.embers = []; this.arcs = []; this.flashes = [];
            this.px = -999; this.py = -999; this.tpx = -999; this.tpy = -999; this.vis = 0; this.tvis = 0;
            this.running = false; this.lowQ = false; this.slow = 0;
            this.nextArc = rand(0.8, 2);
            this.glow = this.makeGlow();
            this.dim = document.createElement('canvas');
            this.bright = document.createElement('canvas');
            this.tmp = document.createElement('canvas');
            this.originCache = null; this.originAt = 0;
            this.resize(true);
            this.bind();
        }

        makeGlow() {
            const c = document.createElement('canvas'); c.width = c.height = 64;
            const g = c.getContext('2d');
            const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
            gr.addColorStop(0, 'rgba(255,245,225,1)');
            gr.addColorStop(0.18, 'rgba(255,170,70,.95)');
            gr.addColorStop(0.5, 'rgba(255,110,10,.28)');
            gr.addColorStop(1, 'rgba(255,90,0,0)');
            g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
            return c;
        }

        origin() {
            if (!this.o.origin) return null;
            const now = performance.now();
            if (!this.originCache || now - this.originAt > 500) { this.originCache = this.o.origin(this.canvas); this.originAt = now; }
            return this.originCache;
        }

        resize(force) {
            const r = this.canvas.getBoundingClientRect();
            const w = Math.max(1, Math.round(r.width));
            const h = Math.max(1, Math.round(r.height));
            if (!force && w === this.w && Math.abs(h - this.h) < 120) return;   // ignora el salto de la barra del navegador móvil
            this.w = w; this.h = h;
            this.dpr = Math.min(window.devicePixelRatio || 1, this.lowQ ? 1 : 1.75);
            this.canvas.width = Math.round(w * this.dpr);
            this.canvas.height = Math.round(h * this.dpr);
            this.build();
            if (!this.running) this.drawFrame(0);
        }

        build() {
            const { w, h, dpr } = this;
            const c = w < 640 ? this.o.cell * 0.78 : this.o.cell;
            const cols = Math.floor(w / c), rows = Math.floor(h / c);
            const ox = (w - cols * c) / 2, oy = (h - rows * c) / 2;
            const rng = mulberry32(1337 + Math.round(w));
            const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
            const count = Math.round(cols * rows / 22 * this.o.density);
            const traces = [];

            for (let i = 0; i < count; i++) {
                let gx = Math.floor(rng() * (cols + 1)), gy = Math.floor(rng() * (rows + 1));
                let d = Math.floor(rng() * 4) * 2;
                const pts = [[gx, gy]];
                const segs = 3 + Math.floor(rng() * 4);
                for (let s = 0; s < segs; s++) {
                    let L = 2 + Math.floor(rng() * 6);
                    let nx = gx + dirs[d][0] * L, ny = gy + dirs[d][1] * L;
                    while (L > 1 && (nx < 0 || ny < 0 || nx > cols || ny > rows)) { L--; nx = gx + dirs[d][0] * L; ny = gy + dirs[d][1] * L; }
                    if (nx < 0 || ny < 0 || nx > cols || ny > rows || L < 1) break;
                    gx = nx; gy = ny; pts.push([gx, gy]);
                    const turn = rng() < 0.82 ? (rng() < 0.5 ? 1 : -1) : (rng() < 0.5 ? 2 : -2);
                    d = (d + turn + 8) % 8;
                }
                if (pts.length < 3) continue;
                const P = pts.map(([x, y]) => [ox + x * c, oy + y * c]);
                const lens = []; let total = 0;
                for (let k = 1; k < P.length; k++) { const l = Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]); lens.push(l); total += l; }
                traces.push({ P, lens, total });
            }
            this.traces = traces;
            this.pads = [];
            traces.forEach((t) => this.pads.push(t.P[0], t.P[t.P.length - 1]));

            // Capas estáticas: tenue (siempre) y brillante (se revela bajo el cursor)
            const paint = (cv, strokeA, padA, dotA) => {
                cv.width = this.canvas.width; cv.height = this.canvas.height;
                const g = cv.getContext('2d');
                g.setTransform(dpr, 0, 0, dpr, 0, 0);
                g.clearRect(0, 0, w, h);
                if (dotA) {
                    g.fillStyle = `rgba(255,255,255,${dotA})`;
                    for (let x = 0; x <= cols; x++) for (let y = 0; y <= rows; y++) g.fillRect(ox + x * c - 0.6, oy + y * c - 0.6, 1.2, 1.2);
                }
                g.lineWidth = 1.3; g.lineJoin = 'round'; g.lineCap = 'round';
                g.strokeStyle = `rgba(255,148,56,${strokeA})`; g.fillStyle = `rgba(255,170,90,${padA})`;
                traces.forEach((t) => {
                    g.beginPath();
                    t.P.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
                    g.stroke();
                    [t.P[0], t.P[t.P.length - 1]].forEach(([x, y]) => {
                        g.beginPath(); g.arc(x, y, 3.2, 0, TAU); g.stroke();
                        g.beginPath(); g.arc(x, y, 1.1, 0, TAU); g.fill();
                    });
                });
            };
            paint(this.dim, 0.13, 0.35, 0.05);
            paint(this.bright, 0.7, 0.95, 0);

            this.pulses = [];
            for (let i = 0; i < this.pulseCount(); i++) { const p = this.newPulse(true); if (p) this.pulses.push(p); }
            this.embers = [];
            for (let i = 0; i < this.emberCount(); i++) this.embers.push(this.newEmber(true));
        }

        pulseCount() { return Math.round(this.o.pulses * (this.w < 640 ? 0.6 : 1) * (this.lowQ ? 0.55 : 1)); }
        emberCount() { return Math.round(this.o.embers * (this.w < 640 ? 0.6 : 1) * (this.lowQ ? 0.5 : 1)); }

        newPulse(initial) {
            const t = this.traces[Math.floor(Math.random() * this.traces.length)];
            if (!t) return null;
            const len = rand(70, 150);
            return { t, len, d: initial ? rand(-len, t.total) : -len, v: rand(130, 260) * (this.w < 640 ? 0.8 : 1) };
        }

        newEmber(initial) {
            const o = this.origin();
            const near = o && Math.random() < 0.6;
            return {
                x: near ? o.x + rand(-o.r, o.r) : rand(0, this.w),
                y: initial ? rand(0, this.h) : (near ? o.y + rand(-o.r * 0.3, o.r * 0.5) : this.h + 10),
                vx: rand(-8, 8), vy: -rand(12, 46), s: rand(0.8, 2.4),
                life: initial ? Math.random() : 0, ttl: rand(3, 7), ph: rand(0, TAU)
            };
        }

        pointAt(t, d) {
            let acc = 0;
            for (let i = 0; i < t.lens.length; i++) {
                if (d <= acc + t.lens[i]) {
                    const f = (d - acc) / t.lens[i];
                    return [lerp(t.P[i][0], t.P[i + 1][0], f), lerp(t.P[i][1], t.P[i + 1][1], f)];
                }
                acc += t.lens[i];
            }
            return t.P[t.P.length - 1];
        }

        strokeRange(ctx, t, a, b) {
            const { P, lens } = t; let acc = 0, started = false;
            ctx.beginPath();
            for (let i = 0; i < lens.length; i++) {
                const s0 = acc, s1 = acc + lens[i]; acc = s1;
                if (s1 < a) continue;
                if (s0 > b) break;
                const A = Math.max(a, s0), B = Math.min(b, s1);
                const ux = (P[i + 1][0] - P[i][0]) / lens[i], uy = (P[i + 1][1] - P[i][1]) / lens[i];
                const x0 = P[i][0] + ux * (A - s0), y0 = P[i][1] + uy * (A - s0);
                const x1 = P[i][0] + ux * (B - s0), y1 = P[i][1] + uy * (B - s0);
                if (!started) { ctx.moveTo(x0, y0); started = true; } else ctx.lineTo(x0, y0);
                ctx.lineTo(x1, y1);
            }
            ctx.stroke();
        }

        bolt(a, b) {
            let pts = [[a.x, a.y], [b.x, b.y]];
            let disp = Math.hypot(b.x - a.x, b.y - a.y) * 0.18;
            for (let i = 0; i < 5; i++) {
                const out = [pts[0]];
                for (let k = 1; k < pts.length; k++) {
                    const [x0, y0] = pts[k - 1], [x1, y1] = pts[k];
                    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1;
                    const off = (Math.random() - 0.5) * disp;
                    out.push([(x0 + x1) / 2 - dy / l * off, (y0 + y1) / 2 + dx / l * off], pts[k]);
                }
                pts = out; disp *= 0.55;
            }
            return pts;
        }

        spawnArc(from, to) {
            let a = from, b = to;
            if (!a || !b) {
                const o = this.origin();
                if (o) {
                    const ang = rand(0, TAU);
                    a = { x: o.x + Math.cos(ang) * o.r * 0.5, y: o.y + Math.sin(ang) * o.r * 0.5 };
                    const cands = this.pads.filter((p) => { const d = Math.hypot(p[0] - o.x, p[1] - o.y); return d > o.r * 0.9 && d < o.r * 2.6; });
                    if (cands.length) { const p = cands[Math.floor(Math.random() * cands.length)]; b = { x: p[0], y: p[1] }; }
                    else b = { x: o.x + Math.cos(ang) * o.r * 1.8, y: o.y + Math.sin(ang) * o.r * 1.8 };
                } else {
                    const p = this.pads[Math.floor(Math.random() * this.pads.length)];
                    if (!p) return;
                    const cands = this.pads.filter((q) => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); return d > 110 && d < 330; });
                    if (!cands.length) return;
                    const q = cands[Math.floor(Math.random() * cands.length)];
                    a = { x: p[0], y: p[1] }; b = { x: q[0], y: q[1] };
                }
            }
            const pts = this.bolt(a, b);
            const br = [];
            for (let i = 0; i < 2; i++) {
                const k = 3 + Math.floor(Math.random() * (pts.length - 6));
                const s = pts[k], ang = Math.atan2(b.y - a.y, b.x - a.x) + rand(-1, 1), len = Math.hypot(b.x - a.x, b.y - a.y) * rand(0.15, 0.3);
                br.push(this.bolt({ x: s[0], y: s[1] }, { x: s[0] + Math.cos(ang) * len, y: s[1] + Math.sin(ang) * len }));
            }
            this.arcs.push({ pts, br, life: 0, ttl: rand(0.2, 0.34), seed: Math.random() * 10 });
            this.flashes.push({ x: b.x, y: b.y, t: 0 });
            this.flashes.push({ x: a.x, y: a.y, t: 0 });
        }

        nearestPoint(x, y, R) {
            const c = [];
            for (const t of this.traces) for (const p of t.P) if (Math.hypot(p[0] - x, p[1] - y) < R) { c.push(t); break; }
            return c.length ? c[Math.floor(Math.random() * c.length)] : null;
        }

        update(dt, now) {
            const k = 1 - Math.pow(0.0005, dt);
            this.px = lerp(this.px, this.tpx, k); this.py = lerp(this.py, this.tpy, k);
            this.vis = lerp(this.vis, this.tvis, 1 - Math.pow(0.01, dt));

            for (let i = 0; i < this.pulses.length; i++) {
                const p = this.pulses[i];
                p.d += p.v * dt;
                if (p.d - p.len > p.t.total) {
                    const e = p.t.P[p.t.P.length - 1];
                    this.flashes.push({ x: e[0], y: e[1], t: 0, small: true });
                    this.pulses[i] = this.newPulse(false) || p;
                }
            }
            // La linterna del cursor genera pulsos extra cerca del puntero
            if (this.tvis > 0.5 && Math.random() < dt * 4 && this.pulses.length < this.pulseCount() + 8) {
                const t = this.nearestPoint(this.px, this.py, 200);
                if (t) this.pulses.push({ t, len: rand(70, 130), d: -20, v: rand(240, 380) });
            }
            if (this.pulses.length > this.pulseCount() + 8) this.pulses.shift();

            for (let i = 0; i < this.embers.length; i++) {
                const e = this.embers[i];
                e.life += dt / e.ttl;
                e.x += (e.vx + Math.sin(now * 0.001 + e.ph) * 10) * dt;
                e.y += e.vy * dt;
                if (e.life > 1 || e.y < -10) this.embers[i] = this.newEmber(false);
            }
            for (let i = this.arcs.length - 1; i >= 0; i--) { this.arcs[i].life += dt; if (this.arcs[i].life > this.arcs[i].ttl) this.arcs.splice(i, 1); }
            for (let i = this.flashes.length - 1; i >= 0; i--) { this.flashes[i].t += dt / 0.55; if (this.flashes[i].t >= 1) this.flashes.splice(i, 1); }

            this.nextArc -= dt;
            if (this.nextArc <= 0) { this.spawnArc(); this.nextArc = rand(this.o.arcMin, this.o.arcMax); }

            // Calidad adaptativa
            if (dt > 0.034) this.slow++; else this.slow = Math.max(0, this.slow - 1);
            if (this.slow > 60 && !this.lowQ) {
                this.lowQ = true;
                this.pulses.length = Math.min(this.pulses.length, this.pulseCount());
                this.embers.length = Math.min(this.embers.length, this.emberCount());
                this.resize(true);
            }
        }

        drawFrame() {
            const { ctx, w, h } = this;
            ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(this.dim, 0, 0, w, h);

            // Linterna: revela la capa brillante alrededor del cursor con borde suave
            if (this.vis > 0.02 && !this.lowQ) {
                const R = w < 640 ? 130 : 190, s = Math.ceil(R * 2 * this.dpr);
                if (this.tmp.width !== s) { this.tmp.width = s; this.tmp.height = s; }
                const t = this.tmp.getContext('2d');
                t.globalCompositeOperation = 'source-over';
                t.clearRect(0, 0, s, s);
                t.drawImage(this.bright, (this.px - R) * this.dpr, (this.py - R) * this.dpr, s, s, 0, 0, s, s);
                t.globalCompositeOperation = 'destination-in';
                const g = t.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
                g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
                t.fillStyle = g; t.fillRect(0, 0, s, s);
                ctx.globalAlpha = this.vis;
                ctx.drawImage(this.tmp, 0, 0, s, s, this.px - R, this.py - R, R * 2, R * 2);
                ctx.globalAlpha = 1;
            }

            ctx.globalCompositeOperation = 'lighter';
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';

            // Pulsos de energía viajando por las pistas
            ctx.strokeStyle = 'rgb(255,150,60)';
            const N = 9;
            for (const p of this.pulses) {
                for (let k = 0; k < N; k++) {
                    const a0 = p.d - p.len * (k + 1) / N, a1 = p.d - p.len * k / N;
                    if (a1 <= 0 || a0 >= p.t.total) continue;
                    const f = 1 - k / N;
                    ctx.globalAlpha = 0.9 * f * f; ctx.lineWidth = 1.2 + 1.8 * f;
                    this.strokeRange(ctx, p.t, Math.max(0, a0), Math.min(p.t.total, a1));
                }
                if (p.d > 0 && p.d < p.t.total) {
                    const [x, y] = this.pointAt(p.t, p.d);
                    ctx.globalAlpha = 1; ctx.drawImage(this.glow, x - 14, y - 14, 28, 28);
                }
            }

            // Brasas
            for (const e of this.embers) {
                const a = Math.sin(clamp(e.life, 0, 1) * Math.PI) * 0.85;
                ctx.globalAlpha = a;
                ctx.drawImage(this.glow, e.x - e.s * 4, e.y - e.s * 4, e.s * 8, e.s * 8);
            }

            // Destellos al final de cada pista
            for (const f of this.flashes) {
                const r = (f.small ? 22 : 46) * (0.6 + f.t * 0.7);
                ctx.globalAlpha = (1 - f.t) * (f.small ? 0.7 : 0.9);
                ctx.drawImage(this.glow, f.x - r, f.y - r, r * 2, r * 2);
            }

            // Arcos eléctricos
            for (const arc of this.arcs) {
                const flick = Math.sin(arc.life * 90 + arc.seed) > -0.3 ? 1 : 0.35;
                const alpha = (1 - arc.life / arc.ttl) * flick;
                [arc.pts, ...arc.br].forEach((pts, i) => {
                    const sc = i ? 0.6 : 1;
                    [[10 * sc, 'rgba(255,100,10,.10)'], [5 * sc, 'rgba(255,140,40,.30)'], [1.8 * sc, 'rgba(255,236,205,.95)']].forEach(([lw, col]) => {
                        ctx.globalAlpha = alpha; ctx.lineWidth = lw; ctx.strokeStyle = col;
                        ctx.beginPath();
                        pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
                        ctx.stroke();
                    });
                });
            }
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
        }

        start() {
            if (this.running || RM) return;
            this.running = true;
            this._fn = (dt, now) => { this.update(dt, now); this.drawFrame(); };
            Loop.add(this._fn);
        }
        stop() {
            if (!this.running) return;
            this.running = false;
            Loop.remove(this._fn);
        }

        bind() {
            this.io = new IntersectionObserver(([e]) => { e.isIntersecting ? this.start() : this.stop(); }, { rootMargin: '120px' });
            this.io.observe(this.canvas);
            let timer;
            this.ro = new ResizeObserver(() => { clearTimeout(timer); timer = setTimeout(() => this.resize(), 150); });
            this.ro.observe(this.canvas);

            const el = this.o.pointerEl;
            if (el && FINE) {
                const rel = (e) => { const r = this.canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
                el.addEventListener('pointermove', (e) => { [this.tpx, this.tpy] = rel(e); this.tvis = 1; }, { passive: true });
                el.addEventListener('pointerleave', () => { this.tvis = 0; });
            }
            if (el) {
                el.addEventListener('pointerdown', (e) => {
                    if (RM || e.target.closest('a, button, input, select, textarea, label')) return;
                    const r = this.canvas.getBoundingClientRect();
                    const x = e.clientX - r.left, y = e.clientY - r.top;
                    const p = this.pads.reduce((best, q) => { const d = Math.hypot(q[0] - x, q[1] - y); return d < best.d ? { d, q } : best; }, { d: Infinity, q: null }).q;
                    if (p) this.spawnArc({ x: p[0], y: p[1] }, { x, y });
                }, { passive: true });
            }
        }
    }

    /* ═══════════════════════════════════════════════════════════════════
       PRELOADER: el símbolo de la marca se "carga" de abajo hacia arriba
       con el progreso real (fuentes + recursos), mínimo ~2.3 s para que
       la animación se vea completa.
       ═══════════════════════════════════════════════════════════════════ */
    function runLoader(onLeave) {
        const loader = $('#loader');
        if (!loader) { root.classList.add('is-ready'); onLeave(); return; }
        const bar = $('#loaderBar'), num = $('#loaderNum'), txt = $('#loaderText'), rect = $('#chargeRect');
        const MIN = RM ? 300 : 2300;
        let target = 30, p = 0, finished = false;
        const t0 = performance.now();
        const mark = (v) => { target = Math.max(target, v); };

        if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => mark(65));
        if (document.readyState === 'complete') mark(100); else window.addEventListener('load', () => mark(100), { once: true });
        setTimeout(() => mark(100), 6000);

        let last = t0;
        const step = (now) => {
            const dt = Math.min(0.05, (now - last) / 1000); last = now;
            const goal = Math.min(target, clamp((now - t0) / MIN, 0, 1) * 100);
            p += (goal - p) * Math.min(1, dt * 6);
            if (goal >= 100 && p > 99.4) p = 100;

            bar.style.transform = `scaleX(${p / 100})`;
            num.textContent = Math.round(p);
            const hgt = p / 100 * 505;
            rect.setAttribute('height', hgt.toFixed(1));
            rect.setAttribute('y', (725 - hgt).toFixed(1));
            txt.textContent = p < 35 ? 'Energizando' : p < 75 ? 'Conectando' : p < 100 ? 'Calibrando' : 'Listo';

            if (p >= 100 && !finished) {
                finished = true;
                loader.classList.add('is-lit');
                setTimeout(() => {
                    loader.classList.add('is-leaving');
                    loader.setAttribute('aria-busy', 'false');
                    root.classList.add('is-ready');
                    onLeave();
                    setTimeout(() => loader.classList.add('is-gone'), 1400);
                }, RM ? 0 : 650);
                return;
            }
            requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    /* ═══════════════════════════════════════════════════════════════════
       NAVEGACIÓN, MENÚ, PROGRESO Y SECCIÓN ACTIVA
       ═══════════════════════════════════════════════════════════════════ */
    function initChrome(lenis) {
        const nav = $('#nav'), burger = $('#burger'), menu = $('#menu');
        const progress = $('#progressBar'), waFloat = $('#waFloat'), stage = $('#heroStage');
        const inertTargets = [$('main'), $('.footer'), $('#rail'), waFloat].filter(Boolean);
        let menuOpen = false, lastFocus = null;

        const setMenu = (open) => {
            menuOpen = open;
            menu.classList.toggle('is-open', open);
            menu.setAttribute('aria-hidden', String(!open));
            burger.setAttribute('aria-expanded', String(open));
            burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
            root.classList.toggle('menu-open', open);
            inertTargets.forEach((el) => { el.inert = open; });
            if (lenis) { open ? lenis.stop() : lenis.start(); } else { root.style.overflow = open ? 'hidden' : ''; }
            if (open) { lastFocus = document.activeElement; setTimeout(() => $('.menu__link', menu).focus(), 350); }
            else if (lastFocus) { burger.focus({ preventScroll: true }); }
        };
        burger.addEventListener('click', () => setMenu(!menuOpen));
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) setMenu(false); });
        matchMedia('(min-width: 1180px)').addEventListener('change', (e) => { if (e.matches && menuOpen) setMenu(false); });

        // Anclas con scroll suave (Lenis) o nativo
        document.addEventListener('click', (e) => {
            const a = e.target.closest('a[href^="#"]');
            if (!a) return;
            const id = a.getAttribute('href');
            if (id.length < 2) return;
            const target = $(id);
            if (!target) return;
            e.preventDefault();
            if (menuOpen) setMenu(false);
            const go = () => {
                if (lenis) lenis.scrollTo(id === '#inicio' ? 0 : target, { duration: 1.9, easing: (t) => 1 - Math.pow(1 - t, 4) });
                else target.scrollIntoView({ behavior: RM ? 'auto' : 'smooth' });
            };
            menuOpen ? setTimeout(go, 120) : go();
        });
        $('#toTop').addEventListener('click', () => {
            if (lenis) lenis.scrollTo(0, { duration: 2.2 }); else window.scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' });
        });

        // Sección activa (navegación y riel) con IntersectionObserver
        const ids = ['inicio', 'marca', 'productos', 'proceso', 'obras', 'porque', 'preguntas', 'contacto'];
        const links = $$('.nav__links a, .rail a');
        const io = new IntersectionObserver((entries) => {
            entries.forEach((en) => {
                if (!en.isIntersecting) return;
                const id = en.target.id;
                links.forEach((l) => l.classList.toggle('is-active', (l.dataset.target || l.getAttribute('href').slice(1)) === id));
            });
        }, { rootMargin: '-45% 0px -54% 0px' });
        ids.forEach((id) => { const s = $('#' + id); if (s) io.observe(s); });

        // Pausa las animaciones CSS infinitas fuera de pantalla
        const pauser = new IntersectionObserver((entries) => {
            entries.forEach((en) => en.target.classList.toggle('is-paused', !en.isIntersecting));
        }, { rootMargin: '80px' });
        ['.hero', '.band', '.contact'].forEach((s) => { const el = $(s); if (el) pauser.observe(el); });

        // Lectura de scroll en el bucle único: progreso, barra de navegación, WhatsApp y marquee
        const band = $('#bandTrack');
        const bandAnim = band && band.getAnimations ? band.getAnimations()[0] : null;
        let lastY = window.scrollY, lastProg = -1, solid = null, hidden = null, floatOn = null, rate = 1;
        Loop.add((dt) => {
            const y = window.scrollY;
            const max = root.scrollHeight - window.innerHeight;
            const prog = max > 0 ? clamp(y / max, 0, 1) : 0;
            if (Math.abs(prog - lastProg) > 0.0004) { progress.style.transform = `scaleX(${prog})`; lastProg = prog; }

            const dy = y - lastY;
            const nowSolid = y > 40;
            if (nowSolid !== solid) { nav.classList.toggle('is-solid', nowSolid); solid = nowSolid; }
            let nowHidden = hidden;
            if (!menuOpen) { if (dy > 6 && y > 240) nowHidden = true; else if (dy < -6 || y < 120) nowHidden = false; }
            if (nowHidden !== hidden) { nav.classList.toggle('is-hidden', !!nowHidden); hidden = nowHidden; }
            const nowFloat = y > window.innerHeight * 0.7;
            if (nowFloat !== floatOn) {
                waFloat.classList.toggle('is-visible', nowFloat); floatOn = nowFloat;
                if (nowFloat && !waFloat.dataset.tipShown) { waFloat.dataset.tipShown = '1'; waFloat.classList.add('show-tip'); setTimeout(() => waFloat.classList.remove('show-tip'), 5200); }
            }
            if (stage && y < window.innerHeight * 1.3) stage.style.setProperty('--py', `${(y * 0.16).toFixed(1)}px`);

            // El marquee acelera con la velocidad del scroll
            if (bandAnim) {
                const vel = Math.abs(dy) / Math.max(dt, 0.001);
                rate = lerp(rate, 1 + clamp(vel / 700, 0, 5), 0.12);
                bandAnim.playbackRate = rate;
            }
            lastY = y;
        });
    }

    /* ═══════════════════════════════════════════════════════════════════
       HERO: titular dividido por palabras, encendido de neón, emblema 3D
       ═══════════════════════════════════════════════════════════════════ */
    function initHero(hasGSAP) {
        const hero = $('#inicio'), emblem = $('#emblem');
        const lines = $$('.hl', hero).map((l) => splitWords(l));

        // Campo de circuitos del hero: los arcos nacen del emblema
        new CircuitField($('#heroCanvas'), {
            cell: 60, density: 1, pulses: 26, embers: 36, arcMin: 1.6, arcMax: 3.8, pointerEl: hero,
            origin: (cv) => {
                const m = $('.emblem__mark', hero).getBoundingClientRect(), c = cv.getBoundingClientRect();
                return { x: m.left + m.width / 2 - c.left, y: m.top + m.height / 2 - c.top, r: Math.max(m.width, m.height) * 0.62 };
            }
        });

        // Inclinación 3D del emblema siguiendo al cursor
        if (FINE && !RM) {
            let tx = 0, ty = 0, cx = 0, cy = 0;
            hero.addEventListener('pointermove', (e) => {
                const r = hero.getBoundingClientRect();
                tx = (e.clientX - r.left) / r.width - 0.5; ty = (e.clientY - r.top) / r.height - 0.5;
            }, { passive: true });
            hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; });
            Loop.add((dt) => {
                const k = 1 - Math.pow(0.002, dt);
                cx = lerp(cx, tx, k); cy = lerp(cy, ty, k);
                emblem.style.setProperty('--ry', `${(cx * 16).toFixed(2)}deg`);
                emblem.style.setProperty('--rx', `${(-cy * 12).toFixed(2)}deg`);
            });
        }

        // Parpadeo ocasional del neón (como un letrero real)
        const neon = $('.hl--2', hero);
        if (!RM) {
            const flicker = () => {
                setTimeout(() => {
                    if (hero.classList.contains('is-lit') && !hero.classList.contains('is-paused')) {
                        neon.classList.add('flick');
                        setTimeout(() => neon.classList.remove('flick'), 750);
                    }
                    flicker();
                }, rand(8000, 14000));
            };
            flicker();
        }

        if (!hasGSAP) { hero.classList.add('is-lit'); return () => {}; }

        // Entrada (queda pausada hasta que el loader abra la cortina)
        const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
        tl.from('.hero__eyebrow', { y: 20, opacity: 0, duration: 1 }, 0.25)
          .from(lines[0], { yPercent: 118, duration: 1.4, stagger: 0.07 }, 0.3)
          .from(lines[1], { yPercent: 118, duration: 1.4, stagger: 0.08 }, 0.55)
          .from('.hero__sub', { y: 24, opacity: 0, duration: 1.1 }, 0.95)
          .from('.hero__ctas > *', { y: 24, opacity: 0, duration: 1, stagger: 0.1, clearProps: 'transform,opacity' }, 1.1)
          .from('#emblem', { scale: 0.8, opacity: 0, duration: 1.9 }, 0.15)
          .add(() => hero.classList.add('is-lit'), 0.95);

        // Al salir del hero el contenido sube más lento y se desvanece
        gsap.to('.hero__inner', {
            yPercent: -14, opacity: 0.0, ease: 'none',
            scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom 20%', scrub: true }
        });
        gsap.to('.hero__canvas', {
            yPercent: 8, ease: 'none',
            scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true }
        });

        return () => tl.play();
    }

    /* ═══════════════════════════════════════════════════════════════════
       ANIMACIONES DE SCROLL (GSAP + ScrollTrigger)
       ═══════════════════════════════════════════════════════════════════ */
    function initScroll() {
        ScrollTrigger.config({ ignoreMobileResize: true });
        const mm = gsap.matchMedia();

        // Titulares: palabras que suben desde una máscara
        $$('[data-split]').filter((el) => !el.closest('.hero')).forEach((el) => {
            const words = splitWords(el);
            gsap.from(words, {
                yPercent: 118, duration: 1.25, ease: 'expo.out', stagger: 0.045,
                scrollTrigger: { trigger: el, start: 'top 88%', once: true }
            });
        });
        // Elementos que entran al hacer scroll
        $$('[data-reveal]').forEach((el) => {
            gsap.from(el, {
                y: 44, opacity: 0, duration: 1.2, ease: 'expo.out',
                scrollTrigger: { trigger: el, start: 'top 90%', once: true }
            });
        });

        /* La marca se abre: el letrero crece hasta ocupar toda la pantalla */
        const sign = (desktop) => {
            const pin = $('.sign__pin');
            const inset0 = desktop ? 'inset(31% 29% 31% 29% round 4px)' : 'inset(34% 12% 34% 12% round 4px)';
            const tl = gsap.timeline({
                defaults: { ease: 'none' },
                scrollTrigger: { trigger: pin, start: 'top top', end: '+=170%', pin: true, scrub: 0.7, anticipatePin: 1 }
            });
            tl.fromTo('.sign__frame', { clipPath: inset0 }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', duration: 1 }, 0)
              .fromTo('.sign__img', { scale: 1.4 }, { scale: 1, duration: 1 }, 0)
              .fromTo('.sign__shade', { opacity: 0.62 }, { opacity: 0, duration: 0.8 }, 0)
              .to('.sign__word--a', desktop ? { xPercent: -135, opacity: 0, duration: 0.85 } : { yPercent: -170, opacity: 0, duration: 0.85 }, 0.05)
              .to('.sign__word--b', desktop ? { xPercent: 135, opacity: 0, duration: 0.85 } : { yPercent: 170, opacity: 0, duration: 0.85 }, 0.05)
              .fromTo(pin, { '--copy': 0 }, { '--copy': 1, duration: 0.3 }, 0.72)
              .fromTo('.sign__copy > *', { y: 50, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.12, duration: 0.32, ease: 'power2.out' }, 0.76)
              .to({}, { duration: 0.18 });
        };
        mm.add('(min-width: 900px)', () => sign(true));
        mm.add('(max-width: 899px)', () => sign(false));

        /* Manifiesto: cada palabra se enciende con el scroll */
        const words = splitWords($('#manifesto'), 'plain');
        gsap.to(words, {
            opacity: 1, ease: 'none', stagger: { each: 0.5 }, duration: 1,
            scrollTrigger: { trigger: '.manifesto', start: 'top 78%', end: 'bottom 62%', scrub: true }
        });

        /* Productos: en escritorio el scroll vertical se convierte en recorrido horizontal */
        mm.add('(min-width: 900px)', () => {
            const pin = $('#prodPin'), track = $('#prodTrack'), bar = $('#prodBar');
            const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
            const pan = gsap.to(track, {
                x: () => -dist(), ease: 'none',
                scrollTrigger: {
                    trigger: pin, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.8,
                    anticipatePin: 1, invalidateOnRefresh: true,
                    onUpdate: (s) => { bar.style.transform = `scaleX(${s.progress})`; }
                }
            });
            $$('.pcard__media').forEach((m) => {
                gsap.fromTo(m, { xPercent: -6 }, {
                    xPercent: 6, ease: 'none',
                    scrollTrigger: { trigger: m.closest('.pcard'), containerAnimation: pan, start: 'left right', end: 'right left', scrub: true }
                });
            });
        });

        /* Cómo trabajamos: las tarjetas se apilan y la anterior se atenúa */
        const steps = $$('.step');
        steps.forEach((step, i) => {
            const next = steps[i + 1];
            if (!next) return;
            gsap.to($('.step__inner', step), {
                scale: 0.94 - i * 0.005, '--dim': 0.62, ease: 'none',
                scrollTrigger: { trigger: next, start: 'top 92%', end: 'top 24%', scrub: true }
            });
        });

        /* Tu obra: entrada escalonada del acordeón */
        gsap.from('.aud__item', {
            y: 70, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.12,
            scrollTrigger: { trigger: '#audList', start: 'top 82%', once: true }
        });

        /* Parallax suave en las fotos del bento */
        $$('.bcell__img').forEach((img) => {
            gsap.fromTo(img, { yPercent: -8, scale: 1.2 }, {
                yPercent: 8, scale: 1.2, ease: 'none',
                scrollTrigger: { trigger: img.closest('.bcell'), start: 'top bottom', end: 'bottom top', scrub: true }
            });
        });

        /* Números: cuentan al entrar y pasan de contorno a relleno */
        $$('[data-count]').forEach((el) => {
            const target = +el.dataset.count, plus = el.dataset.plus === 'true', box = el.closest('.num');
            const fmt = (n) => (plus ? '+' : '') + Math.round(n).toLocaleString('es-MX');
            const o = { v: 0 };
            el.textContent = fmt(0);
            ScrollTrigger.create({
                trigger: box, start: 'top 86%', once: true,
                onEnter: () => gsap.to(o, {
                    v: target, duration: 2.4, ease: 'power3.out',
                    onUpdate: () => { el.textContent = fmt(o.v); },
                    onComplete: () => box.classList.add('is-done')
                })
            });
        });

        /* Footer: la palabra gigante sube al llegar */
        gsap.from('.footer__mega span', {
            yPercent: 40, opacity: 0, duration: 1.6, ease: 'expo.out',
            scrollTrigger: { trigger: '.footer__mega', start: 'top 95%', once: true }
        });
    }

    /* ═══════════════════════════════════════════════════════════════════
       INTERACCIONES: acordeones, spotlight, botones magnéticos, formulario
       ═══════════════════════════════════════════════════════════════════ */
    function initInteractions(hasGSAP) {
        // Tu obra (acordeón de imágenes)
        const items = $$('.aud__item');
        const activate = (item) => {
            items.forEach((it) => {
                const on = it === item;
                it.classList.toggle('is-active', on);
                $('.aud__btn', it).setAttribute('aria-expanded', String(on));
            });
        };
        items.forEach((item) => {
            item.addEventListener('click', () => { if (!item.classList.contains('is-active')) activate(item); });
            if (FINE) item.addEventListener('mouseenter', () => { if (!item.classList.contains('is-active')) activate(item); });
        });

        // FAQ (una pregunta abierta a la vez)
        $$('.faq__q').forEach((btn) => {
            btn.addEventListener('click', () => {
                const item = btn.closest('.faq__item');
                const open = !item.classList.contains('is-open');
                $$('.faq__item').forEach((it) => {
                    it.classList.remove('is-open');
                    $('.faq__q', it).setAttribute('aria-expanded', 'false');
                });
                if (open) { item.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true'); }
                if (hasGSAP) setTimeout(() => ScrollTrigger.refresh(), 650);
            });
        });

        // Spotlight que sigue al cursor
        if (FINE) {
            document.addEventListener('pointermove', (e) => {
                const el = e.target.closest && e.target.closest('[data-spot]');
                if (!el) return;
                const r = el.getBoundingClientRect();
                el.style.setProperty('--mx', `${e.clientX - r.left}px`);
                el.style.setProperty('--my', `${e.clientY - r.top}px`);
            }, { passive: true });
        }

        // Botones magnéticos
        if (hasGSAP && FINE) {
            $$('[data-magnetic]').forEach((btn) => {
                const xTo = gsap.quickTo(btn, 'x', { duration: 0.6, ease: 'power3' });
                const yTo = gsap.quickTo(btn, 'y', { duration: 0.6, ease: 'power3' });
                btn.addEventListener('pointermove', (e) => {
                    const r = btn.getBoundingClientRect();
                    xTo((e.clientX - (r.left + r.width / 2)) * 0.28);
                    yTo((e.clientY - (r.top + r.height / 2)) * 0.4);
                });
                btn.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
                btn.addEventListener('pointerdown', () => gsap.to(btn, { scale: 0.97, duration: 0.15 }));
                ['pointerup', 'pointerleave'].forEach((ev) => btn.addEventListener(ev, () => gsap.to(btn, { scale: 1, duration: 0.4, ease: 'back.out(2)' })));
            });
        }

        // Formulario → WhatsApp
        const form = $('#waForm'), status = $('#formStatus'), submit = $('#formSubmit');
        const name = $('#f-name'), phone = $('#f-phone'), type = $('#f-type'), msg = $('#f-msg');
        const setErr = (input, text) => {
            const field = input.closest('.field');
            field.classList.toggle('has-error', !!text);
            $('.field__err', field).textContent = text || '';
            input.setAttribute('aria-invalid', text ? 'true' : 'false');
            return !text;
        };
        const check = {
            name: () => setErr(name, name.value.trim().length < 2 ? 'Escribe tu nombre para saber con quién hablar.' : ''),
            type: () => setErr(type, !type.value ? 'Elige qué necesitas para orientarte mejor.' : ''),
            phone: () => { const d = phone.value.replace(/\D/g, ''); return setErr(phone, phone.value.trim() && d.length < 8 ? 'Revisa tu teléfono, parece incompleto.' : ''); }
        };
        name.addEventListener('input', () => name.closest('.field').classList.contains('has-error') && check.name());
        phone.addEventListener('input', () => phone.closest('.field').classList.contains('has-error') && check.phone());
        type.addEventListener('change', check.type);

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            status.classList.remove('is-error');
            const results = [check.name(), check.type(), check.phone()];
            if (results.includes(false)) {
                status.textContent = 'Revisa los campos marcados para continuar.';
                status.classList.add('is-error');
                const bad = [name, type, phone].find((i) => i.getAttribute('aria-invalid') === 'true');
                if (bad) bad.focus();
                return;
            }
            const lines = [`Hola, soy ${name.value.trim()}.`, `Me interesa: ${type.value}.`];
            if (msg.value.trim()) lines.push(`Mi obra: ${msg.value.trim()}`);
            if (phone.value.trim()) lines.push(`Mi teléfono: ${phone.value.trim()}`);
            const url = waURL(lines.join('\n'));

            submit.disabled = true;
            $('span', submit).textContent = 'Abriendo WhatsApp...';
            status.textContent = 'Listo. Se abrirá WhatsApp con tu mensaje; solo toca enviar.';
            const w = window.open(url, '_blank');
            if (!w) window.location.href = url; else w.opener = null;
            setTimeout(() => { submit.disabled = false; $('span', submit).textContent = 'Enviar mi solicitud'; }, 2600);
        });
    }

    /* ═══════════════════════════════════════════════════════════════════
       ARRANQUE
       ═══════════════════════════════════════════════════════════════════ */
    function boot() {
        applyConfig();
        const hasGSAP = !RM && !!(window.gsap && window.ScrollTrigger);
        let lenis = null, playIntro = () => {};

        if (hasGSAP) {
            gsap.registerPlugin(ScrollTrigger);
            root.classList.add('gsap-on');
            if (window.Lenis) {
                lenis = new Lenis({
                    duration: 1.25, smoothWheel: true, wheelMultiplier: 0.9, touchMultiplier: 1.4,
                    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t))
                });
                lenis.stop();                                  // bloqueado mientras carga
                lenis.on('scroll', ScrollTrigger.update);
                gsap.ticker.add((t) => lenis.raf(t * 1000));
                gsap.ticker.lagSmoothing(0);
            }
        }

        playIntro = initHero(hasGSAP);
        initChrome(lenis);
        initInteractions(hasGSAP);
        if (hasGSAP) initScroll();

        new CircuitField($('#arcCanvas'), {
            cell: 64, density: 0.7, pulses: 16, embers: 20, arcMin: 2.2, arcMax: 5, pointerEl: $('#contacto')
        });

        runLoader(() => {
            playIntro();
            if (!hasGSAP) $('#inicio').classList.add('is-lit');
            if (lenis) lenis.start();
            if (hasGSAP) {
                ScrollTrigger.refresh();
                window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
                if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
            }
        });
    }

    try {
        boot();
    } catch (err) {
        // Si algo falla, nunca dejamos al visitante atrapado en el loader
        console.error('[Acuña] Error de inicialización:', err);
        root.classList.add('is-ready', 'loader-failsafe');
    }
})();
