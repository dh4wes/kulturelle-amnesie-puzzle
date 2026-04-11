export function createSolvedBoard(size) {
  const tiles = Array.from({ length: size * size }, (_, index) =>
    index === size * size - 1 ? 0 : index + 1,
  );

  return {
    size,
    tiles,
    moves: 0,
  };
}

export function getEmptyIndex(tiles) {
  return tiles.indexOf(0);
}

export function getValidNeighborIndices(index, size) {
  const row = Math.floor(index / size);
  const col = index % size;
  const neighbors = [];

  if (row > 0) neighbors.push(index - size);
  if (row < size - 1) neighbors.push(index + size);
  if (col > 0) neighbors.push(index - 1);
  if (col < size - 1) neighbors.push(index + 1);

  return neighbors;
}

export function canMoveTile(tiles, size, tileIndex) {
  const emptyIndex = getEmptyIndex(tiles);
  return getValidNeighborIndices(emptyIndex, size).includes(tileIndex);
}

export function moveTile(board, tileIndex) {
  if (!canMoveTile(board.tiles, board.size, tileIndex)) {
    return board;
  }

  const nextTiles = [...board.tiles];
  const emptyIndex = getEmptyIndex(nextTiles);
  [nextTiles[emptyIndex], nextTiles[tileIndex]] = [nextTiles[tileIndex], nextTiles[emptyIndex]];

  return {
    ...board,
    tiles: nextTiles,
    moves: board.moves + 1,
  };
}

export function isSolved(tiles) {
  // Solved-state detection is a strict positional check with the empty slot last.
  return tiles.every((value, index) => {
    if (index === tiles.length - 1) {
      return value === 0;
    }

    return value === index + 1;
  });
}

export function shuffleBoard(size, random = Math.random, moveCount = size * size * 30) {
  // Start from solved and apply legal moves so the result is always reachable.
  let board = createSolvedBoard(size);
  let previousEmptyIndex = -1;

  for (let step = 0; step < moveCount; step += 1) {
    const emptyIndex = getEmptyIndex(board.tiles);
    const candidates = getValidNeighborIndices(emptyIndex, size).filter(
      (candidate) => candidate !== previousEmptyIndex,
    );
    const pool = candidates.length ? candidates : getValidNeighborIndices(emptyIndex, size);
    const nextTileIndex = pool[Math.floor(random() * pool.length)];
    previousEmptyIndex = emptyIndex;
    board = moveTile(board, nextTileIndex);
  }

  if (isSolved(board.tiles)) {
    return shuffleBoard(size, random, moveCount + size);
  }

  return {
    ...board,
    moves: 0,
  };
}

export function getTileBackgroundPosition(tileValue, size) {
  const index = tileValue - 1;
  const row = Math.floor(index / size);
  const col = index % size;

  return {
    x: `${(col / (size - 1 || 1)) * 100}%`,
    y: `${(row / (size - 1 || 1)) * 100}%`,
  };
}

export function getMoveTargetFromKey(key, board) {
  const emptyIndex = getEmptyIndex(board.tiles);
  const size = board.size;

  switch (key) {
    case "ArrowUp":
    case "w":
    case "W":
      return emptyIndex + size < board.tiles.length ? emptyIndex + size : null;
    case "ArrowDown":
    case "s":
    case "S":
      return emptyIndex - size >= 0 ? emptyIndex - size : null;
    case "ArrowLeft":
    case "a":
    case "A":
      return emptyIndex + 1 < board.tiles.length && emptyIndex % size !== size - 1
        ? emptyIndex + 1
        : null;
    case "ArrowRight":
    case "d":
    case "D":
      return emptyIndex - 1 >= 0 && emptyIndex % size !== 0 ? emptyIndex - 1 : null;
    default:
      return null;
  }
}
