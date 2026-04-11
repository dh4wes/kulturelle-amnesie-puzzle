import * as THREE from "three";

import { createGalleryFrames, stepPlayer } from "./logic.js";

const ROOM = {
  minX: -520,
  maxX: 520,
  minZ: -800,
  maxZ: 800,
};

const SCALE = 0.01;
const ROOM_HEIGHT = 8.6;
const EYE_HEIGHT = 1.67;
const CEILING_Y = ROOM_HEIGHT;
const HALF_WIDTH = (ROOM.maxX - ROOM.minX) * SCALE * 0.5;
const HALF_DEPTH = (ROOM.maxZ - ROOM.minZ) * SCALE * 0.5;

export function initGallery({ root, images = [] }) {
  if (!root) {
    return {
      activate() {},
    };
  }

  const frames = createGalleryFrames(images);
  root.innerHTML = createGalleryMarkup();

  const viewport = root.querySelector("[data-gallery-viewport]");
  const rendererHost = root.querySelector("[data-gallery-renderer]");
  const previewImage = root.querySelector("[data-gallery-preview-image]");
  const modal = root.querySelector("[data-gallery-modal]");
  const modalImage = root.querySelector("[data-gallery-modal-image]");
  const modalTitle = root.querySelector("[data-gallery-modal-title]");
  const modalNotes = root.querySelector("[data-gallery-notes]");
  const modalClose = root.querySelector("[data-gallery-close]");

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#f3eee4");
  scene.fog = new THREE.Fog("#efe8db", 8, 24);

  const camera = new THREE.PerspectiveCamera(66, 1, 0.1, 60);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  rendererHost.appendChild(renderer.domElement);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const noteStorage = new Map();
  const interactables = [];
  const input = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    turnLeft: false,
    turnRight: false,
  };

  let active = false;
  let frameId = 0;
  let lastTick = 0;
  let hoveredPainting = null;
  let player = {
    x: 0,
    z: 620,
    rotation: Math.PI,
  };

  const resizeRenderer = () => {
    const width = rendererHost.clientWidth || 1;
    const height = rendererHost.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderFrame();
  };

  const renderFrame = () => {
    syncCamera(camera, player);
    updateNearestPreview(player, frames, previewImage);
    renderer.render(scene, camera);
  };

  buildMuseum(scene, frames, interactables, previewImage);
  syncCamera(camera, player);
  renderFrame();

  const tick = (time) => {
    if (!active) return;
    if (!lastTick) {
      lastTick = time;
    }

    const delta = Math.min(time - lastTick, 32);
    lastTick = time;

    if (modal.hidden) {
      player = stepPlayer(player, input, delta, ROOM);
    }

    renderFrame();
    frameId = window.requestAnimationFrame(tick);
  };

  const setControl = (name, value) => {
    input[name] = value;
  };

  const keyMap = {
    w: "forward",
    W: "forward",
    ArrowUp: "forward",
    s: "backward",
    S: "backward",
    ArrowDown: "backward",
    a: "left",
    A: "left",
    d: "right",
    D: "right",
    ArrowLeft: "turnLeft",
    q: "turnLeft",
    Q: "turnLeft",
    ArrowRight: "turnRight",
    e: "turnRight",
    E: "turnRight",
  };

  const closeModal = () => {
    modal.hidden = true;
    viewport.focus();
  };

  const openModal = (painting) => {
    const title = `Werk ${painting.userData.frame.id}`;
    const imageSrc = resolveArtworkSrc(painting.userData.frame.image);
    modal.hidden = false;
    modalTitle.textContent = title;
    modalImage.src = imageSrc;
    modalImage.alt = `${title} in Nahansicht`;
    modalNotes.value = noteStorage.get(imageSrc) ?? "";
    modalClose.focus();
  };

  const updateRaycastTarget = (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const [hit] = raycaster.intersectObjects(interactables, false);
    hoveredPainting = hit?.object ?? null;
    renderer.domElement.style.cursor = hoveredPainting ? "zoom-in" : "default";
  };

  const handleCanvasClick = (event) => {
    if (!modal.hidden) return;
    updateRaycastTarget(event);
    if (hoveredPainting) {
      openModal(hoveredPainting);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeModal();
      return;
    }

    if (!modal.hidden) return;

    const control = keyMap[event.key];
    if (!control) return;
    event.preventDefault();
    setControl(control, true);
  };

  const handleKeyUp = (event) => {
    const control = keyMap[event.key];
    if (!control) return;
    setControl(control, false);
  };

  renderer.domElement.addEventListener("pointermove", updateRaycastTarget);
  renderer.domElement.addEventListener("click", handleCanvasClick);
  modalClose.addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });
  modalNotes.addEventListener("input", () => {
    noteStorage.set(modalImage.src, modalNotes.value);
  });

  window.addEventListener("resize", resizeRenderer);
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp);

  resizeRenderer();

  return {
    activate() {
      active = true;
      lastTick = 0;
      viewport.focus();
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      frameId = requestAnimationFrame(tick);
    },
  };
}

