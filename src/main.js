import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  CURAX_ANIM_MAP,
  CURAX_AUTO_DEMO_ALL_CLIPS,
} from './curaxAnimMap.js';

/** Caps GPU load on laptops (big GLB + HDPI melts integrated graphics). */
const MAX_PIXEL_RATIO = 1.25;

/** Pause between chained clips in auto-demo mode (ms). */
const AUTO_STORY_GAP_MS = 200;

const clock = new THREE.Clock();
let mixer = null;
let clips = [];
let storyOrder = [];
let storyOrderIdx = 0;
let storyFinishedHandler = null;
let poweredOn = false;

const canvas = document.querySelector('#c');
const loadingEl = document.querySelector('#loading');
const barFill = document.querySelector('#bar-fill');
const loadErr = document.querySelector('#load-err');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  alpha: false,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07080d);

const camera = new THREE.PerspectiveCamera(
  42,
  window.innerWidth / window.innerHeight,
  0.01,
  500
);
camera.position.set(2.2, 1.6, 3.2);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.screenSpacePanning = true;
controls.minDistance = 0.05;
controls.maxDistance = 80;
controls.target.set(0, 0.4, 0);

const ambient = new THREE.AmbientLight(0xd4dcff, 0.45);
scene.add(ambient);

const key = new THREE.DirectionalLight(0xffffff, 1.1);
key.position.set(5, 10, 6);
scene.add(key);

const fill = new THREE.DirectionalLight(0xa8b8e8, 0.35);
fill.position.set(-6, 4, -5);
scene.add(fill);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(10, 48),
  new THREE.MeshLambertMaterial({
    color: 0x141824,
  })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.06;
scene.add(ground);

const grid = new THREE.GridHelper(20, 20, 0x2a3144, 0x1a2030);
grid.material.opacity = 0.22;
grid.material.transparent = true;
grid.position.y = -0.02;
scene.add(grid);

function setLoadingProgress(pct) {
  const clamped = Math.max(0, Math.min(100, pct));
  barFill.style.width = `${clamped}%`;
}

function hideLoading() {
  loadingEl.classList.add('done');
  loadingEl.removeAttribute('aria-busy');
  setTimeout(() => {
    loadingEl.style.display = 'none';
  }, 500);
}

function playClipIndex(index) {
  if (!mixer || index == null || index < 0 || index >= clips.length) {
    return null;
  }
  const clip = clips[index];
  mixer.stopAllAction();
  const action = mixer.clipAction(clip);
  action.reset();
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  return action;
}

/** Play one semantic clip from CURAX_ANIM_MAP (used by buttons + external hosts). */
function curaxPlayIndex(mapKey, compartmentSlot = null) {
  let idx = null;
  if (mapKey === 'compartment' && compartmentSlot != null) {
    const arr = CURAX_ANIM_MAP.compartments;
    if (Array.isArray(arr) && arr[compartmentSlot] != null) {
      idx = arr[compartmentSlot];
    }
  } else if (mapKey in CURAX_ANIM_MAP && mapKey !== 'compartments') {
    idx = CURAX_ANIM_MAP[mapKey];
  }
  if (idx == null) {
    console.warn('[Curax3D] No clip mapped for:', mapKey, compartmentSlot);
    return null;
  }
  return playClipIndex(idx);
}

function curaxTogglePower() {
  poweredOn = !poweredOn;
  const keyOn = poweredOn ? 'powerOn' : 'powerOff';
  const idx = CURAX_ANIM_MAP[keyOn];
  if (!poweredOn && idx == null) {
    poweredOn = true;
    console.warn('[Curax3D] powerOff not mapped; ignoring toggle off.');
    return null;
  }
  return curaxPlayIndex(keyOn);
}

function curaxKeypadDigit() {
  return curaxPlayIndex('screenPinStars');
}

