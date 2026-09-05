/**
 * Three.js tropical beach / Furama-inspired scenery for the wedding invite.
 * Idle camera drift, palm sway, soft waves. Optional light drag-to-look.
 * Not an orbitable invitation card.
 */
import * as THREE from "three";

(function () {
  const sceneEl = document.getElementById("scenery-scene");
  const canvas = document.getElementById("scenery-canvas");
  const fallbackImg = document.getElementById("scenery-fallback");
  if (!sceneEl || !canvas) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hint = document.getElementById("scenery-hint");

  function hasWebGL() {
    try {
      const c = document.createElement("canvas");
      return !!(
        c.getContext("webgl2") ||
        c.getContext("webgl") ||
        c.getContext("experimental-webgl")
      );
    } catch (e) {
      return false;
    }
  }

  if (!hasWebGL()) {
    sceneEl.classList.add("is-fallback");
    if (fallbackImg) fallbackImg.hidden = false;
    canvas.hidden = true;
    if (hint) hint.hidden = true;
    return;
  }

  if (fallbackImg) fallbackImg.hidden = true;
  sceneEl.classList.add("is-webgl");
  if (reduceMotion) {
    sceneEl.classList.add("is-static");
    if (hint) hint.textContent = "";
  } else if (hint) {
    hint.textContent = "Drag gently to look around";
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0xf4c89a, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xf2c9a0, 0.018);

  // —— Sky dome (golden-hour sunset) ——
  const skyGeo = new THREE.SphereGeometry(80, 48, 24);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      zenith: { value: new THREE.Color(0x6a9ec9) },
      horizon: { value: new THREE.Color(0xffd4a8) },
      glow: { value: new THREE.Color(0xff9a5c) },
      sunDir: { value: new THREE.Vector3(0.55, 0.12, -0.82).normalize() },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 zenith;
      uniform vec3 horizon;
      uniform vec3 glow;
      uniform vec3 sunDir;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 col = mix(horizon, zenith, smoothstep(0.15, 0.95, h));
        float sun = pow(max(dot(normalize(vDir), sunDir), 0.0), 28.0);
        float halo = pow(max(dot(normalize(vDir), sunDir), 0.0), 4.0);
        col += glow * (sun * 1.4 + halo * 0.35);
        float low = smoothstep(0.35, -0.05, vDir.y);
        col = mix(col, vec3(1.0, 0.72, 0.48), low * 0.45);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // —— Lighting ——
  scene.add(new THREE.AmbientLight(0xffe8d0, 0.55));

  const sun = new THREE.DirectionalLight(0xffd2a0, 1.35);
  sun.position.set(18, 8, -22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 70;
  sun.shadow.camera.left = -28;
  sun.shadow.camera.right = 28;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -10;
  sun.shadow.bias = -0.0005;
  sun.shadow.radius = 2.5;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xa8c8e0, 0.28);
  fill.position.set(-12, 6, 8);
  scene.add(fill);

  scene.add(new THREE.HemisphereLight(0xffe0b8, 0x7a9a6a, 0.35));

  // —— Ground: sand ——
  const sandGeo = new THREE.PlaneGeometry(90, 50, 40, 24);
  const sandPos = sandGeo.attributes.position;
  for (let i = 0; i < sandPos.count; i++) {
    const x = sandPos.getX(i);
    const y = sandPos.getY(i);
    sandPos.setZ(i, Math.sin(x * 0.15) * 0.08 + Math.cos(y * 0.22) * 0.05);
  }
  sandGeo.computeVertexNormals();
  const sand = new THREE.Mesh(
    sandGeo,
    new THREE.MeshStandardMaterial({
      color: 0xe8d4b0,
      roughness: 0.95,
      metalness: 0.0,
    })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0, 4);
  sand.receiveShadow = true;
  scene.add(sand);

  // —— Water ——
  const waterGeo = new THREE.PlaneGeometry(90, 55, 64, 40);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x3db8b0,
    roughness: 0.22,
    metalness: 0.15,
    transparent: true,
    opacity: 0.92,
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.12, -22);
  water.receiveShadow = true;
  scene.add(water);

  const deep = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 30),
    new THREE.MeshStandardMaterial({
      color: 0x1e7a8c,
      roughness: 0.35,
      metalness: 0.2,
    })
  );
  deep.rotation.x = -Math.PI / 2;
  deep.position.set(0, -0.18, -42);
  scene.add(deep);

  const foamMat = new THREE.MeshBasicMaterial({
    color: 0xf5f0e6,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(90, 3.2), foamMat);
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.02, -5.2);
  scene.add(foam);

  // —— Palm trees ——
  const palms = [];

  function makePalm(scale) {
    scale = scale || 1;
    const g = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x8b6914,
      roughness: 0.9,
    });
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12 * scale, 0.22 * scale, 3.2 * scale, 7),
      trunkMat
    );
    trunk.position.y = 1.6 * scale;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    trunk.rotation.z = (Math.random() - 0.5) * 0.12;
    trunk.rotation.x = (Math.random() - 0.5) * 0.08;
    g.add(trunk);

    const fronds = new THREE.Group();
    fronds.position.y = 3.15 * scale;
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x3d7a45,
      roughness: 0.75,
      side: THREE.DoubleSide,
    });
    const leafDark = new THREE.MeshStandardMaterial({
      color: 0x2a5a32,
      roughness: 0.8,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(0.55 * scale, 2.1 * scale, 4, 1, true),
        i % 2 === 0 ? leafMat : leafDark
      );
      leaf.position.y = 0.15 * scale;
      leaf.rotation.z = Math.PI / 2.35;
      leaf.rotation.y = (i / 7) * Math.PI * 2;
      leaf.castShadow = true;
      fronds.add(leaf);
    }
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(0.28 * scale, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x6b4a1e, roughness: 0.85 })
    );
    fronds.add(crown);
    g.add(fronds);
    g.userData.fronds = fronds;
    g.userData.swayPhase = Math.random() * Math.PI * 2;
    g.userData.swayAmp = 0.03 + Math.random() * 0.04;
    palms.push(g);
    return g;
  }

  function placePalm(x, z, scale) {
    const p = makePalm(scale);
    p.position.set(x, 0, z);
    p.rotation.y = Math.random() * Math.PI * 2;
    scene.add(p);
  }

  placePalm(-7.5, 2.5, 1.15);
  placePalm(-9.2, 0.8, 0.9);
  placePalm(-6.2, -0.5, 1.0);
  placePalm(7.8, 2.2, 1.2);
  placePalm(9.5, 0.5, 0.95);
  placePalm(6.5, -0.8, 1.05);
  placePalm(-11, -4, 0.75);
  placePalm(11.5, -3.5, 0.8);
  placePalm(-4, 5.5, 0.7);
  placePalm(4.5, 5.8, 0.72);

  // —— Resort buildings ——
  function makeBuilding(w, d, h, roofColor, wallColor) {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({
        color: wallColor,
        roughness: 0.85,
        metalness: 0.02,
      })
    );
    wall.position.y = h / 2;
    wall.castShadow = true;
    wall.receiveShadow = true;
    g.add(wall);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(w, d) * 0.72, h * 0.55, 4),
      new THREE.MeshStandardMaterial({
        color: roofColor,
        roughness: 0.7,
        metalness: 0.05,
      })
    );
    roof.position.y = h + h * 0.22;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    g.add(roof);

    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(w * 1.15, 0.08, d * 1.2),
      new THREE.MeshStandardMaterial({ color: 0xf0e6d4, roughness: 0.9 })
    );
    slab.position.y = 0.12;
    slab.receiveShadow = true;
    g.add(slab);

    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.28, h * 0.28),
      new THREE.MeshBasicMaterial({
        color: 0xffe6b8,
        transparent: true,
        opacity: 0.75,
      })
    );
    win.position.set(0, h * 0.45, d / 2 + 0.01);
    g.add(win);

    return g;
  }

  const resort = new THREE.Group();
  const main = makeBuilding(5.5, 3.2, 2.4, 0xb86b3a, 0xf5efe4);
  main.position.set(-2.5, 0, -9);
  resort.add(main);

  const wing = makeBuilding(3.2, 2.6, 1.8, 0xc47a42, 0xf2ebe0);
  wing.position.set(3.2, 0, -10.5);
  wing.rotation.y = -0.25;
  resort.add(wing);

  const villa = makeBuilding(2.4, 2.2, 1.5, 0xa85d32, 0xf8f2e8);
  villa.position.set(7.5, 0, -8);
  villa.rotation.y = 0.4;
  resort.add(villa);

  const villa2 = makeBuilding(2.2, 2.0, 1.4, 0xb86b3a, 0xf5efe4);
  villa2.position.set(-7.2, 0, -8.5);
  villa2.rotation.y = -0.35;
  resort.add(villa2);

  const pool = new THREE.Mesh(
    new THREE.BoxGeometry(4.5, 0.08, 2.2),
    new THREE.MeshStandardMaterial({
      color: 0x4ec4c8,
      roughness: 0.15,
      metalness: 0.25,
      transparent: true,
      opacity: 0.85,
    })
  );
  pool.position.set(0.5, 0.06, -6.2);
  resort.add(pool);

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(6.2, 0.06, 3.6),
    new THREE.MeshStandardMaterial({ color: 0xd4b896, roughness: 0.9 })
  );
  deck.position.set(0.5, 0.02, -6.2);
  deck.receiveShadow = true;
  resort.add(deck);

  const colMat = new THREE.MeshStandardMaterial({ color: 0xf0e8d8, roughness: 0.8 });
  for (const [cx, cz] of [
    [-1.2, -5.2],
    [2.2, -5.2],
    [-1.2, -7.2],
    [2.2, -7.2],
  ]) {
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.14, 1.6, 8),
      colMat
    );
    col.position.set(cx, 0.8, cz);
    col.castShadow = true;
    resort.add(col);
  }
  const pavilionRoof = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 0.1, 2.6),
    new THREE.MeshStandardMaterial({ color: 0xc47a42, roughness: 0.75 })
  );
  pavilionRoof.position.set(0.5, 1.65, -6.2);
  pavilionRoof.castShadow = true;
  resort.add(pavilionRoof);

  scene.add(resort);

  // —— Distant hills ——
  const hillMat = new THREE.MeshStandardMaterial({
    color: 0x6a8a72,
    roughness: 1,
    flatShading: true,
  });
  for (let i = 0; i < 5; i++) {
    const hill = new THREE.Mesh(
      new THREE.ConeGeometry(4 + Math.random() * 3, 2.5 + Math.random() * 2, 5),
      hillMat
    );
    hill.position.set(-20 + i * 10, 0.2, -48 - Math.random() * 6);
    scene.add(hill);
  }

  // —— Sun disc ——
  const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xffe0a0 })
  );
  sunMesh.position.set(22, 4.5, -55);
  scene.add(sunMesh);
  const sunGlow = new THREE.Mesh(
    new THREE.SphereGeometry(2.8, 16, 12),
    new THREE.MeshBasicMaterial({
      color: 0xffb070,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    })
  );
  sunGlow.position.copy(sunMesh.position);
  scene.add(sunGlow);

  // —— Camera ——
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
  const lookTarget = new THREE.Vector3(0.5, 1.2, -8);
  const camBase = new THREE.Vector3(0.2, 2.8, 11.5);
  camera.position.copy(camBase);
  camera.lookAt(lookTarget);

  let lookYaw = 0;
  let lookPitch = 0;
  let targetYaw = 0;
  let targetPitch = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const maxYaw = 0.35;
  const maxPitch = 0.18;

  function onPointerDown(e) {
    dragging = true;
    lastX = e.clientX != null ? e.clientX : 0;
    lastY = e.clientY != null ? e.clientY : 0;
    if (canvas.setPointerCapture && e.pointerId != null) {
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    }
  }
  function onPointerMove(e) {
    if (!dragging) return;
    const x = e.clientX != null ? e.clientX : lastX;
    const y = e.clientY != null ? e.clientY : lastY;
    const dx = (x - lastX) * 0.0022;
    const dy = (y - lastY) * 0.002;
    lastX = x;
    lastY = y;
    targetYaw = THREE.MathUtils.clamp(targetYaw - dx, -maxYaw, maxYaw);
    targetPitch = THREE.MathUtils.clamp(targetPitch - dy, -maxPitch, maxPitch);
  }
  function onPointerUp(e) {
    dragging = false;
    if (canvas.releasePointerCapture && e.pointerId != null) {
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    }
  }

  if (!reduceMotion) {
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerUp);
  }

  let disposed = false;
  let animId = 0;
  let lastTs = performance.now();

  function sizeCanvas() {
    const rect = sceneEl.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(220, Math.min(Math.round(w * 0.58), 440));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  sizeCanvas();
  window.addEventListener("resize", sizeCanvas);
  sceneEl.classList.add("is-ready");

  function tick(now) {
    if (disposed) return;
    animId = requestAnimationFrame(tick);
    const t = now / 1000;
    const dt = Math.min(0.05, (now - lastTs) / 1000);
    lastTs = now;

    if (!reduceMotion) {
      const pos = water.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z =
          Math.sin(x * 0.35 + t * 1.1) * 0.08 +
          Math.cos(y * 0.28 + t * 0.85) * 0.06 +
          Math.sin((x + y) * 0.15 + t * 0.5) * 0.04;
        pos.setZ(i, z);
      }
      pos.needsUpdate = true;
      water.geometry.computeVertexNormals();

      foamMat.opacity = 0.35 + Math.sin(t * 0.9) * 0.1;

      for (const p of palms) {
        const fr = p.userData.fronds;
        if (!fr) continue;
        const phase = p.userData.swayPhase;
        const amp = p.userData.swayAmp;
        fr.rotation.z = Math.sin(t * 0.85 + phase) * amp;
        fr.rotation.x = Math.cos(t * 0.65 + phase) * amp * 0.6;
      }

      const driftX = Math.sin(t * 0.18) * 0.45;
      const driftY = Math.sin(t * 0.14) * 0.12;
      const driftZ = Math.cos(t * 0.16) * 0.25;
      camera.position.set(
        camBase.x + driftX,
        camBase.y + driftY,
        camBase.z + driftZ
      );

      lookYaw += (targetYaw - lookYaw) * Math.min(1, dt * 6);
      lookPitch += (targetPitch - lookPitch) * Math.min(1, dt * 6);

      if (!dragging) {
        targetYaw *= 0.985;
        targetPitch *= 0.985;
      }

      const target = lookTarget.clone();
      target.x += lookYaw * 4;
      target.y += lookPitch * 3;
      camera.lookAt(target);
    } else {
      camera.position.copy(camBase);
      camera.lookAt(lookTarget);
    }

    renderer.render(scene, camera);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(animId);
    window.removeEventListener("resize", sizeCanvas);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    canvas.removeEventListener("pointerleave", onPointerUp);
    renderer.dispose();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(animId);
      animId = 0;
    } else if (!disposed && !animId) {
      lastTs = performance.now();
      animId = requestAnimationFrame(tick);
    }
  });

  animId = requestAnimationFrame(tick);
})();