function createGalleryMarkup() {
  return `
    <section class="gallery-viewport" data-gallery-viewport tabindex="0" aria-label="Begehbare Galerie">
      <div class="gallery-preview">
        <img data-gallery-preview-image alt="" />
      </div>

      <div class="gallery-renderer" data-gallery-renderer></div>

      <div class="gallery-modal" data-gallery-modal hidden>
        <div class="gallery-modal-card" role="dialog" aria-modal="true" aria-labelledby="gallery-modal-title">
          <button type="button" class="gallery-modal-close" data-gallery-close aria-label="Nahansicht schließen">×</button>
          <h2 id="gallery-modal-title" data-gallery-modal-title></h2>
          <img data-gallery-modal-image alt="" />
          <label class="gallery-notes">
            <span>Notiz</span>
            <textarea data-gallery-notes rows="3" placeholder="Kurze Beobachtung eingeben"></textarea>
          </label>
        </div>
      </div>
    </section>
  `;
}

function buildMuseum(scene, frames, interactables, previewImage) {
  const width = HALF_WIDTH * 2;
  const depth = HALF_DEPTH * 2;

  const ambient = new THREE.HemisphereLight("#ffffff", "#c4b49c", 1.55);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight("#fff7e6", 1.6);
  sun.position.set(0, CEILING_Y - 0.2, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -9;
  sun.shadow.camera.right = 9;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -12;
  sun.shadow.camera.near = 0.1;
  sun.shadow.camera.far = 25;
  scene.add(sun);

  const skylight = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.32, depth * 0.24),
    new THREE.MeshBasicMaterial({ color: "#fffaf0" }),
  );
  skylight.position.set(0, CEILING_Y - 0.02, 0);
  skylight.rotation.x = Math.PI / 2;
  scene.add(skylight);

  const floorTexture = createFloorTexture();
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 0.72, metalness: 0.04 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: "#f3ece2",
    roughness: 0.92,
    metalness: 0,
  });

  const ceilingMaterial = new THREE.MeshStandardMaterial({
    color: "#f8f4ed",
    roughness: 1,
    metalness: 0,
  });

  const walls = [
    createWall(width, ROOM_HEIGHT, [0, ROOM_HEIGHT / 2, -HALF_DEPTH], [0, 0, 0], wallMaterial),
    createWall(width, ROOM_HEIGHT, [0, ROOM_HEIGHT / 2, HALF_DEPTH], [0, Math.PI, 0], wallMaterial),
    createWall(depth, ROOM_HEIGHT, [-HALF_WIDTH, ROOM_HEIGHT / 2, 0], [0, Math.PI / 2, 0], wallMaterial),
    createWall(depth, ROOM_HEIGHT, [HALF_WIDTH, ROOM_HEIGHT / 2, 0], [0, -Math.PI / 2, 0], wallMaterial),
  ];
  walls.forEach((wall) => scene.add(wall));

  const ceiling = new THREE.Group();
  const ceilingPieces = [
    { size: [width, depth * 0.34], pos: [0, CEILING_Y, -depth * 0.33] },
    { size: [width, depth * 0.34], pos: [0, CEILING_Y, depth * 0.33] },
    { size: [width * 0.32, depth * 0.32], pos: [-width * 0.34, CEILING_Y, 0] },
    { size: [width * 0.32, depth * 0.32], pos: [width * 0.34, CEILING_Y, 0] },
  ];
  ceilingPieces.forEach((piece) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(piece.size[0], piece.size[1]),
      ceilingMaterial,
    );
    mesh.position.set(piece.pos[0], piece.pos[1], piece.pos[2]);
    mesh.rotation.x = Math.PI / 2;
    ceiling.add(mesh);
  });
  scene.add(ceiling);

  addTrim(scene, width, depth);
  addPaintings(scene, frames, interactables, previewImage);
}

