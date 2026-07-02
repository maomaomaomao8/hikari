import mapboxgl from 'mapbox-gl';
import { estimateFeedingCount } from './src/synthesis.js';
import { generateCopy } from './src/copygen.js';
import { saveTap, deleteTap, getTaps } from './src/supabase.js';
import { previewTaps } from './src/previewdata.js';

let currentMode = 'live';
let userLocation = null;

const FALLBACK_COPY = 'Around 80,000 parents are in this moment with you right now, feeding someone small.';
const FALLBACK_COUNT = '~ 80,000 parents worldwide';

document.getElementById('copy-line').textContent = FALLBACK_COPY;
document.getElementById('count-line').textContent = FALLBACK_COUNT;

(async () => {
  const now = new Date();
  const utcHour = now.getUTCHours();

  const countPromise = estimateFeedingCount(now).then((count) => {
    console.log('[hikari] Estimated feeding count:', count);
    document.getElementById('count-line').textContent =
      `~ ${count.toLocaleString('en-US')} parents worldwide`;
    return count;
  });

  const copyPromise = countPromise.then((count) =>
    generateCopy(count, utcHour).then((sentence) => {
      console.log('[copygen]', sentence);
      document.getElementById('copy-line').textContent = sentence;
    })
  );

  try {
    await Promise.all([countPromise, copyPromise]);
  } catch (err) {
    console.error('[hikari] API error — using fallback text:', err);
  }
})();

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v11',
  projection: 'globe',
  center: [100, 20],
  zoom: 1.5,
  interactive: true,
  dragRotate: true,
  scrollZoom: true,
  touchZoomRotate: true,
  doubleClickZoom: false,
  keyboard: false,
});

let rotating = true;
let resumeTimer = null;

function pauseRotation() {
  rotating = false;
  clearTimeout(resumeTimer);
}

function scheduleResume() {
  clearTimeout(resumeTimer);
  resumeTimer = setTimeout(() => { rotating = true; }, 2000);
}

map.on('mousedown', pauseRotation);
map.on('touchstart', pauseRotation);
map.on('wheel', pauseRotation);
map.on('mouseup', scheduleResume);
map.on('touchend', scheduleResume);
map.on('wheel', scheduleResume);

map.on('style.load', () => {
  map.setFog({
    color: 'rgb(20, 20, 30)',
    'high-color': 'rgb(40, 40, 80)',
    'horizon-blend': 0.08,
    'space-color': '#0a0a0f',
    'star-intensity': 0.4,
  });

});

function rotate() {
  if (rotating) {
    const center = map.getCenter();
    center.lng -= 0.006;
    map.setCenter(center);
  }
  requestAnimationFrame(rotate);
}

let mapLoaded = false;

map.on('load', () => {
  mapLoaded = true;
  rotate();
  setupTaps();
  loadRecentTaps();
});

setupModeToggle();

function getTapGeoJSON(taps) {
  return {
    type: 'FeatureCollection',
    features: taps.map((t) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [t.lng, t.lat] },
    })),
  };
}

function setupTapLayer() {
  if (map.getSource('taps')) return;

  map.addSource('taps', {
    type: 'geojson',
    data: getTapGeoJSON([]),
  });

  map.addLayer({
    id: 'taps-glow',
    type: 'circle',
    source: 'taps',
    paint: {
      'circle-radius': 12,
      'circle-color': '#ffffff',
      'circle-opacity': 0.08,
      'circle-blur': 1,
    },
  });

  map.addLayer({
    id: 'taps-dot',
    type: 'circle',
    source: 'taps',
    paint: {
      'circle-radius': 3,
      'circle-color': '#ffffff',
      'circle-opacity': 0.7,
    },
  });

  map.addLayer({
    id: 'taps-hit',
    type: 'circle',
    source: 'taps',
    paint: {
      'circle-radius': 20,
      'circle-color': '#ffffff',
      'circle-opacity': 0,
    },
  });
}

function updateTapDots(taps) {
  setupTapLayer();
  map.getSource('taps').setData(getTapGeoJSON(taps));
}

function setupUserDotLayer() {
  if (map.getSource('user-dot')) return;

  map.addSource('user-dot', {
    type: 'geojson',
    data: getTapGeoJSON([]),
  });

  map.addLayer({
    id: 'user-dot-glow',
    type: 'circle',
    source: 'user-dot',
    paint: {
      'circle-radius': 14,
      'circle-color': '#ffffff',
      'circle-opacity': 0.12,
      'circle-blur': 1,
    },
  });

  map.addLayer({
    id: 'user-dot-core',
    type: 'circle',
    source: 'user-dot',
    paint: {
      'circle-radius': 4,
      'circle-color': '#ffffff',
      'circle-opacity': 0.9,
    },
  });
}

function updateUserDot(loc) {
  setupUserDotLayer();
  map.getSource('user-dot').setData(
    loc ? getTapGeoJSON([loc]) : getTapGeoJSON([])
  );
}

