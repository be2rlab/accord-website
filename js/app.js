// The page: everything it shows comes from assets/catalog.json, which scripts/build_site.py writes.
import { Viewer, decode } from './viewer.js';

const $ = id => document.getElementById(id);
// The first shot of each dataset: indoors from three-quarters with the roof cut away, a wide outdoor walk from above;
// red at 15 cm in rooms, at 30 cm on the large sites (as the CC05 video).
const LOOK = {
  euroc: { view: 'hero', ceiling: 80, red: 15 }, ori: { view: 'hero', ceiling: 75, red: 15 },
  hilti: { view: 'hero', ceiling: 85, red: 30 }, spires: { view: 'top', ceiling: 100, red: 30 },
  tumvi: { view: 'hero', ceiling: 80 }, realsense: { view: 'hero', ceiling: 85 }, iphone: { view: 'hero', ceiling: 100 },
  phones: { view: 'top', ceiling: 100 },
};
const POSTER = { euroc: 'euroc', ori: 'ori', hilti: 'hilti', spires: 'spires_compare', tumvi: 'tumvi', realsense: 'realsense',
                 phones: 'phone_dataset' };
// the colourings a dataset offers (sources.json modes), all three unless it says
const modesOf = d => d?.modes || ['image', 'error', 'height'];
const RERUN = 'https://unpkg.com/@rerun-io/web-viewer@0.23.1/index.js';   // unpkg resolves its extensionless imports

const fmt = {
  f: v => (v == null ? '—' : v.toFixed(3)),
  cm: v => (v == null ? '—' : `${(v * 100).toFixed(1)} cm`),
  n: v => (v == null ? '—' : v.toLocaleString('en-US')),
  mb: v => `${(v / 1e6).toFixed(0)} MB`,
};

const isDark = () => (document.documentElement.dataset.theme
  ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
// a pipeline's colour: its step for the dark page there (sources.json color_dark), else its own
const hue = key => (isDark() && systems[key]?.color_dark) || systems[key]?.color;

function setTheme(theme) {
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}
// ?theme=light or ?theme=dark in the address decides; else what the reader chose before; else the system
const asked = new URLSearchParams(location.search).get('theme');
if (asked === 'light' || asked === 'dark') setTheme(asked);
else try { setTheme(localStorage.getItem('accord-theme')); } catch { /* storage may be blocked */ }
$('theme').addEventListener('click', () => {
  const dark = isDark();
  setTheme(dark ? 'light' : 'dark');
  try { localStorage.setItem('accord-theme', dark ? 'light' : 'dark'); } catch { /* fine */ }
  update();                                                  // the pipelines' colours follow the theme
  for (const row of document.querySelectorAll('#board .bar-row')) {
    const fill = row.querySelector('.fill');
    if (fill) fill.style.background = hue(row.dataset.system);
  }
});

function select(container, button) {
  for (const b of container.querySelectorAll('button')) b.setAttribute('aria-selected', String(b === button));
}

function tabs(container, items, current, onPick) {
  container.replaceChildren(...items.map(item => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = item.label;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(item.id === current));
    if (item.disabled) b.disabled = true;
    b.addEventListener('click', () => { select(container, b); onPick(item.id); });
    return b;
  }));
}

const catalog = await (await fetch('assets/catalog.json')).json();
const systems = catalog.systems;
const videoGroup = id => (catalog.videos || []).find(g => g.id === id);

// identity: who made it and where it lives (sources.json identity)
const identity = catalog.identity || {};
const ICON = {
  paper: 'M6 2h8l5 5v15H6V2Zm7 1.5V8h4.5L13 3.5ZM8 12h9v1.6H8V12Zm0 3.4h9V17H8v-1.6Z',
  code: 'm8.6 16.6-4.6-4.6 4.6-4.6L7.2 6 1.2 12l6 6 1.4-1.4Zm6.8 0 4.6-4.6-4.6-4.6L16.8 6l6 6-6 6-1.4-1.4Z',
  data: 'M12 3C7.6 3 4 4.3 4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6c0-1.7-3.6-3-8-3Zm0 2c3.6 0 5.7.8 6 1-.3.2-2.4 1-6 1s-5.7-.8-6-1c.3-.2 2.4-1 6-1ZM6 8.3c1.5.5 3.6.7 6 .7s4.5-.2 6-.7V12c-.3.2-2.4 1-6 1s-5.7-.8-6-1V8.3Zm0 6c1.5.5 3.6.7 6 .7s4.5-.2 6-.7V18c-.3.2-2.4 1-6 1s-5.7-.8-6-1v-3.7Z',
  licence: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm-1.2 11.6-3.4-3.4 1.4-1.4 2 2 4.8-4.8 1.4 1.4-6.2 6.2Z',
};
const linkTo = (className, href, label, icon) => {
  const a = Object.assign(document.createElement('a'), { className, href });
  a.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON[icon]}"/></svg>${label}`;
  return a;
};
const paperHref = identity.arxiv || identity.pdf;
const authors = identity.authors || [];
$('authors').replaceChildren(...authors.map(name => Object.assign(document.createElement('span'), { textContent: name })));
$('affiliation').textContent = identity.affiliation || '';
if (paperHref) {
  $('identityLinks').append(linkTo('button primary', paperHref, identity.arxiv ? 'Paper (arXiv)' : 'Paper (PDF)', 'paper'));
  $('paperLinks').append(linkTo('chip-link', paperHref, identity.arxiv ? 'Read on arXiv' : 'Read the paper', 'paper'));
}
if (identity.code) {
  $('identityLinks').append(linkTo('button', identity.code, 'Code', 'code'));
  $('paperLinks').append(linkTo('chip-link', identity.code, 'Get the code', 'code'));
  Object.assign($('navRepo'), { href: identity.code, hidden: false });
  $('cloneLine').textContent = `git clone --recursive ${identity.code}.git`;
  $('cloneDir').textContent = identity.code.split('/').pop();
}
// the dataset, where it is published (build_site.py dataset, sources.json dataset.release)
const release = catalog.dataset?.release;
if (release) $('identityLinks').append(linkTo('button', release.hub, 'Dataset', 'data'));
$('footerIdentity').textContent = authors.length ? `${authors.join(', ')}${identity.affiliation ? ` · ${identity.affiliation}` : ''}` : '';
if (identity.abstract) $('abstractText').innerHTML = identity.abstract;
else $('abstract').hidden = true;

