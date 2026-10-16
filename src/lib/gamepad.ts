// Xbox / standard-mapping gamepad support, using the browser Gamepad API.
// No dependencies. Inert until a controller is pressed or connected.
//
// Default mapping:
//   A           tick / untick the focused step; expand / collapse a focused section
//               header; with the sidebar focused, open it
//   B           leave the sidebar (or close the menu); otherwise go back
//   X           open page contents: desktop focuses "On This Page" (else the chapter
//               sidebar); narrow screens open the drawer on its "This Page" tab.
//               X again leaves the desktop sidebar or On This Page
//   Y           focus the next unticked step
//   LB / RB     browser back / forward
//   LT / RT     previous / next section on this page
//   D-pad       move focus through section headers, steps and entry cards (hold to repeat)
//   Left stick  scroll slowly
//   Right stick scroll fast
//   Start       hide/show the desktop sidebar; open/close the menu on narrow screens
//   View        jump to top
//   R3          toggle fullscreen (may be refused by the browser; no fallback)
//
// Sidebar focus: when the sidebar or menu is open, focus moves into it. D-pad
// moves through its chapters and categories, and A opens them. Step controls
// (D-pad step focus, A tick) pause until focus returns to the page.

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
const SIDEBAR_FOCUS_CLASS = 'gp-sidebar-focus';
const HINT_DISMISS_KEY = 'gamepad-hints-dismissed';

const prevPressed: boolean[] = [];
let focusIndex = -1;
let heldDir = 0;
let heldSince = 0;
let lastRepeat = 0;

let inSidebar = false;
let sidebarIndex = -1;
let sidebarList: HTMLElement | null = null;
let pendingSidebarEnter = false;

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

// D-pad sequence on the page: section headers, walkthrough steps, manual entry
// cards and table-of-contents rows, in page order. Entries inside a collapsed
// section are skipped.
function stepItems(): HTMLElement[] {
  const selector = '.section-toggle, .category-toggle, .step-item, .gp-entry, .toc-item';
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => el.getClientRects().length > 0 && !insideCollapsed(el),
  );
}