function createWall(width, height, position, rotation, material) {
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  wall.position.set(position[0], position[1], position[2]);
  wall.rotation.set(rotation[0], rotation[1], rotation[2]);
  wall.receiveShadow = true;
  return wall;
}

function addTrim(scene, width, depth) {
  const baseMaterial = new THREE.MeshStandardMaterial({ color: "#b89b73", roughness: 0.78 });
  const crownMaterial = new THREE.MeshStandardMaterial({ color: "#e0d2be", roughness: 0.86 });
  const baseDepth = 0.08;

  const pieces = [
    { size: [width, 0.2, baseDepth], pos: [0, 0.1, -HALF_DEPTH + baseDepth / 2] },
    { size: [width, 0.2, baseDepth], pos: [0, 0.1, HALF_DEPTH - baseDepth / 2] },
    { size: [baseDepth, 0.2, depth], pos: [-HALF_WIDTH + baseDepth / 2, 0.1, 0] },
    { size: [baseDepth, 0.2, depth], pos: [HALF_WIDTH - baseDepth / 2, 0.1, 0] },
    { size: [width, 0.18, baseDepth], pos: [0, CEILING_Y - 0.09, -HALF_DEPTH + baseDepth / 2] },
    { size: [width, 0.18, baseDepth], pos: [0, CEILING_Y - 0.09, HALF_DEPTH - baseDepth / 2] },
    { size: [baseDepth, 0.18, depth], pos: [-HALF_WIDTH + baseDepth / 2, CEILING_Y - 0.09, 0] },
    { size: [baseDepth, 0.18, depth], pos: [HALF_WIDTH - baseDepth / 2, CEILING_Y - 0.09, 0] },
  ];

  pieces.forEach((piece, index) => {
    const material = index < 4 ? baseMaterial : crownMaterial;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...piece.size), material);
    mesh.position.set(...piece.pos);
    mesh.castShadow = true;
    scene.add(mesh);
  });
}

