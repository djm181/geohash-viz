// Import stylesheets
import './style.css';
import mapboxgl from 'mapbox-gl'; // or "const mapboxgl = require('mapbox-gl');"
import {
  circle,
  bboxPolygon,
  bbox,
  centroid,
  Point,
  Polygon,
} from '@turf/turf';
import 'mapbox-gl/dist/mapbox-gl.css';

const center: Point = { type: 'Point', coordinates: [-74.485, 50] };
const hashResolution = 5000;
const radiusKm = 2;

mapboxgl.accessToken =
  'pk.eyJ1IjoiZGF2aWRtaXRjaGVsbHBhdHJvbGlvIiwiYSI6ImNrZ3R4M3E1dDA3bmMycXFmMTB3cGwxa2oifQ.2dD6QU7zbDZrV4lxm8-gsQ';
const map = new mapboxgl.Map({
  container: 'map', // container ID
  style: 'mapbox://styles/mapbox/streets-v12', // style URL
  center: center.coordinates, // starting position [lng, lat]
  zoom: 9, // starting zoom
  doubleClickZoom: false,
});

let rad = circle(center, radiusKm, { units: 'kilometers' });

map.on('load', () => {
  map.addSource('radius', {
    type: 'geojson',
    data: rad,
  });

  map.addLayer({
    id: 'radius',
    type: 'fill',
    source: 'radius',
    layout: {},
    paint: {
      'fill-color': '#ff0000',
      'fill-opacity': 0.4,
    },
  });

  const boxes = calcBoxes(rad);

  map.addSource('boxes', {
    type: 'geojson',
    data: boxes,
  });

  map.addLayer({
    id: 'boxes',
    type: 'line',
    source: 'boxes',
    layout: {},
    paint: {
      'line-color': '#00ff00',
      'line-width': 4,
    },
  });

  map.addSource('crime', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: center }
      ]
    }
  });

  map.addLayer({
    id: 'crime',
    type: 'circle',
    source: 'crime',
    paint: {
      'circle-color': '#0000ff',
      'circle-radius': 4
    }
  })
});

map.on('dblclick', (e) => {
  rad = circle(e.lngLat.toArray(), radiusKm);
  const r = map.getSource('radius');
  if (r.type == 'geojson') {
    r.setData(rad);
  }
  const b = map.getSource('boxes');
  if (b.type == 'geojson') {
    b.setData(calcBoxes(rad));
  }

  const c = map.getSource('crime');
  if (c.type == 'geojson') {
    const params = {
      json: {
        lat: e.lngLat.lat,
        lon: e.lngLat.lng,
        radiusKm: 2
      }
    };
    fetch(`http://localhost:3000/dev/crimesInRadius?input=${JSON.stringify(params)}`, {
      headers: {
        'x-api-key': 'd41d8cd98f00b204e9800998ecf8427e'
      }
    })
    .then(r => r.json())
    .then(r => {
      c.setData({
        type: 'FeatureCollection',
        features: r.result.data.json.map(cr => ({
          type: 'Feature',
          geometry: cr.location
        }))
      })
    })
  }
});

function calculateGeoHash(location: Point): number {
  return (
    singleGeohash(location.coordinates[0]) * hashResolution +
    singleGeohash(location.coordinates[1])
  );
}

function singleGeohash(coord: number): number {
  return Math.floor(((coord + 180) / 360) * hashResolution);
}

function geoHashBounds(hash: number): [number, number, number, number] {
  const hy = hash % hashResolution;
  const hx = Math.floor(hash / hashResolution);

  const hToDeg = (h: number) => (h / hashResolution) * 360 - 180;

  return [hToDeg(hx), hToDeg(hy), hToDeg(hx + 1), hToDeg(hy + 1)];
}

function calcBoxes(poly: Polygon) {
  const bounds = bbox(poly);
  const minHash = calculateGeoHash({
    type: 'Point',
    coordinates: bounds.slice(0, 2),
  });
  const maxHash = calculateGeoHash({
    type: 'Point',
    coordinates: bounds.slice(2, 4),
  });

  const miny = minHash % hashResolution;
  const maxy = maxHash % hashResolution;
  const minx = Math.floor(minHash / hashResolution);
  const maxx = Math.floor(maxHash / hashResolution);

  const boxes = [];
  const hashes = [];
  for (let x = minx; x <= maxx; x++) {
    for (let y = miny; y <= maxy; y++) {
      hashes.push(x * hashResolution + y);
      boxes.push(bboxPolygon(geoHashBounds(x * hashResolution + y)));
    }
  }

  const appDiv: HTMLElement = document.getElementById('app');
  appDiv.innerHTML = `<p>${hashes.join('</p><p>')}</p><p>${JSON.stringify(
    centroid(rad)
  )}`;

  return {
    type: 'FeatureCollection',
    features: boxes,
  };
}

// Write TypeScript code!
