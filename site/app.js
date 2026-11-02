const $ = id => document.getElementById(id), version = 'archive-preload-20261103', viewer = $('viewer');
let archives = [], photoMap = new Map(), active = null, pageIndex = 0, home = null;
let viewerPhotos = [], viewerIndex = 0, opener = null, zoomed = false, imageRequest = 0;
const imageCache = new Map(), imageQueue = [], spreadCache = new Map();
let pinnedImages = new Set(), archiveLoadRequest = 0, loadingArchive = null;
let runningImages = 0, renderRequest = 0;
let spreadAnimation = null, spreadChange = 0;
function replaceSpread(nodes, className) {
  const spread=$('spread'), change=++spreadChange;
  const commit=()=>{spread.className=className;spread.replaceChildren(...nodes);};
  if (spreadAnimation) { spreadAnimation.cancel(); spreadAnimation=null; }
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!spread.children.length || reduced || !spread.animate) { commit();return; }
  spreadAnimation=spread.animate([{opacity:1},{opacity:0}],{duration:110,easing:'ease-out',fill:'forwards'});
  spreadAnimation.finished.then(()=>{
    if (change!==spreadChange) return;
    spreadAnimation.cancel();commit();
    spreadAnimation=spread.animate([{opacity:0},{opacity:1}],{duration:220,easing:'ease-out'});
    spreadAnimation.finished.then(()=>{if(change===spreadChange) spreadAnimation=null;}).catch(()=>{});
  }).catch(()=>{});
}
function pumpImages() {
  imageQueue.sort((a,b) => (a.priority === 'low') - (b.priority === 'low') || Number(pinnedImages.has(b.url))-Number(pinnedImages.has(a.url)));
  const limit=/2g/.test(navigator.connection?.effectiveType || '') ? 2 : 4;
  while (runningImages < limit && imageQueue.length) {
    if (viewer.open && imageQueue[0].priority === 'low' && !pinnedImages.has(imageQueue[0].url)) return;
    const job = imageQueue.shift(); runningImages++;
    const image = new Image(); image.decoding = 'async'; image.fetchPriority = job.priority;
    const finish = () => { runningImages--; pumpImages(); };
    image.onload = async () => {
      job.done = true; job.resolve(image); finish();
      // Keep the bitmap cache bounded; visible DOM nodes retain their own images.
      if (imageCache.size > pinnedImages.size + 24) {
        for (const [key, entry] of imageCache) {
          if (imageCache.size <= pinnedImages.size + 24) break;
          if (entry.done && !pinnedImages.has(key)) imageCache.delete(key);
        }
      }
    };
    image.onerror = () => { imageCache.delete(job.url); job.reject(Error('Image unavailable')); finish(); };
    image.src = job.url;
  }
}
function loadImage(url, priority = 'high', decode = true) {
  const ready = job => !decode ? job.promise : job.promise.then(image=>{
    if (!job.decoded) job.decoded=image.decode ? image.decode().catch(()=>{}) : Promise.resolve();
    return job.decoded.then(()=>image);
  });
  let job = imageCache.get(url);
  if (job) { if (priority === 'high') job.priority = priority; pumpImages(); return ready(job); }
  job = { url, priority, done: false };
  job.promise = new Promise((resolve,reject) => { job.resolve = resolve; job.reject = reject; });
  imageCache.set(url,job); imageQueue.push(job); pumpImages(); return ready(job);
}
function preloadArchive() {
  if (!active || loadingArchive===active.id) return;
  loadingArchive=active.id;
  const request=++archiveLoadRequest, archive=active;
  const photos=[...new Set(archive.pages.flatMap(p=>p.photos))].map(id=>photoMap.get(id));
  pinnedImages=new Set(photos.flatMap(p=>[p.thumbnail,p.preview]));
  let completed=0,failed=0;
  const status=$('archive-load');status.hidden=false;
  const update=()=>{
    if (request!==archiveLoadRequest) return;
    status.textContent=completed===photos.length ? failed ? `${failed} images unavailable` : 'Loaded' : `Loading ${completed} / ${photos.length}`;
  };
  update();
  for (const photo of photos) {
    Promise.all([loadImage(photo.thumbnail,'low',false),loadImage(photo.preview,'low',false)])
      .catch(()=>{failed++;}).finally(()=>{
        completed++;update();
        if (completed===photos.length && !failed) setTimeout(()=>{
          if (request===archiveLoadRequest) status.hidden=true;
        },2500);
      });
  }
}
function screenSource(photo, layout = 'solo', index = 0) {
  const mobile = window.innerWidth <= 700, aspect = photo.width / photo.height;
  const available = mobile ? window.innerWidth * .88 : Math.max(200,window.innerWidth - (window.innerWidth <= 1050 ? 240 : 205 + window.innerWidth * .1));
  const fractions = { solo: mobile || window.innerWidth <= 1050 ? 1 : .8, duo: .5, triptych: index ? .43 : .52, portraits: .5, offset: .65 };
  const maxHeight = window.innerHeight * (layout === 'triptych' && index ? .31 : layout === 'solo' ? .65 : .70);
  const width = Math.min(available * (fractions[layout] || 1),maxHeight * aspect);
  const edge = Math.max(width,width / aspect) * Math.min(window.devicePixelRatio || 1,2);
  return edge <= 800 ? photo.thumbnail : photo.preview;
}
function setImage(image, photo, full = false, layout = 'solo', index = 0, priority = 'high') {
  image.alt = photo.alt || photo.title; image.width = photo.width; image.height = photo.height;
  image.setAttribute('style',`aspect-ratio:${photo.width}/${photo.height}`);
  image.removeAttribute('srcset');
  image.dataset.photo = photo.id; image.dataset.full = full ? '1' : '0';
  if (full) { image.src = photo.full || photo.preview; return Promise.resolve(); }
  image.src = photo.placeholder || photo.thumbnail;
  const target = screenSource(photo,layout,index);
  const display = url => { if (image.dataset.photo === photo.id && image.dataset.full !== '1') image.src = url; };
  return loadImage(photo.thumbnail,priority).then(() => {
    display(photo.thumbnail);
    if (target === photo.thumbnail) return;
    return loadImage(target,priority).then(() => display(target));
  }).catch(() => { image.dataset.failed = '1'; });
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
  $('image-status').textContent = 'Loading…'; $('zoom').disabled = true;
  const image = $('full-image');
  image.onload = null; image.onerror = null;
  setImage(image, photo); // Show a small decoded preview while full resolution loads.
  const full = new Image();
  full.onload = () => {
    if (request !== imageRequest || !viewer.open) return;
    setImage(image, photo, true);
    $('image-status').textContent = `${full.naturalWidth} × ${full.naturalHeight}`;
    $('zoom').disabled = false;
  };
  full.onerror = () => {
    if (request !== imageRequest) return;
    $('image-status').textContent = 'Preview shown · Full-resolution image unavailable'; $('zoom').disabled = false;
  };
  full.src = photo.full || photo.preview;
}
function photoFigure(id, layout, index, priority) {
  const photo = photoMap.get(id), figure = document.createElement('figure');
  figure.setAttribute('style',`--photo-ratio:${photo.width/photo.height}`);
  const button = document.createElement('button'); button.type = 'button'; button.className = 'photo-button';
  button.setAttribute('aria-label', `View photograph ${photo.title} at full resolution`);
  const image = new Image(); image.decoding = 'async'; figure.ready = setImage(image, photo, false, layout, index, priority); button.append(image);
  button.onclick = () => {
    opener = button; viewerPhotos = active.pages.flatMap(p => p.photos).map(id => photoMap.get(id));
    viewer.showModal(); document.body.classList.add('viewing'); showPhoto(viewerPhotos.findIndex(p => p.id === id)); $('close').focus();
  };
  const caption = document.createElement('figcaption'); caption.textContent = photo.title;
  figure.append(button, caption); return figure;
}
function prepareSpread(page, priority = 'high') {
  if (spreadCache.has(page)) {
    const saved = spreadCache.get(page);
    saved.nodes.filter(n => n.tagName === 'FIGURE').forEach((figure,i) => {
      const image=figure.children[0].children[0];
      if (image.dataset.failed) {
        delete image.dataset.failed;
        figure.ready=setImage(image,photoMap.get(page.photos[i]),false,page.layout,i,priority);
      }
    });
    saved.ready=Promise.allSettled(saved.nodes.map(n=>n.ready).filter(Boolean));
    // Promote queued preloads when the visitor turns to this page.
    if (priority === 'high') page.photos.forEach((id,i) => {
      const p=photoMap.get(id); loadImage(p.thumbnail,'high').catch(()=>{});
      const target=screenSource(p,page.layout,i);
      if (imageCache.has(target)) loadImage(target,'high').catch(()=>{});
    });
    return saved;
  }
  const nodes = page.photos.map((id,i) => photoFigure(id,page.layout,i,priority));
  if (page.note) { const note=document.createElement('p');note.className='spread-note';note.textContent=page.note;nodes.push(note); }
  const result = { nodes, ready: Promise.allSettled(nodes.map(n=>n.ready).filter(Boolean)) };
  spreadCache.set(page,result);
  while (spreadCache.size > 5) spreadCache.delete(spreadCache.keys().next().value);
  return result;
}
function preloadNeighbors(request) {
  if (request !== renderRequest || !active || viewer.open || navigator.connection?.saveData || /(^|-)2g/.test(navigator.connection?.effectiveType || '')) return;
  for (const delta of [1,-1]) {
    const page=active.pages[pageIndex+delta];
    if (page) prepareSpread(page,'low');
  }
}
function render() {
  const page = active.pages[pageIndex];
  $('book-heading').hidden=false; $('pagination').hidden=false;
  $('archive-title').textContent = active.title; document.title = `${active.title} — Elsewhere.`;
  $('archive-count').textContent = `${active.pages.flatMap(p => p.photos).length} photographs`;
  const spread = $('spread'), request = ++renderRequest, prepared = prepareSpread(page);
  replaceSpread(prepared.nodes,`spread spread-${page.layout}`);
  preloadArchive();
  prepared.ready.then(() => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(()=>preloadNeighbors(request),{timeout:800});
    else setTimeout(()=>preloadNeighbors(request),150);
  });
  $('page-label').textContent = `${String(pageIndex + 1).padStart(2,'0')} / ${String(active.pages.length).padStart(2,'0')}`;
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
function renderHome() {
  active=null; pageIndex=0; ++renderRequest;
  loadingArchive=null;++archiveLoadRequest;pinnedImages.clear();$('archive-load').hidden=true;
  document.title='Elsewhere. — Wutao Liu';
  $('book-heading').hidden=true; $('pagination').hidden=true;
  if (!home.nodes) {
    home.nodes=home.collage.map((id,i)=>{
      const photo=photoMap.get(id),link=document.createElement('a');
      const archive=archives.find(a=>a.pages.some(p=>p.photos.includes(id)));
      link.className=`home-layer home-layer-${i+1}`;link.href=`#${archive?.id || home.archive}/1`;
      link.setAttribute('aria-label',`Explore ${archive?.title || 'the archive'}`);
      const image=new Image();image.alt=photo.alt;image.width=photo.width;image.height=photo.height;image.decoding='async';
      image.src=photo.placeholder || photo.thumbnail;link.append(image);
      loadImage(photo.thumbnail,'high').then(()=>{image.src=photo.thumbnail;}).catch(()=>{});
      return link;
    });
    const heading=document.createElement('div');heading.className='home-wordmark';
    const title=document.createElement('a');title.className='home-title';title.href='#in-between/1';title.textContent='Elsewhere.';
    title.setAttribute('aria-label','Elsewhere. — enter the photographic archive');
    const signature=document.createElement('span');signature.className='home-signature';signature.textContent='Wutao Liu';
    heading.append(title,signature);home.nodes.push(heading);
  }
  replaceSpread(home.nodes,'spread spread-home spread-collage');
  for (const link of $('archives').children) link.removeAttribute('aria-current');
}
function readRoute() {
  if (!location.hash || location.hash==='#home') { renderHome();return; }
  const [rawId, raw] = location.hash.slice(1).split('/'); const id = ({'open-air':'wandering','street-notes':'in-between'})[rawId] || rawId; active = archives.find(a => a.id === id) || archives[0];
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
viewer.addEventListener('close', () => { ++imageRequest; document.body.classList.remove('viewing'); setZoom(false); opener?.focus(); pumpImages(); preloadNeighbors(renderRequest); });
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
  home={archive:book.home?.archive || archives[0].id,page:{layout:'solo',photos:[book.home?.photo || archives[0].pages[0].photos[0]]},collage:book.home?.collage || [book.home?.photo || archives[0].pages[0].photos[0]]};
  if (home.collage.some(id=>!photoMap.has(id))) throw Error('Invalid cover collage');
  if (!photoMap.has(home.page.photos[0]) || !archives.some(a=>a.id===home.archive)) throw Error('Invalid home cover');
  archives.forEach(a => {
    const link=document.createElement('a');link.className='archive-link';link.dataset.archive=a.id;link.href=`#${a.id}/1`;
    const title=document.createElement('span');title.textContent=a.title;link.append(title);$('archives').append(link);
  });
  $('status').hidden=true;window.addEventListener('hashchange',readRoute);readRoute();
}).catch(()=>{$('status').textContent='The archive could not be loaded. Please refresh to try again.';});