// how to cite it: from the same identity
if (authors.length && identity.title) {
  const key = `${authors[0].split(' ').pop().toLowerCase()}${identity.year || ''}accord`;
  const names = authors.map(a => { const parts = a.split(' '); return `${parts.pop()}, ${parts.join(' ')}`; }).join(' and ');
  const eprint = identity.arxiv?.match(/(\d{4}\.\d{4,5})/)?.[1];
  const fields = [['title', identity.title], ['author', names], ['year', identity.year || '']]
    .concat(eprint ? [['eprint', eprint], ['archivePrefix', 'arXiv']] : []);
  const width = Math.max(...fields.map(([k]) => k.length));
  $('bibtex').textContent = `@misc{${key},\n${fields.map(([k, v]) => `  ${k.padEnd(width)} = {${v}}`).join(',\n')}\n}`;
  $('cite').hidden = false;
  $('copyBibtex').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('bibtex').textContent); $('copyBibtex').textContent = 'Copied'; }
    catch { $('copyBibtex').textContent = 'Select and copy'; }
    setTimeout(() => { $('copyBibtex').textContent = 'Copy'; }, 1600);
  });
}

const byLabel = (group, label) => group?.items.find(it => it.label === label) || group?.items[0];
const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// the film that opens the page (build_site.py film): it plays muted as the page opens; the button starts it over with
// its sound; a chapter per scene
const film = catalog.film;
if (film) {
  const video = $('heroVideo'), sound = $('filmSound');
  video.poster = film.poster;
  video.src = film.src;
  $('heroCaption').innerHTML = `<b>${film.title}</b> (${clock(film.seconds)}). ${film.note}`;
  const chapters = film.chapters.map(c => {
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'chapter' });
    b.innerHTML = `<span class="t">${clock(c.t)}</span>${c.label}`;
    b.addEventListener('click', () => { video.currentTime = c.t + 0.7; video.play().catch(() => {}); });
    return b;
  });
  $('filmChapters').replaceChildren(...chapters);
  video.addEventListener('timeupdate', () => {
    const at = film.chapters.findLastIndex(c => video.currentTime >= c.t);
    chapters.forEach((b, i) => b.setAttribute('aria-current', String(i === at)));
  });
  const shown = () => {
    sound.setAttribute('aria-pressed', String(!video.muted));
    sound.querySelector('span').textContent = video.muted ? 'Play with sound' : 'Sound on';
  };
  sound.addEventListener('click', () => {
    if (video.muted) { video.muted = false; video.currentTime = 0; video.play().catch(() => {}); } else video.muted = true;
  });
  video.addEventListener('volumechange', shown);
  shown();
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) { if (video.muted) video.play().catch(() => {}); } else video.pause();
  }, { threshold: 0.15 }).observe(video);
} else {
  document.querySelector('.film').hidden = true;
}

// the facts under the film: the paper's numbers (build_site.py facts)
$('facts').innerHTML = (catalog.facts || []).map(f => `<div class="fact"><div class="value">${f.value}</div>`
  + `<div class="what">${f.label}</div><div class="note">${f.note}</div></div>`).join('');
$('facts').hidden = !(catalog.facts || []).length;

// ---------------------------------------------------------------------------------------------------- the explorer
const viewer = new Viewer($('stage'));
const datasets = catalog.datasets || [];
const state = { dataset: datasets[0]?.id, seq: null, a: 'ours', b: null, compare: false, mode: 'image',
                saturation: 0.15, scan: false, path: true, dark: false, size: 2.5, ceiling: null };
const cache = new Map();
let token = 0;
let framedSeq = null;

const dataset = () => datasets.find(d => d.id === state.dataset);
const sequence = () => dataset().sequences.find(s => s.id === state.seq);
const hasScan = () => !!sequence()?.scan;
const origin = seq => (seq.scan || seq.clouds.ours).offset;

function bestOther(seq) {
  const others = Object.entries(seq.clouds).filter(([k]) => k !== 'ours');
  others.sort((x, y) => (y[1].scores?.f5 ?? -1) - (x[1].scores?.f5 ?? -1));
  return others[0]?.[0] ?? null;
}

function load(meta, seq, progress) {
  if (!cache.has(meta.file)) {
    cache.set(meta.file, decode(meta, origin(seq), progress).catch(error => { cache.delete(meta.file); throw error; }));
    while (cache.size > 16) {
      const [oldest] = cache.keys();
      cache.get(oldest).then(g => g.dispose()).catch(() => {});
      cache.delete(oldest);
    }
  }
  return cache.get(meta.file);
}

function loading(text, fraction) {
  $('loading').classList.toggle('hidden', text == null);
  if (text != null) {
    $('loadingText').textContent = text;
    $('loadingBar').style.width = `${Math.round((fraction || 0) * 100)}%`;
  }
}

