/**
 * Three.js WebGL invitation card scene
 * Requires: importmap for "three" and "three/addons/"
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

(function () {
  const sceneEl = document.getElementById("card-scene");
  const canvas = document.getElementById("invite-canvas");
  const fallbackImg = document.getElementById("invite-card");
  if (!sceneEl || !canvas) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hint = document.getElementById("card-hint");

  // WebGL capability check
  function hasWebGL() {
    try {
      const c = document.createElement("canvas");
      return !!(c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl"));
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
    hint.textContent = "Drag to orbit · pinch to zoom";
  }

  const CARD_W = 1.5;
  const CARD_H = 1.0;
  const CARD_DEPTH = 0.012;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();

  // Soft warm gradient via large backdrop plane behind everything
  const bgGeo = new THREE.SphereGeometry(8, 32, 16);
  const bgMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0xf0f5ee) },
      midColor: { value: new THREE.Color(0xf3ebe1) },
      bottomColor: { value: new THREE.Color(0xe6d7c2) },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 bottomColor;
      varying vec3 vWorldPos;
      void main() {
        float h = normalize(vWorldPos).y;
        vec3 col = mix(bottomColor, midColor, smoothstep(-0.55, 0.15, h));
        col = mix(col, topColor, smoothstep(0.05, 0.85, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const bgMesh = new THREE.Mesh(bgGeo, bgMat);
  scene.add(bgMesh);

  // Lighting — tropical cream / gold
  const ambient = new THREE.AmbientLight(0xfff6e8, 0.72);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffe8c8, 1.15);
  key.position.set(2.2, 3.4, 2.8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 12;
  key.shadow.camera.left = -3;
  key.shadow.camera.right = 3;
  key.shadow.camera.top = 3;
  key.shadow.camera.bottom = -3;
  key.shadow.bias = -0.0004;
  key.shadow.radius = 3;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xdce8dc, 0.35);
  fill.position.set(-2.5, 1.2, -1.5);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xc4a35a, 0.28);
  rim.position.set(0.5, 1.0, -2.5);
  scene.add(rim);

  // Soft floor / shadow catcher
  const floorGeo = new THREE.CircleGeometry(2.4, 64);
  const floorMat = new THREE.ShadowMaterial({ opacity: 0.22 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -CARD_H * 0.52;
  floor.receiveShadow = true;
  scene.add(floor);

  // Subtle warm disc under floor for spatial feel
  const discGeo = new THREE.CircleGeometry(1.85, 64);
  const discMat = new THREE.MeshBasicMaterial({
    color: 0xe8dcc8,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const disc = new THREE.Mesh(discGeo, discMat);
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = floor.position.y + 0.001;
  scene.add(disc);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40);
  const camStart = new THREE.Vector3(0, 0.35, 4.2);
  const camEnd = new THREE.Vector3(0, 0.12, 2.55);
  camera.position.copy(reduceMotion ? camEnd : camStart);
  camera.lookAt(0, 0, 0);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 1.85;
  controls.maxDistance = 4.2;
  controls.minPolarAngle = Math.PI * 0.28;
  controls.maxPolarAngle = Math.PI * 0.72;
  controls.autoRotate = !reduceMotion;
  controls.autoRotateSpeed = 0.55;
  controls.target.set(0, 0, 0);
  controls.update();

  // Card group
  const cardGroup = new THREE.Group();
  scene.add(cardGroup);

  const loader = new THREE.TextureLoader();
  loader.load(
    "card.jpg",
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

      const aspect = tex.image.width / tex.image.height;
      let w = CARD_W;
      let h = CARD_H;
      if (aspect > w / h) {
        h = w / aspect;
      } else {
        w = h * aspect;
      }

      // Thin box so edges catch light
      const geo = new THREE.BoxGeometry(w, h, CARD_DEPTH);
      const edgeMat = new THREE.MeshStandardMaterial({
        color: 0xf5efe4,
        roughness: 0.85,
        metalness: 0.05,
      });
      const frontMat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.55,
        metalness: 0.02,
      });
      const backMat = new THREE.MeshStandardMaterial({
        color: 0xf8f1e6,
        roughness: 0.8,
        metalness: 0.02,
      });
      // Box materials: +x, -x, +y, -y, +z (front), -z (back)
      const mats = [edgeMat, edgeMat, edgeMat, edgeMat, frontMat, backMat];
      const card = new THREE.Mesh(geo, mats);
      card.castShadow = true;
      card.receiveShadow = true;
      cardGroup.add(card);

      // Soft gold rim frame (slightly larger thin plane behind front)
      const frameGeo = new THREE.PlaneGeometry(w + 0.018, h + 0.018);
      const frameMat = new THREE.MeshBasicMaterial({
        color: 0xb8954a,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      });
      const frame = new THREE.Mesh(frameGeo, frameMat);
      frame.position.z = -CARD_DEPTH * 0.5 - 0.001;
      cardGroup.add(frame);

      floor.position.y = -h * 0.52 - 0.02;
      disc.position.y = floor.position.y + 0.001;

      sceneEl.classList.add("is-ready");
    },
    undefined,
    () => {
      // Texture failed — show fallback image
      sceneEl.classList.add("is-fallback");
      if (fallbackImg) fallbackImg.hidden = false;
      canvas.hidden = true;
      if (hint) hint.hidden = true;
      dispose();
    }
  );

  let disposed = false;
  let animId = 0;
  let entranceT = reduceMotion ? 1 : 0;
  const entranceDur = 1.35;
  let lastTs = performance.now();
  let userInteracting = false;

  controls.addEventListener("start", () => {
    userInteracting = true;
    controls.autoRotate = false;
  });
  controls.addEventListener("end", () => {
    userInteracting = false;
    if (!reduceMotion) {
      // Resume idle spin after a short pause
      setTimeout(() => {
        if (!userInteracting && !disposed && !reduceMotion) {
          controls.autoRotate = true;
        }
      }, 2200);
    }
  });

  function sizeCanvas() {
    const rect = sceneEl.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    // Portrait-friendly height: ~72% of width, clamped
    const h = Math.max(240, Math.min(Math.round(w * 0.72), 520));
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

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function tick(now) {
    if (disposed) return;
    animId = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - lastTs) / 1000);
    lastTs = now;

    if (entranceT < 1) {
      entranceT = Math.min(1, entranceT + dt / entranceDur);
      const e = easeOutCubic(entranceT);
      camera.position.lerpVectors(camStart, camEnd, e);
      // Slight card lift in
      cardGroup.rotation.y = (1 - e) * -0.35;
      cardGroup.position.y = (1 - e) * -0.15;
      controls.target.set(0, 0, 0);
      controls.update();
    } else {
      controls.update();
    }

    // Gentle idle bob when auto-rotating
    if (!reduceMotion && controls.autoRotate && !userInteracting && entranceT >= 1) {
      const t = now / 1000;
      cardGroup.position.y = Math.sin(t * 0.7) * 0.012;
    }

    renderer.render(scene, camera);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(animId);
    window.removeEventListener("resize", sizeCanvas);
    controls.dispose();
    renderer.dispose();
  }

  // Pause when tab hidden
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
