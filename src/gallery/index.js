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
const SITE_FALLBACK_URL = "https://webauftritt.vercel.app";
const AR_MODEL_SRC = "/models/Splat_Test_textured_mesh_glb.glb";
const AR_MODEL_SOURCE_SRC = "/models/Splat_Test_textured_mesh_obj.zip";
const MINIMAP_MARKER_INSET_PERCENT = 8;
const NAVIGATION_ITEMS = [
  { label: "Horch mal", href: "/featured", icon: "/icons/menu-1.png" },
  { label: "Texte/Gedichte", href: "/works", icon: "/icons/menu-2.png" },
  { label: "Projekte", href: "/archive", icon: "/icons/menu-3.png" },
  { label: "Nachrichten", href: "/guestbook", icon: "/icons/menu-4.png" },
  { label: "begehbare Ausstellung", href: "https://kulturelle-amnesie-puzzle.vercel.app/", icon: "/icons/menu-5.png" },
  { label: "Kontakt", href: "/kontakt", icon: "/icons/menu-6.png" },
  { label: "Lebenslauf", href: "/lebenslauf", icon: "/icons/menu-7.png" },
  { label: "Fragen; des Monats? des Tages?", href: "/fragen", icon: "/icons/menu-8.png" },
  { label: "Tattoo", href: "/tattoo", icon: "/icons/menu-9.png" },
];
const MENU_ICON_PATHS = Array.from({ length: 9 }, (_, index) => `/icons/menu-${index + 1}.png`);

let modelViewerLoadPromise = null;

function loadModelViewer() {
  if (!modelViewerLoadPromise) {
    modelViewerLoadPromise = import("@google/model-viewer");
  }

  return modelViewerLoadPromise;
}