function writeHash() {
  const parts = [state.dataset, state.seq, state.a, state.compare ? state.b : '', state.mode];
  history.replaceState(null, '', `#map=${parts.join(',')}`);
}

function readHash() {
  const m = location.hash.match(/^#map=([^,]*),([^,]*),([^,]*),([^,]*),([^,]*)$/);
  if (!m) return false;
  const [, ds, seq, a, b, mode] = m.map(decodeURIComponent);
  const d = datasets.find(x => x.id === ds);
  const s = d?.sequences.find(x => x.id === seq);
  if (!s) return false;
  Object.assign(state, { dataset: ds, seq, a: s.clouds[a] ? a : 'ours', b: s.clouds[b] ? b : null, compare: !!s.clouds[b],
                         mode: ['image', 'error', 'height'].includes(mode) ? mode : 'image' });
  return true;
}

function systemButton(key, seq, pick, current) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'system';
  b.setAttribute('role', 'radio');
  const meta = seq.clouds[key];
  b.setAttribute('aria-checked', String(key === current));
  const f5 = meta?.scores?.f5;
  b.innerHTML = `<span class="dot" style="background:${hue(key)}"></span><span>${systems[key].label}</span>
    <span class="f">${meta ? (f5 != null ? `F ${fmt.f(f5)}` : '') : seq.missing[key]}</span>`;
  if (!meta) b.disabled = true;
  else b.addEventListener('click', () => pick(key));
  return b;
}

function renderSystems() {
  const seq = sequence();
  const keys = Object.keys(systems).filter(k => seq.clouds[k] || seq.missing[k]);
  $('systemsA').replaceChildren(...keys.map(k => systemButton(k, seq, key => { state.a = key; update(); }, state.a)));
  $('systemsB').replaceChildren(...keys.map(k => systemButton(k, seq, key => { state.b = key; update(); }, state.b)));
  $('comparePick').hidden = !state.compare;
  $('compare').checked = state.compare;
  $('compare').disabled = keys.length < 2;
}

function paneLabel(el, key) {
  if (!key) { el.replaceChildren(); return; }
  const meta = sequence().clouds[key];
  const f5 = meta.scores?.f5;
  el.innerHTML = `<span class="dot" style="background:${hue(key)}"></span>${systems[key].label}` +
    (f5 != null ? `<span class="f">F@5cm ${fmt.f(f5)}</span>` : '');
}

