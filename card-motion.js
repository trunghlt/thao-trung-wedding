/**
 * card-motion.js — Gentle wave + leaf motion on the original watercolor card.
 * Water: subtle ripple on lower-right ocean/beach only.
 * Leaves: soft sway on left / top foliage corners only.
 * Center text stays still. Respects prefers-reduced-motion.
 */
(function () {
  "use strict";

  var reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  var img = document.getElementById("invite-card");
  var canvas = document.getElementById("card-motion");
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

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }
  function smoothstep(e0, e1, x) {
    var t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  /* 0 = free to move, 1 = locked (text / center panel) */
  function textLock(nx, ny) {
    var textX = 1 - smoothstep(0.2, 0.3, nx) * smoothstep(0.8, 0.7, nx);
    var textY = 1 - smoothstep(0.14, 0.24, ny) * smoothstep(0.76, 0.64, ny);
    return clamp(textX * textY, 0, 1);
  }

  /* Lower-right beach & ocean — expanded a bit, still avoid center text */
  function waterStrength(nx, ny) {
    var right = smoothstep(0.38, 0.55, nx);
    var bottom = smoothstep(0.48, 0.62, ny);
    var avoidOrchid =
      1 - (1 - smoothstep(0.22, 0.4, nx)) * smoothstep(0.72, 0.9, ny);
    var s = right * bottom * avoidOrchid;
    return s * (1 - textLock(nx, ny) * 0.98);
  }

  /* Left / top foliage corners */
  function foliageStrength(nx, ny) {
    var leftCorner =
      (1 - smoothstep(0.0, 0.32, nx)) *
      (1 - smoothstep(0.5, 0.82, ny));
    var topLeft =
      (1 - smoothstep(0.0, 0.4, nx)) * (1 - smoothstep(0.0, 0.42, ny));
    var topRight =
      smoothstep(0.66, 0.84, nx) * (1 - smoothstep(0.0, 0.4, ny));
    var bottomLeft =
      (1 - smoothstep(0.0, 0.3, nx)) * smoothstep(0.52, 0.7, ny);
    var s = Math.max(leftCorner, topLeft, topRight, bottomLeft);
    return s * (1 - textLock(nx, ny) * 0.98);
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

  function drawFrame(t) {
    var time = t * 0.001;
    var scale = dw / 700;

    ctx.clearRect(0, 0, dw, dh);
    ctx.drawImage(source, 0, 0, iw, ih, 0, 0, dw, dh);

    /* --- Water: horizontal ripples (lower-right ocean/beach) --- */
    var waterTop = Math.floor(dh * 0.5);
    var leftPx = Math.floor(dw * 0.4);
    var stripH = Math.max(2, Math.round(dw / 900));

    ctx.save();
    ctx.beginPath();
    ctx.rect(leftPx - 4, waterTop, dw - leftPx + 8, dh - waterTop);
    ctx.clip();

    for (var y = waterTop; y < dh; y += stripH) {
      var ny = (y + stripH * 0.5) / dh;
      var wStr = waterStrength(0.72, ny);
      if (wStr < 0.04) continue;

      /* Clearly visible but natural ~8–16px at typical card width */
      var amp = (8 + 8 * wStr) * scale;
      var wave =
        Math.sin(time * 1.35 + ny * 16.0) * 0.55 +
        Math.sin(time * 2.1 + ny * 28.0) * 0.3 +
        Math.sin(time * 0.85 + ny * 8.0) * 0.2;
      var dx = wave * amp * wStr;

      var srcY = (y / dh) * ih;
      var srcH = Math.max(0.6, (stripH / dh) * ih);
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

    /* --- Foliage: soft column sway + slight vertical bob --- */
    var foliageCols = [
      { x0: 0.0, x1: 0.28, y0: 0.0, y1: 0.95 },
      { x0: 0.7, x1: 1.0, y0: 0.0, y1: 0.42 }
    ];
    var colW = Math.max(1, Math.round(2 * scale));

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
        if (fStr < 0.06) continue;

        /* ~6–12px sway at typical card width + slight vertical bob */
        var swayAmp = (6 + 6 * fStr) * scale;
        var sway =
          Math.sin(time * 0.75 + nx * 6.0 + c * 1.3) * 0.65 +
          Math.sin(time * 0.45 + nx * 11.0) * 0.35;
        var ox = sway * swayAmp * fStr;
        var oy =
          Math.sin(time * 0.55 + nx * 4.0 + c * 0.8) *
          (2.5 + 2.5 * fStr) *
          scale *
          fStr;

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
    /* Hide underlying img so only the animated canvas is visible */
    img.style.visibility = "hidden";
    canvas.classList.add("is-on");
    startLoop();
  }

  /* Wait until image is ready AND layout has non-zero height (2× rAF). */
  function waitLayoutThenActivate() {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        sizeCanvas();
        if (dh < 2) {
          /* Layout not ready yet — try once more next frame */
          requestAnimationFrame(function () {
            activate();
          });
          return;
        }
        activate();
      });
    });
  }

  function onReady() {
    function go() {
      waitLayoutThenActivate();
    }
    if (source.complete && source.naturalWidth) {
      if (source.decode) {
        source.decode().then(go).catch(go);
      } else {
        go();
      }
    } else {
      source.addEventListener(
        "load",
        function () {
          if (source.decode) {
            source.decode().then(go).catch(go);
          } else {
            go();
          }
        },
        { once: true }
      );
    }
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
