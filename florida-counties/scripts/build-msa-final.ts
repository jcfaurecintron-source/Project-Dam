/**
 * Build Florida MSA GeoJSON - Final Version
 * 
 * Properly merges county geometries into MSA boundaries.
 * Handles MultiPolygons, preserves coastlines, no rectangles.
 */

import fs from 'fs';
import flatten from '@turf/flatten';
import combine from '@turf/combine';
import union from '@turf/union';
import { featureCollection, polygon, multiPolygon } from '@turf/helpers';

function normalizeCode(code: string): string {
  const digits = code.replace(/\D/g, '');
  return digits.slice(-5);
}

async function buildMsaFinal(): Promise<void> {
  console.log('🗺️  Building Florida MSA GeoJSON (Final)...\n');

  const countyGeoJson = JSON.parse(fs.readFileSync('public/florida-counties.geojson', 'utf-8'));
  const countyMsaMap = JSON.parse(fs.readFileSync('src/data/county-to-msa.json', 'utf-8'));

  console.log(`📊 Input counties: ${countyGeoJson.features.length}`);

  // Group by MSA
  const msaGroups = new Map<string, any[]>();
  const msaNames = new Map<string, string>();

  countyGeoJson.features.forEach((feature: any) => {
    const geoId = feature.properties.GEO_ID?.replace('0500000US', '');
    if (!geoId) return;

    const msaInfo = countyMsaMap.countyToMsa[geoId];
    if (!msaInfo) return;

    const code = normalizeCode(msaInfo.msaCode);
    
    if (!msaGroups.has(code)) {
      msaGroups.set(code, []);
      msaNames.set(code, msaInfo.msaName);
    }

    // Flatten MultiPolygons into individual Polygons
    if (feature.geometry.type === 'MultiPolygon') {
      const flattened = flatten(feature);
      flattened.features.forEach((f: any) => {
        msaGroups.get(code)!.push(f);
      });
    } else {
      msaGroups.get(code)!.push(feature);
    }
  });

  console.log(`🏢 MSAs to create: ${msaGroups.size}\n`);

  const msaFeatures: any[] = [];

  msaGroups.forEach((features, code) => {
    const name = msaNames.get(code) || `MSA ${code}`;
    console.log(`   ${code}: ${name} (${features.length} polygons)`);

    try {
      if (features.length === 1) {
        // Single polygon - use as is
        msaFeatures.push({
          type: 'Feature',
          properties: {
            CBSAFP: code,
            NAME: name,
          },
          geometry: features[0].geometry,
        });
      } else {
        // Multiple polygons - union them
        let result = features[0];
        
        for (let i = 1; i < features.length; i++) {
          try {
            const unioned = union(result, features[i]);
            if (unioned) {
              result = unioned;
            }
          } catch (err) {
            // If union fails, collect all polygons as MultiPolygon
            console.log(`     ⚠️ Union failed, creating MultiPolygon`);
            const allCoords = features.map((f: any) => {
              if (f.geometry.type === 'Polygon') {
                return f.geometry.coordinates;
              }
              return null;
            }).filter(Boolean);
            
            result = multiPolygon(allCoords);
            break;
          }
        }

        msaFeatures.push({
          type: 'Feature',
          properties: {
            CBSAFP: code,
            NAME: name,
          },
          geometry: result.geometry,
        });
      }
      console.log(`     ✓ Created`);
    } catch (err) {
      console.error(`     ❌ Failed:`, err);
    }
  });

  const output = featureCollection(msaFeatures);
  fs.writeFileSync('public/data/fl-msas.geojson', JSON.stringify(output, null, 2));

  const stats = fs.statSync('public/data/fl-msas.geojson');
  console.log(`\n✅ Created ${msaFeatures.length} MSA features`);
  console.log(`📦 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
}

buildMsaFinal().catch(console.error);

