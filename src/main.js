import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** Caps GPU load on laptops (big GLB + HDPI melts integrated graphics). */
const MAX_PIXEL_RATIO = 1.25;

const canvas = document.querySelector('#c');
const loadingEl = document.querySelector('#loading');
const barFill = document.querySelector('#bar-fill');
const loadingText = document.querySelector('#loading-text');
const loadingDetail = document.querySelector('#loading-detail');

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
ground.position.y = -0.001;
scene.add(ground);

const grid = new THREE.GridHelper(20, 20, 0x2a3144, 0x1a2030);
grid.material.opacity = 0.22;
grid.material.transparent = true;
scene.add(grid);

function setLoadingProgress(pct, detail) {
  const clamped = Math.max(0, Math.min(100, pct));
  barFill.style.width = `${clamped}%`;
  if (detail) loadingDetail.textContent = detail;
}

function hideLoading() {
  loadingEl.classList.add('done');
  setTimeout(() => {
    loadingEl.style.display = 'none';
  }, 500);
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

    root.position.sub(center);
    scene.add(root);

    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const dist = maxDim * 1.8;
    camera.near = Math.max(0.001, maxDim / 200);
    camera.far = Math.max(100, maxDim * 40);
    camera.updateProjectionMatrix();

    controls.target.set(0, size.y * 0.25, 0);
    camera.position.set(dist * 0.85, dist * 0.55, dist * 0.95);
    controls.update();

    loadingText.textContent = 'Ready';
    setLoadingProgress(100, 'Curax system model');
    hideLoading();
  },
  (event) => {
    if (event.lengthComputable) {
      const pct = (event.loaded / event.total) * 100;
      setLoadingProgress(
        pct,
        `${(event.loaded / (1024 * 1024)).toFixed(1)} / ${(event.total / (1024 * 1024)).toFixed(1)} MB`
      );
    } else {
      setLoadingProgress(50, 'Downloading…');
    }
  },
  (err) => {
    console.error(err);
    loadingText.textContent = 'Could not load model';
    loadingDetail.textContent = 'Ensure Box.glb is in public/ and redeploy.';
    barFill.style.background = '#f87171';
  }
);

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
  controls.update();
  renderer.render(scene, camera);
}

tick();