function isStep(item: HTMLElement): boolean {
  return item.classList.contains('step-item');
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

// A on a step ticks it; A on a section header toggles it; A on an available
// table-of-contents row opens its guide; A on other entry cards does nothing
function activateFocused(): void {
  const items = stepItems();
  if (focusIndex < 0 || !items[focusIndex]) {
    moveFocus(1);
    return;
  }
  const item = items[focusIndex];
  if (isStep(item)) {
    // Native click fires the change event that StepChecklist already listens to,
    // so localStorage and visual state stay in sync with mouse and keyboard.
    item.querySelector<HTMLInputElement>('.step-checkbox')?.click();
  } else if (item.classList.contains('section-toggle') || item.classList.contains('category-toggle')) {
    item.click();
  } else if (item.classList.contains('toc-item')) {
    item.querySelector<HTMLAnchorElement>('a[href]')?.click();
  }
}

function focusNextUnticked(): void {
  const items = stepItems();
  if (items.length === 0) return;
  for (let n = 1; n <= items.length; n++) {
    const index = (focusIndex + n) % items.length;
    if (isStep(items[index]) && !isChecked(items[index])) {
      setFocus(index);
      return;
    }
  }
}

function drawerOpen(): boolean {
  return document.getElementById('mobile-drawer-panel')?.classList.contains('translate-x-0') ?? false;
}

function closeDrawer(): void {
  document.getElementById('close-mobile-drawer')?.click();
}

// Desktop: X focuses On This Page, else the chapter sidebar (shown if hidden).
// Narrow screens: X opens the drawer on its This Page tab.
function openContents(): void {
  if (drawerOpen()) {
    closeDrawer();
    return;
  }
  if (inSidebar) {
    exitSidebar();
    return;
  }
  if (desktopLayout() || pageTocShown()) {
    if (pageTocShown()) {
      enterSidebar(pageToc());
    } else if (desktopSidebarShown()) {
      enterSidebar();
    } else {
      document.getElementById('sidebar-toggle')?.click();
      pendingSidebarEnter = true;
    }
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
    closeDrawer();
  } else if (history.length > 1) {
    history.back();
  }
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

// ---- Sidebar (desktop aside, or mobile drawer chapters / "This Page" tab) ----

function desktopSidebar(): HTMLElement | null {
  return document.getElementById('desktop-sidebar');
}

// Desktop layout is shown at >= lg; the shell is display:none below that
function desktopLayout(): boolean {
  return desktopSidebar()?.offsetParent != null;
}

function desktopSidebarShown(): boolean {
  const aside = desktopSidebar();
  return !!aside && aside.offsetParent !== null && !aside.hasAttribute('inert');
}

// "On This Page" aside: shown at xl and up, outside #desktop-sidebar
function pageToc(): HTMLElement | null {
  return document.getElementById('page-toc');
}

function pageTocShown(): boolean {
  const toc = pageToc();
  return !!toc && toc.getClientRects().length > 0;
}

// The list the controller navigates right now, or null when no sidebar is open.
function currentSidebarList(): HTMLElement | null {
  if (drawerOpen()) {
    const sections = document.getElementById('tab-content-sections');
    if (sections && !sections.classList.contains('hidden')) return sections;
    return document.getElementById('tab-content-chapters');
  }
  // Keep On This Page while it is the list being navigated, even with the chapter sidebar open
  const toc = pageToc();
  if (toc && sidebarList === toc && pageTocShown()) return toc;
  if (desktopSidebarShown()) return document.getElementById('sidebar-list');
  return null;
}

// True when el sits inside a collapsed <details>. Newer Chrome keeps the closed
// content laid out (content-visibility), so getClientRects() alone is not enough.
// A category's own <summary> is never hidden by its own collapsed state.
function insideCollapsed(el: HTMLElement): boolean {
  let details = el.closest('details');
  if (details && details.firstElementChild === el) {
    details = details.parentElement?.closest('details') ?? null;
  }
  while (details) {
    if (!details.open) return true;
    details = details.parentElement?.closest('details') ?? null;
  }
  return false;
}

// Category summaries and chapter links that are actually shown (skips collapsed categories)
function sidebarItems(list: HTMLElement | null): HTMLElement[] {
  if (!list) return [];
  return Array.from(list.querySelectorAll<HTMLElement>('summary, a[href]')).filter(
    (el) => el.getClientRects().length > 0 && !insideCollapsed(el),
  );
}

function clearSidebarFocus(): void {
  document.querySelectorAll(`.${SIDEBAR_FOCUS_CLASS}`).forEach((el) => el.classList.remove(SIDEBAR_FOCUS_CLASS));
}

function setSidebarFocus(index: number): void {
  const items = sidebarItems(sidebarList);
  if (items.length === 0) return;
  sidebarIndex = Math.max(0, Math.min(items.length - 1, index));
  clearSidebarFocus();
  items[sidebarIndex].classList.add(SIDEBAR_FOCUS_CLASS);
  items[sidebarIndex].scrollIntoView({ block: 'nearest', behavior: scrollBehavior() });
}

function moveSidebar(delta: number): void {
  const items = sidebarItems(sidebarList);
  if (items.length === 0) return;
  const from = sidebarIndex < 0 ? (delta > 0 ? -1 : items.length) : sidebarIndex;
  setSidebarFocus(from + delta);
}

function enterSidebar(list: HTMLElement | null = currentSidebarList()): void {
  if (!list) return;
  inSidebar = true;
  sidebarList = list;
  // Start on the current chapter so the user sees where they are
  const items = sidebarItems(list);
  const active = items.findIndex(
    (el) => el.tagName === 'A' && el.closest('li')?.getAttribute('data-active') === 'true',
  );
  setSidebarFocus(active >= 0 ? active : 0);
}

function exitSidebar(): void {
  inSidebar = false;
  sidebarIndex = -1;
  sidebarList = null;
  clearSidebarFocus();
}

// A opens a chapter link or expands a category (native click does both)
function activateSidebarItem(): void {
  sidebarItems(sidebarList)[sidebarIndex]?.click();
}

// Start: hide the desktop sidebar, show it (focused) when hidden, or open the menu on narrow screens
function handleStart(): void {
  if (drawerOpen()) {
    closeDrawer();
    exitSidebar();
    return;
  }
  if (desktopSidebarShown()) {
    document.getElementById('sidebar-toggle')?.click();
    exitSidebar();
    return;
  }
  if (desktopLayout()) {
    document.getElementById('sidebar-toggle')?.click();
  } else {
    document.getElementById('open-mobile-drawer')?.click();
  }
  pendingSidebarEnter = true;
}

// ---- Input handling ----

function handleDpad(pad: Gamepad): void {
  const dir = isPressed(pad, BUTTON.DPAD_UP) ? -1 : isPressed(pad, BUTTON.DPAD_DOWN) ? 1 : 0;
  if (dir === 0) {
    heldDir = 0;
    return;
  }
  const now = performance.now();
  const step = (d: number) => (inSidebar ? moveSidebar(d) : moveFocus(d));
  if (dir !== heldDir) {
    heldDir = dir;
    heldSince = now;
    lastRepeat = now;
    step(dir);
  } else if (now - heldSince > DPAD_REPEAT_DELAY_MS && now - lastRepeat > DPAD_REPEAT_INTERVAL_MS) {
    lastRepeat = now;
    step(dir);
  }
}

function handleButtons(pad: Gamepad): void {
  const pressed = (index: number) => isPressed(pad, index) && !prevPressed[index];

  if (pressed(BUTTON.START)) handleStart();

  if (inSidebar) {
    if (pressed(BUTTON.A)) activateSidebarItem();
    if (pressed(BUTTON.B)) {
      if (drawerOpen()) closeDrawer();
      exitSidebar();
    }
  } else {
    if (pressed(BUTTON.A)) activateFocused();
    if (pressed(BUTTON.B)) goBack();
  }

  if (pressed(BUTTON.X)) openContents();
  if (pressed(BUTTON.Y)) focusNextUnticked();
  if (pressed(BUTTON.LB) && history.length > 1) history.back();
  if (pressed(BUTTON.RB)) history.forward();
  if (pressed(BUTTON.LT)) jumpSection(-1);
  if (pressed(BUTTON.RT)) jumpSection(1);
  if (pressed(BUTTON.VIEW)) window.scrollTo({ top: 0, behavior: scrollBehavior() });
  if (pressed(BUTTON.R3)) toggleFullscreen();

  handleDpad(pad);
  if (!drawerOpen()) scrollFromSticks(pad);
}

function scrollFromSticks(pad: Gamepad): void {
  const left = pad.axes[AXIS.LEFT_Y] ?? 0;
  const right = pad.axes[AXIS.RIGHT_Y] ?? 0;
  const delta =
    (Math.abs(left) > STICK_DEAD_ZONE ? left * LEFT_STICK_SPEED : 0) +
    (Math.abs(right) > STICK_DEAD_ZONE ? right * RIGHT_STICK_SPEED : 0);
  // Per-frame nudges must not be animated: html has scroll-behavior: smooth, and
  // restarting a smooth scroll every frame flattens the stick speed.
  if (delta !== 0) window.scrollBy({ top: delta, behavior: 'instant' });
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

    // Opening the sidebar or menu moves focus into it (drawer animates in a frame later)
    if (pendingSidebarEnter && (drawerOpen() || desktopSidebarShown())) {
      pendingSidebarEnter = false;
      enterSidebar();
    }
    // Any open menu takes focus, including one opened by X
    if (!inSidebar && drawerOpen()) enterSidebar();
    // Leave the sidebar if it closed or switched to another list
    if (inSidebar && currentSidebarList() !== sidebarList) exitSidebar();

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
