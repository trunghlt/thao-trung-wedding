/**
 * scenery-2d.js — Visible 2D tropical scenery motion on card.jpg
 * Water ripples, foliage sway, sun shimmer. No Three.js.
 * Pauses when document.hidden; respects prefers-reduced-motion.
 */
(function () {
  "use strict";

  var reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  var img = document.getElementById("invite-card");
  var canvas = document.getElementById("scenery-canvas");
  if (!img || !canvas) return;

  var wrap = canvas.parentElement;
  var ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx || !wrap) return;

  var source = new Image();
  source.decoding = "async";
  source.src = img.currentSrc || img.src;

  var raf = 0;
  var start = 0;
  var running = false;
  var iw = 1400;
  var ih = 933;
  var dw = 0;
  var dh = 0;
  var dpr = 1;

  /* Soft petal accents (very subtle) */
  function spawnPetals() {
    var field = document.getElementById("petal-field");
    if (!field || field.childElementCount) return;
    var specs = [
      { x: "3%", y: "10%", dur: "18s", delay: "0s", cls: "" },
      { x: "90%", y: "14%", dur: "20s", delay: "2.5s", cls: "leaf" },
      { x: "8%", y: "70%", dur: "16s", delay: "1.2s", cls: "gold" },
      { x: "85%", y: "78%", dur: "19s", delay: "3.8s", cls: "leaf" },
      { x: "50%", y: "-4%", dur: "15s", delay: "2s", cls: "" }
    ];
    specs.forEach(function (s) {
      var el = document.createElement("span");
      el.className = "petal" + (s.cls ? " " + s.cls : "");
      el.style.setProperty("--x", s.x);
      el.style.setProperty("--y", s.y);
      el.style.setProperty("--dur", s.dur);
      el.style.setProperty("--delay", s.delay);
      field.appendChild(el);
    });
  }

  function sizeCanvas() {
    var rect = wrap.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    dw = Math.max(1, Math.floor(rect.width));
    dh = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(dw * dpr);
    canvas.height = Math.floor(dh * dpr);
    canvas.style.width = dw + "px";
    canvas.style.height = dh + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function easeMask(nx, ny) {
    /* 0 = animate freely, 1 = lock (text / center panel) */
    var textX = 1 - smoothstep(0.18, 0.28, nx) * smoothstep(0.82, 0.72, nx);
    var textY = 1 - smoothstep(0.12, 0.22, ny) * smoothstep(0.78, 0.66, ny);
    var centerLock = textX * textY;
    return clamp(centerLock, 0, 1);
  }

  function waterStrength(nx, ny) {
    /* Lower-right beach & ocean band */
    var right = smoothstep(0.38, 0.55, nx);
    var bottom = smoothstep(0.48, 0.62, ny);
    var avoidOrchid = 1 - (1 - smoothstep(0.22, 0.4, nx)) * smoothstep(0.72, 0.88, ny);
    var s = right * bottom * avoidOrchid;
    return s * (1 - easeMask(nx, ny) * 0.92);
  }

  function foliageStrength(nx, ny) {
    var leftCorner =
      (1 - smoothstep(0.0, 0.32, nx)) *
      (1 - smoothstep(0.55, 0.85, ny));
    var topLeft =
      (1 - smoothstep(0.0, 0.4, nx)) * (1 - smoothstep(0.0, 0.42, ny));
    var topRight =
      smoothstep(0.62, 0.82, nx) * (1 - smoothstep(0.0, 0.4, ny));
    var s = Math.max(leftCorner, topLeft, topRight);
    return s * (1 - easeMask(nx, ny) * 0.95);
  }

  function shimmerStrength(nx, ny) {
    /* Horizon / water highlight band on the right */
    var bandY = 1 - Math.abs(ny - 0.58) / 0.18;
    bandY = clamp(bandY, 0, 1);
    bandY = bandY * bandY;
    var right = smoothstep(0.45, 0.7, nx);
    return bandY * right * (1 - easeMask(nx, ny) * 0.85);
  }

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }
  function smoothstep(e0, e1, x) {
    var t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  /**
   * Draw card with slice-based displacement.
   * Water: horizontal sine offset on scanlines (classic ripple).
   * Foliage: mild horizontal sway, stronger near edges.
   */
  function drawFrame(t) {
    var time = t * 0.001;
    ctx.clearRect(0, 0, dw, dh);

    /* Base: full static card */
    ctx.drawImage(source, 0, 0, iw, ih, 0, 0, dw, dh);

    /* --- Water ripple (redraw horizontal strips with X offset) --- */
    var waterTop = Math.floor(dh * 0.5);
    var leftPx = Math.floor(dw * 0.42);
    var stripH = Math.max(1, Math.round(dw / 900));
    ctx.save();
    ctx.beginPath();
    ctx.rect(leftPx - 8, waterTop, dw - leftPx + 16, dh - waterTop);
    ctx.clip();
    for (var y = waterTop; y < dh; y += stripH) {
      var ny = (y + stripH * 0.5) / dh;
      var wStr = waterStrength(0.78, ny);
      if (wStr < 0.03) continue;

      var amp = (5.5 + 9.0 * wStr) * (dw / 700);
      var wave =
        Math.sin(time * 2.4 + ny * 22.0) * 0.55 +
        Math.sin(time * 3.8 + ny * 37.0) * 0.35 +
        Math.sin(time * 1.5 + ny * 11.0) * 0.28;
      var dx = wave * amp * wStr;

      var srcY = (y / dh) * ih;
      var srcH = Math.max(0.75, (stripH / dh) * ih);
      var srcX = (leftPx / dw) * iw;
      var srcW = iw - srcX;
      var dstW = dw - leftPx;

      ctx.drawImage(
        source,
        srcX,
        srcY,
        srcW,
        srcH,
        leftPx + dx,
        y,
        dstW,
        stripH + 1
      );
    }
    ctx.restore();

    /* --- Foliage sway (vertical columns near left / top corners) --- */
    var foliageCols = [
      { x0: 0.0, x1: 0.28, y0: 0.0, y1: 0.92 },
      { x0: 0.68, x1: 1.0, y0: 0.0, y1: 0.42 }
    ];
    var colW = Math.max(1, Math.round(2 * (dw / 700)));
    for (var c = 0; c < foliageCols.length; c++) {
      var region = foliageCols[c];
      var xStart = Math.floor(region.x0 * dw);
      var xEnd = Math.ceil(region.x1 * dw);
      var yStart = Math.floor(region.y0 * dh);
      var yEnd = Math.ceil(region.y1 * dh);
      for (var x = xStart; x < xEnd; x += colW) {
        var nx = (x + colW * 0.5) / dw;
        var midY = (yStart + yEnd) * 0.5 / dh;
        var fStr = foliageStrength(nx, midY);
        if (fStr < 0.05) continue;

        var swayAmp = (3.2 + 6.5 * fStr) * (dw / 700);
        var sway =
          Math.sin(time * 1.15 + nx * 7.5 + c) * 0.65 +
          Math.sin(time * 0.7 + nx * 14.0) * 0.35;
        var ox = sway * swayAmp * fStr;

        /* Mild vertical stretch feel via tiny Y offset varying by x */
        var oy = Math.sin(time * 0.9 + nx * 5.0) * 0.8 * fStr * (dh / 600);

        var sx = (x / dw) * iw;
        var sw = (colW / dw) * iw;
        var sy = (yStart / dh) * ih;
        var sh = ((yEnd - yStart) / dh) * ih;

        ctx.drawImage(
          source,
          sx,
          sy,
          Math.max(0.5, sw),
          Math.max(0.5, sh),
          x + ox,
          yStart + oy,
          colW + 0.5,
          yEnd - yStart
        );
      }
    }

    /* --- Sun shimmer on horizon / water highlights --- */
    var shimmerPulse =
      0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * 1.8));
    var shimmerX =
      dw * (0.62 + 0.08 * Math.sin(time * 0.55));
    var shimmerY = dh * (0.55 + 0.03 * Math.cos(time * 0.7));
    var g = ctx.createRadialGradient(
      shimmerX,
      shimmerY,
      0,
      shimmerX,
      shimmerY,
      dw * 0.28
    );
    g.addColorStop(0, "rgba(255, 248, 210," + (0.38 * shimmerPulse) + ")");
    g.addColorStop(0.45, "rgba(255, 236, 180," + (0.18 * shimmerPulse) + ")");
    g.addColorStop(1, "rgba(255, 240, 200, 0)");

    ctx.save();
    ctx.globalCompositeOperation = "soft-light";
    /* Soft rectangular mask favoring right mid band */
    ctx.beginPath();
    ctx.rect(dw * 0.42, dh * 0.42, dw * 0.58, dh * 0.4);
    ctx.clip();
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, dw, dh);

    /* Moving highlight streak across water */
    var streakX = ((time * 0.08) % 1.4) - 0.2;
    var lg = ctx.createLinearGradient(
      dw * streakX,
      dh * 0.5,
      dw * (streakX + 0.35),
      dh * 0.72
    );
    lg.addColorStop(0, "rgba(255,255,255,0)");
    lg.addColorStop(0.45, "rgba(255, 250, 230," + (0.32 * shimmerPulse) + ")");
    lg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = lg;
    ctx.fillRect(dw * 0.42, dh * 0.5, dw * 0.58, dh * 0.4);
    ctx.restore();

    /* Extra water sparkle lines — short bright dashes that drift */
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (var i = 0; i < 10; i++) {
      var px = dw * (0.5 + 0.45 * ((i * 0.137 + time * 0.03) % 1));
      var py =
        dh *
        (0.58 +
          0.32 * ((i * 0.271 + Math.sin(time * 0.8 + i) * 0.05) % 1));
      var ns = waterStrength(px / dw, py / dh);
      if (ns < 0.15) continue;
      var len = (8 + (i % 4) * 5) * (dw / 700) * ns;
      var alpha = (0.2 + 0.25 * Math.sin(time * 3 + i * 1.7)) * ns;
      ctx.strokeStyle = "rgba(255, 252, 235," + alpha + ")";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + len, py + Math.sin(time + i) * 1.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  function tick(now) {
    if (!running) return;
    if (!start) start = now;
    drawFrame(now - start);
    raf = requestAnimationFrame(tick);
  }

  function startLoop() {
    if (running) return;
    running = true;
    start = 0;
    raf = requestAnimationFrame(tick);
  }

  function stopLoop() {
    running = false;
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function activate() {
    iw = source.naturalWidth || 1400;
    ih = source.naturalHeight || 933;
    sizeCanvas();
    canvas.classList.add("is-on");
    spawnPetals();
    startLoop();
  }

  function onReady() {
    if (source.complete && source.naturalWidth) activate();
    else source.addEventListener("load", activate, { once: true });
  }

  onReady();

  window.addEventListener("resize", function () {
    if (!canvas.classList.contains("is-on")) return;
    sizeCanvas();
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stopLoop();
    else if (canvas.classList.contains("is-on")) startLoop();
  });
})();
