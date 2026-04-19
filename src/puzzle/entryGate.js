import {
  EXPECTED_PUZZLE_IMAGE_COUNT,
  getAvailablePuzzleImages,
  pickRandomPuzzleImage,
} from "./imageManifest.js";
import { loadAndCropToSquare } from "./imageProcessing.js";
import {
  canMoveTile,
  getMoveTargetFromKey,
  getTileBackgroundPosition,
  isSolved,
  moveTile,
  shuffleBoard,
} from "./logic.js";

const SESSION_FLAG = "__kulturelle_amnesie_gate_open__";
const MOBILE_MEDIA = "(max-width: 479px)";
const SOLVED_HOLD_MS = 5000;
const SITE_FALLBACK_URL = "https://webauftritt.vercel.app";

export async function initEntryGate(options = {}) {
  const { onSolved } = options;

  if (window[SESSION_FLAG]) {
    unlockPageShell();
    onSolved?.();
    return;
  }

  const images = getAvailablePuzzleImages();
  if (images.length !== EXPECTED_PUZZLE_IMAGE_COUNT) {
    console.warn(
      `[entry-gate] Expected ${EXPECTED_PUZZLE_IMAGE_COUNT} puzzle images but found ${images.length}. Using available assets.`,
    );
  }

  if (!images.length) {
    console.warn("[entry-gate] No puzzle images found. Entry gate skipped.");
    unlockPageShell();
    return;
  }

  const root = document.getElementById("entry-gate-root");
  const pageShell = document.querySelector(".page-shell");
  const size = window.matchMedia(MOBILE_MEDIA).matches ? 3 : 4;

  lockPageShell(pageShell);

  try {
    const { sourceUrl, croppedUrl } = await pickAndPrepareImage(images);
    const gate = createGateElement();
    root.replaceChildren(gate);

    const puzzleArea = gate.querySelector("[data-puzzle-area]");
    const boardElement = gate.querySelector("[data-puzzle-board]");
    const statusElement = gate.querySelector("[data-status]");
    const infoToggle = gate.querySelector("[data-info-toggle]");
    const infoOverlay = gate.querySelector("[data-info-overlay]");
    const infoClose = gate.querySelector("[data-info-close]");
    const referenceToggle = gate.querySelector("[data-reference-toggle]");
    const referenceFrame = gate.querySelector("[data-reference-frame]");
    const referenceImage = gate.querySelector("[data-reference-image]");
    const shuffleButton = gate.querySelector("[data-shuffle]");
    const bypassStar = gate.querySelector("[data-bypass-star]");
    const bypassDialog = gate.querySelector("[data-bypass-dialog]");
    const bypassYes = gate.querySelector("[data-bypass-yes]");
    const bypassNo = gate.querySelector("[data-bypass-no]");

    let board = shuffleBoard(size);
    let solved = false;

    referenceImage.src = croppedUrl;
    referenceImage.alt = "Referenzansicht des gewählten Puzzlebildes";

    const announceStatus = (message = "") => {
      statusElement.textContent = message;
    };

    const renderBoard = () => {
      boardElement.style.gridTemplateColumns = `repeat(${board.size}, minmax(0, 1fr))`;
      boardElement.style.setProperty("--solved-image", `url('${croppedUrl}')`);
      boardElement.setAttribute("aria-label", `${board.size} mal ${board.size} Schiebepuzzle`);
      boardElement.dataset.solved = String(solved);
      boardElement.innerHTML = "";

      board.tiles.forEach((tileValue, index) => {
        if (tileValue === 0) {
          const empty = document.createElement("div");
          empty.className = "puzzle-empty";
          empty.setAttribute("aria-hidden", "true");
          boardElement.appendChild(empty);
          return;
        }

        const button = document.createElement("button");
        const tilePosition = getTileBackgroundPosition(tileValue, board.size);
        const movable = canMoveTile(board.tiles, board.size, index);

        button.type = "button";
        button.className = "puzzle-tile";
        button.style.backgroundImage = `url('${croppedUrl}')`;
        button.style.backgroundSize = `${board.size * 100}% ${board.size * 100}%`;
        button.style.backgroundPosition = `${tilePosition.x} ${tilePosition.y}`;
        button.disabled = solved;
        button.dataset.correct = String(tileValue === index + 1);
        button.setAttribute(
          "aria-label",
          movable
            ? `Kachel ${tileValue} verschieben`
            : `Kachel ${tileValue} liegt nicht neben dem leeren Feld`,
        );
        button.addEventListener("click", () => handleTileMove(index));

        boardElement.appendChild(button);
      });
    };

    const finishGate = () => {
      solved = true;
      bypassDialog.hidden = true;
      renderBoard();
      announceStatus("Gelöst. Die Galerie öffnet sich gleich.");

      setTimeout(() => {
        gate.classList.add("is-hiding");
      }, SOLVED_HOLD_MS);

      gate.addEventListener(
        "transitionend",
        () => {
          root.replaceChildren();
          window[SESSION_FLAG] = true;
          unlockPageShell(pageShell);
          onSolved?.();
        },
        { once: true },
      );
    };

    const handleTileMove = (tileIndex) => {
      if (solved) return;

      const nextBoard = moveTile(board, tileIndex);
      if (nextBoard === board) {
        announceStatus("Nur Kacheln neben dem leeren Feld können bewegt werden.");
        return;
      }

      board = nextBoard;
      renderBoard();
      announceStatus("");

      if (isSolved(board.tiles)) {
        finishGate();
      }
    };

    const handleShuffle = () => {
      board = shuffleBoard(size);
      solved = false;
      renderBoard();
      announceStatus("Puzzle neu gemischt.");
    };

    const openInfoOverlay = () => {
      infoOverlay.hidden = false;
      infoToggle.setAttribute("aria-expanded", "true");
      infoClose.focus();
    };

    const closeInfoOverlay = () => {
      infoOverlay.hidden = true;
      infoToggle.setAttribute("aria-expanded", "false");
      infoToggle.focus();
    };

    const updatePuzzleViewingAngle = (event) => {
      if (solved || !puzzleArea) return;

      const bounds = puzzleArea.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      const rotateX = clampNumber(8 - y * 18, -8, 18);
      const rotateY = clampNumber(-6 + x * 22, -18, 14);

      boardElement.dataset.viewing = "true";
      boardElement.style.setProperty("--puzzle-rotate-x", `${rotateX.toFixed(2)}deg`);
      boardElement.style.setProperty("--puzzle-rotate-y", `${rotateY.toFixed(2)}deg`);
    };

    const resetPuzzleViewingAngle = () => {
      boardElement.dataset.viewing = "false";
      boardElement.style.removeProperty("--puzzle-rotate-x");
      boardElement.style.removeProperty("--puzzle-rotate-y");
    };

    gate.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !infoOverlay.hidden) {
        closeInfoOverlay();
        return;
      }

      if (!infoOverlay.hidden) {
        return;
      }

      const tileIndex = getMoveTargetFromKey(event.key, board);
      if (tileIndex === null) return;

      event.preventDefault();
      handleTileMove(tileIndex);
    });

    referenceToggle.addEventListener("change", () => {
      referenceFrame.hidden = !referenceToggle.checked;
    });

    puzzleArea?.addEventListener("pointermove", updatePuzzleViewingAngle);
    puzzleArea?.addEventListener("pointerleave", resetPuzzleViewingAngle);
    puzzleArea?.addEventListener("pointercancel", resetPuzzleViewingAngle);
    infoToggle.addEventListener("click", openInfoOverlay);
    infoClose.addEventListener("click", closeInfoOverlay);
    infoOverlay.addEventListener("click", (event) => {
      if (event.target === infoOverlay) {
        closeInfoOverlay();
      }
    });
    shuffleButton.addEventListener("click", handleShuffle);
    bypassStar.addEventListener("click", () => {
      const nextHidden = !bypassDialog.hidden;
      bypassDialog.hidden = nextHidden;
      if (!nextHidden) {
        bypassYes.focus();
      }
    });
    bypassYes.addEventListener("click", () => {
      announceStatus("Galerie wird ohne Lösen geöffnet.");
      finishGate();
    });
    bypassNo.addEventListener("click", () => {
      bypassDialog.hidden = true;
      bypassStar.focus();
    });

    renderBoard();
    announceStatus("");
    gate.focus();
  } catch (error) {
    console.warn(`[entry-gate] ${error.message}`);
    unlockPageShell(pageShell);
    root.replaceChildren();
  }
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

