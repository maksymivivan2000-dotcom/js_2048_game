'use strict';

const ANIMATION_DURATION = 120;
const EFFECT_DURATION = 120;

const GameClass = window.Game;

if (!GameClass) {
  throw new Error('Game class is not available');
}

const game = new GameClass();
const boardElement = document.querySelector('.game-board');
const tileLayer = document.querySelector('.tile-layer');
const cells = Array.from(document.querySelectorAll('.field-cell'));
const scoreElement = document.querySelector('.game-score');
const button = document.querySelector('.button');
const startMessage = document.querySelector('.message-start');
const winMessage = document.querySelector('.message-win');
const loseMessage = document.querySelector('.message-lose');
let isAnimating = false;
let moveTimeoutId = 0;
let effectTimeoutId = 0;

function getPositionKey(row, col) {
  return `${row}:${col}`;
}

function setButtonMode(mode) {
  const isStart = mode === 'start';

  button.classList.toggle('start', isStart);
  button.classList.toggle('restart', !isStart);
  button.textContent = isStart ? 'Start' : 'Restart';
}

function hideAllMessages() {
  startMessage.classList.add('hidden');
  winMessage.classList.add('hidden');
  loseMessage.classList.add('hidden');
}

function clearValueClass(cell) {
  const classNames = Array.from(cell.classList);

  for (const className of classNames) {
    if (className.startsWith('field-cell--')) {
      cell.classList.remove(className);
    }
  }
}

function renderBoard(state = game.getState(), hiddenPositions = new Set()) {
  state.flat().forEach((value, index) => {
    const cell = cells[index];
    const row = Math.floor(index / 4);
    const col = index % 4;
    const isHidden = hiddenPositions.has(getPositionKey(row, col));

    clearValueClass(cell);
    cell.textContent = value === 0 || isHidden ? '' : value;

    if (value > 0 && !isHidden) {
      cell.classList.add(`field-cell--${value}`);
    }
  });
}

function renderStatus() {
  const gameStatus = game.getStatus();

  hideAllMessages();

  if (gameStatus === 'idle') {
    startMessage.classList.remove('hidden');
  }

  if (gameStatus === 'win') {
    winMessage.classList.remove('hidden');
  }

  if (gameStatus === 'lose') {
    loseMessage.classList.remove('hidden');
  }
}

function render() {
  scoreElement.textContent = game.getScore();
  renderBoard();
  renderStatus();
}

function renderScoreAndStatus() {
  scoreElement.textContent = game.getScore();
  renderStatus();
}

function clearTileLayer() {
  tileLayer.innerHTML = '';
}

function finishAnimation() {
  window.clearTimeout(moveTimeoutId);
  window.clearTimeout(effectTimeoutId);
  clearTileLayer();
  renderBoard();
  isAnimating = false;
}

function getCellRect(row, col) {
  const cell = cells[row * 4 + col];
  const boardRect = boardElement.getBoundingClientRect();
  const cellRect = cell.getBoundingClientRect();

  return {
    x: cellRect.left - boardRect.left,
    y: cellRect.top - boardRect.top,
    width: cellRect.width,
    height: cellRect.height,
  };
}

function createTileElement(value, row, col, extraClass = '') {
  const tile = document.createElement('div');
  const content = document.createElement('div');
  const rect = getCellRect(row, col);

  tile.className = 'tile';
  tile.style.width = `${rect.width}px`;
  tile.style.height = `${rect.height}px`;
  tile.style.transform = `translate(${rect.x}px, ${rect.y}px)`;

  content.className = `tile-content field-cell--${value} ${extraClass}`.trim();
  content.textContent = value;
  tile.append(content);

  return tile;
}

function prepareTilesForAnimation(tiles) {
  tiles.forEach((tile) => {
    tile.style.transition = 'none';
    tile.getBoundingClientRect();
    tile.style.transition = '';
  });
}

function getEffectHiddenPositions(moveMeta) {
  const hiddenPositions = new Set();

  moveMeta.merged.forEach(({ row, col }) => {
    hiddenPositions.add(getPositionKey(row, col));
  });

  moveMeta.spawned.forEach(({ row, col }) => {
    hiddenPositions.add(getPositionKey(row, col));
  });

  return hiddenPositions;
}

