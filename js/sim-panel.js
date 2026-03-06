// Simulation info panel — controls, live stats, and flow field visualizer

(function() {
    const panel = document.getElementById('sim-info-panel');
    const overlay = document.getElementById('sim-info-overlay');
    const toggleBtn = document.getElementById('sim-info-toggle');
    const closeBtn = document.getElementById('sim-info-close');
    if (!panel || !toggleBtn) return;

    // Open / close
    window.simPanelOpen = false;

    function openPanel() {
        panel.classList.add('open');
        overlay.classList.add('open');
        window.simPanelOpen = true;
        startFlowViz();
    }

    function closePanel() {
        panel.classList.remove('open');
        overlay.classList.remove('open');
        window.simPanelOpen = false;
    }

    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        openPanel();
    });
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closePanel();
    });
    overlay.addEventListener('click', closePanel);

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && window.simPanelOpen) closePanel();
    });

    // --- Live stats ---
    const countEl = document.getElementById('particle-count');
    const fpsEl = document.getElementById('sim-fps');
    const flowModeEl = document.getElementById('flow-mode-label');

    setInterval(() => {
        if (countEl && window._particleCount !== undefined) {
            countEl.textContent = window._particleCount;
        }
        if (fpsEl && window._simFps !== undefined) {
            fpsEl.textContent = window._simFps;
        }
        if (flowModeEl && window.simParams) {
            const layers = window.simParams.turbulenceLayers;
            const labels = ['', 'Laminar', 'Steady', 'Transitional', 'Turbulent', 'Chaotic', 'Fully Developed'];
            flowModeEl.textContent = labels[layers] || 'Turbulent';
        }
    }, 250);

    // --- Sliders ---
    function bindSlider(id, paramKey, transform) {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', () => {
            window.simParams[paramKey] = transform ? transform(el.value) : parseFloat(el.value);
            drawFlowField();
        });
    }

    bindSlider('ctrl-flow-scale', 'flowScale');
    bindSlider('ctrl-flow-speed', 'flowSpeed');
    bindSlider('ctrl-damping', 'damping', v => 1.79 - parseFloat(v));
    bindSlider('ctrl-turbulence', 'turbulenceLayers', v => parseInt(v));

    // Opacity slider — updates CSS opacity on the canvas element
    const opacitySlider = document.getElementById('ctrl-opacity');
    const particleCanvas = document.getElementById('particle-canvas');
    if (opacitySlider && particleCanvas) {
        opacitySlider.addEventListener('input', () => {
            const val = parseFloat(opacitySlider.value);
            window.simParams.opacity = val;
            particleCanvas.style.opacity = val;
        });
    }

    // --- Theme buttons ---
    document.querySelectorAll('.sim-theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.sim-theme-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            window.simParams.theme = btn.dataset.theme;
            if (window.simRecolor) window.simRecolor();
        });
    });

    // --- Flow field mini-visualizer ---
    const flowCanvas = document.getElementById('flow-field-canvas');
    let flowCtx = null;
    let flowVizRunning = false;

    function drawFlowField() {
        if (!flowCtx || !window.simFlowAngle) return;
        const w = flowCanvas.width;
        const h = flowCanvas.height;
        const t = window.simGetTime ? window.simGetTime() : 0;
        const step = 20;

        flowCtx.fillStyle = '#050508';
        flowCtx.fillRect(0, 0, w, h);

        // Map the mini canvas coordinates to a representative region
        const scaleX = window.innerWidth / w;
        const scaleY = window.innerHeight / h;

        for (let x = step / 2; x < w; x += step) {
            for (let y = step / 2; y < h; y += step) {
                const worldX = x * scaleX;
                const worldY = y * scaleY;
                const angle = window.simFlowAngle(worldX, worldY, t);
                const len = 7;

                const dx = Math.cos(angle) * len;
                const dy = Math.sin(angle) * len;

                // Arrow color based on angle
                const hue = ((angle / Math.PI) * 180 + 360) % 360;
                flowCtx.strokeStyle = `hsla(${hue}, 60%, 65%, 0.7)`;
                flowCtx.lineWidth = 1;

                flowCtx.beginPath();
                flowCtx.moveTo(x - dx * 0.5, y - dy * 0.5);
                flowCtx.lineTo(x + dx * 0.5, y + dy * 0.5);
                flowCtx.stroke();

                // Arrowhead
                const headLen = 3;
                const headAngle = Math.atan2(dy, dx);
                flowCtx.beginPath();
                flowCtx.moveTo(x + dx * 0.5, y + dy * 0.5);
                flowCtx.lineTo(
                    x + dx * 0.5 - headLen * Math.cos(headAngle - 0.5),
                    y + dy * 0.5 - headLen * Math.sin(headAngle - 0.5)
                );
                flowCtx.moveTo(x + dx * 0.5, y + dy * 0.5);
                flowCtx.lineTo(
                    x + dx * 0.5 - headLen * Math.cos(headAngle + 0.5),
                    y + dy * 0.5 - headLen * Math.sin(headAngle + 0.5)
                );
                flowCtx.stroke();
            }
        }
    }

    // --- Power spectrum visualizer ---
    const specCanvas = document.getElementById('power-spectrum-canvas');
    let specCtx = null;

    // Mode frequencies (must match MODES in particles.js)
    const MODE_FREQS = [0.8, 1.5, 2.8, 5.5, 9.0, 16.0];
    const MODE_AMPS  = [1.0, 0.55, 0.35, 0.22, 0.15, 0.10];

    function drawPowerSpectrum() {
        if (!specCtx) return;
        const w = specCanvas.width;
        const h = specCanvas.height;
        const layers = window.simParams.turbulenceLayers;
        const pad = { top: 20, right: 15, bottom: 35, left: 45 };
        const plotW = w - pad.left - pad.right;
        const plotH = h - pad.top - pad.bottom;

        specCtx.fillStyle = '#050508';
        specCtx.fillRect(0, 0, w, h);

        // Log-log axes
        const kMin = 0.5, kMax = 25;
        const pMin = 0.005, pMax = 2.0;
        const logKMin = Math.log10(kMin), logKMax = Math.log10(kMax);
        const logPMin = Math.log10(pMin), logPMax = Math.log10(pMax);

        function toX(k) { return pad.left + (Math.log10(k) - logKMin) / (logKMax - logKMin) * plotW; }
        function toY(p) { return pad.top + plotH - (Math.log10(p) - logPMin) / (logPMax - logPMin) * plotH; }

        // Grid lines
        specCtx.strokeStyle = 'rgba(255,255,255,0.06)';
        specCtx.lineWidth = 0.5;
        [1, 5, 10, 20].forEach(k => {
            const x = toX(k);
            if (x >= pad.left && x <= pad.left + plotW) {
                specCtx.beginPath(); specCtx.moveTo(x, pad.top); specCtx.lineTo(x, pad.top + plotH); specCtx.stroke();
            }
        });
        [0.01, 0.1, 1].forEach(p => {
            const y = toY(p);
            if (y >= pad.top && y <= pad.top + plotH) {
                specCtx.beginPath(); specCtx.moveTo(pad.left, y); specCtx.lineTo(pad.left + plotW, y); specCtx.stroke();
            }
        });

        // Axes
        specCtx.strokeStyle = 'rgba(255,255,255,0.15)';
        specCtx.lineWidth = 1;
        specCtx.beginPath();
        specCtx.moveTo(pad.left, pad.top);
        specCtx.lineTo(pad.left, pad.top + plotH);
        specCtx.lineTo(pad.left + plotW, pad.top + plotH);
        specCtx.stroke();

        // Axis labels
        specCtx.fillStyle = '#8888a0';
        specCtx.font = '10px Inter, sans-serif';
        specCtx.textAlign = 'center';
        specCtx.fillText('Wavenumber k', pad.left + plotW / 2, h - 3);
        [1, 5, 10, 20].forEach(k => {
            const x = toX(k);
            if (x >= pad.left && x <= pad.left + plotW) {
                specCtx.fillText(k, x, pad.top + plotH + 14);
            }
        });
        specCtx.textAlign = 'right';
        [0.01, 0.1, 1].forEach(p => {
            const y = toY(p);
            if (y >= pad.top && y <= pad.top + plotH) {
                specCtx.fillText(p, pad.left - 5, y + 3);
            }
        });
        specCtx.save();
        specCtx.translate(11, pad.top + plotH / 2);
        specCtx.rotate(-Math.PI / 2);
        specCtx.textAlign = 'center';
        specCtx.fillText('E(k)', 0, 0);
        specCtx.restore();

        // Kolmogorov k^{-5/3} reference line
        specCtx.setLineDash([4, 4]);
        specCtx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
        specCtx.lineWidth = 1.5;
        specCtx.beginPath();
        const refAmp = 0.8;
        for (let px = 0; px <= plotW; px += 2) {
            const logK = logKMin + (px / plotW) * (logKMax - logKMin);
            const k = Math.pow(10, logK);
            const p = refAmp * Math.pow(k, -5/3);
            const x = pad.left + px;
            const y = toY(p);
            if (y < pad.top || y > pad.top + plotH) continue;
            if (px === 0) specCtx.moveTo(x, y);
            else specCtx.lineTo(x, y);
        }
        specCtx.stroke();
        specCtx.setLineDash([]);

        // Label the reference line
        specCtx.fillStyle = 'rgba(255, 100, 100, 0.7)';
        specCtx.font = '9px Inter, sans-serif';
        specCtx.textAlign = 'left';
        const labelK = 8;
        const labelP = refAmp * Math.pow(labelK, -5/3);
        const lx = toX(labelK);
        const ly = toY(labelP);
        if (ly > pad.top && ly < pad.top + plotH) {
            specCtx.fillText('k\u207B\u2075\u2033\u00B3', lx + 4, ly - 6);
        }

        // Draw active mode peaks as filled area + dots
        // Build the spectrum curve: sum of Gaussians centered on each mode
        const spectrumPoints = [];
        for (let px = 0; px <= plotW; px += 1) {
            const logK = logKMin + (px / plotW) * (logKMax - logKMin);
            const k = Math.pow(10, logK);
            let power = 0;
            for (let i = 0; i < layers && i < MODE_FREQS.length; i++) {
                const centerK = MODE_FREQS[i];
                const amp = MODE_AMPS[i] * MODE_AMPS[i]; // energy ~ amplitude^2
                const logCenter = Math.log10(centerK);
                const sigma = 0.12;
                power += amp * Math.exp(-Math.pow(logK - logCenter, 2) / (2 * sigma * sigma));
            }
            spectrumPoints.push({ x: pad.left + px, y: toY(Math.max(power, pMin)), power });
        }

        // Filled area
        specCtx.beginPath();
        specCtx.moveTo(spectrumPoints[0].x, pad.top + plotH);
        spectrumPoints.forEach(pt => {
            const y = Math.max(pad.top, Math.min(pad.top + plotH, pt.y));
            specCtx.lineTo(pt.x, y);
        });
        specCtx.lineTo(spectrumPoints[spectrumPoints.length - 1].x, pad.top + plotH);
        specCtx.closePath();
        specCtx.fillStyle = 'rgba(124, 138, 255, 0.12)';
        specCtx.fill();

        // Spectrum line
        specCtx.beginPath();
        spectrumPoints.forEach((pt, i) => {
            const y = Math.max(pad.top, Math.min(pad.top + plotH, pt.y));
            if (i === 0) specCtx.moveTo(pt.x, y);
            else specCtx.lineTo(pt.x, y);
        });
        specCtx.strokeStyle = '#7c8aff';
        specCtx.lineWidth = 2;
        specCtx.stroke();

        // Peak dots for active modes
        for (let i = 0; i < layers && i < MODE_FREQS.length; i++) {
            const k = MODE_FREQS[i];
            const energy = MODE_AMPS[i] * MODE_AMPS[i];
            const x = toX(k);
            const y = toY(energy);
            if (y < pad.top || y > pad.top + plotH) continue;

            // Glow
            specCtx.beginPath();
            specCtx.arc(x, y, 6, 0, Math.PI * 2);
            specCtx.fillStyle = 'rgba(124, 138, 255, 0.2)';
            specCtx.fill();

            // Dot
            specCtx.beginPath();
            specCtx.arc(x, y, 3, 0, Math.PI * 2);
            specCtx.fillStyle = '#7c8aff';
            specCtx.fill();
        }

        // Inactive mode positions (dimmed)
        for (let i = layers; i < MODE_FREQS.length; i++) {
            const k = MODE_FREQS[i];
            const energy = MODE_AMPS[i] * MODE_AMPS[i];
            const x = toX(k);
            const y = toY(energy);
            if (y < pad.top || y > pad.top + plotH) continue;

            specCtx.beginPath();
            specCtx.arc(x, y, 3, 0, Math.PI * 2);
            specCtx.fillStyle = 'rgba(255,255,255,0.1)';
            specCtx.fill();

            // Dashed line down to show where it would contribute
            specCtx.setLineDash([2, 3]);
            specCtx.strokeStyle = 'rgba(255,255,255,0.08)';
            specCtx.lineWidth = 0.5;
            specCtx.beginPath();
            specCtx.moveTo(x, y);
            specCtx.lineTo(x, pad.top + plotH);
            specCtx.stroke();
            specCtx.setLineDash([]);
        }
    }

    // --- Spatial energy density map ---
    const energyCanvas = document.getElementById('energy-map-canvas');
    let energyCtx = null;
    let energyImageData = null;

    // Colormap: dark -> indigo -> blue -> amber -> bright yellow
    // Perceptually motivated, similar to "inferno" / "magma"
    const COLORMAP = [
        [5,   5,   8],     // 0.0  near-black
        [20,  12,  50],    // 0.15 deep purple
        [45,  27,  105],   // 0.3  indigo
        [100, 60,  180],   // 0.45 violet
        [124, 138, 255],    // 0.6  accent green
        [255, 159, 96],    // 0.75 amber
        [255, 230, 130],   // 0.9  warm yellow
        [255, 255, 210],   // 1.0  near-white
    ];

    function sampleColormap(t) {
        t = Math.max(0, Math.min(1, t));
        const idx = t * (COLORMAP.length - 1);
        const lo = Math.floor(idx);
        const hi = Math.min(lo + 1, COLORMAP.length - 1);
        const frac = idx - lo;
        return [
            COLORMAP[lo][0] + (COLORMAP[hi][0] - COLORMAP[lo][0]) * frac,
            COLORMAP[lo][1] + (COLORMAP[hi][1] - COLORMAP[lo][1]) * frac,
            COLORMAP[lo][2] + (COLORMAP[hi][2] - COLORMAP[lo][2]) * frac,
        ];
    }

    function drawEnergyMap() {
        if (!energyCtx || !window.simFlowAngle) return;
        const w = energyCanvas.width;
        const h = energyCanvas.height;
        const t = window.simGetTime ? window.simGetTime() : 0;
        const s = window.simParams.flowScale;
        const layers = window.simParams.turbulenceLayers;

        if (!energyImageData || energyImageData.width !== w || energyImageData.height !== h) {
            energyImageData = energyCtx.createImageData(w, h);
        }

        const data = energyImageData.data;
        const scaleX = window.innerWidth / w;
        const scaleY = window.innerHeight / h;

        // Coarse grid, then bilinear interpolation to fill pixels
        const cellSize = 6;
        const cols = Math.ceil(w / cellSize) + 1;
        const rows = Math.ceil(h / cellSize) + 1;

        // First pass: compute energy on coarse grid
        const grid = new Float32Array(cols * rows);
        let maxEnergy = 0;

        for (let gy = 0; gy < rows; gy++) {
            for (let gx = 0; gx < cols; gx++) {
                const worldX = (gx * cellSize) * scaleX;
                const worldY = (gy * cellSize) * scaleY;

                // Use the raw flow angle value at multiple offsets
                // to compute a smooth velocity divergence measure.
                // Larger eps = smoother result, no lattice artifacts.
                const eps = 30 * scaleX;

                const a0 = window.simFlowAngle(worldX, worldY, t);
                const aR = window.simFlowAngle(worldX + eps, worldY, t);
                const aL = window.simFlowAngle(worldX - eps, worldY, t);
                const aU = window.simFlowAngle(worldX, worldY + eps, t);
                const aD = window.simFlowAngle(worldX, worldY - eps, t);

                // How much the flow direction changes around this point.
                // Large changes = strong vorticity / shear = high energy.
                // Use angle differences (handles wrapping naturally via sin).
                const dxAngle = Math.sin(aR - aL);
                const dyAngle = Math.sin(aU - aD);
                const energy = Math.sqrt(dxAngle * dxAngle + dyAngle * dyAngle);

                grid[gy * cols + gx] = energy;
                if (energy > maxEnergy) maxEnergy = energy;
            }
        }

        if (maxEnergy < 0.001) maxEnergy = 1;

        // Second pass: bilinear interpolation to fill all pixels
        const step = 1;
        const energyVals = new Float32Array(w * h);
        let idx = 0;

        for (let py = 0; py < h; py++) {
            for (let px = 0; px < w; px++) {
                // Position in grid coordinates
                const gxf = px / cellSize;
                const gyf = py / cellSize;
                const gx0 = Math.floor(gxf);
                const gy0 = Math.floor(gyf);
                const gx1 = Math.min(gx0 + 1, cols - 1);
                const gy1 = Math.min(gy0 + 1, rows - 1);
                const fx = gxf - gx0;
                const fy = gyf - gy0;

                // Bilinear interpolation
                const e00 = grid[gy0 * cols + gx0];
                const e10 = grid[gy0 * cols + gx1];
                const e01 = grid[gy1 * cols + gx0];
                const e11 = grid[gy1 * cols + gx1];
                const energy = e00 * (1-fx)*(1-fy) + e10 * fx*(1-fy)
                             + e01 * (1-fx)*fy     + e11 * fx*fy;

                energyVals[idx] = energy;
                idx++;
            }
        }

        // Render pixels
        idx = 0;
        for (let py = 0; py < h; py++) {
            for (let px = 0; px < w; px++) {
                const norm = Math.pow(energyVals[idx] / maxEnergy, 0.65);
                const [r, g, b] = sampleColormap(norm);
                const pixIdx = idx * 4;
                data[pixIdx]     = r;
                data[pixIdx + 1] = g;
                data[pixIdx + 2] = b;
                data[pixIdx + 3] = 255;
                idx++;
            }
        }

        energyCtx.putImageData(energyImageData, 0, 0);
    }

    function animateFlowViz() {
        if (panel.classList.contains('open')) {
            drawFlowField();
            drawPowerSpectrum();
            drawEnergyMap();
        }
        requestAnimationFrame(animateFlowViz);
    }

    function startFlowViz() {
        if (!flowCanvas) return;
        flowCtx = flowCanvas.getContext('2d');
        if (specCanvas) specCtx = specCanvas.getContext('2d');
        if (energyCanvas) energyCtx = energyCanvas.getContext('2d');
        if (!flowVizRunning) {
            flowVizRunning = true;
            animateFlowViz();
        }
    }
})();
