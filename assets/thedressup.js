'use strict';

// The existing runway artwork is used as a style edit, not a live inventory feed.
const SHOP = 'https://www.instagram.com/dressup_clothing_shop/';
const MODELS = 'assets/runway-models.webp';
const PIECES = 'assets/runway-pieces.webp';
const MODEL_BOXES = [[12,176],[178,330],[331,470],[476,633],[634,767],[767,956]];
const ITEMS = [
  {name:'Blush feather jacket', detail:'Soft texture · blush', box:[26,224,28,214]},
  {name:'Satin wide-leg trousers', detail:'Fluid satin · blush', box:[304,412,22,236]},
  {name:'Sage pleated dress', detail:'Soft pleats · sage', box:[530,666,12,242]},
  {name:'Gold waist belt', detail:'A little finishing touch', box:[752,922,100,146]},
  {name:'Satin trench dress', detail:'Elegant satin · champagne', box:[70,176,246,466]},
  {name:'Top-handle bag', detail:'Everyday elegance · ivory', box:[294,422,294,432]},
  {name:'Billow-sleeve blouse', detail:'Soft volume · rose', box:[508,688,240,452]},
  {name:'Tie-waist trousers', detail:'Relaxed tailoring · rose', box:[780,890,252,466]},
  {name:'Powder blue coat', detail:'Soft tailoring · powder blue', box:[64,178,484,698]},
  {name:'Ivory straight trousers', detail:'A timeless silhouette', box:[316,396,482,698]},
  {name:'Sculpted ruffle top', detail:'Statement texture · ivory', box:[530,672,508,682]},
  {name:'Pleated maxi skirt', detail:'Beautiful movement · ivory', box:[754,916,484,700]}
];
const LOOKS = [
  {name:'Blush, beautifully.', category:'tailoring', items:[0,1]},
  {name:'A softer shade of sage.', category:'dresses', items:[2,3]},
  {name:'Champagne moments.', category:'dresses', items:[4,5]},
  {name:'Rose-tinted days.', category:'everyday', items:[6,7]},
  {name:'Something borrowed blue.', category:'tailoring', items:[8,9]},
  {name:'A little ivory magic.', category:'everyday', items:[10,11]}
];
const $ = id => document.getElementById(id);
const wrap = (value, length) => ((value % length) + length) % length;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const svgNS = 'http://www.w3.org/2000/svg';
const saved = new Set();
let storageAvailable = true;
try {
  const stored = JSON.parse(localStorage.getItem('thedressup-saved') || '[]');
  if (Array.isArray(stored)) stored.forEach(id => {
    if (Number.isInteger(id) && ITEMS[id]) saved.add(id);
  });
} catch { storageAvailable = false; }

function crop(source, x, y, width, height, sheetWidth, sheetHeight) {
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
  svg.setAttribute('aria-hidden', 'true');
  const image = document.createElementNS(svgNS, 'image');
  image.setAttribute('href', source);
  image.setAttribute('width', sheetWidth);
  image.setAttribute('height', sheetHeight);
  svg.append(image);
  return svg;
}

function pieceCard(id) {
  const item = ITEMS[id];
  const card = document.createElement('article');
  card.className = 'piece-card';
  const [left, right, top, bottom] = item.box;
  card.innerHTML = `<div class="piece-image"><button class="save-piece" data-save="${id}" aria-pressed="${saved.has(id)}" aria-label="${saved.has(id) ? 'Unsave' : 'Save'} ${item.name}"><svg class="icon"><use href="#icon-heart"/></svg></button></div><div class="piece-meta"><div><h3>${item.name}</h3><p>${item.detail}</p></div><a href="${SHOP}" target="_blank" rel="noopener noreferrer" aria-label="Ask TheDressUp about ${item.name} on Instagram">Enquire <svg class="icon"><use href="#icon-arrow"/></svg></a></div>`;
  card.querySelector('.piece-image').prepend(crop(PIECES, left, top, right-left, bottom-top, 960, 720));
  return card;
}

function updateSavedButtons() {
  $('saved-count').textContent = saved.size;
  $('saved-trigger').setAttribute('aria-label', `Open saved pieces, ${saved.size} saved`);
  document.querySelectorAll('[data-save]').forEach(button => {
    const id = Number(button.dataset.save);
    button.setAttribute('aria-pressed', saved.has(id));
    button.setAttribute('aria-label', `${saved.has(id) ? 'Unsave' : 'Save'} ${ITEMS[id].name}`);
  });
}

