// Keyboard + mouse state for Lumen Drift. The game reads this every fixed step;
// the module itself never touches game logic, so it stays easy to test.
export function createInput(canvas) {
  const keys = new Set();
  const input = {
    keys,
    mouseX: 640,
    mouseY: 300,
    mouseDown: false,
    // Edge-triggered presses, consumed by the game once per step.
    pressed: new Set(),
    // A click is latched the moment the button goes down, so a fast click
    // can never slip between two slow frames unnoticed.
    clicked: false,
  };

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    input.pressed.add(event.code);
    // Keep the page from scrolling on Space / arrows while playing.
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    input.mouseX = (event.clientX - rect.left) * scaleX;
    input.mouseY = (event.clientY - rect.top) * scaleY;
  }
  function onMouseDown(event) {
    if (event.button === 0) {
      input.mouseDown = true;
      input.clicked = true;
    }
    onMouseMove(event);
  }
  function onMouseUp(event) {
    if (event.button === 0) input.mouseDown = false;
  }
  function onBlur() {
    keys.clear();
    input.mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  // Movement vector from WASD or the arrow keys, normalised.
  input.moveVector = function moveVector() {
    let x = 0;
    let y = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const len = Math.hypot(x, y);
      x /= len;
      y /= len;
    }
    return { x, y };
  };

  input.wasPressed = function wasPressed(code) {
    return input.pressed.has(code);
  };

  // Returns true once per physical click, then clears the latch.
  input.consumeClick = function consumeClick() {
    const was = input.clicked;
    input.clicked = false;
    return was;
  };

  // Call once per fixed step, after the game has read the presses.
  input.endStep = function endStep() {
    input.pressed.clear();
  };

  input.destroy = function destroy() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
  };

  return input;
}
