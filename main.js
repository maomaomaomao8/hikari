import mapboxgl from 'mapbox-gl';
import { estimateFeedingCount } from './src/synthesis.js';
import { generateCopy } from './src/copygen.js';
import { saveTap, deleteTap, getTaps } from './src/supabase.js';
import { previewTaps } from './src/previewdata.js';

let currentMode = 'live';

(async () => {
  try {
    const now = new Date();
    const count = await estimateFeedingCount(now);
    console.log('[hikari] Estimated feeding count:', count);

    document.getElementById('count-line').textContent =
      `~ ${count.toLocaleString('en-US')} parents worldwide`;

    const utcHour = now.getUTCHours();
    const sentence = await generateCopy(count, utcHour);
    console.log('[copygen]', sentence);
    document.getElementById('copy-line').textContent = sentence;
  } catch (err) {
    console.error('[hikari] Error:', err);
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

  addDayNightLayer();
});

function addDayNightLayer() {
  const now = new Date();
  const dayOfYear = Math.floor(
    (now - new Date(now.getFullYear(), 0, 0)) / 86400000
  );
  const declination = -23.44 * Math.cos((360 / 365) * (dayOfYear + 10) * (Math.PI / 180));
  const hourUTC = now.getUTCHours() + now.getUTCMinutes() / 60;
  const subsolarLng = (12 - hourUTC) * 15;

  const coords = buildTerminatorPolygon(declination, subsolarLng);

  map.addSource('night', {
    type: 'geojson',
    data: {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [coords] },
    },
  });

  map.addLayer({
    id: 'night-layer',
    type: 'fill',
    source: 'night',
    paint: {
      'fill-color': '#000010',
      'fill-opacity': 0.35,
    },
  });
}

function buildTerminatorPolygon(declination, subsolarLng) {
  const decRad = declination * (Math.PI / 180);
  const points = [];

  for (let i = 0; i <= 360; i++) {
    const lngOffset = i - 180;
    const lng = subsolarLng + lngOffset;
    const lat =
      Math.atan(
        -Math.cos((lngOffset * Math.PI) / 180) / Math.tan(decRad)
      ) * (180 / Math.PI);
    points.push([normLng(lng), lat]);
  }

  const nightSide = declination >= 0 ? -90 : 90;
  const polygon = [];
  polygon.push([normLng(subsolarLng - 180), nightSide]);
  for (let i = points.length - 1; i >= 0; i--) {
    polygon.push(points[i]);
  }
  polygon.push([normLng(subsolarLng + 180), nightSide]);
  polygon.push([normLng(subsolarLng - 180), nightSide]);

  return polygon;
}

function normLng(lng) {
  while (lng > 180) lng -= 360;
  while (lng < -180) lng += 360;
  return lng;
}

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
}

function updateTapDots(taps) {
  setupTapLayer();
  map.getSource('taps').setData(getTapGeoJSON(taps));
}

async function loadRecentTaps() {
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
      try {
        const row = await saveTap(loc.lat, loc.lng);
        console.log('[taps] Saved tap:', JSON.stringify(row));
        activeTapId = row.id;
        await loadRecentTaps();
      } catch (err) {
        console.error('[taps] Save error:', err);
      }
    } else {
      btn.textContent = 'I\'m feeding right now';
      btn.classList.remove('done');
      try {
        await deleteTap(activeTapId);
        console.log('[taps] Deleted tap:', activeTapId);
        activeTapId = null;
        await loadRecentTaps();
      } catch (err) {
        console.error('[taps] Delete error:', err);
        activeTapId = null;
      }
    }
  });
}
