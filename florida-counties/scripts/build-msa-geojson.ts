/**
 * Build Florida MSA GeoJSON from county boundaries
 * 
 * Merges county polygons into MSA polygons based on county-to-MSA mapping
 */

import fs from 'fs';

async function buildMsaGeoJson(): Promise<void> {
  console.log('🗺️  Building Florida MSA GeoJSON...\n');

  // Load county GeoJSON
  const countyGeoJson = JSON.parse(
    fs.readFileSync('public/florida-counties.geojson', 'utf-8')
  );

  // Load county-to-MSA mapping
  const countyMsaMap = JSON.parse(
    fs.readFileSync('src/data/county-to-msa.json', 'utf-8')
  );

  console.log(`📊 Counties: ${countyGeoJson.features.length}`);

  // Group counties by MSA
  const msaToCounties = new Map<string, any[]>();

  countyGeoJson.features.forEach((feature: any) => {
    const geoId = feature.properties.GEO_ID?.replace('0500000US', '');
    if (!geoId) return;

    const msaInfo = countyMsaMap.countyToMsa[geoId];
    if (msaInfo) {
      if (!msaToCounties.has(msaInfo.msaCode)) {
        msaToCounties.set(msaInfo.msaCode, []);
      }
      msaToCounties.get(msaInfo.msaCode)!.push(feature);
    }
  });

  console.log(`🏢 MSAs with boundaries: ${msaToCounties.size}\n`);

  // Create MSA features (simplified - use first county's geometry for single-county MSAs,
  // or create a bounding box for multi-county MSAs)
  const msaFeatures: any[] = [];

  msaToCounties.forEach((counties, msaCode) => {
    const msaName = counties[0]?.properties.NAME 
      ? `${counties[0].properties.NAME} MSA` 
      : msaCode;

    // For simplicity, if MSA has multiple counties, use union of bounding boxes
    // In production, you'd use turf.js to merge geometries properly
    if (counties.length === 1) {
      // Single county MSA - use that county's geometry
      msaFeatures.push({
        type: 'Feature',
        properties: {
          CBSAFP: msaCode,
          NAME: Object.values(countyMsaMap.countyToMsa).find(
            (m: any) => m.msaCode === msaCode
          )?.msaName || msaName,
          COUNTIES: 1,
        },
        geometry: counties[0].geometry,
      });
    } else {
      // Multi-county MSA - create approximate boundary
      // Calculate bounding box of all counties
      let minLng = Infinity, minLat = Infinity;
      let maxLng = -Infinity, maxLat = -Infinity;

      counties.forEach((county) => {
        const coords = getAllCoordinates(county.geometry);
        coords.forEach(([lng, lat]) => {
          minLng = Math.min(minLng, lng);
          maxLng = Math.max(maxLng, lng);
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
        });
      });

      // Create polygon from bounding box
      msaFeatures.push({
        type: 'Feature',
        properties: {
          CBSAFP: msaCode,
          NAME: Object.values(countyMsaMap.countyToMsa).find(
            (m: any) => m.msaCode === msaCode
          )?.msaName || msaName,
          COUNTIES: counties.length,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [minLng, minLat],
            [maxLng, minLat],
            [maxLng, maxLat],
            [minLng, maxLat],
            [minLng, minLat],
          ]],
        },
      });
    }
  });

  const msaGeoJson = {
    type: 'FeatureCollection',
    features: msaFeatures,
  };

  // Save
  fs.writeFileSync(
    'public/data/fl-msas.geojson',
    JSON.stringify(msaGeoJson, null, 2)
  );

  console.log(`✅ Created Florida MSA GeoJSON`);
  console.log(`📁 Output: public/data/fl-msas.geojson`);
  console.log(`🏢 MSA features: ${msaFeatures.length}`);
  console.log(`\n📋 MSAs included:`);
  msaFeatures.forEach((f) => {
    console.log(`   ${f.properties.CBSAFP}: ${f.properties.NAME} (${f.properties.COUNTIES} counties)`);
  });
}

// Helper to extract all coordinates from any geometry type
function getAllCoordinates(geometry: any): [number, number][] {
  const coords: [number, number][] = [];
  
  function extract(g: any) {
    if (g.type === 'Polygon') {
      g.coordinates[0].forEach((c: [number, number]) => coords.push(c));
    } else if (g.type === 'MultiPolygon') {
      g.coordinates.forEach((poly: any) => {
        poly[0].forEach((c: [number, number]) => coords.push(c));
      });
    } else if (Array.isArray(g)) {
      g.forEach(extract);
    }
  }
  
  extract(geometry);
  return coords;
}

buildMsaGeoJson().catch(console.error);

