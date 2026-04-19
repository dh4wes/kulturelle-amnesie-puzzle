import test from "node:test";
import assert from "node:assert/strict";

import {
  createSolvedBoard,
  isSolved,
  shuffleBoard,
} from "../src/puzzle/logic.js";
import {
  getAvailablePuzzleImages,
  pickRandomPuzzleImage,
} from "../src/puzzle/imageManifest.js";
import {
  clampPlayerPosition,
  createGalleryFrames,
  stepPlayer,
} from "../src/gallery/logic.js";

test("shuffleBoard returns an unsolved yet reachable state", () => {
  const board = shuffleBoard(4, () => 0.2, 80);

  assert.equal(board.tiles.length, 16);
  assert.equal(isSolved(board.tiles), false);
  assert.equal(board.moves, 0);
  assert.deepEqual([...board.tiles].sort((a, b) => a - b), [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
  ]);
});

test("isSolved detects solved and unsolved boards", () => {
  assert.equal(isSolved(createSolvedBoard(3).tiles), true);
  assert.equal(isSolved([1, 2, 3, 4, 5, 6, 7, 0, 8]), false);
});

test("random image selection picks from the available manifest", () => {
  const available = getAvailablePuzzleImages([
    "/puzzle-images/a.jpg",
    "/puzzle-images/b.webp",
    "/puzzle-images/c.txt",
  ]);

  assert.deepEqual(available, [
    "/puzzle-images/a.jpg",
    "/puzzle-images/b.webp",
  ]);
  assert.equal(pickRandomPuzzleImage(available, () => 0), "/puzzle-images/a.jpg");
  assert.equal(pickRandomPuzzleImage(available, () => 0.9999), "/puzzle-images/b.webp");
});

test("gallery movement stays inside the room bounds", () => {
  const room = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
  const next = stepPlayer(
    { x: 9, z: 9, rotation: 0 },
    { forward: true, backward: false, left: false, right: false, turnLeft: false, turnRight: false },
    100,
    room,
  );

  assert.deepEqual(clampPlayerPosition(next, room), next);
  assert.equal(next.z, 10);
});

test("gallery horizontal turn controls match the facing direction", () => {
  const room = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
  const start = { x: 0, z: 0, rotation: Math.PI };

  const right = stepPlayer(
    start,
    { forward: false, backward: false, left: false, right: false, turnLeft: false, turnRight: true },
    100,
    room,
  );
  const left = stepPlayer(
    start,
    { forward: false, backward: false, left: false, right: false, turnLeft: true, turnRight: false },
    100,
    room,
  );

  assert.ok(right.rotation < start.rotation);
  assert.ok(left.rotation > start.rotation);
});

test("gallery frame layout assigns positions to all available images", () => {
  const frames = createGalleryFrames([
    "public/puzzle-images/one.jpg",
    "public/puzzle-images/two.jpg",
    "public/puzzle-images/three.jpg",
  ]);

  assert.equal(frames.length, 3);
  assert.equal(frames[0].wall, "front");
  assert.equal(frames[2].wall, "left");
  assert.equal(frames[1].label, "two.jpg");
});