function getAnimatedTiles(moveMeta) {
  const mergedTargets = new Set(
    moveMeta.merged.map(({ row, col }) => `${row}:${col}`),
  );

  return moveMeta.moved.filter(({ from, to }) => {
    const hasMoved = from.row !== to.row || from.col !== to.col;
    const isMergeTarget = mergedTargets.has(`${to.row}:${to.col}`);

    return hasMoved || isMergeTarget;
  });
}

function animateEffects(moveMeta) {
  const effectTiles = [];

  moveMeta.merged.forEach(({ row, col, value }) => {
    effectTiles.push(createTileElement(value, row, col, 'tile--merge'));
  });

  moveMeta.spawned.forEach(({ row, col, value }) => {
    effectTiles.push(createTileElement(value, row, col, 'tile--new'));
  });

  effectTiles.forEach((tile) => tileLayer.append(tile));

  effectTimeoutId = window.setTimeout(() => {
    clearTileLayer();
    renderBoard();
    isAnimating = false;
  }, EFFECT_DURATION);
}

function animateMove(moveMeta, onMoveEnd) {
  const movingTiles = getAnimatedTiles(moveMeta);

  if (!movingTiles.length) {
    clearTileLayer();
    onMoveEnd(getEffectHiddenPositions(moveMeta));
    animateEffects(moveMeta);

    return;
  }

  movingTiles.forEach(({ from, value }) => {
    tileLayer.append(createTileElement(value, from.row, from.col));
  });

  prepareTilesForAnimation(Array.from(tileLayer.children));

  requestAnimationFrame(() => {
    movingTiles.forEach(({ to }, index) => {
      const tile = tileLayer.children[index];
      const rect = getCellRect(to.row, to.col);

      tile.style.transform = `translate(${rect.x}px, ${rect.y}px)`;
    });
  });

  moveTimeoutId = window.setTimeout(() => {
    clearTileLayer();
    onMoveEnd(getEffectHiddenPositions(moveMeta));
    animateEffects(moveMeta);
  }, ANIMATION_DURATION);
}

function getHiddenPositions(moveMeta) {
  const hiddenPositions = new Set();

  getAnimatedTiles(moveMeta).forEach(({ from }) => {
    hiddenPositions.add(getPositionKey(from.row, from.col));
  });

  moveMeta.spawned.forEach(({ row, col }) => {
    hiddenPositions.add(getPositionKey(row, col));
  });

  return hiddenPositions;
}

function playAnimations(previousState) {
  const moveMeta = game.getLastMove();

  if (!moveMeta.changed) {
    return;
  }

  isAnimating = true;
  clearTileLayer();
  renderBoard(previousState, getHiddenPositions(moveMeta));

  animateMove(moveMeta, (hiddenPositions) => {
    renderBoard(game.getState(), hiddenPositions);
  });
}

function handleMove(key) {
  const moveByKey = {
    ArrowLeft: () => game.moveLeft(),
    ArrowRight: () => game.moveRight(),
    ArrowUp: () => game.moveUp(),
    ArrowDown: () => game.moveDown(),
    a: () => game.moveLeft(),
    A: () => game.moveLeft(),
    d: () => game.moveRight(),
    D: () => game.moveRight(),
    w: () => game.moveUp(),
    W: () => game.moveUp(),
    s: () => game.moveDown(),
    S: () => game.moveDown(),
  };

  const moveAction = moveByKey[key];

  if (!moveAction) {
    return;
  }

  const previousState = game.getState();

  moveAction();

  if (game.getLastMove().changed) {
    setButtonMode('restart');
  }

  renderScoreAndStatus();

  if (game.getLastMove().changed) {
    playAnimations(previousState);
  } else {
    renderBoard();
  }
}

button.addEventListener('click', () => {
  if (button.classList.contains('start')) {
    game.start();
    renderScoreAndStatus();
    playAnimations(Array.from({ length: 4 }, () => Array(4).fill(0)));

    return;
  }

  game.restart();
  finishAnimation();
  setButtonMode('start');
  render();
});

document.addEventListener('keydown', (keyEvent) => {
  const gameStatus = game.getStatus();

  if (gameStatus !== 'playing') {
    return;
  }

  if (isAnimating) {
    finishAnimation();
  }

  handleMove(keyEvent.key);
});

render();
