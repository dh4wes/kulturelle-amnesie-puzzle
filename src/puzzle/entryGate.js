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
const INTRO_OVERLAY_MS = 7000;
const MOBILE_MEDIA = "(max-width: 479px)";
const SOLVED_HOLD_MS = 1200;
const BYPASS_HOLD_MS = 150;
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
    setupIntroOverlay(gate);

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
        button.dataset.movable = String(movable);
        button.dataset.tileValue = String(tileValue);
        button.setAttribute(
          "aria-label",
          movable
            ? `Kachel ${tileValue} verschieben`
            : `Kachel ${tileValue} liegt nicht neben dem leeren Feld`,
        );
        button.addEventListener("click", () => {
          handleTileMoveByValue(tileValue);
        });

        boardElement.appendChild(button);
      });
    };

    const finishGate = ({ holdMs = SOLVED_HOLD_MS } = {}) => {
      solved = true;
      bypassDialog.hidden = true;
      renderBoard();
      announceStatus("Gelöst. Die Galerie öffnet sich gleich.");

      setTimeout(() => {
        unlockPageShell(pageShell);
        onSolved?.();
        gate.classList.add("is-hiding");
      }, holdMs);

      gate.addEventListener(
        "transitionend",
        (event) => {
          if (event.target !== gate) return;
          root.replaceChildren();
          window[SESSION_FLAG] = true;
        },
        { once: true },
      );
    };

    const handleTileMoveByValue = (tileValue) => {
      if (solved) return;

      const tileIndex = board.tiles.indexOf(tileValue);
      if (tileIndex >= 0) {
        handleTileMove(tileIndex);
      }
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
      finishGate({ holdMs: BYPASS_HOLD_MS });
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

function setupIntroOverlay(gate) {
  const overlay = gate.querySelector("[data-intro-overlay]");
  const startLabel = overlay?.querySelector("[data-intro-start-label]");
  const menuLabel = overlay?.querySelector("[data-intro-menu-label]");
  const arrows = overlay?.querySelector("[data-intro-arrows]");
  const startLine = overlay?.querySelector("[data-intro-start-line]");
  const startHead = overlay?.querySelector("[data-intro-start-head]");
  const menuLine = overlay?.querySelector("[data-intro-menu-line]");
  const menuHead = overlay?.querySelector("[data-intro-menu-head]");
  const startTarget = gate.querySelector("[data-bypass-star]");
  const menuTarget = gate.querySelector("[data-info-toggle]");

  if (
    !overlay ||
    !startLabel ||
    !menuLabel ||
    !arrows ||
    !startLine ||
    !startHead ||
    !menuLine ||
    !menuHead ||
    !startTarget ||
    !menuTarget
  ) {
    return;
  }

  const positionOverlay = () => {
    const visualViewport = window.visualViewport;
    const viewportWidth = visualViewport?.width ?? window.innerWidth;
    const viewportHeight = visualViewport?.height ?? window.innerHeight;
    const viewportOffsetLeft = visualViewport?.offsetLeft ?? 0;
    const viewportOffsetTop = visualViewport?.offsetTop ?? 0;
    arrows.setAttribute("viewBox", `0 0 ${viewportWidth} ${viewportHeight}`);

    const startTargetRect = startTarget.getBoundingClientRect();
    const menuTargetRect = menuTarget.getBoundingClientRect();
    const startTargetPoint = getRectCenter(startTargetRect, viewportOffsetLeft, viewportOffsetTop);
    const menuTargetPoint = getRectCenter(menuTargetRect, viewportOffsetLeft, viewportOffsetTop);
    const isMobile = viewportWidth < 520;

    positionLabel(startLabel, {
      x: startTargetPoint.x - (isMobile ? 232 : 350),
      y: startTargetPoint.y + (isMobile ? 30 : 42),
      viewportWidth,
      viewportHeight,
    });
    positionLabel(menuLabel, {
      x: menuTargetPoint.x - (isMobile ? 198 : 300),
      y: menuTargetPoint.y - (isMobile ? 114 : 140),
      viewportWidth,
      viewportHeight,
    });

    const startLabelRect = startLabel.getBoundingClientRect();
    const menuLabelRect = menuLabel.getBoundingClientRect();
    const startAnchor = {
      x: startLabelRect.right - 12,
      y: startLabelRect.top + startLabelRect.height * 0.42,
    };
    const menuAnchor = {
      x: menuLabelRect.right - 8,
      y: menuLabelRect.bottom + 8,
    };

    drawArrow(startLine, startHead, startAnchor, startTargetPoint, {
      x: (startAnchor.x + startTargetPoint.x) * 0.5,
      y: startTargetPoint.y + 34,
    });
    drawArrow(menuLine, menuHead, menuAnchor, menuTargetPoint, {
      x: (menuAnchor.x + menuTargetPoint.x) * 0.55,
      y: menuTargetPoint.y - 34,
    });
  };

  const removeOverlay = () => overlay.remove();
  const schedulePositionOverlay = () => window.requestAnimationFrame(positionOverlay);
  schedulePositionOverlay();
  window.setTimeout(schedulePositionOverlay, 120);
  window.setTimeout(schedulePositionOverlay, 420);
  window.addEventListener("resize", schedulePositionOverlay);
  window.visualViewport?.addEventListener("resize", schedulePositionOverlay);
  window.visualViewport?.addEventListener("scroll", schedulePositionOverlay);
  window.setTimeout(() => {
    overlay.classList.add("is-fading");
    overlay.addEventListener(
      "transitionend",
      () => {
        window.removeEventListener("resize", schedulePositionOverlay);
        window.visualViewport?.removeEventListener("resize", schedulePositionOverlay);
        window.visualViewport?.removeEventListener("scroll", schedulePositionOverlay);
        removeOverlay();
      },
      { once: true },
    );
    window.setTimeout(() => {
      window.removeEventListener("resize", schedulePositionOverlay);
      window.visualViewport?.removeEventListener("resize", schedulePositionOverlay);
      window.visualViewport?.removeEventListener("scroll", schedulePositionOverlay);
      removeOverlay();
    }, 700);
  }, INTRO_OVERLAY_MS);
}

function getRectCenter(rect, viewportOffsetLeft = 0, viewportOffsetTop = 0) {
  return {
    x: rect.left - viewportOffsetLeft + rect.width * 0.5,
    y: rect.top - viewportOffsetTop + rect.height * 0.5,
  };
}

function positionLabel(label, { x, y, viewportWidth, viewportHeight }) {
  const maxWidth = Math.min(viewportWidth - 24, viewportWidth < 520 ? 260 : 360);
  label.style.maxWidth = `${maxWidth}px`;
  const labelWidth = Math.min(label.getBoundingClientRect().width || maxWidth, maxWidth);
  label.style.left = `${Math.min(Math.max(x, 12), viewportWidth - labelWidth - 12)}px`;
  label.style.top = `${Math.min(Math.max(y, 74), viewportHeight - 168)}px`;
}

function drawArrow(line, head, from, to, control) {
  line.setAttribute("d", `M ${from.x} ${from.y} Q ${control.x} ${control.y} ${to.x} ${to.y}`);

  const angle = Math.atan2(to.y - control.y, to.x - control.x);
  const length = 24;
  const spread = 0.72;
  const left = {
    x: to.x - Math.cos(angle - spread) * length,
    y: to.y - Math.sin(angle - spread) * length,
  };
  const right = {
    x: to.x - Math.cos(angle + spread) * length,
    y: to.y - Math.sin(angle + spread) * length,
  };

  head.setAttribute("d", `M ${left.x} ${left.y} L ${to.x} ${to.y} L ${right.x} ${right.y}`);
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

    <div class="gate-intro-overlay" data-intro-overlay aria-hidden="true">
      <svg class="gate-intro-arrows" data-intro-arrows role="presentation" focusable="false">
        <path class="gate-intro-arrow-line" data-intro-start-line />
        <path class="gate-intro-arrow-head" data-intro-start-head />
        <path class="gate-intro-arrow-line" data-intro-menu-line />
        <path class="gate-intro-arrow-head" data-intro-menu-head />
      </svg>
      <div class="gate-intro-note gate-intro-note-start" data-intro-start-label>Schnellstart?</div>
      <div class="gate-intro-note gate-intro-note-menu" data-intro-menu-label>Guck mal hier</div>
    </div>

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
      <div class="puzzle-area">
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