function addPaintings(scene, frames, interactables, previewImage) {
  const loader = new THREE.TextureLoader();
  previewImage.src = frames[0] ? resolveArtworkSrc(frames[0].image) : "";

  frames.forEach((frame) => {
    const group = new THREE.Group();
    const artTexture = loader.load(resolveArtworkSrc(frame.image));
    artTexture.colorSpace = THREE.SRGBColorSpace;

    const frameWidth = 1.28;
    const frameHeight = 1.76;
    const frameDepth = 0.07;
    const matteInset = 0.08;

    const outerFrame = new THREE.Mesh(
      new THREE.BoxGeometry(frameWidth, frameHeight, frameDepth),
      new THREE.MeshStandardMaterial({ color: "#6e5335", roughness: 0.6, metalness: 0.05 }),
    );
    outerFrame.castShadow = true;
    group.add(outerFrame);

    const matte = new THREE.Mesh(
      new THREE.BoxGeometry(frameWidth - matteInset, frameHeight - matteInset, frameDepth * 0.45),
      new THREE.MeshStandardMaterial({ color: "#f3ecdf", roughness: 0.95 }),
    );
    matte.position.z = frameDepth * 0.2;
    group.add(matte);

    const painting = new THREE.Mesh(
      new THREE.PlaneGeometry(frameWidth - 0.22, frameHeight - 0.22),
      new THREE.MeshStandardMaterial({ map: artTexture, roughness: 0.92 }),
    );
    painting.position.z = frameDepth * 0.52;
    painting.userData.frame = frame;
    group.add(painting);
    interactables.push(painting);

    const plaque = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.08, 0.02),
      new THREE.MeshStandardMaterial({ color: "#d2bb8f", roughness: 0.8 }),
    );
    plaque.position.set(0, -(frameHeight / 2 + 0.12), 0.02);
    group.add(plaque);

    const spot = new THREE.SpotLight("#fff8ef", 2.8, 7.5, Math.PI / 6, 0.38, 1.3);
    const target = new THREE.Object3D();
    target.position.set(0, 0, 0);
    group.add(target);
    spot.target = target;
    spot.position.set(0, 2.4, 1.4);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    group.add(spot);

    positionPaintingGroup(group, frame);
    scene.add(group);
  });
}

function positionPaintingGroup(group, frame) {
  const x = frame.x * SCALE;
  const y = frame.y * SCALE;
  const z = frame.z * SCALE;
  const inset = 0.03;

  if (frame.wall === "front") {
    group.position.set(x, y, ROOM.minZ * SCALE + inset);
    group.rotation.y = 0;
  } else if (frame.wall === "back") {
    group.position.set(x, y, ROOM.maxZ * SCALE - inset);
    group.rotation.y = Math.PI;
  } else if (frame.wall === "left") {
    group.position.set(ROOM.minX * SCALE + inset, y, z);
    group.rotation.y = Math.PI / 2;
  } else if (frame.wall === "right") {
    group.position.set(ROOM.maxX * SCALE - inset, y, z);
    group.rotation.y = -Math.PI / 2;
  }
}

function syncCamera(camera, player) {
  const position = new THREE.Vector3(player.x * SCALE, EYE_HEIGHT, player.z * SCALE);
  const direction = new THREE.Vector3(Math.sin(player.rotation), 0, Math.cos(player.rotation));
  camera.position.copy(position);
  camera.lookAt(position.clone().add(direction));
}

function updateNearestPreview(player, frames, previewImage) {
  const nearest = getNearestFrame(player, frames);
  if (nearest) {
    previewImage.src = resolveArtworkSrc(nearest.image);
    previewImage.alt = "Vorschau eines Werks in der Galerie";
  }
}

function resolveArtworkSrc(imagePath) {
  if (!imagePath) return "";
  if (imagePath.startsWith("/puzzle-images/")) return imagePath;
  if (imagePath.startsWith("/")) return imagePath;

  const filename = imagePath.split("/").pop();
  return `/puzzle-images/${filename}`;
}

function getNearestFrame(player, frames) {
  let best = null;
  let bestDistance = Infinity;

  frames.forEach((frame) => {
    const dx = player.x - frame.x;
    const dz = player.z - frame.z;
    const distance = Math.hypot(dx, dz);
    if (distance < bestDistance) {
      best = frame;
      bestDistance = distance;
    }
  });

  return best;
}

function createFloorTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext("2d");

  context.fillStyle = "#c9ae86";
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      context.fillStyle = (row + col) % 2 === 0 ? "#b28e62" : "#c39d71";
      context.fillRect(col * 128, row * 128, 128, 128);
      context.strokeStyle = "rgba(88, 58, 30, 0.22)";
      context.strokeRect(col * 128, row * 128, 128, 128);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3.5, 5);
  return texture;
}
