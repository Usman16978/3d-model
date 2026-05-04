import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const canvas = document.querySelector('#c');
const loadingEl = document.querySelector('#loading');
const barFill = document.querySelector('#bar-fill');
const loadingText = document.querySelector('#loading-text');
const loadingDetail = document.querySelector('#loading-detail');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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

const gen = new THREE.PMREMGenerator(renderer);
scene.environment = gen.fromScene(new RoomEnvironment(renderer), 0.04).texture;
gen.dispose();

const key = new THREE.DirectionalLight(0xffffff, 1.05);
key.position.set(4, 8, 5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 0.5;
key.shadow.camera.far = 40;
key.shadow.camera.left = -8;
key.shadow.camera.right = 8;
key.shadow.camera.top = 8;
key.shadow.camera.bottom = -8;
scene.add(key);

const fill = new THREE.DirectionalLight(0xb8c8ff, 0.35);
fill.position.set(-5, 3, -4);
scene.add(fill);

const rim = new THREE.HemisphereLight(0x8fb4ff, 0x1a1424, 0.55);
scene.add(rim);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(12, 96),
  new THREE.MeshStandardMaterial({
    color: 0x121520,
    metalness: 0.15,
    roughness: 0.92,
  })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
ground.position.y = -0.001;
scene.add(ground);

const grid = new THREE.GridHelper(24, 48, 0x2a3144, 0x1a2030);
grid.position.y = 0;
grid.material.opacity = 0.35;
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
      const mesh = obj;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
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
    setLoadingProgress(100, 'Use mouse or touch to explore');
    hideLoading();
  },
  (event) => {
    if (event.lengthComputable) {
      const pct = (event.loaded / event.total) * 100;
      setLoadingProgress(pct, `${(event.loaded / (1024 * 1024)).toFixed(1)} / ${(event.total / (1024 * 1024)).toFixed(1)} MB`);
    } else {
      setLoadingProgress(50, 'Downloading…');
    }
  },
  (err) => {
    console.error(err);
    loadingText.textContent = 'Could not load model';
    loadingDetail.textContent = 'Check that Box.glb is in public/ and redeploy.';
    barFill.style.background = '#f87171';
  }
);

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

window.addEventListener('resize', onResize);

function tick() {
  requestAnimationFrame(tick);
  controls.update();
  renderer.render(scene, camera);
}

tick();
