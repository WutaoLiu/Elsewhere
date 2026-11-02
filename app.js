const $ = id => document.getElementById(id), version = 'book-20261102', viewer = $('viewer');
let archives = [], photoMap = new Map(), active = null, pageIndex = 0;
let viewerPhotos = [], viewerIndex = 0, opener = null, zoomed = false, imageRequest = 0;
$('year').textContent = new Date().getFullYear();
function setImage(image, photo, full = false) {
  image.alt = photo.alt || photo.title; image.width = photo.width; image.height = photo.height;
  image.removeAttribute('srcset');
  if (!full) {
    const longest = Math.max(photo.width, photo.height);
    const w = size => Math.max(1, Math.round(Math.min(size, longest) * photo.width / longest));
    image.srcset = `${photo.thumbnail} ${w(800)}w, ${photo.preview} ${w(2000)}w`;
    image.sizes = '(max-width:700px) 88vw, 65vw';
  }
  image.src = full ? photo.full || photo.preview : photo.preview;
}
function setZoom(value) {
  zoomed = value; $('image-stage').classList.toggle('zoomed', zoomed); $('image-stage').scrollTo(0, 0);
  $('zoom').setAttribute('aria-pressed', String(zoomed)); $('zoom').textContent = zoomed ? 'Fit' : '100%';
  $('zoom').setAttribute('aria-label', zoomed ? 'Fit photograph to screen' : 'View photograph at 100 percent');
}
function showPhoto(index) {
  viewerIndex = (index + viewerPhotos.length) % viewerPhotos.length;
  const photo = viewerPhotos[viewerIndex], request = ++imageRequest;
  setZoom(false);
  $('position').textContent = `${viewerIndex + 1} / ${viewerPhotos.length}`;
  $('caption').textContent = `${active.title} / ${photo.title}`;
  $('image-status').textContent = 'Loading full resolution…'; $('zoom').disabled = true;
  const image = $('full-image');
  image.onload = null; image.onerror = null;
  setImage(image, photo); // Show the lightweight preview while the full file loads.
  const full = new Image();
  full.onload = () => {
    if (request !== imageRequest || !viewer.open) return;
    setImage(image, photo, true);
    $('image-status').textContent = `${full.naturalWidth} × ${full.naturalHeight} · Click to zoom`;
    $('zoom').disabled = false;
  };
  full.onerror = () => {
    if (request !== imageRequest) return;
    $('image-status').textContent = 'Preview shown · Full-resolution image unavailable'; $('zoom').disabled = false;
  };
  full.src = photo.full || photo.preview;
}
function photoFigure(id) {
  const photo = photoMap.get(id), figure = document.createElement('figure');
  const button = document.createElement('button'); button.type = 'button'; button.className = 'photo-button';
  button.setAttribute('aria-label', `View photograph ${photo.title} at full resolution`);
  const image = new Image(); image.decoding = 'async'; setImage(image, photo); button.append(image);
  button.onclick = () => {
    opener = button; viewerPhotos = active.pages.flatMap(p => p.photos).map(id => photoMap.get(id));
    viewer.showModal(); document.body.classList.add('viewing'); showPhoto(viewerPhotos.findIndex(p => p.id === id)); $('close').focus();
  };
  const caption = document.createElement('figcaption'); caption.textContent = photo.title;
  figure.append(button, caption); return figure;
}
function render() {
  const page = active.pages[pageIndex];
  $('archive-title').textContent = active.title; document.title = `${active.title} — Passing Light`;
  $('archive-count').textContent = `${active.pages.flatMap(p => p.photos).length} photographs`;
  const spread = $('spread'); spread.replaceChildren(); spread.className = `spread spread-${page.layout}`;
  page.photos.forEach(id => spread.append(photoFigure(id)));
  if (page.note) { const note = document.createElement('p'); note.className = 'spread-note'; note.textContent = page.note; spread.append(note); }
  $('page-label').textContent = `Page ${String(pageIndex + 1).padStart(2,'0')} / ${String(active.pages.length).padStart(2,'0')}`;
  $('page-prev').disabled = pageIndex === 0; $('page-next').disabled = pageIndex === active.pages.length - 1;
  const oldFocus = document.activeElement?.dataset?.page;
  $('page-dots').replaceChildren();
  active.pages.forEach((_, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.page = String(i); b.setAttribute('aria-label', `Go to page ${i + 1}`);
    if (i === pageIndex) b.setAttribute('aria-current','page');
    b.onclick = () => navigate(active.id, i); $('page-dots').append(b); if (oldFocus === String(i)) b.focus();
  });
  for (const link of $('archives').children) {
    if (link.dataset.archive === active.id) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
  }
}
function navigate(id, page) { location.hash = `${id}/${page + 1}`; }
function readRoute() {
  const [id, raw] = location.hash.slice(1).split('/'); active = archives.find(a => a.id === id) || archives[0];
  const n = Number(raw); pageIndex = Number.isInteger(n) ? Math.max(0,Math.min(active.pages.length - 1,n - 1)) : 0; render();
}
function turn(delta) {
  if (!active || viewer.open) return;
  const n = pageIndex + delta; if (n >= 0 && n < active.pages.length) navigate(active.id,n);
}
$('page-prev').onclick = () => turn(-1); $('page-next').onclick = () => turn(1);
$('previous').onclick = () => showPhoto(viewerIndex - 1); $('next').onclick = () => showPhoto(viewerIndex + 1);
$('zoom').onclick = () => setZoom(!zoomed); $('full-image').onclick = () => { if (!$('zoom').disabled) setZoom(!zoomed); };
$('close').onclick = () => viewer.close();
viewer.addEventListener('close', () => { ++imageRequest; document.body.classList.remove('viewing'); setZoom(false); opener?.focus(); });
document.addEventListener('keydown', e => {
  if (e.altKey || e.ctrlKey || e.metaKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || !['ArrowLeft','ArrowRight'].includes(e.key)) return;
  e.preventDefault(); const delta = e.key === 'ArrowLeft' ? -1 : 1;
  if (viewer.open) showPhoto(viewerIndex + delta); else turn(delta);
});
let touch = null;
$('spread').addEventListener('touchstart', e => { const t=e.touches[0]; touch={x:t.clientX,y:t.clientY}; },{passive:true});
$('spread').addEventListener('touchend', e => {
  if (!touch) return;
  const t=e.changedTouches[0],dx=t.clientX-touch.x,dy=t.clientY-touch.y;
  if (Math.abs(dx)>65 && Math.abs(dx)>Math.abs(dy)*1.5) turn(dx<0?1:-1); touch=null;
},{passive:true});
async function loadJSON(path) { const r=await fetch(`${path}?v=${version}`,{cache:'no-store'}); if (!r.ok) throw Error(path); return r.json(); }
Promise.all([loadJSON('photos.json'),loadJSON('archives.json')]).then(([data,book]) => {
  photoMap=new Map(data.photos.map(p=>[p.id,p])); archives=book.archives;
  if (!archives.length || archives.some(a=>!a.pages.length || a.pages.some(p=>!p.photos.length || p.photos.some(id=>!photoMap.has(id))))) throw Error('Invalid archive');
  archives.forEach((a,i) => {
    const link=document.createElement('a');link.className='archive-link';link.dataset.archive=a.id;link.href=`#${a.id}/1`;
    const number=document.createElement('span');number.className='archive-number';number.textContent=String(i+1).padStart(2,'0');
    const title=document.createElement('span');title.textContent=a.title;link.append(number,title);$('archives').append(link);
  });
  $('status').hidden=true;window.addEventListener('hashchange',readRoute);readRoute();
}).catch(()=>{$('status').textContent='The archive could not be loaded. Please refresh to try again.';});
