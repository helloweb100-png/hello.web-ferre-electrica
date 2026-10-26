document.addEventListener('DOMContentLoaded', () => {

    /* ═══════════════════════════════════════════
       1. LOADER
    ═══════════════════════════════════════════ */
    const loader = document.getElementById('loader');
    let pctTick = null;

    const loaderBar = loader.querySelector('.loader-bar');
    if (loaderBar) {
        const pctEl = document.createElement('span');
        pctEl.className = 'loader-pct';
        pctEl.textContent = '0%';
        loaderBar.appendChild(pctEl);
        const pctStart = Date.now();
        pctTick = setInterval(() => {
            const p = Math.min((Date.now() - pctStart) / 1500, 1);
            const eased = 1 - Math.pow(1 - p, 2.4);
            pctEl.textContent = Math.floor(eased * 99) + '%';
            if (p >= 1) { clearInterval(pctTick); pctTick = null; }
        }, 28);
    }

    // Pre-empty typewriter word so it's blank during hero anim
    const twEl = document.querySelector('.hero-red');
    if (twEl) twEl.textContent = '';

    const hideLoader = () => {
        if (pctTick) { clearInterval(pctTick); pctTick = null; }
        if (loaderBar) {
            const pctEl = loaderBar.querySelector('.loader-pct');
            if (pctEl) pctEl.textContent = '100%';
        }
        loader.classList.add('out');
        initTypewriter();
        const onEnd = (e) => {
            if (e.propertyName !== 'opacity') return;
            loader.removeEventListener('transitionend', onEnd);
            loader.remove();
        };
        loader.addEventListener('transitionend', onEnd);
    };

    if (document.readyState === 'complete') {
        setTimeout(hideLoader, 1600);
    } else {
        window.addEventListener('load', () => setTimeout(hideLoader, 1600));
    }

    /* ═══════════════════════════════════════════
       2. NAVBAR SCROLL
    ═══════════════════════════════════════════ */
    const navbar = document.getElementById('navbar');
    let lastScrollY = window.scrollY;
    const onScroll = () => {
        const y = window.scrollY;
        navbar.classList.toggle('scrolled', y > 30);
        if (y > 80) {
            navbar.classList.toggle('shrunk', y > lastScrollY);
        } else {
            navbar.classList.remove('shrunk');
        }
        lastScrollY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    /* ═══════════════════════════════════════════
       3. MOBILE MENU
    ═══════════════════════════════════════════ */
    const burger  = document.getElementById('nav-burger');
    const mobileNav = document.getElementById('nav-mobile');
    const closeBtn = document.getElementById('nav-close');

    const openMenu = () => {
        mobileNav.classList.add('open');
        burger.classList.add('open');
        burger.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
    };
    const closeMenu = () => {
        mobileNav.classList.remove('open');
        burger.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
    };

    burger.addEventListener('click', () => {
        mobileNav.classList.contains('open') ? closeMenu() : openMenu();
    });
    closeBtn.addEventListener('click', closeMenu);
    mobileNav.querySelectorAll('.nm-link').forEach(a => a.addEventListener('click', closeMenu));

    /* ═══════════════════════════════════════════
       4. HERO PARTICLE SYSTEM (canvas only, hero only)
    ═══════════════════════════════════════════ */
    const canvas = document.getElementById('hero-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let particles = [];
        let raf;
        let active = true;

        const resize = () => {
            canvas.width  = canvas.parentElement.offsetWidth;
            canvas.height = canvas.parentElement.offsetHeight;
            initParticles();
        };

        class Particle {
            constructor() { this.reset(true); }
            reset(rand = false) {
                this.x    = Math.random() * canvas.width;
                this.y    = rand ? Math.random() * canvas.height : -6;
                this.r    = Math.random() * 3.0 + 0.7;
                this.vx   = (Math.random() - 0.5) * 0.30;
                this.vy   = Math.random() * 0.24 + 0.07;
                this.base = Math.random() * 0.36 + 0.14;
                this.a    = this.base;
                this.pa   = Math.random() * 0.016 + 0.006;
                this.pd   = Math.random() > 0.5 ? 1 : -1;
                this.red  = Math.random() < 0.25;
                this.glow = this.red && this.r > 1.8;
            }
            update() {
                this.x += this.vx;
                this.y += this.vy;
                this.a += this.pa * this.pd;
                if (this.a > this.base + 0.18 || this.a < 0.02) this.pd *= -1;
                if (this.y > canvas.height + 6 || this.x < -6 || this.x > canvas.width + 6) this.reset();
            }
            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
                ctx.fillStyle = this.red
                    ? `rgba(220,30,30,${this.a * 0.95})`
                    : `rgba(0,0,0,${this.a})`;
                ctx.fill();
                if (this.glow) {
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.r * 3.2, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(220,30,30,${this.a * 0.16})`;
                    ctx.fill();
                }
            }
        }

        const initParticles = () => {
            const isMobile = canvas.width < 768;
            const raw = Math.floor((canvas.width * canvas.height) / (isMobile ? 8000 : 5000));
            const count = Math.min(Math.max(raw, isMobile ? 55 : 110), isMobile ? 90 : 240);
            particles = Array.from({ length: count }, () => new Particle());
        };

        const animate = () => {
            if (!active) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => { p.update(); p.draw(); });
            raf = requestAnimationFrame(animate);
        };

        const heroObserver = new IntersectionObserver(([entry]) => {
            active = entry.isIntersecting;
            if (active) animate();
            else cancelAnimationFrame(raf);
        }, { threshold: 0 });

        heroObserver.observe(canvas.parentElement);

        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(resize, 200);
        });

        resize();
        animate();
    }

    /* ═══════════════════════════════════════════
       5. INTERSECTION OBSERVER — SCROLL REVEAL
    ═══════════════════════════════════════════ */
    // Assign directional animation classes before observing
    (function assignRevealVariants() {
        document.querySelectorAll('.espec-card').forEach((el, i) => {
            el.classList.add(i % 2 === 0 ? 'reveal-left' : 'reveal-right');
        });
        const contactInfo = document.querySelector('.contact-info');
        if (contactInfo) contactInfo.classList.add('reveal-left');
        const contactFormWrap = document.querySelector('.contact-form-wrap');
        if (contactFormWrap) contactFormWrap.classList.add('reveal-right');
        const ctaInner = document.querySelector('.cta-inner');
        if (ctaInner) ctaInner.classList.add('reveal-scale');
        // col-card, ben-card, testi-card, stat-item, process-step
        // use their own CSS keyframe animations — no generic class needed
    })();

    const revealObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                el.classList.add('visible');
                // Add shimmer idle after entry animation finishes
                if (el.matches('.col-card, .ben-card, .testi-card')) {
                    const baseDelay = (parseFloat(getComputedStyle(el).getPropertyValue('--delay')) || 0) * 1000;
                    setTimeout(() => {
                        el.style.setProperty('--float-del', `${(Math.random() * 3).toFixed(2)}s`);
                        el.style.setProperty('--float-dur', `${(2.8 + Math.random() * 1.8).toFixed(2)}s`);
                        el.classList.add('card-floating');
                    }, baseDelay + 900);
                }
                obs.unobserve(el);
            }
        });
    }, { rootMargin: '0px 0px -80px 0px', threshold: 0.08 });

    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

    /* ═══════════════════════════════════════════
       6. COUNTER ANIMATION
    ═══════════════════════════════════════════ */
    const easeOut = t => 1 - Math.pow(1 - t, 3);

    const animateCounter = (el) => {
        const target = parseInt(el.dataset.target, 10);
        const duration = 1800;
        const start = performance.now();

        const tick = (now) => {
            const progress = Math.min((now - start) / duration, 1);
            el.textContent = Math.floor(easeOut(progress) * target).toLocaleString('es-MX');
            if (progress < 1) requestAnimationFrame(tick);
            else el.textContent = target.toLocaleString('es-MX');
        };
        requestAnimationFrame(tick);
    };

    const counterObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.querySelectorAll('.counter').forEach(animateCounter);
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.3 });

    const statsSection = document.getElementById('estadisticas');
    if (statsSection) counterObserver.observe(statsSection);

    /* ═══════════════════════════════════════════
       7. SMOOTH SCROLL for nav links
    ═══════════════════════════════════════════ */
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', e => {
            const id = a.getAttribute('href');
            if (id === '#') return;
            const target = document.querySelector(id);
            if (!target) return;
            e.preventDefault();
            const top = target.getBoundingClientRect().top + window.scrollY - 70;
            window.scrollTo({ top, behavior: 'smooth' });
        });
    });

    /* ═══════════════════════════════════════════
       8. HERO PARALLAX — works on all browsers including iOS
    ═══════════════════════════════════════════ */
    (function() {
        const heroBg = document.querySelector('.hero-bg');
        const heroEl = document.getElementById('hero');
        if (!heroBg || !heroEl) return;
        let ticking = false;
        function onParallax() {
            if (!ticking) {
                requestAnimationFrame(() => {
                    const y = window.scrollY;
                    if (y <= heroEl.offsetHeight + 200) {
                        heroBg.style.transform = 'translateY(' + (y * 0.6) + 'px)';
                    }
                    ticking = false;
                });
                ticking = true;
            }
        }
        window.addEventListener('scroll', onParallax, { passive: true });
    })();

    // initSofa3D(); — removed: hero now uses background image

    /* ═══════════════════════════════════════════
       9. SECTION PARTICLES — white / gray
    ═══════════════════════════════════════════ */
    initSectionParticles();

    /* ═══════════════════════════════════════════
       10. FORM → WHATSAPP
    ═══════════════════════════════════════════ */
    const form = document.getElementById('wa-form');
    if (form) {
        form.addEventListener('submit', e => {
            e.preventDefault();

            const name     = document.getElementById('name')?.value.trim();
            const phone    = document.getElementById('phone')?.value.trim();
            const interest = document.getElementById('interest')?.value;
            const message  = document.getElementById('message')?.value.trim();

            if (!name || !interest) {
                const empty = !name
                    ? document.getElementById('name')
                    : document.getElementById('interest');
                empty.focus();
                empty.style.borderColor = '#DC1E1E';
                setTimeout(() => { empty.style.borderColor = ''; }, 2500);
                return;
            }

            let txt = `Hola Salas Online, soy *${name}*.\n`;
            txt += `\nEstoy interesado/a en: *${interest}*`;
            if (phone)   txt += `\nMi teléfono: ${phone}`;
            if (message) txt += `\n\n${message}`;
            txt += `\n\n¿Podrían brindarme más información y opciones disponibles? 😊`;

            const btn = form.querySelector('.btn-form-submit');
            btn.textContent = 'Redirigiendo…';
            btn.disabled = true;

            setTimeout(() => {
                window.open(`https://wa.me/5212381123528?text=${encodeURIComponent(txt)}`, '_blank');
                form.reset();
                btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg> Enviar por WhatsApp`;
                btn.disabled = false;
            }, 500);
        });
    }

});

/* ═══════════════════════════════════════════
   TYPEWRITER — "Transforman" hero word
═══════════════════════════════════════════ */
function initTypewriter() {
    const el = document.querySelector('.hero-red');
    if (!el) return;
    // All words make grammatical sense: "que [word] tu Hogar"
    const words = ['Transforman', 'Elevan', 'Definen', 'Adornan', 'Inspiran', 'Renuevan'];
    let wi = 0, ci = 0, deleting = false;

    el.textContent = '';
    el.classList.add('typing');

    const tick = () => {
        const word = words[wi];
        if (!deleting) {
            ci++;
            el.textContent = word.slice(0, ci);
            if (ci === word.length) {
                deleting = true;
                setTimeout(tick, 2400);
                return;
            }
            setTimeout(tick, 75 + Math.random() * 45);
        } else {
            ci--;
            el.textContent = word.slice(0, ci);
            if (ci === 0) {
                deleting = false;
                wi = (wi + 1) % words.length;
                setTimeout(tick, 360);
                return;
            }
            setTimeout(tick, 35 + Math.random() * 20);
        }
    };
    tick();
}

/* ═══════════════════════════════════════════
   SOFA 3D — real texture + full-hero mouse
   Transparent bg, continuous fast oscillation
═══════════════════════════════════════════ */
function initSofa3D() {
    if (!window.THREE) return;
    const canvas = document.getElementById('sofa-3d');
    if (!canvas) return;

    const T = THREE;

    /* ── Renderer ── */
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    const getSize = () => {
        const r = canvas.getBoundingClientRect();
        return { w: r.width || 520, h: r.height || 500 };
    };
    const sz = getSize();
    renderer.setSize(sz.w, sz.h);

    /* ── Scene ── */
    const scene = new T.Scene();

    /* ── Camera: wide FOV, centered, far back — sofa large and never clipped ── */
    const camera = new T.PerspectiveCamera(52, sz.w / sz.h, 0.1, 100);
    camera.position.set(1.2, 1.6, 8.8);
    camera.lookAt(0, 0.25, 0);

    /* ── Studio lighting ── */
    scene.add(new T.AmbientLight(0xffffff, 0.85));

    const sun = new T.DirectionalLight(0xffffff, 1.4);
    sun.position.set(4, 8, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.width  = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far  = 20;
    sun.shadow.bias = -0.0008;
    scene.add(sun);

    const fill = new T.DirectionalLight(0xfff5e8, 0.55);
    fill.position.set(-4, 3, -4);
    scene.add(fill);

    scene.add(new T.HemisphereLight(0xffffff, 0xd0c8c0, 0.5));

    /* ── Textura real: TextureLoader funciona en http:// (Live Server / Vercel) ── */
    const loader  = new T.TextureLoader();
    const linenTex = loader.load('img/textura_sofa.jpg', tex => {
        tex.wrapS = tex.wrapT = T.RepeatWrapping;
        tex.repeat.set(6, 6);
        tex.colorSpace = T.SRGBColorSpace;
        tex.needsUpdate = true;
    });
    linenTex.wrapS = linenTex.wrapT = T.RepeatWrapping;
    linenTex.repeat.set(6, 6);
    linenTex.colorSpace = T.SRGBColorSpace;

    /* ── Materials: crema/lino matching textura_sofa.jpg ── */
    const mFab  = new T.MeshStandardMaterial({ map: linenTex, color: 0xD6D1C6, roughness: 0.95, metalness: 0.0 });
    const mLite = new T.MeshStandardMaterial({ map: linenTex, color: 0xEAE5DA, roughness: 0.97, metalness: 0.0 });
    const mMid  = new T.MeshStandardMaterial({ map: linenTex, color: 0xBEBAAF, roughness: 0.93, metalness: 0.0 });
    const mDark = new T.MeshStandardMaterial({ map: linenTex, color: 0x8C887E, roughness: 0.90, metalness: 0.0 });
    const mLeg  = new T.MeshStandardMaterial({ color: 0x1A0E06, roughness: 0.45, metalness: 0.30 });

    /* ── Mesh helper ── */
    const mk = (geo, mat) => {
        const m = new T.Mesh(geo, mat);
        m.castShadow    = true;
        m.receiveShadow = true;
        return m;
    };

    const sofa = new T.Group();

    /* ════════════════════════════════
       BASE / SEAT PLATFORM
    ════════════════════════════════ */
    const seatBase = mk(new T.BoxGeometry(3.7, 0.22, 1.65), mFab);
    seatBase.position.set(0, 0.22, 0);
    sofa.add(seatBase);

    const skirtF = mk(new T.BoxGeometry(3.72, 0.22, 0.07), mDark);
    skirtF.position.set(0, 0.11, 0.86);
    sofa.add(skirtF);

    [-1.835, 1.835].forEach(x => {
        const sk = mk(new T.BoxGeometry(0.07, 0.22, 1.65), mDark);
        sk.position.set(x, 0.11, 0);
        sofa.add(sk);
    });

    /* ════════════════════════════════
       SEAT CUSHIONS (2)
    ════════════════════════════════ */
    const cGeo = new T.BoxGeometry(1.70, 0.20, 1.45);
    [-0.9, 0.9].forEach(x => {
        const c = mk(cGeo, mLite);
        c.position.set(x, 0.43, 0.05);
        sofa.add(c);
    });

    const seam = mk(new T.BoxGeometry(0.025, 0.20, 1.42), mDark);
    seam.position.set(0, 0.43, 0.05);
    sofa.add(seam);

    /* ════════════════════════════════
       BACKREST FRAME
    ════════════════════════════════ */
    const backFrame = mk(new T.BoxGeometry(3.7, 1.05, 0.25), mFab);
    backFrame.position.set(0, 0.90, -0.70);
    sofa.add(backFrame);

    /* ════════════════════════════════
       BACK CUSHIONS (2)
    ════════════════════════════════ */
    const bcGeo = new T.BoxGeometry(1.64, 0.88, 0.22);
    [-0.9, 0.9].forEach(x => {
        const bc = mk(bcGeo, mMid);
        bc.position.set(x, 0.93, -0.60);
        sofa.add(bc);
    });

    /* ════════════════════════════════
       ROLLED ARMRESTS — classic English style
    ════════════════════════════════ */
    const rollGeo = new T.CylinderGeometry(0.22, 0.22, 1.66, 32, 1);
    rollGeo.rotateX(Math.PI / 2);

    const frontCapGeo = new T.SphereGeometry(0.22, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    frontCapGeo.rotateX(Math.PI / 2);

    const backCapGeo = new T.SphereGeometry(0.22, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    backCapGeo.rotateX(-Math.PI / 2);

    const armBodyGeo = new T.BoxGeometry(0.36, 0.72, 1.66);

    [-1.85, 1.85].forEach(x => {
        const body = mk(armBodyGeo, mFab);
        body.position.set(x, 0.48, 0);
        sofa.add(body);

        const roll = mk(rollGeo, mMid);
        roll.position.set(x, 0.88, 0);
        sofa.add(roll);

        const capF = mk(frontCapGeo, mMid);
        capF.position.set(x, 0.88, 0.83);
        sofa.add(capF);

        const capB = mk(backCapGeo, mMid);
        capB.position.set(x, 0.88, -0.83);
        sofa.add(capB);
    });

    /* ════════════════════════════════
       LEGS — round tapered cylinders
    ════════════════════════════════ */
    const legGeo = new T.CylinderGeometry(0.06, 0.04, 0.28, 14);
    [[-1.45, -0.65], [1.45, -0.65], [-1.45, 0.65], [1.45, 0.65]].forEach(([x, z]) => {
        const leg = mk(legGeo, mLeg);
        leg.position.set(x, -0.14, z);
        sofa.add(leg);
    });

    sofa.scale.set(1.62, 1.62, 1.62);
    scene.add(sofa);

    /* ── Shadow plane ── */
    const floorShadow = new T.Mesh(
        new T.PlaneGeometry(14, 14),
        new T.ShadowMaterial({ opacity: 0.08 })
    );
    floorShadow.rotation.x   = -Math.PI / 2;
    floorShadow.position.y   = -0.30;
    floorShadow.receiveShadow = true;
    scene.add(floorShadow);

    /* ── Mouse: listen on window, filter by hero bounds ── */
    const heroEl = document.getElementById('hero');
    const mouse  = { tx: 0, ty: 0, cx: 0, cy: 0 };

    window.addEventListener('mousemove', e => {
        if (!heroEl) return;
        const r  = heroEl.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        if (mx >= 0 && mx <= r.width && my >= 0 && my <= r.height) {
            mouse.tx = (mx / r.width  - 0.5) * 2; // −1 → +1
            mouse.ty = (my / r.height - 0.5) * 2;
        } else {
            mouse.tx = 0;
            mouse.ty = 0;
        }
    }, { passive: true });

    /* ── Animation: fast oscillation always active + mouse nudge ── */
    let t = 0;
    let rafId = null;

    const tick = () => {
        rafId = requestAnimationFrame(tick);
        t += 0.018;

        // Smooth-lerp mouse
        mouse.cx += (mouse.tx - mouse.cx) * 0.09;
        mouse.cy += (mouse.ty - mouse.cy) * 0.09;

        // Base oscillation ±26°, faster side-to-side + stronger mouse response
        sofa.rotation.y = Math.sin(t * 1.10) * 0.46 + mouse.cx * 0.52;
        sofa.rotation.x = mouse.cy * -0.20;
        sofa.position.y = Math.sin(t * 0.62) * 0.055 - 0.28;

        renderer.render(scene, camera);
    };

    /* Pause RAF when hero off-screen */
    const visObs = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) { if (!rafId) tick(); }
        else { cancelAnimationFrame(rafId); rafId = null; }
    }, { threshold: 0 });
    visObs.observe(heroEl || canvas);

    tick();

    /* Responsive resize */
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const { w, h } = getSize();
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        }, 180);
    }, { passive: true });
}

/* ═══════════════════════════════════════════
   SECTION PARTICLES — white / gray sections
   Bouncing dots, very subtle, paused off-screen
═══════════════════════════════════════════ */
function initSectionParticles() {
    document.querySelectorAll('.s-white, .s-gray').forEach(section => {
        const cv = document.createElement('canvas');
        cv.className = 'section-particles';
        section.insertBefore(cv, section.firstChild);
        const ctx = cv.getContext('2d');
        let pts = [], raf = null, active = false;

        const resize = () => {
            cv.width  = section.offsetWidth;
            cv.height = section.offsetHeight;
            const n = Math.min(Math.floor((cv.width * cv.height) / 22000), 50);
            pts = Array.from({ length: Math.max(n, 22) }, () => ({
                x:   Math.random() * cv.width,
                y:   Math.random() * cv.height,
                r:   Math.random() * 2.2 + 0.6,
                vx:  (Math.random() - 0.5) * 0.22,
                vy:  (Math.random() - 0.5) * 0.22,
                a:   Math.random() * 0.22 + 0.10,
                red: Math.random() < 0.22
            }));
        };

        const loop = () => {
            if (!active) return;
            ctx.clearRect(0, 0, cv.width, cv.height);
            pts.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0 || p.x > cv.width)  p.vx *= -1;
                if (p.y < 0 || p.y > cv.height)  p.vy *= -1;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = p.red
                    ? `rgba(220,30,30,${p.a})`
                    : `rgba(0,0,0,${p.a})`;
                ctx.fill();
            });
            raf = requestAnimationFrame(loop);
        };

        new IntersectionObserver(([entry]) => {
            active = entry.isIntersecting;
            if (active) { resize(); loop(); }
            else { cancelAnimationFrame(raf); raf = null; }
        }, { threshold: 0 }).observe(section);
    });
}