async function loadRecentTaps() {
  if (currentMode !== 'live') return;
  try {
    const taps = await getTaps();
    console.log('[taps] Loaded recent taps:', taps.length);
    updateTapDots(taps);
  } catch (err) {
    console.error('[taps] Load error:', err);
  }
}

function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        console.log('[geo] Raw result:', pos.coords.latitude, pos.coords.longitude, 'accuracy:', pos.coords.accuracy);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        console.log('[geo] Denied or failed:', err.message);
        reject(err);
      },
      { timeout: 5000 }
    );
  });
}

function setupModeToggle() {
  const liveBtn = document.getElementById('mode-live');
  const previewBtn = document.getElementById('mode-preview');
  const label = document.getElementById('preview-label');

  function applyMode(mode) {
    currentMode = mode;
    liveBtn.classList.toggle('active', mode === 'live');
    previewBtn.classList.toggle('active', mode === 'preview');
    label.style.display = mode === 'preview' ? 'block' : 'none';
    if (!mapLoaded) return;
    if (mode === 'preview') updateTapDots(previewTaps);
    else loadRecentTaps();
  }

  applyMode('live');

  liveBtn.addEventListener('click', () => {
    if (currentMode !== 'live') applyMode('live');
  });

  previewBtn.addEventListener('click', () => {
    if (currentMode !== 'preview') applyMode('preview');
  });
}

function setupTaps() {
  const btn = document.getElementById('tap-btn');
  const hint = document.getElementById('location-hint');
  let activeTapId = null;

  btn.addEventListener('click', async () => {
    if (!activeTapId) {
      let loc;
      try {
        loc = await getUserLocation();
      } catch {
        hint.style.display = 'block';
        return;
      }
      hint.style.display = 'none';
      btn.textContent = 'I\'m done feeding';
      btn.classList.add('done');
      userLocation = loc;
      updateUserDot(loc);
      try {
        const row = await saveTap(loc.lat, loc.lng);
        console.log('[taps] Saved tap:', JSON.stringify(row));
        activeTapId = row.id;
      } catch (err) {
        console.error('[taps] Save error:', err);
      }
    } else {
      btn.textContent = 'I\'m feeding right now';
      btn.classList.remove('done');
      userLocation = null;
      updateUserDot(null);
      try {
        await deleteTap(activeTapId);
        console.log('[taps] Deleted tap:', activeTapId);
        activeTapId = null;
      } catch (err) {
        console.error('[taps] Delete error:', err);
        activeTapId = null;
      }
    }
  });
}

if (window.matchMedia('(max-width: 768px)').matches) {
  setTimeout(() => {
    document.getElementById('overlay-text').classList.add('faded');
  }, 5000);
}

let tooltipTimer = null;

function hideTooltip() {
  const el = document.getElementById('dot-tooltip');
  el.classList.remove('visible');
  clearTimeout(tooltipTimer);
}

function showTooltip(x, y, text) {
  hideTooltip();
  const el = document.getElementById('dot-tooltip');
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y - 40}px`;
  el.classList.add('visible');
  tooltipTimer = setTimeout(hideTooltip, 3000);
}

function isUserDot(lng, lat) {
  if (!userLocation) return false;
  return Math.abs(lng - userLocation.lng) < 0.01 && Math.abs(lat - userLocation.lat) < 0.01;
}

function getLocalTime(lng) {
  const now = new Date();
  const offsetHours = Math.round(lng / 15);
  const localMs = now.getTime() + offsetHours * 3600000 + now.getTimezoneOffset() * 60000;
  const local = new Date(localMs);
  const h = local.getHours();
  const m = local.getMinutes();
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')}${ampm}`;
}

async function reverseGeocode(lng, lat) {
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxgl.accessToken}&types=place,country&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.features && data.features.length > 0) {
      const parts = data.features[0].place_name.split(', ');
      if (parts.length >= 2) return `${parts[0]}, ${parts[parts.length - 1]}`;
      return parts[0];
    }
  } catch {}
  return null;
}

map.on('mouseenter', 'taps-hit', () => { map.getCanvas().style.cursor = 'pointer'; });
map.on('mouseleave', 'taps-hit', () => { map.getCanvas().style.cursor = ''; });

async function handleDotTap(point) {
  const features = map.queryRenderedFeatures(point, { layers: ['taps-hit'] });
  if (!features.length) { hideTooltip(); return; }
  const [lng, lat] = features[0].geometry.coordinates;
  if (isUserDot(lng, lat)) return;
  const projected = map.project([lng, lat]);
  const time = getLocalTime(lng);
  showTooltip(projected.x, projected.y, `${time} · ...`);
  const place = await reverseGeocode(lng, lat);
  if (place) showTooltip(projected.x, projected.y, `${time} · ${place}`);
}

map.on('click', (e) => { handleDotTap(e.point); });

map.getCanvas().addEventListener('touchend', (e) => {
  if (e.changedTouches.length === 0) return;
  const touch = e.changedTouches[0];
  const rect = map.getCanvas().getBoundingClientRect();
  const point = new mapboxgl.Point(
    touch.clientX - rect.left,
    touch.clientY - rect.top
  );
  handleDotTap(point);
});