function setupBindingUi() {
  const panel = document.querySelector('#curax-bindings');
  if (!panel) return;
  panel.hidden = false;

  panel.querySelector('[data-curax="power"]').addEventListener('click', () => {
    curaxTogglePower();
  });
  panel.querySelector('[data-curax="init"]').addEventListener('click', () => {
    curaxPlayIndex('screenInitializing');
  });
  panel.querySelector('[data-curax="ready"]').addEventListener('click', () => {
    curaxPlayIndex('screenSystemReady');
  });
  panel.querySelector('[data-curax="pin"]').addEventListener('click', () => {
    curaxPlayIndex('screenEnterPin');
  });
  panel.querySelector('[data-curax="stars"]').addEventListener('click', () => {
    curaxPlayIndex('screenPinStars');
  });
  panel.querySelector('[data-curax="readings"]').addEventListener('click', () => {
    curaxPlayIndex('screenReadings');
  });

  panel.querySelectorAll('[data-curax-comp]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const slot = Number.parseInt(btn.getAttribute('data-curax-comp'), 10);
      curaxPlayIndex('compartment', slot);
    });
  });

  panel.querySelectorAll('[data-curax-key]').forEach((btn) => {
    btn.addEventListener('click', () => {
      curaxKeypadDigit();
    });
  });
}

function setupAutoStory(root, animations) {
  clips = animations;
  if (!animations.length) return;

  mixer = new THREE.AnimationMixer(root);

  console.table(
    animations.map((c, i) => ({
      index: i,
      name: c.name,
      durationSec: Number(c.duration.toFixed(3)),
    }))
  );

  if (!CURAX_AUTO_DEMO_ALL_CLIPS) {
    setupBindingUi();
    return;
  }

  storyOrder = animations.map((_, i) => i);
  storyOrderIdx = 0;

  if (storyFinishedHandler) {
    mixer.removeEventListener('finished', storyFinishedHandler);
  }
  storyFinishedHandler = () => {
    window.setTimeout(() => advanceAutoStory(), AUTO_STORY_GAP_MS);
  };
  mixer.addEventListener('finished', storyFinishedHandler);
  advanceAutoStory();
}

function playStoryClipAtOrderIndex(orderPos) {
  if (!storyOrder.length) return;
  const wrap = orderPos % storyOrder.length;
  const clipIdx = storyOrder[wrap];
  if (clipIdx < 0 || clipIdx >= clips.length) return;
  playClipIndex(clipIdx);
}

function advanceAutoStory() {
  if (!storyOrder.length || !mixer) return;
  playStoryClipAtOrderIndex(storyOrderIdx);
  storyOrderIdx = (storyOrderIdx + 1) % storyOrder.length;
}

const loader = new GLTFLoader();
loader.setPath(import.meta.env.BASE_URL);

loader.load(
  'Box.glb',
  (gltf) => {
    const root = gltf.scene;
    root.traverse((obj) => {
      if (obj.isMesh) {
        obj.frustumCulled = true;
        obj.castShadow = false;
        obj.receiveShadow = false;
      }
    });

    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= box.min.y;
    root.position.y += 0.02;

    scene.add(root);

    box.setFromObject(root);
    const midY = (box.min.y + box.max.y) / 2;
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const dist = maxDim * 1.8;
    camera.near = Math.max(0.001, maxDim / 200);
    camera.far = Math.max(100, maxDim * 40);
    camera.updateProjectionMatrix();

    controls.target.set(0, midY, 0);
    camera.position.set(dist * 0.85, dist * 0.55, dist * 0.95);
    controls.update();

    setupAutoStory(root, gltf.animations || []);

    setLoadingProgress(100);
    hideLoading();
  },
  (event) => {
    if (event.lengthComputable) {
      setLoadingProgress((event.loaded / event.total) * 100);
    }
  },
  (err) => {
    console.error(err);
    loadingEl.setAttribute('aria-busy', 'false');
    barFill.style.background = '#f87171';
    loadErr.hidden = false;
  }
);

window.Curax3D = {
  map: CURAX_ANIM_MAP,
  playClip: playClipIndex,
  play: curaxPlayIndex,
  togglePower: curaxTogglePower,
  keypadDigit: curaxKeypadDigit,
};

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
  renderer.setSize(w, h);
}

window.addEventListener('resize', onResize);

function tick() {
  requestAnimationFrame(tick);
  const dt = clock.getDelta();
  if (mixer) mixer.update(dt);
  controls.update();
  renderer.render(scene, camera);
}

tick();
