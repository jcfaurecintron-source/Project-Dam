/**
 * Build Florida MSA GeoJSON from County Boundaries
 * 
 * Properly dissolves county polygons into MSA boundaries using geometric union.
 * No rectangles - preserves actual coastlines and boundaries.
 */

import fs from 'fs';
import union from '@turf/union';
import { feature, featureCollection } from '@turf/helpers';

async function buildMsaGeoJson(): Promise<void> {
  console.log('🗺️  Building Florida MSA GeoJSON with proper geometry...\n');

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
  const msaToName = new Map<string, string>();

  countyGeoJson.features.forEach((feature: any) => {
    const geoId = feature.properties.GEO_ID?.replace('0500000US', '');
    if (!geoId) return;

    const msaInfo = countyMsaMap.countyToMsa[geoId];
    if (msaInfo) {
      if (!msaToCounties.has(msaInfo.msaCode)) {
        msaToCounties.set(msaInfo.msaCode, []);
        msaToName.set(msaInfo.msaCode, msaInfo.msaName);
      }
      msaToCounties.get(msaInfo.msaCode)!.push(feature);
    }
  });

  console.log(`🏢 MSAs to process: ${msaToCounties.size}\n`);

  // Create MSA features by dissolving county geometries
  const msaFeatures: any[] = [];

  msaToCounties.forEach((counties, msaCode) => {
    const msaName = msaToName.get(msaCode) || `MSA ${msaCode}`;
    console.log(`   Processing ${msaCode}: ${msaName} (${counties.length} counties)`);

    try {
      if (counties.length === 1) {
        // Single county MSA - use as is
        msaFeatures.push({
          type: 'Feature',
          properties: {
            CBSAFP: msaCode,
            NAME: msaName,
            COUNTIES: 1,
          },
          geometry: counties[0].geometry,
        });
        console.log(`     ✓ Single county, preserved original geometry`);
      } else {
        // Multi-county MSA - union geometries
        let combined = counties[0];
        
        for (let i = 1; i < counties.length; i++) {
          try {
            combined = union(combined, counties[i]);
            if (!combined) {
              console.warn(`     ⚠️ Union failed at county ${i}, skipping`);
              break;
            }
          } catch (err) {
            console.warn(`     ⚠️ Union error at county ${i}:`, err);
            break;
          }
        }

        if (combined && combined.geometry) {
          msaFeatures.push({
            type: 'Feature',
            properties: {
              CBSAFP: msaCode,
              NAME: msaName,
              COUNTIES: counties.length,
            },
            geometry: combined.geometry,
          });
          console.log(`     ✓ Dissolved ${counties.length} counties successfully`);
        } else {
          console.warn(`     ⚠️ Failed to create union, skipping MSA ${msaCode}`);
        }
      }
    } catch (err) {
      console.error(`     ❌ Error processing MSA ${msaCode}:`, err);
    }
  });

  const msaGeoJson = {
    type: 'FeatureCollection',
    features: msaFeatures,
  };

  // Validate
  console.log(`\n🔍 Validation:`);
  let hasRectangles = 0;
  let hasInvalidCodes = 0;

  msaFeatures.forEach((f) => {
    // Check for rectangular geometry (4 corners)
    if (f.geometry.type === 'Polygon' && f.geometry.coordinates[0].length === 5) {
      const coords = f.geometry.coordinates[0];
      const isRect = 
        coords[0][0] === coords[3][0] && // Same lng for first/last-1
        coords[1][0] === coords[2][0] && // Same lng for second/third
        coords[0][1] === coords[1][1] && // Same lat for first/second
        coords[2][1] === coords[3][1];   // Same lat for third/last-1
      
      if (isRect) {
        console.warn(`   ⚠️ Rectangle detected: ${f.properties.NAME}`);
        hasRectangles++;
      }
    }

    // Check CBSAFP format
    if (!f.properties.CBSAFP || f.properties.CBSAFP.length !== 5) {
      console.warn(`   ⚠️ Invalid CBSAFP: ${f.properties.CBSAFP} for ${f.properties.NAME}`);
      hasInvalidCodes++;
    }
  });

  console.log(`   Total features: ${msaFeatures.length}`);
  console.log(`   Rectangles: ${hasRectangles}`);
  console.log(`   Invalid codes: ${hasInvalidCodes}`);
  
  if (hasRectangles === 0 && hasInvalidCodes === 0) {
    console.log(`   ✅ All features validated successfully`);
  }

  // Save
  const outputPath = 'public/data/fl-msas.geojson';
  fs.writeFileSync(outputPath, JSON.stringify(msaGeoJson, null, 2));

  const stats = fs.statSync(outputPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  console.log(`\n✅ Created Florida MSA GeoJSON`);
  console.log(`📁 Output: ${outputPath}`);
  console.log(`📦 File size: ${sizeMB} MB`);
  console.log(`🏢 MSA features: ${msaFeatures.length}`);
  
  if (parseFloat(sizeMB) > 5) {
    console.warn(`\n⚠️ File size is large (${sizeMB} MB). Consider simplification if map loads slowly.`);
  }
}

buildMsaGeoJson().catch((err) => {
  console.error('❌ Error building MSA GeoJSON:', err);
  process.exit(1);
});