async function pickAndPrepareImage(images) {
  const remaining = [...images];

  while (remaining.length) {
    const nextSource = pickRandomPuzzleImage(remaining);
    const candidateIndex = remaining.indexOf(nextSource);

    try {
      const croppedUrl = await loadAndCropToSquare(nextSource);
      return {
        sourceUrl: nextSource,
        croppedUrl,
      };
    } catch (error) {
      console.warn(`[entry-gate] ${error.message}. Trying another image.`);
      remaining.splice(candidateIndex, 1);
    }
  }

  throw new Error("Every available puzzle image failed to load.");
}

function lockPageShell(pageShell) {
  document.body.classList.add("gate-locked");
  if (pageShell) {
    pageShell.setAttribute("aria-hidden", "true");
    pageShell.inert = true;
  }
}

function unlockPageShell(pageShell) {
  document.body.classList.remove("gate-locked");
  if (pageShell) {
    pageShell.removeAttribute("aria-hidden");
    pageShell.inert = false;
  }
}

function createGateElement() {
  const gate = document.createElement("section");
  gate.className = "entry-gate";
  gate.tabIndex = -1;
  gate.setAttribute("aria-label", "Puzzle");

  gate.innerHTML = `
    <h1 class="gate-title">Nicole Grundhöfer</h1>

    <button
      type="button"
      class="bypass-star"
      data-bypass-star
      aria-label="Bestätigung zum Betreten ohne Lösen öffnen"
      aria-controls="bypass-dialog"
    >✦</button>

    <div class="bypass-dialog" id="bypass-dialog" data-bypass-dialog hidden>
      <p>Ohne Lösen eintreten?</p>
      <div class="bypass-actions">
        <button type="button" class="button" data-bypass-yes>Ja</button>
        <button type="button" class="button" data-bypass-no>Nein</button>
      </div>
    </div>

    <div class="entry-card">
      <div class="puzzle-area" data-puzzle-area>
        <div
          class="puzzle-board"
          data-puzzle-board
          role="group"
          aria-describedby="entry-gate-status"
        ></div>
        <p id="entry-gate-status" class="puzzle-status" data-status aria-live="polite"></p>
      </div>

      <button
        type="button"
        class="gate-info-wave"
        data-info-toggle
        aria-label="Puzzle-Hinweise öffnen"
        aria-expanded="false"
        aria-controls="entry-gate-info"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      <div class="gate-info-overlay" data-info-overlay hidden>
        <div
          class="control-panel gate-info-card"
          id="entry-gate-info"
          role="dialog"
          aria-modal="true"
          aria-labelledby="entry-gate-title"
        >
          <button type="button" class="gate-info-close" data-info-close aria-label="Puzzle-Hinweise schließen">×</button>
          <div>
            <h2 id="entry-gate-title">Löse das Puzzle, um einzutreten</h2>
            <p id="entry-gate-help">Setze das Bild wieder zusammen oder nutze den Stern zum Überspringen.</p>
          </div>

          <div class="controls">
            <label class="toggle">
              <input type="checkbox" data-reference-toggle />
              <span>Referenz zeigen</span>
            </label>
            <button type="button" class="button" data-shuffle>Neu mischen</button>
          </div>

          <div class="reference-frame" data-reference-frame hidden>
            <img data-reference-image alt="" />
          </div>

          <p class="gate-note">
            Verschiebe die Kacheln, bis das Bild vollständig ist. Danach öffnet sich
            die Galerie.
          </p>
        </div>
      </div>
    </div>
  `;

  return gate;
}

function resolveSitePageHref(path) {
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

  return new URL(path, baseUrl).toString();
}