function renderScores() {
  const d = dataset(), seq = sequence();
  const keys = Object.keys(systems).filter(k => seq.clouds[k] || seq.missing[k]);
  const shown = new Set([state.a, state.compare ? state.b : null]);
  const scored = hasScan();
  const best = Math.max(...keys.map(k => seq.clouds[k]?.scores?.f5 ?? -1));
  const head = scored
    ? '<th>Pipeline</th><th class="num">F@5cm</th><th class="num">Precision</th><th class="num">Recall</th><th class="num">Accuracy</th><th class="num">Points shown</th>'
    : '<th>Pipeline</th><th class="num">Trajectory ATE</th><th class="num">Duration</th><th class="num">Points shown</th>';
  const rows = keys.map(k => {
    const m = seq.clouds[k];
    const name = `<span class="dot" style="background:${hue(k)}"></span>${systems[k].label}`;
    if (!m) return `<tr><td>${name}</td><td class="num" colspan="${scored ? 5 : 3}">${seq.missing[k]}</td></tr>`;
    const s = m.scores || {};
    const cells = scored
      ? `<td class="num${s.f5 === best ? ' best' : ''}">${fmt.f(s.f5)}</td><td class="num">${fmt.f(s.precision5)}</td>
         <td class="num">${fmt.f(s.recall5)}</td><td class="num">${fmt.cm(s.accuracy_median_m)}</td><td class="num">${fmt.n(m.count)}</td>`
      : `<td class="num">${fmt.cm(m.ate_final_m)}</td><td class="num">${m.duration_s ? `${m.duration_s.toFixed(0)} s` : '—'}</td>
         <td class="num">${fmt.n(m.count)}</td>`;
    return `<tr data-system="${k}" class="${shown.has(k) ? 'shown' : ''}"><td>${name}</td>${cells}</tr>`;
  });
  const notes = [];
  const ours = seq.clouds.ours;
  if (scored) {
    notes.push('F, precision and recall at 5 cm and the median accuracy are read from each cloud\'s score report'
      + (d.in_paper === false ? '; this dataset is not in the paper.' : ': the paper\'s numbers.')
      + (modesOf(d).includes('error') ? ' The colours are each shown point\'s distance to the scan, for display only.'
        : ' Each cloud is shown in its own colours, from the images; the reference\'s map is the one the scores measure against.'));
    if (ours.ate_final_m != null) notes.push(`Accord's trajectory: ${fmt.cm(ours.ate_final_m)} from the reference after a rigid fit.`);
  } else {
    notes.push(d.note ? `${d.note[0].toUpperCase()}${d.note.slice(1)}.` : '');
  }
  notes.push(`Points shown: the cloud thinned to one point per ${(d.voxel_m * 100).toFixed(1)} cm, at most 500,000.`);
  for (const k of keys) if (seq.clouds[k] && systems[k].note) notes.push(`${systems[k].label}: ${systems[k].note}.`);
  if (keys.some(k => seq.clouds[k] && !seq.clouds[k].color)) notes.push('Clouds stored without colours show in their pipeline\'s colour under Image.');
  $('scores').innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${rows.join('')}</tbody></table>
    <p class="foot">${notes.filter(Boolean).join(' ')}</p>`;
  for (const tr of $('scores').querySelectorAll('tr[data-system]')) {
    tr.addEventListener('click', () => {
      const k = tr.dataset.system;
      if (state.compare && k !== state.a) state.b = k; else state.a = k;
      update();
    });
  }
}

function renderControls() {
  const scored = hasScan();
  const allowed = modesOf(dataset());
  if ((!scored && state.mode === 'error') || !allowed.includes(state.mode)) state.mode = 'image';
  for (const b of $('colourTabs').querySelectorAll('button')) {
    b.setAttribute('aria-selected', String(b.dataset.mode === state.mode));
    b.disabled = (b.dataset.mode === 'error' && !scored) || !allowed.includes(b.dataset.mode);
    b.hidden = !allowed.includes(b.dataset.mode);
  }
  $('errorSlider').hidden = state.mode !== 'error';
  $('legend').hidden = state.mode !== 'error';
  $('saturationValue').textContent = `${Math.round(state.saturation * 100)} cm`;
  $('legendMax').textContent = `${Math.round(state.saturation * 100)} cm+`;
  $('showScan').disabled = !scored;
  $('showScan').checked = state.scan && scored;
  $('ceiling').value = state.ceiling;
  $('ceilingValue').textContent = state.ceiling >= 100 ? 'off' : `${state.ceiling}%`;
  $('pointSizeValue').textContent = `${state.size} px`;
  $('datasetNote').textContent = dataset().note ? `${dataset().platform}, ${dataset().camera}; ${dataset().note}.`
    : `${dataset().platform}, ${dataset().camera}.`;
  viewer.uniforms.uMode.value = { image: 0, error: 1, height: 2 }[state.mode];
  viewer.uniforms.uSaturation.value = state.saturation;
  viewer.uniforms.uSize.value = state.size;
  viewer.setCeiling(state.ceiling / 100);
  viewer.showPath(state.path);
  viewer.setDark(state.dark);
}

function renderTabs() {
  tabs($('datasetTabs'), datasets.map(d => ({ id: d.id, label: d.name })), state.dataset, id => pickDataset(id));
  tabs($('sequenceTabs'), dataset().sequences.map(s => ({ id: s.id, label: s.label })), state.seq, id => {
    state.seq = id;
    fixSystems();
    update();
  });
}

function fixSystems() {
  const seq = sequence();
  if (!seq.clouds[state.a]) state.a = 'ours';
  if (!state.b || !seq.clouds[state.b] || state.b === state.a) state.b = bestOther(seq) === state.a ? 'ours' : bestOther(seq);
  if (!state.b) state.compare = false;
}

function pickDataset(id, seqId) {
  state.dataset = id;
  state.seq = seqId || dataset().sequences[0].id;
  state.ceiling = LOOK[id]?.ceiling ?? 100;
  state.saturation = (LOOK[id]?.red ?? 15) / 100;
  if (dataset().compare) Object.assign(state, { compare: true, a: 'ours', b: dataset().compare });
  if (!modesOf(dataset()).includes(state.mode)) state.mode = modesOf(dataset())[0];
  fixSystems();
  renderTabs();
  update();
}

async function update() {
  const mine = ++token;
  const seq = sequence();
  for (const card of $('platforms').children) card.setAttribute('aria-current', String(card.dataset.id === state.dataset));
  renderSystems();
  renderControls();
  renderScores();
  writeHash();
  viewer.setSplit(state.compare);
  paneLabel($('labelA'), state.compare || state.a !== 'ours' ? state.a : null);
  paneLabel($('labelB'), state.compare ? state.b : null);
  const wanted = [seq.clouds.ours, seq.clouds[state.a], state.compare ? seq.clouds[state.b] : null].filter(Boolean);
  if (state.scan && seq.scan) wanted.push(seq.scan);
  const fractions = new Map(wanted.map(m => [m.file, cache.has(m.file) ? 1 : 0]));
  const progress = () => {
    const values = [...fractions.values()];
    if (values.every(v => v >= 1)) return;
    loading(`loading ${seq.label}…`, values.reduce((x, y) => x + y, 0) / values.length);
  };
  progress();
  try {
    const geometries = await Promise.all(wanted.map(m => load(m, seq, f => { fractions.set(m.file, f); progress(); })));
    if (mine !== token) return;
    const byFile = new Map(wanted.map((m, i) => [m.file, geometries[i]]));
    const key = `${state.dataset}/${state.seq}`;
    if (framedSeq !== key) {
      const o = origin(seq);
      const flat = seq.clouds.ours.trajectory?.map((v, i) => v - o[i % 3]);
      viewer.setFocus(byFile.get(seq.clouds.ours.file), flat);
      viewer.setCeiling(state.ceiling / 100);
      viewer.setTrajectory(flat, viewer.focus.size / 450);
      viewer.setScan(null);
    }
    viewer.setCloud(0, byFile.get(seq.clouds[state.a].file), hue(state.a));
    viewer.setCloud(1, state.compare ? byFile.get(seq.clouds[state.b].file) : null, hue(state.b));
    if (state.scan && seq.scan) viewer.setScan(byFile.get(seq.scan.file));
    viewer.showScan(state.scan && !!seq.scan);
    if (framedSeq !== key) {
      viewer.frame(LOOK[state.dataset]?.view || 'hero');
      framedSeq = key;
    }
    loading(null);
  } catch (error) {
    console.error(error);
    if (mine === token) loading(`could not load: ${error.message}`, 0);
  }
}

$('compare').addEventListener('change', e => {
  state.compare = e.target.checked;
  if (state.compare && hasScan() && state.mode === 'image' && modesOf(dataset()).includes('error')) state.mode = 'error';
  fixSystems();
  update();
});
for (const b of $('colourTabs').querySelectorAll('button')) {
  b.addEventListener('click', () => { state.mode = b.dataset.mode; renderControls(); writeHash(); });
}
$('saturation').addEventListener('input', e => { state.saturation = Number(e.target.value) / 100; renderControls(); });
$('ceiling').addEventListener('input', e => { state.ceiling = Number(e.target.value); renderControls(); });
$('pointSize').addEventListener('input', e => { state.size = Number(e.target.value); renderControls(); });
$('showScan').addEventListener('change', e => { state.scan = e.target.checked; update(); });
$('showPath').addEventListener('change', e => { state.path = e.target.checked; renderControls(); });
$('darkStage').addEventListener('change', e => { state.dark = e.target.checked; renderControls(); });
for (const b of document.querySelectorAll('.toolbar [data-view]')) b.addEventListener('click', () => viewer.frame(b.dataset.view));
$('spin').addEventListener('click', () => {
  viewer.spinning = !viewer.spinning;
  $('spin').setAttribute('aria-pressed', String(viewer.spinning));
});
viewer.onSpinStop = () => $('spin').setAttribute('aria-pressed', 'false');
$('fullscreen').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else $('stage').requestFullscreen?.();
});
viewer.onPortrait = () => {};
for (const a of document.querySelectorAll('[data-compare]')) {
  a.addEventListener('click', () => {
    if (!state.compare && Object.keys(sequence().clouds).length > 1) {
      state.compare = true;
      if (hasScan() && modesOf(dataset()).includes('error')) state.mode = 'error';
      fixSystems();
      update();
    }
  });
}

if (datasets.length) {
  const fromHash = readHash();
  state.seq ??= dataset().sequences[0].id;
  state.ceiling = LOOK[state.dataset]?.ceiling ?? 100;
  state.saturation = (LOOK[state.dataset]?.red ?? 15) / 100;
  if (!fromHash) fixSystems();
  if (!state.b) state.b = bestOther(sequence());
  renderTabs();
  update();
}

// platform cards: one per dataset, opening the explorer on it
$('platforms').replaceChildren(...datasets.map(d => {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'card';
  const poster = catalog.posters?.[d.id]?.src || byLabel(videoGroup(POSTER[d.id]), 'Three-quarter')?.poster;
  card.dataset.id = d.id;
  const pipelines = new Set(d.sequences.flatMap(s => Object.keys(s.clouds)));
  card.innerHTML = `<div class="thumb${poster ? '' : ' empty'}"${poster ? ` style="background-image:url('${poster}')"` : ''}></div>
    <div class="body"><h3>${d.name}</h3><p>${d.platform}</p>
    <div class="count">${d.sequences.length} seq. · ${pipelines.size} pipeline${pipelines.size > 1 ? 's' : ''}</div></div>`;
  card.addEventListener('click', () => {
    pickDataset(d.id);
    $('maps').scrollIntoView({ behavior: 'smooth' });
  });
  return card;
}));
for (const card of $('platforms').children) card.setAttribute('aria-current', String(card.dataset.id === state.dataset));

// ------------------------------------------------------------------------------------------------------- the videos
const featured = (catalog.videos || []).find(g => g.featured);
if (featured) {
  const item = featured.items[0];
  $('feature').innerHTML = `<video controls muted loop playsinline preload="none" poster="${item.poster}" src="${item.src}"></video>
    <div><p class="eyebrow">Side by side</p><h3>${featured.title}</h3><p>${featured.note}</p>
    <p class="note"><a href="#maps" id="featureLink">Open CC05 in the explorer, both maps under one camera →</a></p></div>`;
  const video = $('feature').querySelector('video');
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) video.play().catch(() => {}); else video.pause();
  }, { threshold: 0.4 }).observe(video);
  $('featureLink').addEventListener('click', () => {
    const spires = datasets.find(d => d.id === 'spires');
    if (!spires) return;
    Object.assign(state, { compare: true, a: 'ours', b: 'fvio', mode: 'error' });
    pickDataset('spires', 'cc05');
  });
}
const gallery = (catalog.videos || []).filter(g => !g.featured && !g.section);
const firstShot = group => Math.max(0, group.items.findIndex(it => it.label === 'Three-quarter'));
const playing = { group: gallery[0]?.id, item: gallery[0] ? firstShot(gallery[0]) : 0 };
function showVideo() {
  const group = gallery.find(g => g.id === playing.group);
  const item = group.items[playing.item];
  const player = $('videoPlayer');
  player.poster = item.poster;
  player.src = item.src;
  $('videoCaption').textContent = `${group.title}: ${group.note}. ${item.label}, ${item.seconds.toFixed(0)} s.`
    + (group.caption_note ? ` ${group.caption_note}` : '');
}
function renderVariants() {
  const group = gallery.find(g => g.id === playing.group);
  tabs($('variantTabs'), group.items.map((it, i) => ({ id: i, label: it.label })), playing.item, i => {
    playing.item = i;
    showVideo();
    $('videoPlayer').play().catch(() => {});
  });
}
if (gallery.length) {
  tabs($('videoTabs'), gallery.map(g => ({ id: g.id, label: g.title })), playing.group, id => {
    playing.group = id;
    playing.item = firstShot(gallery.find(g => g.id === id));
    renderVariants();
    showVideo();
  });
  renderVariants();
  showVideo();
}

// ------------------------------------------------------------------------------------------------------ the replays
let rerun = null;
function closeRerun() {
  if (rerun) { rerun.stop(); rerun = null; }
  $('rerunStage').replaceChildren();
  $('rerunStage').hidden = true;
}
async function openRerun(replay, card) {
  closeRerun();
  for (const c of $('replayCards').children) c.setAttribute('aria-pressed', String(c === card));
  $('rerunStage').hidden = false;
  $('rerunNote').textContent = 'Loading the Rerun viewer…';
  const { WebViewer } = await import(RERUN);
  rerun = new WebViewer();
  await rerun.start(new URL(replay.src, location.href).href, $('rerunStage'),
                    { hide_welcome_screen: true, width: '100%', height: '100%' });
  $('rerunNote').textContent = 'Drag to orbit, scroll to zoom; the timeline at the bottom scrubs the run.';
}
$('replayCards').replaceChildren(...(catalog.replays || []).map(replay => {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'replay';
  card.innerHTML = `<b>${replay.title}</b><span>${fmt.mb(replay.bytes)} recording</span>`;
  card.addEventListener('click', () => openRerun(replay, card).catch(error => {
    $('rerunNote').textContent = `The Rerun viewer could not start: ${error.message || error}`;
    console.error(error);
  }));
  return card;
}));

// ------------------------------------------------------------------------------------------------------- the method
if (catalog.figures?.method) $('methodFigure').src = catalog.figures.method.src;

// the paper's tables, as build_site.py read them from the rows the paper typesets
function renderResults() {
  const tables = catalog.results || [];
  $('results').hidden = !tables.length;
  $('resultsTables').innerHTML = tables.map(t => {
    const groups = (t.groups || []).map(([label, span]) => `<th class="num group" colspan="${span}">${label}</th>`).join('');
    const head = `<tr><th></th>${groups}</tr><tr><th>Pipeline</th>${t.columns.map((c, j) => `<th class="num">${c}`
      + (t.subcolumns ? `<span class="sub">${t.subcolumns[j]}</span>` : '') + '</th>').join('')}</tr>`;
    const body = t.rows.map(r => `<tr class="${r.rule ? 'rule' : ''}${r.cells[0].startsWith(systems.ours.label) ? ' ours' : ''}">`
      + `<td>${r.cells[0]}</td>${r.cells.slice(1).map(c => `<td class="num">${c}</td>`).join('')}</tr>`).join('');
    return `<div class="table-block reveal"><h3>${t.title || ''}</h3>`
      + `<div class="scores results-table"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>`
      + `<p class="foot">${t.note}</p></div>`;
  }).join('');
}
renderResults();

// the scoreboard: per test set, each dense pipeline's mean map score as the paper's tables give it (build_site.py
// reads them; nothing is computed here but the bars' lengths and who is first). Each panel has its own scale.
function renderScoreboard() {
  const sets = catalog.scoreboard || [];
  $('scoreboard').hidden = !sets.length;
  if (!sets.length) return;
  let lead = 0;
  $('board').innerHTML = sets.map(set => {
    const rows = set.entries.map(e => ({ ...e, value: e.failed ? -1 : parseFloat(e.text) })).sort((x, y) => y.value - x.value);
    const top = rows[0].value, ours = rows.find(r => r.system === 'ours');
    const first = ours.value === top && rows.filter(r => r.value === top).length === 1;
    const rank = rows.filter(r => r.value > ours.value).length + 1;
    if (first) lead += 1;
    const bars = rows.map(r => `<div class="bar-row${r.system === 'ours' ? ' ours' : ''}${r.failed ? ' failed' : ''}" data-system="${r.system}"`
      + ` title="${systems[r.system].label}${systems[r.system].note ? `: ${systems[r.system].note}` : ''}">`
      + `<span class="who">${systems[r.system].label}</span>`
      + `<span class="track">${r.failed ? '' : `<span class="fill" data-width="${(100 * r.value / top).toFixed(1)}" style="width:0;background:${hue(r.system)}"></span>`}</span>`
      + `<span class="num">${r.failed ? 'failed' : r.text}</span></div>`).join('');
    return `<article class="panel-score reveal"><header><div><h3>${set.name}</h3><div class="where">${set.where}</div></div>`
      + `<span class="badge${first ? '' : ' second'}">${first ? 'Accord first' : `Accord ${['', '1st', '2nd', '3rd'][rank] || `${rank}th`}`}</span></header>`
      + `<div class="bars">${bars}</div></article>`;
  }).join('');
  $('scoreClaim').innerHTML = `The best mean map score on <em>${lead} of ${sets.length}</em> test sets.`;
  const marks = Object.entries(systems).filter(([k, v]) => v.note && sets.some(set => set.entries.some(e => e.system === k)) && k !== 'base')
    .map(([, v]) => `${v.label}: ${v.note}.`).join(' ');
  $('boardNote').innerHTML = 'Each panel has its own scale, from 0 to its best score. Failed: every sequence failed (no output, or a '
    + `trajectory more than 10 m off). A pipeline that was not run on a test set is not listed there. ${marks} `
    + 'The numbers are those of the paper\'s tables: <a href="#results">Results in full</a>.';
  // the bars grow when their panel comes into view; a pipeline under the pointer is picked out in every panel
  const grow = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      for (const fill of entry.target.querySelectorAll('.fill')) fill.style.width = `${fill.dataset.width}%`;
      grow.unobserve(entry.target);
    }
  }, { threshold: 0.3 });
  for (const panel of $('board').children) grow.observe(panel);
  const hot = key => {
    if (key) $('board').dataset.hot = key; else delete $('board').dataset.hot;
    for (const row of $('board').querySelectorAll('.bar-row')) row.classList.toggle('hot', row.dataset.system === key);
  };
  $('board').addEventListener('pointerover', e => hot(e.target.closest('.bar-row')?.dataset.system));
  $('board').addEventListener('pointerleave', () => hot(null));
}
renderScoreboard();

// ------------------------------------------------------------------------------------------- the phone rig dataset
// what the release's sequences.csv says (build_site.py dataset): the walks, their totals, the video of all of them
function renderDataset() {
  const d = catalog.dataset;
  if (!d) return;
  const t = d.totals, group = videoGroup(d.video), item = group?.items[0];
  const min = s => { if (s == null) return '—'; const r = Math.round(s); return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`; };
  $('dataset').hidden = false;
  $('datasetLead').textContent = `${t.walks} walks, ${t.indoor} indoors and ${t.walks - t.indoor} outdoors, ${t.night} of them at night, `
    + 'recorded by a Samsung Galaxy Note 9 and an iPhone carried together, with a second iPhone, its LiDAR running RTAB-Map, '
    + 'alongside as the reference. Every frame is as released: people, faces and number plates blurred.';
  if (item) {
    const video = $('datasetVideo');
    let inView = false;
    const show = it => {
      video.poster = it.poster;
      video.src = it.src;
      $('datasetCaption').textContent = `${it.note || group.note}.`;
      if (inView) video.play().catch(() => {});
    };
    show(item);
    // more than one clip: a tab each (every walk at once, both phones with the depth, the reference)
    if (group.items.length > 1) {
      tabs($('datasetClips'), group.items.map((it, i) => ({ id: String(i), label: it.label })), '0', id => show(group.items[Number(id)]));
      $('datasetClips').hidden = false;
    }
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) video.play().catch(() => {}); else video.pause();
    }, { threshold: 0.3 }).observe(video);
  }
  const stat = (what, value, unit) => `<div class="stat"><div class="what">${what}</div><div class="value">${value}</div><div class="unit">${unit}</div></div>`;
  $('datasetStats').innerHTML = stat('Walks', t.walks, `${t.night} at night`)
    + stat('Walking', Math.round(t.walk_s / 60), 'minutes, by the reference')
    + stat('Distance', (t.path_m / 1000).toFixed(1), 'km, by the reference')
    + stat('Frames', `${Math.round(t.frames / 1000)}k`, `both phones, ${Math.round(t.android_s / 60)} + ${Math.round(t.iphone_s / 60)} min`);
  const rows = d.walks.map(w => `<tr><td>${w.sequence}</td><td>${w.scene}</td><td class="num">${min(w.walk_s)}</td>`
    + `<td class="num">${w.path_m == null ? '—' : Math.round(w.path_m)}</td><td class="num">${min(w.android_s)}</td>`
    + `<td class="num">${min(w.iphone_s)}</td><td class="num">${w.arkit_vs_reference_m == null ? '—' : (w.arkit_vs_reference_m * 100).toFixed(0)}</td></tr>`);
  $('datasetTable').innerHTML = '<table><thead><tr><th>Walk</th><th>Scene</th><th class="num">Duration</th><th class="num">Path, m</th>'
    + '<th class="num">Note 9</th><th class="num">iPhone</th><th class="num">vs ARKit, cm</th></tr></thead>'
    + `<tbody>${rows.join('')}</tbody></table>`;
  $('datasetFoot').textContent = `From the release's ${d.source.split('/').pop()}. ${d.foot}${d.status ? ` ${d.status}` : ''}`;
  // where it is published, and what its card says of it: the card's own rows and commands
  const r = d.release;
  if (r) {
    $('datasetLinks').append(linkTo('chip-link primary', r.hub, 'Dataset on Hugging Face', 'data'),
      linkTo('chip-link', r.licence_url, `Licence: ${r.licence}`, 'licence'),
      Object.assign(document.createElement('span'), { className: 'chip-link plain', textContent: `${(r.bytes / 1e9).toFixed(1)} GB` }));
    $('datasetFacts').replaceChildren(...r.facts.map(([what, value]) => {
      const row = document.createElement('div');
      row.append(Object.assign(document.createElement('dt'), { textContent: what }),
        Object.assign(document.createElement('dd'), { textContent: value }));
      return row;
    }));
    // a line per command, so a long one can wrap in a narrow column and still read as one command
    // (an option such as --local-dir stays in one piece: a line may otherwise break after its hyphens)
    $('datasetGet').replaceChildren(...r.get.map(line => {
      const cmd = Object.assign(document.createElement('span'), { className: 'cmd' });
      line.split(' ').forEach((word, i) => cmd.append(i ? ' ' : '', word.startsWith('-')
        ? Object.assign(document.createElement('span'), { className: 'opt', textContent: word }) : word));
      return cmd;
    }));
    $('datasetGetNote').textContent = r.get_note || '';
    $('copyDatasetGet').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(r.get.join('\n')); $('copyDatasetGet').textContent = 'Copied'; }
      catch { $('copyDatasetGet').textContent = 'Select and copy'; }
      setTimeout(() => { $('copyDatasetGet').textContent = 'Copy'; }, 1600);
    });
    $('datasetRelease').hidden = false;
  }
  $('datasetMapsLink').addEventListener('click', () => {
    if (datasets.some(x => x.id === 'phones')) pickDataset('phones');
  });
}
renderDataset();