let toastTimer;
function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2600);
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-save]');
  if (!button) return;
  const id = Number(button.dataset.save);
  if (saved.has(id)) {
    saved.delete(id);
    toast('Piece removed from your favourites.');
  } else {
    saved.add(id);
    toast(storageAvailable ? 'Saved for a little outfit inspiration.' : 'Saved for this visit.');
  }
  try { localStorage.setItem('thedressup-saved', JSON.stringify([...saved])); }
  catch { storageAvailable = false; }
  updateSavedButtons();
  if ($('details-dialog').open && dialogMode === 'saved') renderSaved();
});

const runway = $('runway');
const people = MODEL_BOXES.map(([left, right], index) => {
  const element = document.createElement('div');
  element.className = 'model';
  element.dataset.model = index;
  element.append(crop(MODELS, left, 48, right-left, 448, 960, 540));
  $('model-line').append(element);
  return {element, ratio:(right-left)/448};
});

let active = LOOKS.map((_, index) => index);
let position = 0;
let target = 0;
let selected = 0;
let width = 0;
let height = 0;
let mobile = false;
let animationId = 0;
let lastTime = 0;

function renderSelected() {
  selected = active[wrap(Math.round(target), active.length)];
  $('look-number').textContent = String(selected+1).padStart(2, '0');
  $('look-name').textContent = LOOKS[selected].name;
  const current = String(wrap(Math.round(target), active.length)+1).padStart(2, '0');
  $('look-position').innerHTML = `${current} <i>/</i> ${String(active.length).padStart(2, '0')}`;
  $('pieces-list').replaceChildren(...LOOKS[selected].items.map(pieceCard));
}

function paint() {
  const xs = mobile ? [1.2,.73,.5,.34,.24,.17,.13] : [1.18,.72,.55,.45,.38,.32,.27];
  const hs = mobile ? [.65,.50,.37,.27,.21,.16,.12] : [1.08,.87,.64,.47,.35,.27,.20];
  const floors = mobile ? [.97,.91,.83,.78,.74,.71,.69] : [.97,.9,.82,.76,.72,.69,.67];
  const opacity = [0,1,.93,.76,.52,.25,0];
  const blur = [0,0,.25,1.2,2.3,4,6];
  people.forEach((model, index) => {
    const slot = active.indexOf(index);
    if (slot < 0) { model.element.hidden = true; return; }
    model.element.hidden = false;
    let depth = wrap(slot-position, active.length);
    if (depth > active.length-1) depth -= active.length;
    // A short filtered edit keeps the background looks naturally spaced.
    if (depth >= 0 && active.length < 6) depth *= 1.5;
    const stop = clamp(depth+1, 0, 6);
    const a = Math.floor(stop), b = Math.min(a+1, 6), t = stop-a;
    const mix = values => values[a]+(values[b]-values[a])*t;
    const modelHeight = mix(hs)*height;
    const scale = modelHeight/(height*1.2);
    const modelWidth = modelHeight*model.ratio;
    model.element.style.width = `${height*1.2*model.ratio}px`;
    model.element.style.height = `${height*1.2}px`;
    model.element.style.transform = `translate3d(${mix(xs)*width-modelWidth/2}px,${mix(floors)*height-modelHeight}px,0) scale(${scale})`;
    model.element.style.opacity = mix(opacity);
    model.element.style.filter = `blur(${mix(blur)/scale}px)`;
    model.element.style.zIndex = 100-Math.round(depth*10);
  });
}

function frame(time) {
  const delta = Math.min(50, time-lastTime) || 16;
  lastTime = time;
  position = reducedMotion.matches ? target : position+(target-position)*(1-Math.exp(-delta*.009));
  if (Math.abs(target-position) < .0005) position = target;
  paint();
  if (position !== target) animationId = requestAnimationFrame(frame);
  else { animationId = 0; lastTime = 0; }
}

function animate() {
  if (!animationId) animationId = requestAnimationFrame(frame);
}

function goTo(value) {
  target = value;
  renderSelected();
  animate();
}

function resize() {
  width = runway.clientWidth;
  height = runway.clientHeight;
  mobile = innerWidth <= 760;
  paint();
}
new ResizeObserver(resize).observe(runway);
$('previous-look').addEventListener('click', () => goTo(Math.round(target)-1));
$('next-look').addEventListener('click', () => goTo(Math.round(target)+1));
runway.addEventListener('keydown', event => {
  if (event.target !== runway) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    goTo(Math.round(target)+(event.key === 'ArrowRight' ? 1 : -1));
  }
});

