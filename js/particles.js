// Flow-field particle system
// Particles follow smooth vector fields inspired by fluid dynamics
// Parameters exposed on window.simParams for the control panel

const canvas = document.getElementById('particle-canvas');
if (canvas) {
    const ctx = canvas.getContext('2d');
    let particles = [];
    let mouse = { x: null, y: null };
    const PARTICLE_COUNT = 250;
    const MAX_PARTICLES = 500;
    let time = 0;
    let lastFrameTime = performance.now();
    let fps = 60;

    // Exposed simulation parameters (controlled by sliders)
    window.simParams = {
        flowScale: 0.003,
        flowSpeed: 0.0004,
        damping: 0.92,
        turbulenceLayers: 3,
        theme: 'mixed',
        opacity: 0.65,
    };

    // Color themes
    const THEMES = {
        mixed: [
            { r: 124, g: 138, b: 255, weight: 0.35 },
            { r: 160, g: 170, b: 255, weight: 0.2 },
            { r: 100, g: 200, b: 255, weight: 0.15 },
            { r: 255, g: 190, b: 100, weight: 0.15 },
            { r: 120, g: 220, b: 150, weight: 0.1 },
            { r: 255, g: 140, b: 90,  weight: 0.05 },
        ],
        stellar: [
            { r: 124, g: 138, b: 255, weight: 0.4 },
            { r: 160, g: 170, b: 255, weight: 0.25 },
            { r: 100, g: 200, b: 255, weight: 0.2 },
            { r: 200, g: 180, b: 255, weight: 0.15 },
        ],
        climate: [
            { r: 255, g: 190, b: 100, weight: 0.3 },
            { r: 255, g: 140, b: 90,  weight: 0.25 },
            { r: 100, g: 200, b: 255, weight: 0.25 },
            { r: 255, g: 100, b: 80,  weight: 0.2 },
        ],
        vegetation: [
            { r: 120, g: 220, b: 150, weight: 0.35 },
            { r: 80,  g: 190, b: 120, weight: 0.25 },
            { r: 180, g: 230, b: 140, weight: 0.2 },
            { r: 255, g: 210, b: 100, weight: 0.2 },
        ],
    };

    function pickColor() {
        const palette = THEMES[window.simParams.theme] || THEMES.mixed;
        let r = Math.random();
        let cumulative = 0;
        for (const p of palette) {
            cumulative += p.weight;
            if (r <= cumulative) return p;
        }
        return palette[0];
    }

    // Flow field: layered trig functions approximating Fourier modes
    // turbulenceLayers controls how many modes contribute
    // Each mode doubles the spatial frequency and rotates the phase,
    // mimicking a turbulent energy cascade: energy injected at large
    // scales cascades to smaller eddies at higher wavenumbers.
    // Mode amplitudes follow a Kolmogorov-like scaling (k^{-5/3}).
    const MODES = [
        { freqX: 0.8,  freqY: 0.6,  timeScale: 1.0,  amp: 1.0,   phase: 0.0  },  // largest eddies
        { freqX: 1.5,  freqY: 1.2,  timeScale: 0.7,  amp: 0.55,  phase: 1.3  },  // medium eddies
        { freqX: 2.8,  freqY: 3.2,  timeScale: 0.5,  amp: 0.35,  phase: 2.7  },  // smaller eddies
        { freqX: 5.5,  freqY: 4.8,  timeScale: 1.3,  amp: 0.22,  phase: 4.1  },  // fine structure
        { freqX: 9.0,  freqY: 10.5, timeScale: 1.8,  amp: 0.15,  phase: 5.5  },  // turbulent wisps
        { freqX: 16.0, freqY: 14.0, timeScale: 2.5,  amp: 0.10,  phase: 0.8  },  // chaotic micro-eddies
    ];

    function flowAngle(x, y, t) {
        const s = window.simParams.flowScale;
        const layers = window.simParams.turbulenceLayers;

        let val = 0;
        for (let i = 0; i < layers && i < MODES.length; i++) {
            const m = MODES[i];
            val += m.amp * Math.sin(x * s * m.freqX + t * m.timeScale + m.phase)
                        * Math.cos(y * s * m.freqY - t * m.timeScale * 0.6 + m.phase * 0.7);
        }

        return val * Math.PI;
    }

    // Expose flowAngle for the vector field visualizer
    window.simFlowAngle = flowAngle;
    window.simGetTime = () => time;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function createParticle() {
        const color = pickColor();
        return {
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: 0,
            vy: 0,
            r: Math.random() * 2 + 0.8,
            opacity: 0.4 + Math.random() * 0.55,
            color: color,
            life: Math.random() * 600 + 200,
            age: 0,
            maxTrail: Math.floor(Math.random() * 4) + 2,
            trail: [],
        };
    }

    function createParticles() {
        particles = [];
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            particles.push(createParticle());
        }
    }

    function animate() {
        // FPS tracking
        const now = performance.now();
        fps = 0.9 * fps + 0.1 * (1000 / (now - lastFrameTime));
        lastFrameTime = now;
        window._simFps = Math.round(fps);

        ctx.fillStyle = 'rgba(5, 5, 8, 0.15)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        time += window.simParams.flowSpeed;

        // Enforce cap
        while (particles.length > MAX_PARTICLES) {
            particles.shift();
        }

        window._particleCount = particles.length;

        particles.forEach((p) => {
            const angle = flowAngle(p.x, p.y, time);
            const flowStrength = 0.6;

            p.vx += Math.cos(angle) * flowStrength;
            p.vy += Math.sin(angle) * flowStrength;

            // Mouse interaction — strong swirl
            if (mouse.x !== null) {
                const dx = mouse.x - p.x;
                const dy = mouse.y - p.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 300 && dist > 1) {
                    const force = 0.6 / dist;
                    p.vx += -dy * force + dx * force * 0.4;
                    p.vy += dx * force + dy * force * 0.4;
                }
            }

            p.vx *= window.simParams.damping;
            p.vy *= window.simParams.damping;

            p.x += p.vx;
            p.y += p.vy;

            p.trail.push({ x: p.x, y: p.y });
            if (p.trail.length > p.maxTrail) p.trail.shift();

            p.age++;
            let fadeFactor = 1;
            if (p.age < 30) fadeFactor = p.age / 30;
            if (p.age > p.life - 30) fadeFactor = (p.life - p.age) / 30;
            fadeFactor = Math.max(0, Math.min(1, fadeFactor));

            if (p.x < -20 || p.x > canvas.width + 20 ||
                p.y < -20 || p.y > canvas.height + 20 ||
                p.age > p.life) {
                Object.assign(p, createParticle());
                return;
            }

            const { r: cr, g: cg, b: cb } = p.color;
            const alpha = p.opacity * fadeFactor;

            if (p.trail.length > 1) {
                ctx.beginPath();
                ctx.moveTo(p.trail[0].x, p.trail[0].y);
                for (let i = 1; i < p.trail.length; i++) {
                    ctx.lineTo(p.trail[i].x, p.trail[i].y);
                }
                ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${alpha * 0.25})`;
                ctx.lineWidth = p.r * 0.6;
                ctx.stroke();
            }

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${alpha})`;
            ctx.fill();

            if (alpha > 0.5) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${alpha * 0.08})`;
                ctx.fill();
            }
        });

        requestAnimationFrame(animate);
    }

    function spawnBurst(x, y, count) {
        const toSpawn = Math.min(count, MAX_PARTICLES - particles.length);
        for (let i = 0; i < toSpawn; i++) {
            const p = createParticle();
            p.x = x;
            p.y = y;
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.5 + Math.random() * 3;
            p.vx = Math.cos(angle) * speed;
            p.vy = Math.sin(angle) * speed;
            p.opacity = 0.6 + Math.random() * 0.4;
            p.r = 1.2 + Math.random() * 2;
            particles.push(p);
        }
    }

    // Re-color existing particles when theme changes
    window.simRecolor = function() {
        particles.forEach(p => { p.color = pickColor(); });
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });
    window.addEventListener('mouseleave', () => {
        mouse.x = null;
        mouse.y = null;
    });
    window.addEventListener('mousedown', (e) => {
        // Don't spawn particles when interacting with UI elements
        if (window.simPanelOpen) return;
        if (e.target.closest('a, button, input, textarea, select, .navbar, .sim-info-toggle')) return;
        spawnBurst(e.clientX, e.clientY, 15);
    });

    // Touch support for mobile
    window.addEventListener('touchmove', (e) => {
        var touch = e.touches[0];
        mouse.x = touch.clientX;
        mouse.y = touch.clientY;
    }, { passive: true });
    window.addEventListener('touchend', () => {
        mouse.x = null;
        mouse.y = null;
    });
    window.addEventListener('touchstart', (e) => {
        if (window.simPanelOpen) return;
        if (e.target.closest('a, button, input, textarea, select, .navbar, .sim-info-toggle')) return;
        var touch = e.touches[0];
        mouse.x = touch.clientX;
        mouse.y = touch.clientY;
        spawnBurst(touch.clientX, touch.clientY, 15);
    }, { passive: true });

    resize();
    createParticles();
    animate();
}