// the paper's figures of the results, as build_site.py rendered them
$('resultFigures').innerHTML = Object.entries(catalog.figures || {}).filter(([, f]) => f.section === 'results')
  .map(([, f]) => `<figure class="figure ${f.layout || 'wide'}"><img src="${f.src}" alt="${f.alt || ''}" loading="lazy">`
    + `<figcaption>${f.caption || ''}</figcaption></figure>`).join('');

// --------------------------------------------------------------------------------------------------- the page itself
// what comes into view fades in once
const reveal = new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add('in'); reveal.unobserve(entry.target); }
}, { threshold: 0.08 });
document.documentElement.classList.add('reveal-ready');
for (const el of document.querySelectorAll('.reveal')) reveal.observe(el);

// One list is the way through the page: the sections that are shown, in order, under the names they give themselves
// (data-nav, data-tour in index.html). From it come the bar on top, the tour under the film, each section's number, the
// link to the next one that ends it, the rail at the side and the footer's list; a section that has nothing to show
// (hidden) is in none of them.
const stops = [...document.querySelectorAll('main > section[data-nav]')].filter(s => !s.hidden);
const two = i => String(i + 1).padStart(2, '0');
const svg = d => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const RIGHT = 'M5 11h11.2l-4.6-4.6L13 5l7 7-7 7-1.4-1.4 4.6-4.6H5v-2Z';
const DOWN = 'M11 5v11.2l-4.6-4.6L5 13l7 7 7-7-1.4-1.4-4.6 4.6V5h-2Z';
const UP = 'M11 19V7.8l-4.6 4.6L5 11l7-7 7 7-1.4 1.4L13 7.8V19h-2Z';
const anchor = (href, className, html) => Object.assign(document.createElement('a'), { href, className, innerHTML: html });
$('navLinks').replaceChildren(...stops.map(s => anchor(`#${s.id}`, '', s.dataset.nav)));
$('tour').replaceChildren(...stops.map((s, i) => anchor(`#${s.id}`, '',
  `<span class="n">${two(i)}</span><b>${s.dataset.nav}</b>${svg(RIGHT)}<span class="line">${s.dataset.tour}</span>`)));