export function initGallery({ root, images = [], wallpaper = "botanical" }) {
  if (!root) {
    return {
      activate() {},
    };
  }

  const frames = createGalleryFrames(getGalleryFrameImages(images));
  root.innerHTML = createGalleryMarkup();

  const viewport = root.querySelector("[data-gallery-viewport]");
  const rendererHost = root.querySelector("[data-gallery-renderer]");
  const mapToggle = root.querySelector("[data-gallery-map-toggle]");
  const mapPanel = root.querySelector("[data-gallery-map-panel]");
  const mapTrack = root.querySelector("[data-gallery-map-track]");
  const mapList = root.querySelector("[data-gallery-map-list]");
  const mapPlayer = root.querySelector("[data-gallery-map-player]");
  const joystick = root.querySelector("[data-gallery-joystick]");
  const joystickThumb = root.querySelector("[data-gallery-joystick-thumb]");
  const modal = root.querySelector("[data-gallery-modal]");
  const modalIcon = root.querySelector("[data-gallery-modal-icon]");
  const modalImage = root.querySelector("[data-gallery-modal-image]");
  const modalArViewer = root.querySelector("[data-gallery-ar-viewer]");
  const modalTitle = root.querySelector("[data-gallery-modal-title]");
  const modalLink = root.querySelector("[data-gallery-link]");
  const modalSourceLink = root.querySelector("[data-gallery-source-link]");
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
  const interactables = [];
  const input = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    turnLeft: false,
    turnRight: false,
    moveAxisX: 0,
    moveAxisY: 0,
    turnAxis: 0,
  };

  let active = false;
  let frameId = 0;
  let lastTick = 0;
  let hoveredObject = null;
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
    updateMiniMapPlayer(player, mapPlayer);
    renderer.render(scene, camera);
  };

  const moveToFrame = (frame) => {
    modal.hidden = true;
    player = getPlayerViewForFrame(frame);
    renderFrame();
    viewport.focus();
  };

  buildMiniMapMarkers(frames, mapTrack, mapList, moveToFrame);
  buildMuseum(scene, frames, interactables, wallpaper);
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

  const openPaintingModal = (painting) => {
    const title = `Werk ${painting.userData.frame.id}`;
    const imageSrc = resolveArtworkSrc(painting.userData.frame.image);
    const navigationItem = getNavigationItem(painting.userData.frame);
    modal.hidden = false;
    modalIcon.src = navigationItem.icon;
    modalIcon.alt = "";
    modalTitle.textContent = navigationItem.label;
    modalImage.hidden = false;
    modalImage.src = imageSrc;
    modalImage.alt = `${title} in Nahansicht`;
    modalArViewer.hidden = true;
    modalArViewer.removeAttribute("src");
    modalLink.textContent = `${navigationItem.label} öffnen`;
    modalLink.href = resolveSiteHref(navigationItem.href);
    modalLink.hidden = false;
    modalSourceLink.hidden = true;
    modalClose.focus();
  };

  const openBenchModal = () => {
    modal.hidden = false;
    modalIcon.src = "/icons/menu-5.png";
    modalIcon.alt = "";
    modalTitle.textContent = "AR Objekt";
    modalImage.hidden = true;
    modalImage.removeAttribute("src");
    modalArViewer.hidden = false;
    modalArViewer.setAttribute("src", AR_MODEL_SRC);
    loadModelViewer();
    modalLink.hidden = true;
    modalSourceLink.hidden = false;
    modalSourceLink.href = AR_MODEL_SOURCE_SRC;
    modalClose.focus();
  };

  const updateRaycastTarget = (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const [hit] = raycaster.intersectObjects(interactables, false);
    hoveredObject = hit?.object ?? null;
    renderer.domElement.style.cursor = hoveredObject ? "zoom-in" : "default";
  };

  const handleCanvasClick = (event) => {
    if (!modal.hidden) return;
    updateRaycastTarget(event);
    if (hoveredObject?.userData.kind === "bench") {
      openBenchModal();
    } else if (hoveredObject?.userData.frame) {
      openPaintingModal(hoveredObject);
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

  const resetJoystick = () => {
    input.moveAxisX = 0;
    input.moveAxisY = 0;
    input.turnAxis = 0;
    joystickThumb.style.transform = "translate(-50%, -50%)";
    joystick.dataset.active = "false";
  };

  const updateJoystick = (event) => {
    const rect = joystick.getBoundingClientRect();
    const radius = rect.width * 0.5;
    const thumbRadius = 24;
    const centerX = rect.left + radius;
    const centerY = rect.top + radius;
    const rawX = event.clientX - centerX;
    const rawY = event.clientY - centerY;
    const distance = Math.hypot(rawX, rawY);
    const maxDistance = radius - thumbRadius;
    const clampRatio = distance > maxDistance ? maxDistance / distance : 1;
    const clampedX = rawX * clampRatio;
    const clampedY = rawY * clampRatio;
    const normalizedX = maxDistance ? clampedX / maxDistance : 0;
    const normalizedY = maxDistance ? clampedY / maxDistance : 0;

    joystickThumb.style.transform = `translate(calc(-50% + ${clampedX}px), calc(-50% + ${clampedY}px))`;
    joystick.dataset.active = "true";

    input.turnAxis = -normalizedX;
    input.moveAxisY = -normalizedY;
    input.moveAxisX = 0;
  };

  joystick.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    joystick.setPointerCapture(event.pointerId);
    updateJoystick(event);
  });
  joystick.addEventListener("pointermove", (event) => {
    if (!joystick.hasPointerCapture(event.pointerId)) return;
    updateJoystick(event);
  });
  joystick.addEventListener("pointerup", (event) => {
    if (joystick.hasPointerCapture(event.pointerId)) {
      joystick.releasePointerCapture(event.pointerId);
    }
    resetJoystick();
  });
  joystick.addEventListener("pointercancel", (event) => {
    if (joystick.hasPointerCapture(event.pointerId)) {
      joystick.releasePointerCapture(event.pointerId);
    }
    resetJoystick();
  });
  mapToggle.addEventListener("click", () => {
    const collapsed = mapPanel.dataset.collapsed !== "true";
    mapPanel.dataset.collapsed = String(collapsed);
    mapToggle.setAttribute("aria-expanded", String(!collapsed));
  });

  renderer.domElement.addEventListener("pointermove", updateRaycastTarget);
  renderer.domElement.addEventListener("click", handleCanvasClick);
  modalClose.addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
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
      <div class="gallery-map" data-gallery-map-panel data-collapsed="true">
        <button
          type="button"
          class="gallery-map-toggle"
          data-gallery-map-toggle
          aria-expanded="false"
          aria-controls="gallery-map-content"
          aria-label="Galeriekarte ein- oder ausklappen"
        >
          Karte
        </button>
        <div class="gallery-map-content" id="gallery-map-content">
          <div class="gallery-map-track" data-gallery-map-track aria-label="Galeriekarte">
            <span class="gallery-map-player" data-gallery-map-player aria-hidden="true"></span>
          </div>
          <div class="gallery-map-list" data-gallery-map-list aria-label="Direkte Navigation"></div>
        </div>
      </div>

      <div class="gallery-renderer" data-gallery-renderer></div>

      <div class="gallery-joystick-wrap" aria-label="Mobile Steuerung">
        <div class="gallery-joystick" data-gallery-joystick data-active="false" aria-hidden="true">
          <div class="gallery-joystick-thumb" data-gallery-joystick-thumb></div>
        </div>
      </div>

      <div class="gallery-modal" data-gallery-modal hidden>
        <div class="gallery-modal-card" role="dialog" aria-modal="true" aria-labelledby="gallery-modal-title">
          <button type="button" class="gallery-modal-close" data-gallery-close aria-label="Nahansicht schließen">×</button>
          <h2 class="gallery-modal-heading">
            <img class="gallery-modal-icon" data-gallery-modal-icon alt="" />
            <span id="gallery-modal-title" data-gallery-modal-title></span>
          </h2>
          <img class="gallery-modal-artwork" data-gallery-modal-image alt="" />
          <model-viewer
            class="gallery-ar-viewer"
            data-gallery-ar-viewer
            alt="AR Objekt"
            ar
            ar-modes="webxr scene-viewer quick-look"
            camera-controls
            auto-rotate
            shadow-intensity="0.85"
            exposure="0.95"
            hidden
          ></model-viewer>
          <a class="gallery-site-link" data-gallery-link href="${resolveSiteHref(NAVIGATION_ITEMS[0].href)}">${NAVIGATION_ITEMS[0].label} öffnen</a>
          <a class="gallery-site-link gallery-source-link" data-gallery-source-link href="${AR_MODEL_SOURCE_SRC}" download hidden>OBJ Quelle herunterladen</a>
        </div>
      </div>
    </section>
  `;
}

function getNavigationItem(frame) {
  return NAVIGATION_ITEMS[(frame.id - 1) % NAVIGATION_ITEMS.length];
}

function resolveSiteHref(path) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return resolveSiteGalleryHandoff(path);
}

function getGalleryFrameImages(images) {
  if (!images.length) {
    return [];
  }

  return NAVIGATION_ITEMS.map((_, index) => images[index % images.length]);
}

function resolveSiteGalleryHandoff(path) {
  const params = new URLSearchParams(window.location.search);
  const returnUrl = params.get("returnUrl");
  let baseUrl = SITE_FALLBACK_URL;

  if (returnUrl) {
    try {
      baseUrl = new URL(returnUrl).origin;
    } catch {
      baseUrl = SITE_FALLBACK_URL;
    }
  }

  const handoffUrl = new URL("/gallery", baseUrl);
  handoffUrl.searchParams.set("to", path);
  return handoffUrl.toString();
}

function buildMiniMapMarkers(frames, mapTrack, mapList, onSelectFrame) {
  const markerFragment = document.createDocumentFragment();
  const listFragment = document.createDocumentFragment();

  frames.forEach((frame) => {
    const navigationItem = getNavigationItem(frame);
    const marker = document.createElement("button");
    marker.className = "gallery-map-marker";
    marker.type = "button";
    marker.setAttribute("aria-label", `Zu ${navigationItem.label} in der Galerie`);
    marker.style.left = `${roomXToMarkerPercent(frame.x)}%`;
    marker.style.top = `${roomZToMarkerPercent(frame.z)}%`;
    marker.addEventListener("click", () => onSelectFrame(frame));
    const markerIcon = document.createElement("img");
    markerIcon.src = navigationItem.icon;
    markerIcon.alt = "";
    markerIcon.loading = "lazy";
    marker.appendChild(markerIcon);
    const label = document.createElement("span");
    label.className = "sr-only";
    label.textContent = navigationItem.label;
    marker.appendChild(label);
    markerFragment.appendChild(marker);

    const listLink = document.createElement("button");
    listLink.className = "gallery-map-list-link";
    listLink.type = "button";
    const listIcon = document.createElement("img");
    listIcon.src = navigationItem.icon;
    listIcon.alt = "";
    listIcon.loading = "lazy";
    const listLabel = document.createElement("span");
    listLabel.textContent = navigationItem.label;
    listLink.append(listIcon, listLabel);
    listLink.addEventListener("click", () => onSelectFrame(frame));
    listFragment.appendChild(listLink);
  });

  mapTrack.appendChild(markerFragment);
  mapList.appendChild(listFragment);
}

function getPlayerViewForFrame(frame) {
  const inset = 220;

  if (frame.wall === "front") {
    return { x: frame.x, z: ROOM.minZ + inset, rotation: Math.PI };
  }

  if (frame.wall === "back") {
    return { x: frame.x, z: ROOM.maxZ - inset, rotation: 0 };
  }

  if (frame.wall === "left") {
    return { x: ROOM.minX + inset, z: frame.z, rotation: Math.PI * 1.5 };
  }

  if (frame.wall === "right") {
    return { x: ROOM.maxX - inset, z: frame.z, rotation: Math.PI * 0.5 };
  }

  return { x: 0, z: 0, rotation: 0 };
}

function updateMiniMapPlayer(player, mapPlayer) {
  mapPlayer.style.left = `${roomXToPercent(player.x)}%`;
  mapPlayer.style.top = `${roomZToPercent(player.z)}%`;
  mapPlayer.style.transform = `translate(-50%, -50%) rotate(${player.rotation}rad)`;
}

function roomXToPercent(x) {
  const clampedX = Math.min(Math.max(x, ROOM.minX), ROOM.maxX);
  return ((clampedX - ROOM.minX) / (ROOM.maxX - ROOM.minX)) * 100;
}

function roomZToPercent(z) {
  const clampedZ = Math.min(Math.max(z, ROOM.minZ), ROOM.maxZ);
  return ((clampedZ - ROOM.minZ) / (ROOM.maxZ - ROOM.minZ)) * 100;
}

function insetPercent(percent, inset = MINIMAP_MARKER_INSET_PERCENT) {
  return inset + (percent / 100) * (100 - inset * 2);
}

function roomXToMarkerPercent(x) {
  return insetPercent(roomXToPercent(x));
}

function roomZToMarkerPercent(z) {
  return insetPercent(roomZToPercent(z));
}

function buildMuseum(scene, frames, interactables, wallpaper) {
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

  const wallTexture = createWallpaperTexture(wallpaper);
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: wallTexture,
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
  addBench(scene, interactables);
  addPaintings(scene, frames, interactables);
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

function addPaintings(scene, frames, interactables) {
  const loader = new THREE.TextureLoader();

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

function addBench(scene, interactables) {
  const group = new THREE.Group();
  group.position.set(ROOM.minX * SCALE + 0.52, 0, 1.55);
  group.rotation.y = Math.PI / 2;

  const wood = new THREE.MeshStandardMaterial({
    color: "#8c5630",
    roughness: 0.58,
    metalness: 0.03,
  });
  const darkWood = new THREE.MeshStandardMaterial({
    color: "#5d381f",
    roughness: 0.64,
    metalness: 0.02,
  });
  const metal = new THREE.MeshStandardMaterial({
    color: "#24211f",
    roughness: 0.46,
    metalness: 0.45,
  });

  const makePart = (geometry, material, position, interactive = false) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (interactive) {
      mesh.userData.kind = "bench";
      interactables.push(mesh);
    }
    group.add(mesh);
    return mesh;
  };

  makePart(new THREE.BoxGeometry(2.35, 0.16, 0.68), wood, [0, 0.52, 0], true);
  makePart(new THREE.BoxGeometry(2.42, 0.64, 0.14), darkWood, [0, 0.88, 0.36], true);
  makePart(new THREE.BoxGeometry(2.28, 0.08, 0.08), darkWood, [0, 0.64, -0.34], true);

  const legGeometry = new THREE.BoxGeometry(0.1, 0.48, 0.1);
  [
    [-0.96, 0.25, -0.22],
    [0.96, 0.25, -0.22],
    [-0.96, 0.25, 0.22],
    [0.96, 0.25, 0.22],
  ].forEach((position) => makePart(legGeometry, metal, position));

  const footGeometry = new THREE.BoxGeometry(0.28, 0.05, 0.14);
  [
    [-0.96, 0.03, -0.22],
    [0.96, 0.03, -0.22],
    [-0.96, 0.03, 0.22],
    [0.96, 0.03, 0.22],
  ].forEach((position) => makePart(footGeometry, metal, position));

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.75, 1.15),
    new THREE.MeshBasicMaterial({
      color: "#3a2618",
      transparent: true,
      opacity: 0.11,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  group.add(shadow);

  scene.add(group);
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

function resolveArtworkSrc(imagePath) {
  if (!imagePath) return "";
  if (imagePath.startsWith("/puzzle-images/")) return imagePath;
  if (imagePath.startsWith("/")) return imagePath;

  const filename = imagePath.split("/").pop();
  return `/puzzle-images/${filename}`;
}

function createWallpaperTexture(wallpaper) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext("2d");

  if (wallpaper === "damask") {
    drawDamaskWallpaper(context, canvas);
  } else if (wallpaper === "art-nouveau") {
    drawArtNouveauWallpaper(context, canvas);
  } else if (wallpaper === "icons") {
    drawIconWallpaperBase(context, canvas);
  } else {
    drawBotanicalWallpaper(context, canvas);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.4, 1.8);

  if (wallpaper === "icons") {
    hydrateIconWallpaper(context, canvas, texture);
  }

  return texture;
}

function drawIconWallpaperBase(context, canvas) {
  const background = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  background.addColorStop(0, "#f1eadf");
  background.addColorStop(0.46, "#e8dccb");
  background.addColorStop(1, "#f3ecdf");
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "rgba(116, 91, 61, 0.035)";
  for (let speck = 0; speck < 1400; speck += 1) {
    const x = (speck * 193) % canvas.width;
    const y = (speck * 389) % canvas.height;
    const size = 0.6 + ((speck * 17) % 13) / 10;
    context.fillRect(x, y, size, size);
  }

  context.strokeStyle = "rgba(255, 253, 248, 0.18)";
  context.lineWidth = 1;
  for (let y = 0; y < canvas.height; y += 96) {
    context.beginPath();
    context.moveTo(0, y + ((y / 96) % 2) * 9);
    for (let x = 0; x <= canvas.width; x += 128) {
      context.lineTo(x, y + Math.sin(x * 0.012 + y * 0.018) * 4);
    }
    context.stroke();
  }
}

function hydrateIconWallpaper(context, canvas, texture) {
  MENU_ICON_PATHS.forEach((icon, index) => {
    const image = new Image();
    image.onload = () => {
      drawWallpaperIconGrid(context, canvas, image, index);
      texture.needsUpdate = true;
    };
    image.src = icon;
  });
}

function drawWallpaperIconGrid(context, canvas, image, index) {
  const placements = [
    { x: 74, y: 96, size: 42, rotation: -0.16, alpha: 0.2 },
    { x: 286, y: 58, size: 34, rotation: 0.1, alpha: 0.16 },
    { x: 516, y: 128, size: 48, rotation: -0.05, alpha: 0.22 },
    { x: 812, y: 78, size: 38, rotation: 0.18, alpha: 0.18 },
    { x: 164, y: 302, size: 52, rotation: 0.08, alpha: 0.22 },
    { x: 410, y: 248, size: 36, rotation: -0.22, alpha: 0.17 },
    { x: 696, y: 336, size: 44, rotation: 0.13, alpha: 0.2 },
    { x: 922, y: 268, size: 32, rotation: -0.1, alpha: 0.15 },
    { x: 82, y: 560, size: 36, rotation: 0.22, alpha: 0.17 },
    { x: 338, y: 502, size: 46, rotation: -0.12, alpha: 0.21 },
    { x: 604, y: 610, size: 40, rotation: 0.04, alpha: 0.18 },
    { x: 864, y: 552, size: 54, rotation: -0.18, alpha: 0.23 },
    { x: 206, y: 804, size: 40, rotation: 0.12, alpha: 0.19 },
    { x: 472, y: 744, size: 54, rotation: -0.02, alpha: 0.22 },
    { x: 746, y: 858, size: 36, rotation: 0.2, alpha: 0.16 },
    { x: 958, y: 774, size: 44, rotation: -0.09, alpha: 0.2 },
  ];

  context.save();

  placements
    .filter((_, placementIndex) => placementIndex % MENU_ICON_PATHS.length === index)
    .forEach((placement) => {
      context.save();
      context.globalAlpha = placement.alpha;
      context.translate(placement.x, placement.y);
      context.rotate(placement.rotation);
      context.drawImage(image, -placement.size / 2, -placement.size / 2, placement.size, placement.size);
      context.restore();
    });

  context.restore();
}

function drawBotanicalWallpaper(context, canvas) {
  context.fillStyle = "#efe8dc";
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 48; y < canvas.height; y += 160) {
    for (let x = 48; x < canvas.width; x += 144) {
      const shift = ((x + y) / 48) % 2 === 0 ? 0 : 42;
      drawBotanicalSprig(context, x + shift, y);
    }
  }

  context.fillStyle = "rgba(91, 74, 54, 0.06)";
  for (let dot = 0; dot < 220; dot += 1) {
    const x = (dot * 97) % canvas.width;
    const y = (dot * 173) % canvas.height;
    context.fillRect(x, y, 1.5, 1.5);
  }
}

function drawBotanicalSprig(context, x, y) {
  context.save();
  context.translate(x, y);
  context.strokeStyle = "rgba(65, 76, 51, 0.26)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(0, 54);
  context.bezierCurveTo(18, 22, -12, 12, 8, -28);
  context.stroke();

  for (let leaf = 0; leaf < 5; leaf += 1) {
    const leafY = 38 - leaf * 18;
    const side = leaf % 2 === 0 ? 1 : -1;
    context.beginPath();
    context.ellipse(side * 13, leafY, 16, 5.5, side * -0.45, 0, Math.PI * 2);
    context.stroke();
  }

  context.restore();
}

function drawDamaskWallpaper(context, canvas) {
  context.fillStyle = "#2d4638";
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < canvas.height; y += 256) {
    for (let x = 0; x < canvas.width; x += 256) {
      drawDamaskMedallion(context, x + 128, y + 128);
    }
  }

  const shade = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  shade.addColorStop(0, "rgba(255,255,255,0.08)");
  shade.addColorStop(0.5, "rgba(17,34,26,0.1)");
  shade.addColorStop(1, "rgba(6,18,13,0.26)");
  context.fillStyle = shade;
  context.fillRect(0, 0, canvas.width, canvas.height);
}

function drawDamaskMedallion(context, x, y) {
  context.save();
  context.translate(x, y);
  context.strokeStyle = "rgba(222, 213, 183, 0.2)";
  context.fillStyle = "rgba(222, 213, 183, 0.07)";
  context.lineWidth = 3;

  for (let side = -1; side <= 1; side += 2) {
    context.beginPath();
    context.moveTo(0, -88);
    context.bezierCurveTo(side * 72, -58, side * 64, 22, 0, 88);
    context.bezierCurveTo(side * 28, 28, side * 28, -32, 0, -88);
    context.fill();
    context.stroke();
  }

  context.beginPath();
  context.ellipse(0, 0, 34, 88, 0, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawArtNouveauWallpaper(context, canvas) {
  context.fillStyle = "#e7d7c7";
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = -20; y < canvas.height + 80; y += 170) {
    for (let x = 0; x < canvas.width + 120; x += 128) {
      drawArtNouveauArch(context, x, y);
    }
  }

  context.strokeStyle = "rgba(141, 82, 62, 0.15)";
  context.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 64) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.stroke();
  }
}

function drawArtNouveauArch(context, x, y) {
  context.save();
  context.translate(x, y);
  context.strokeStyle = "rgba(182, 136, 55, 0.46)";
  context.lineWidth = 4;

  for (let arch = 0; arch < 3; arch += 1) {
    const radius = 58 - arch * 15;
    context.beginPath();
    context.arc(64, 94, radius, Math.PI, 0);
    context.lineTo(64 + radius, 166);
    context.moveTo(64 - radius, 94);
    context.lineTo(64 - radius, 166);
    context.stroke();
  }

  context.fillStyle = "rgba(151, 88, 64, 0.12)";
  context.fillRect(24, 166, 80, 8);
  context.restore();
}

function createFloorTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 2048;
  const context = canvas.getContext("2d");

  const plankHeight = 132;
  const plankLength = 620;
  const colors = ["#8b5a34", "#9a653c", "#734727", "#aa7144", "#8f5c35", "#684225", "#a46a3d"];

  context.fillStyle = "#7b4b2b";
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < Math.ceil(canvas.height / plankHeight); row += 1) {
    const y = row * plankHeight;
    const offset = (row % 3) * Math.round(plankLength / 3);

    for (let x = -offset; x < canvas.width; x += plankLength) {
      const color = colors[(row + Math.floor((x + offset) / plankLength)) % colors.length];
      const gradient = context.createLinearGradient(x, y, x, y + plankHeight);
      gradient.addColorStop(0, lightenHex(color, 20));
      gradient.addColorStop(0.18, color);
      gradient.addColorStop(0.55, lightenHex(color, -10));
      gradient.addColorStop(1, lightenHex(color, 12));

      context.fillStyle = gradient;
      context.fillRect(x, y, plankLength, plankHeight);

      context.strokeStyle = "rgba(37, 21, 12, 0.58)";
      context.lineWidth = 4;
      context.strokeRect(x + 1, y + 1, plankLength - 2, plankHeight - 2);

      drawWoodGrain(context, x, y, plankLength, plankHeight, row);
    }
  }

  const vignette = context.createRadialGradient(1024, 860, 180, 1024, 1024, 1200);
  vignette.addColorStop(0, "rgba(255, 232, 184, 0.18)");
  vignette.addColorStop(0.56, "rgba(74, 42, 24, 0.08)");
  vignette.addColorStop(1, "rgba(28, 16, 10, 0.32)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.2, 2.4);
  return texture;
}

function drawWoodGrain(context, x, y, width, height, seed) {
  context.save();
  context.beginPath();
  context.rect(x + 6, y + 6, width - 12, height - 12);
  context.clip();

  context.globalCompositeOperation = "multiply";
  context.fillStyle = "rgba(44, 24, 12, 0.025)";
  for (let pore = 0; pore < 90; pore += 1) {
    const poreX = x + ((pore * 47 + seed * 31) % Math.max(1, width));
    const poreY = y + ((pore * 19 + seed * 43) % Math.max(1, height));
    const poreWidth = 8 + ((pore * 7 + seed) % 26);
    context.fillRect(poreX, poreY, poreWidth, 1);
  }

  for (let line = 0; line < 18; line += 1) {
    const lineY = y + 12 + ((line * 13 + seed * 11) % Math.max(1, height - 24));
    context.beginPath();
    context.moveTo(x + 18, lineY);

    for (let step = 1; step <= 9; step += 1) {
      const controlX = x + step * (width / 9) - width / 18;
      const controlY = lineY + Math.sin((step + seed + line) * 1.23) * 5 + Math.cos((seed + line) * 0.71) * 2;
      const nextX = x + step * (width / 9);
      const nextY = lineY + Math.cos((step * 1.9 + seed + line) * 0.83) * 4;
      context.quadraticCurveTo(controlX, controlY, nextX, nextY);
    }

    context.strokeStyle = line % 4 === 0 ? "rgba(255, 218, 160, 0.1)" : "rgba(48, 27, 14, 0.18)";
    context.lineWidth = line % 4 === 0 ? 1.4 : 0.9;
    context.stroke();
  }

  context.globalCompositeOperation = "screen";
  context.strokeStyle = "rgba(255, 229, 185, 0.1)";
  context.lineWidth = 1;
  for (let highlight = 0; highlight < 5; highlight += 1) {
    const highlightY = y + 18 + ((highlight * 23 + seed * 17) % Math.max(1, height - 36));
    context.beginPath();
    context.moveTo(x + 24, highlightY);
    context.lineTo(x + width - 24, highlightY + Math.sin((seed + highlight) * 1.4) * 3);
    context.stroke();
  }

  context.restore();
}

function lightenHex(hex, amount) {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (value >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((value >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (value & 255) + amount));
  return `rgb(${r}, ${g}, ${b})`;
}
