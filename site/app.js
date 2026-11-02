const $ = (id) => document.getElementById(id);
let photos = [], visible = [], current = 0, opener = null;
const viewer = $('viewer');
$('year').textContent = new Date().getFullYear();
function setImage(image, photo, full = false) {
  image.alt = photo.alt || photo.title || '';
  image.src = full ? (photo.full || photo.preview) : (photo.thumbnail || photo.preview);
  image.removeAttribute('srcset');
  if (!full && photo.thumbnail && photo.preview && photo.thumbnail !== photo.preview) {
    image.srcset = `${photo.thumbnail} 800w, ${photo.preview} 2000w`;
    image.sizes = '(max-width: 650px) 88vw, 42vw';
  }
  if (photo.width && photo.height) { image.width = photo.width; image.height = photo.height; }
}
function show(index) {
  current = (index + visible.length) % visible.length;
  const photo = visible[current];
  setImage($('full-image'), photo, true);
  $('caption').textContent = photo.title || '';
  $('series').textContent = [photo.series, photo.date].filter(Boolean).join(' · ');
  $('position').textContent = `${String(current + 1).padStart(2, '0')} / ${String(visible.length).padStart(2, '0')}`;
}
function render(filter = '') {
  visible = photos.filter(p => !filter || p.series === filter);
  $('gallery').replaceChildren();
  $('count').textContent = `${String(visible.length).padStart(2, '0')} photographs`;
  visible.forEach((photo, index) => {
    const figure = document.createElement('figure'); figure.className = 'photo';
    const button = document.createElement('button'); button.type = 'button';
    button.setAttribute('aria-label', `View ${photo.title || 'photograph'}`);
    const image = new Image(); image.loading = index < 2 ? 'eager' : 'lazy'; image.decoding = 'async';
    setImage(image, photo); button.append(image);
    button.addEventListener('click', () => { opener = button; show(index); viewer.showModal(); document.body.classList.add('viewing'); $('close').focus(); });
    const caption = document.createElement('figcaption');
    [photo.title, photo.series].forEach(text => { const span = document.createElement('span'); span.textContent = text || ''; caption.append(span); });
    figure.append(button, caption); $('gallery').append(figure);
  });
  for (const b of $('filters').children) b.setAttribute('aria-pressed', String(b.dataset.filter === filter));
}
$('previous').onclick = () => show(current - 1);
$('next').onclick = () => show(current + 1);
$('close').onclick = () => viewer.close();
viewer.addEventListener('close', () => { document.body.classList.remove('viewing'); opener?.focus(); });
viewer.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') { e.preventDefault(); show(current - 1); }
  if (e.key === 'ArrowRight') { e.preventDefault(); show(current + 1); }
});
fetch('photos.json').then(r => { if (!r.ok) throw Error('Unable to load photographs.'); return r.json(); }).then(data => {
  photos = data.photos || [];
  $('demo-note').hidden = !data.demo;
  for (const series of ['', ...new Set(photos.map(p => p.series).filter(Boolean))]) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.filter = series;
    button.textContent = series || 'All photographs'; button.onclick = () => render(series); $('filters').append(button);
  }
  render();
  if (!photos.length) $('status').textContent = 'The first photographs will appear here soon.';
}).catch(() => { $('status').textContent = 'Photographs could not be loaded. Please try again.'; });