$('rail').replaceChildren(...stops.map(s => anchor(`#${s.id}`, '', `<span>${s.dataset.nav}</span><i></i>`)));
$('footNav').replaceChildren(...stops.map((s, i) => anchor(`#${s.id}`, '', `<span class="n">${two(i)}</span>${s.dataset.nav}`)));
stops.forEach((s, i) => {
  const eyebrow = s.querySelector('.eyebrow');
  if (eyebrow) eyebrow.dataset.n = two(i);
  const next = stops[i + 1], wraps = s.querySelectorAll(':scope > .wrap');
  wraps[wraps.length - 1].append(next
    ? anchor(`#${next.id}`, 'next', `<span class="k">Next</span><span class="n">${two(i + 1)}</span><b>${next.dataset.nav}</b>`
      + `<span class="line">${next.dataset.tour}</span>${svg(DOWN)}`)
    : anchor('#top', 'next up', `<span class="k">The end</span><b>Back to the top</b><span class="line"></span>${svg(UP)}`));
});
// a glow follows the pointer over the tour's cards
$('tour').addEventListener('pointermove', e => {
  const card = e.target.closest('a');
  if (!card) return;
  const box = card.getBoundingClientRect();
  card.style.setProperty('--mx', `${e.clientX - box.left}px`);
  card.style.setProperty('--my', `${e.clientY - box.top}px`);
});

