// Xbox / standard-mapping gamepad support, using the browser Gamepad API.
// No dependencies. Inert until a controller is pressed or connected.
//
// Default mapping:
//   A           tick / untick the focused step
//   B           close menu, else go back
//   X           open page contents (drawer, "This Page" tab)
//   Y           focus the next unticked step
//   LB / RB     previous / next chapter page
//   LT / RT     previous / next section on this page
//   D-pad       move focus between steps (hold to repeat)
//   Left stick  scroll slowly
//   Right stick scroll fast
//   Start       open / close menu
//   View        jump to top
//   R3          toggle fullscreen (may be refused by the browser; no fallback)

// Standard mapping button indexes (Chrome / Edge / Firefox with an Xbox controller)
const BUTTON = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  VIEW: 8,
  START: 9,
  R3: 11,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
} as const;

// Standard mapping axis indexes
const AXIS = { LEFT_Y: 1, RIGHT_Y: 3 } as const;

const STICK_DEAD_ZONE = 0.2;
const TRIGGER_THRESHOLD = 0.5;
const LEFT_STICK_SPEED = 8; // px per frame at full tilt
const RIGHT_STICK_SPEED = 22; // px per frame at full tilt
const DPAD_REPEAT_DELAY_MS = 400;
const DPAD_REPEAT_INTERVAL_MS = 120;
const SECTION_EDGE_PX = 16; // viewport line where a section counts as "current"
const FOCUS_CLASS = 'gp-focus';
const HINT_DISMISS_KEY = 'gamepad-hints-dismissed';

const prevPressed: boolean[] = [];
let focusIndex = -1;
let heldDir = 0;
let heldSince = 0;
let lastRepeat = 0;

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

function activePad(): Gamepad | null {
  for (const pad of navigator.getGamepads()) {
    if (pad && pad.connected) return pad;
  }
  return null;
}

function isPressed(pad: Gamepad, index: number): boolean {
  const button = pad.buttons[index];
  return !!button && (button.pressed || button.value > TRIGGER_THRESHOLD);
}

function stepItems(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.step-item'));
}

function isChecked(item: HTMLElement): boolean {
  return !!item.querySelector<HTMLInputElement>('.step-checkbox')?.checked;
}

function setFocus(index: number): void {
  const items = stepItems();
  if (items.length === 0) return;
  focusIndex = Math.max(0, Math.min(items.length - 1, index));
  items.forEach((el, n) => el.classList.toggle(FOCUS_CLASS, n === focusIndex));
  items[focusIndex].scrollIntoView({ block: 'center', behavior: scrollBehavior() });
}

function moveFocus(delta: number): void {
  const items = stepItems();
  if (items.length === 0) return;
  // First press with nothing focused lands on the first (down) or last (up) step
  const from = focusIndex < 0 ? (delta > 0 ? -1 : items.length) : focusIndex;
  setFocus(from + delta);
}

function toggleFocusedStep(): void {
  const items = stepItems();
  if (focusIndex < 0 || !items[focusIndex]) {
    moveFocus(1);
    return;
  }
  // Native click fires the change event that StepChecklist already listens to,
  // so localStorage and visual state stay in sync with mouse and keyboard.
  items[focusIndex].querySelector<HTMLInputElement>('.step-checkbox')?.click();
}

function focusNextUnticked(): void {
  const items = stepItems();
  if (items.length === 0) return;
  for (let n = 1; n <= items.length; n++) {
    const index = (focusIndex + n) % items.length;
    if (!isChecked(items[index])) {
      setFocus(index);
      return;
    }
  }
}

function drawerOpen(): boolean {
  return document.getElementById('mobile-drawer-panel')?.classList.contains('translate-x-0') ?? false;
}

function toggleDrawer(): void {
  document.getElementById(drawerOpen() ? 'close-mobile-drawer' : 'open-mobile-drawer')?.click();
}

function openContents(): void {
  if (drawerOpen()) {
    document.getElementById('close-mobile-drawer')?.click();
    return;
  }
  document.getElementById('open-mobile-drawer')?.click();
  document.getElementById('tab-btn-sections')?.click();
}

// Browsers only allow fullscreen inside a user gesture; if Chrome refuses a
// gamepad press, the promise rejects and nothing happens (no fallback by design).
function toggleFullscreen(): void {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  } else {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}

function goBack(): void {
  if (drawerOpen()) {
    document.getElementById('close-mobile-drawer')?.click();
  } else if (history.length > 1) {
    history.back();
  }
}

function followLink(selector: string): void {
  const link = document.querySelector<HTMLAnchorElement>(selector);
  if (link) window.location.href = link.href;
}

