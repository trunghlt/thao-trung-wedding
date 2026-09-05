/**
 * card-motion.js — Bulletproof visible wave + leaf motion on the invite card.
 * Uses #invite-card as the bitmap source. Center text stays still.
 * prefers-reduced-motion only slightly reduces amplitude (never disables).
 */
(function () {
  "use strict";

  var img = document.getElementById("invite-card");
  var canvas = document.getElementById("card-motion");
  if (!img || !canvas) return;

  var wrap = canvas.parentElement;
  var ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx || !wrap) return;

  var reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  /* Never disable — only soften amplitude a bit when reduce is set */
  var ampScale = reduce ? 0.72 : 1;

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

  /* Simple center text lock rectangle: nx 0.28–0.72, ny 0.18–0.58 */
  function textLocked(nx, ny) {
    return nx >= 0.28 && nx <= 0.72 && ny >= 0.18 && ny <= 0.58;
  }

  /* Lower-right ocean / beach */
  function waterStrength(nx, ny) {
    if (textLocked(nx, ny)) return 0;
    if (nx < 0.42 || ny < 0.48) return 0;
    var right = clamp((nx - 0.42) / 0.28, 0, 1);
    var bottom = clamp((ny - 0.48) / 0.22, 0, 1);
    return right * bottom;
  }

  /* Left / top foliage */
  function foliageStrength(nx, ny) {
    if (textLocked(nx, ny)) return 0;
    var left =
      nx < 0.34 ? clamp(1 - nx / 0.34, 0, 1) * clamp(1 - (ny - 0.05) / 0.9, 0, 1) : 0;
    var topLeft =
      nx < 0.45 && ny < 0.38
        ? clamp(1 - nx / 0.45, 0, 1) * clamp(1 - ny / 0.38, 0, 1)
        : 0;
    var topRight =
      nx > 0.68 && ny < 0.4
        ? clamp((nx - 0.68) / 0.22, 0, 1) * clamp(1 - ny / 0.4, 0, 1)
        : 0;
    var bottomLeft =
      nx < 0.32 && ny > 0.55
        ? clamp(1 - nx / 0.32, 0, 1) * clamp((ny - 0.55) / 0.3, 0, 1)
        : 0;
    return Math.max(left, topLeft, topRight, bottomLeft);
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
    canvas.style.display = "block";
    canvas.style.zIndex = "2";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawFrame(t) {
    var time = t * 0.001;
    var scale = dw / 700;

    ctx.clearRect(0, 0, dw, dh);
    ctx.drawImage(img, 0, 0, iw, ih, 0, 0, dw, dh);

    /* --- Water: OBVIOUS horizontal ripples (amp 12–20px) --- */
    var waterTop = Math.floor(dh * 0.48);
    var leftPx = Math.floor(dw * 0.4);
    var stripH = Math.max(2, Math.round(dw / 700));

    ctx.save();
    ctx.beginPath();
    ctx.rect(leftPx - 6, waterTop, dw - leftPx + 12, dh - waterTop);
    ctx.clip();

    for (var y = waterTop; y < dh; y += stripH) {
      var ny = (y + stripH * 0.5) / dh;
      var wStr = waterStrength(0.75, ny);
      if (wStr < 0.03) continue;

      var amp = (12 + 8 * wStr) * scale * ampScale;
      var wave =
        Math.sin(time * 1.55 + ny * 18.0) * 0.55 +
        Math.sin(time * 2.35 + ny * 32.0) * 0.3 +
        Math.sin(time * 0.95 + ny * 9.0) * 0.2;
      var dx = wave * amp * wStr;

      var srcY = (y / dh) * ih;
      var srcH = Math.max(0.6, (stripH / dh) * ih);
      var srcX = (leftPx / dw) * iw;
      var srcW = iw - srcX;
      var dstW = dw - leftPx;

      ctx.drawImage(
        img,
        srcX,
        srcY,
        srcW,
        srcH,
        leftPx + dx,
        y,
        dstW,
        stripH + 1.5
      );
    }
    ctx.restore();

    /* --- Foliage: sway 8–14px on left / top leaf areas --- */
    var foliageCols = [
      { x0: 0.0, x1: 0.32, y0: 0.0, y1: 0.98 },
      { x0: 0.68, x1: 1.0, y0: 0.0, y1: 0.42 }
    ];
    var colW = Math.max(1, Math.round(2.5 * scale));

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

        var swayAmp = (8 + 6 * fStr) * scale * ampScale;
        var sway =
          Math.sin(time * 0.85 + nx * 7.0 + c * 1.4) * 0.65 +
          Math.sin(time * 0.5 + nx * 12.0) * 0.35;
        var ox = sway * swayAmp * fStr;
        var oy =
          Math.sin(time * 0.6 + nx * 4.5 + c * 0.9) *
          (3 + 3 * fStr) *
          scale *
          ampScale *
          fStr;

        var sx = (x / dw) * iw;
        var sw = (colW / dw) * iw;
        var sy = (yStart / dh) * ih;
        var sh = ((yEnd - yStart) / dh) * ih;

        ctx.drawImage(
          img,
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

  function hideSourceImg() {
    img.classList.add("is-hidden");
    img.style.visibility = "hidden";
    img.style.opacity = "0";
  }

  function activate() {
    iw = img.naturalWidth || 1400;
    ih = img.naturalHeight || 933;
    if (!iw || !ih) return;
    sizeCanvas();
    hideSourceImg();
    canvas.classList.add("is-on");
    canvas.style.display = "block";
    canvas.style.zIndex = "2";
    startLoop();
  }

  function waitLayoutThenActivate() {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        sizeCanvas();
        if (dh < 2) {
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

    function afterDecode() {
      if (img.decode) {
        img.decode().then(go).catch(go);
      } else {
        go();
      }
    }

    if (img.complete && img.naturalWidth) {
      afterDecode();
    } else {
      img.addEventListener(
        "load",
        function () {
          afterDecode();
        },
        { once: true }
      );
      /* Fallback if load already fired between checks */
      if (img.complete && img.naturalWidth) afterDecode();
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
