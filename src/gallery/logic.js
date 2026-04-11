const TURN_SPEED = Math.PI * 0.0014;
const MOVE_SPEED = 0.42;

export function clampPlayerPosition(position, room) {
  return {
    x: clamp(position.x, room.minX, room.maxX),
    z: clamp(position.z, room.minZ, room.maxZ),
    rotation: normalizeAngle(position.rotation),
  };
}

export function stepPlayer(position, input, deltaMs, room) {
  const rotationDelta =
    ((input.turnRight ? 1 : 0) - (input.turnLeft ? 1 : 0)) * TURN_SPEED * deltaMs;
  const rotation = normalizeAngle(position.rotation + rotationDelta);
  const travel = MOVE_SPEED * deltaMs;

  let x = position.x;
  let z = position.z;

  const forward = (input.forward ? 1 : 0) - (input.backward ? 1 : 0);
  const strafe = (input.right ? 1 : 0) - (input.left ? 1 : 0);

  if (forward !== 0) {
    x += Math.sin(rotation) * travel * forward;
    z += Math.cos(rotation) * travel * forward;
  }

  if (strafe !== 0) {
    x += Math.sin(rotation + Math.PI / 2) * travel * strafe;
    z += Math.cos(rotation + Math.PI / 2) * travel * strafe;
  }

  return clampPlayerPosition({ x, z, rotation }, room);
}

export function createGalleryFrames(images) {
  const positions = [
    { wall: "front", x: -250, y: 155, z: -900, rotateY: 0 },
    { wall: "front", x: 250, y: 155, z: -900, rotateY: 0 },
    { wall: "left", x: -620, y: 155, z: -360, rotateY: 90 },
    { wall: "left", x: -620, y: 155, z: 360, rotateY: 90 },
    { wall: "right", x: 620, y: 155, z: -360, rotateY: -90 },
    { wall: "right", x: 620, y: 155, z: 360, rotateY: -90 },
    { wall: "back", x: 0, y: 155, z: 900, rotateY: 180 },
  ];

  return images.map((image, index) => ({
    id: index + 1,
    image,
    label: image.split("/").pop(),
    ...positions[index % positions.length],
  }));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeAngle(value) {
  const fullTurn = Math.PI * 2;
  return ((value % fullTurn) + fullTurn) % fullTurn;
}