let pointer = null;
runway.addEventListener('pointerdown', event => {
  if (event.target.closest('a,button') || !event.isPrimary || event.button !== 0) return;
  pointer = {id:event.pointerId, startX:event.clientX, startY:event.clientY, target:Math.round(target), dragging:false};
});
runway.addEventListener('pointermove', event => {
  if (!pointer || event.pointerId !== pointer.id) return;
  const dx = event.clientX-pointer.startX;
  const dy = event.clientY-pointer.startY;
  if (!pointer.dragging && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { pointer = null; return; }
  if (Math.abs(dx) > 8) {
    pointer.dragging = true;
    if (!runway.hasPointerCapture(event.pointerId)) runway.setPointerCapture(event.pointerId);
    target = pointer.target-dx/Math.max(140,width*.22);
    animate();
  }
});
function releasePointer(event) {
  if (!pointer || event.pointerId !== pointer.id) return;
  const wasDragging = pointer.dragging;
  pointer = null;
  if (runway.hasPointerCapture(event.pointerId)) runway.releasePointerCapture(event.pointerId);
  if (wasDragging) goTo(Math.round(target));
}
runway.addEventListener('pointerup', releasePointer);
runway.addEventListener('pointercancel', releasePointer);
runway.addEventListener('lostpointercapture', event => {
  if (pointer?.id === event.pointerId) { pointer = null; goTo(Math.round(target)); }
});

document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-filter]').forEach(other => {
    const isSelected = other === button;
    other.classList.toggle('selected', isSelected);
    other.setAttribute('aria-pressed', isSelected);
  });
  active = LOOKS.map((look,index) => button.dataset.filter === 'all' || look.category === button.dataset.filter ? index : -1).filter(index => index >= 0);
  if (animationId) cancelAnimationFrame(animationId);
  animationId = 0; lastTime = 0; pointer = null;
  position = target = 0;
  renderSelected();
  paint();
}));

const dialog = $('details-dialog');
let dialogMode = 'look';
function dialogActions() {
  const actions = document.createElement('div');
  actions.className = 'dialog-actions';
  actions.innerHTML = `<a class="primary-button" href="${SHOP}" target="_blank" rel="noopener noreferrer">Ask us on Instagram <svg class="icon"><use href="#icon-arrow"/></svg></a><button class="underlined close-dialog">Keep exploring</button><p>These looks are style inspiration. Ask our shop for current availability, sizing and prices. Office hours: 10am–5pm.</p>`;
  return actions;
}

function showLook() {
  dialogMode = 'look';
  $('dialog-eyebrow').textContent = `THE LOOK · ${String(selected+1).padStart(2,'0')}`;
  $('dialog-title').textContent = LOOKS[selected].name;
  const intro = document.createElement('p');
  intro.className = 'dialog-intro';
  intro.textContent = 'A little inspiration for your next outfit. Save the pieces you love, then visit our shop to find your favourites.';
  const pieces = document.createElement('div');
  pieces.className = 'dialog-pieces';
  pieces.append(...LOOKS[selected].items.map(pieceCard));
  $('dialog-content').replaceChildren(intro,pieces,dialogActions());
  dialog.showModal();
}

function renderSaved() {
  $('dialog-eyebrow').textContent = 'YOUR LITTLE STYLE COLLECTION';
  $('dialog-title').textContent = `Saved pieces (${saved.size})`;
  if (!saved.size) {
    const empty = document.createElement('div');
    empty.className = 'empty-saved';
    empty.innerHTML = '<svg class="icon"><use href="#icon-heart"/></svg><p>A little room for favourites.</p><span>Tap the heart on a piece to save your outfit inspiration.</span>';
    $('dialog-content').replaceChildren(empty,dialogActions());
  } else {
    const pieces = document.createElement('div');
    pieces.className = 'dialog-pieces';
    pieces.append(...[...saved].map(pieceCard));
    $('dialog-content').replaceChildren(pieces,dialogActions());
  }
}

$('look-details').addEventListener('click', showLook);
$('saved-trigger').addEventListener('click', () => { dialogMode = 'saved'; renderSaved(); dialog.showModal(); });
dialog.addEventListener('click', event => {
  if (event.target.closest('.close-dialog')) dialog.close();
  else if (event.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  }
});
dialog.addEventListener('close', () => document.body.style.overflow = '');
const dialogObserver = new MutationObserver(() => { if (dialog.open) document.body.style.overflow = 'hidden'; });
dialogObserver.observe(dialog, {attributes:true, attributeFilter:['open']});

const menu = $('menu-toggle');
function closeMenu() { menu.setAttribute('aria-expanded','false'); menu.setAttribute('aria-label','Open navigation'); $('mobile-nav').hidden = true; }
menu.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded',open);
  menu.setAttribute('aria-label',open ? 'Close navigation' : 'Open navigation');
  $('mobile-nav').hidden = !open;
});
$('mobile-nav').addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { closeMenu(); menu.focus(); } });
matchMedia('(min-width:761px)').addEventListener('change', event => { if (event.matches) closeMenu(); });
$('year').textContent = new Date().getFullYear();
renderSelected();
updateSavedButtons();
resize();