// the bar and the rail mark the section being read; where the bar scrolls sideways its mark stays in sight
const marks = stops.map(s => [s, [...document.querySelectorAll(`#navLinks a[href="#${s.id}"], #rail a[href="#${s.id}"]`)]]);
const seen = new Map();
const spy = new IntersectionObserver(entries => {
  for (const entry of entries) seen.set(entry.target, entry.isIntersecting);
  const current = stops.find(s => seen.get(s));
  for (const [s, links] of marks) for (const a of links) a.setAttribute('aria-current', String(s === current));
  const bar = $('navLinks'), a = current && bar.querySelector(`a[href="#${current.id}"]`);
  if (a && bar.scrollWidth > bar.clientWidth) bar.scrollTo({ left: a.offsetLeft - (bar.clientWidth - a.offsetWidth) / 2, behavior: 'smooth' });
}, { rootMargin: '-45% 0px -50% 0px' });
for (const s of stops) spy.observe(s);

// how far down the page: the line under the bar; past the opening, the rail and the way back up appear
let queued = false;
const onScroll = () => {
  queued = false;
  const room = document.documentElement.scrollHeight - innerHeight;
  $('progress').style.transform = `scaleX(${room > 0 ? Math.min(1, scrollY / room) : 0})`;
  const past = scrollY > innerHeight * 0.9;
  $('toTop').classList.toggle('on', past);
  $('rail').classList.toggle('on', past);
};
addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(onScroll); } }, { passive: true });
addEventListener('resize', onScroll);
onScroll();

// the footer: where the paper, the code and the dataset are, and under which licences
$('footLinks').replaceChildren(...[[paperHref, identity.arxiv ? 'Paper (arXiv)' : 'Paper (PDF)', 'paper'], [identity.code, 'Code', 'code'],
  [release?.hub, 'Dataset', 'data']].filter(([href]) => href).map(([href, label, icon]) => linkTo('button', href, label, icon)));
if (release) $('footLicence').textContent = `Accord is GPL-3.0; the phone rig dataset is ${release.licence}.`;