// Top-level page sections only (nested CollapsibleSection blocks are skipped)
function pageSections(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('main section[id]')).filter(
    (el) => !el.parentElement?.closest('section'),
  );
}

function jumpSection(dir: 1 | -1): void {
  const sections = pageSections();
  if (sections.length === 0) return;

  let current = -1;
  sections.forEach((el, n) => {
    if (el.getBoundingClientRect().top <= SECTION_EDGE_PX) current = n;
  });

  let target: number;
  if (dir > 0) {
    target = current + 1;
  } else if (current >= 0 && sections[current].getBoundingClientRect().top < -40) {
    // Mid-section: first press returns to this section's start
    target = current;
  } else {
    target = current - 1;
  }

  if (target < 0) {
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
    return;
  }
  if (target >= sections.length) return;

  const top = sections[target].getBoundingClientRect().top + window.scrollY - SECTION_EDGE_PX;
  window.scrollTo({ top, behavior: scrollBehavior() });
}

function scrollFromSticks(pad: Gamepad): void {
  const left = pad.axes[AXIS.LEFT_Y] ?? 0;
  const right = pad.axes[AXIS.RIGHT_Y] ?? 0;
  const delta =
    (Math.abs(left) > STICK_DEAD_ZONE ? left * LEFT_STICK_SPEED : 0) +
    (Math.abs(right) > STICK_DEAD_ZONE ? right * RIGHT_STICK_SPEED : 0);
  if (delta !== 0) window.scrollBy(0, delta);
}

function handleDpad(pad: Gamepad): void {
  const dir = isPressed(pad, BUTTON.DPAD_UP) ? -1 : isPressed(pad, BUTTON.DPAD_DOWN) ? 1 : 0;
  if (dir === 0) {
    heldDir = 0;
    return;
  }
  const now = performance.now();
  if (dir !== heldDir) {
    heldDir = dir;
    heldSince = now;
    lastRepeat = now;
    moveFocus(dir);
  } else if (now - heldSince > DPAD_REPEAT_DELAY_MS && now - lastRepeat > DPAD_REPEAT_INTERVAL_MS) {
    lastRepeat = now;
    moveFocus(dir);
  }
}

function handleButtons(pad: Gamepad): void {
  const pressed = (index: number) => isPressed(pad, index) && !prevPressed[index];

  if (drawerOpen()) {
    // While the menu is open, only B and Start act; the page behind it stays still
    if (pressed(BUTTON.B) || pressed(BUTTON.START)) toggleDrawer();
    return;
  }

  if (pressed(BUTTON.A)) toggleFocusedStep();
  if (pressed(BUTTON.B)) goBack();
  if (pressed(BUTTON.X)) openContents();
  if (pressed(BUTTON.Y)) focusNextUnticked();
  if (pressed(BUTTON.LB)) followLink('a[aria-label^="Previous chapter"]');
  if (pressed(BUTTON.RB)) followLink('a[aria-label^="Next chapter"]');
  if (pressed(BUTTON.LT)) jumpSection(-1);
  if (pressed(BUTTON.RT)) jumpSection(1);
  if (pressed(BUTTON.START)) toggleDrawer();
  if (pressed(BUTTON.VIEW)) window.scrollTo({ top: 0, behavior: scrollBehavior() });
  if (pressed(BUTTON.R3)) toggleFullscreen();

  handleDpad(pad);
  scrollFromSticks(pad);
}

function showHints(): void {
  const hints = document.getElementById('gamepad-hints');
  if (!hints || !hints.classList.contains('hidden')) return;
  try {
    if (localStorage.getItem(HINT_DISMISS_KEY) === 'true') return;
  } catch {
    // Storage can be blocked; show the hints anyway
  }
  hints.classList.remove('hidden');
}

function wireHintDismiss(): void {
  document.getElementById('gamepad-hints-dismiss')?.addEventListener('click', () => {
    document.getElementById('gamepad-hints')?.classList.add('hidden');
    try {
      localStorage.setItem(HINT_DISMISS_KEY, 'true');
    } catch {
      // Ignore: hints just reappear next visit
    }
  });
}

function tick(): void {
  const pad = activePad();
  if (pad) {
    showHints();
    handleButtons(pad);
    for (let i = 0; i < pad.buttons.length; i++) prevPressed[i] = isPressed(pad, i);
  } else {
    prevPressed.length = 0;
    heldDir = 0;
  }
  requestAnimationFrame(tick);
}

wireHintDismiss();
requestAnimationFrame(tick);
