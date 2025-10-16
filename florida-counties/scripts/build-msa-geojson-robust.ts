/**
 * Build Florida MSA GeoJSON - Robust Version
 * 
 * Uses turf/dissolve to properly merge county geometries into MSAs.
 * No manual union loops - handles multipart geometries correctly.
 */

import fs from 'fs';
import dissolve from '@turf/dissolve';
import { featureCollection } from '@turf/helpers';

// Normalize MSA code to 5-digit zero-padded string
function normalizeCode(code: string): string {
  const digits = code.replace(/\D/g, '');
  return digits.slice(-5).padStart(5, '0');
}

async function buildMsaGeoJsonRobust(): Promise<void> {
  console.log('🗺️  Building Florida MSA GeoJSON (Robust)...\n');

  // Load county GeoJSON
  const countyGeoJson = JSON.parse(
    fs.readFileSync('public/florida-counties.geojson', 'utf-8')
  );

  // Load county-to-MSA mapping
  const countyMsaMap = JSON.parse(
    fs.readFileSync('src/data/county-to-msa.json', 'utf-8')
  );

  console.log(`📊 Input counties: ${countyGeoJson.features.length}`);

  // Tag each county feature with its CBSAFP
  const taggedFeatures: any[] = [];
  const cbsaCodes = new Set<string>();

  countyGeoJson.features.forEach((feature: any) => {
    const geoId = feature.properties.GEO_ID?.replace('0500000US', '');
    if (!geoId) return;

    const msaInfo = countyMsaMap.countyToMsa[geoId];
    if (msaInfo) {
      const normalizedCode = normalizeCode(msaInfo.msaCode);
      
      // Skip features with invalid geometry
      if (!feature.geometry || !feature.geometry.coordinates || feature.geometry.coordinates.length === 0) {
        console.warn(`   ⚠️ County ${geoId} has invalid geometry, skipping`);
        return;
      }

      taggedFeatures.push({
        ...feature,
        properties: {
          ...feature.properties,
          CBSAFP: normalizedCode,
          MSA_NAME: msaInfo.msaName,
        },
      });
      cbsaCodes.add(normalizedCode);
    }
  });

  console.log(`📊 Counties in MSAs: ${taggedFeatures.length}`);
  console.log(`🏢 Unique MSA codes: ${cbsaCodes.size}`);
  console.log(`📋 Expected MSAs: ${Object.keys(countyMsaMap.countyToMsa).length > 0 ? new Set(Object.values(countyMsaMap.countyToMsa).map((m: any) => normalizeCode(m.msaCode))).size : '?'}\n`);

  // List all MSAs that will be created
  console.log(`🏢 MSAs to create:`);
  Array.from(cbsaCodes).sort().forEach(code => {
    const counties = taggedFeatures.filter(f => f.properties.CBSAFP === code);
    const name = counties[0]?.properties.MSA_NAME || code;
    console.log(`   ${code}: ${name} (${counties.length} counties)`);
  });

  console.log(`\n🔄 Dissolving counties into MSAs...`);

  // Use turf/dissolve to merge by CBSAFP
  const taggedCollection = featureCollection(taggedFeatures);
  const dissolved = dissolve(taggedCollection, { propertyName: 'CBSAFP' });

  console.log(`✅ Dissolved into ${dissolved.features.length} MSA features\n`);

  // Add proper properties to dissolved features
  const finalFeatures = dissolved.features.map((feature) => {
    const cbsafp = feature.properties?.CBSAFP || '';
    const sampleCounty = taggedFeatures.find(f => f.properties.CBSAFP === cbsafp);
    const msaName = sampleCounty?.properties.MSA_NAME || `MSA ${cbsafp}`;
    const countyCount = taggedFeatures.filter(f => f.properties.CBSAFP === cbsafp).length;

    return {
      ...feature,
      properties: {
        CBSAFP: cbsafp,
        NAME: msaName,
        COUNTIES: countyCount,
        LSAD: 'M1', // Metro/Micro Statistical Area
      },
    };
  });

  // Validation
  console.log(`🔍 Validation:`);
  let invalidCount = 0;
  let rectangleCount = 0;

  finalFeatures.forEach((f, idx) => {
    // Check CBSAFP format
    if (!f.properties.CBSAFP || f.properties.CBSAFP.length !== 5) {
      console.warn(`   ⚠️ Invalid CBSAFP: "${f.properties.CBSAFP}" for ${f.properties.NAME}`);
      invalidCount++;
    }

    // Check for empty NAME
    if (!f.properties.NAME || f.properties.NAME.trim() === '') {
      console.warn(`   ⚠️ Empty NAME for CBSAFP ${f.properties.CBSAFP}`);
      invalidCount++;
    }

    // Check for null/empty geometry
    if (!f.geometry || !f.geometry.coordinates || f.geometry.coordinates.length === 0) {
      console.warn(`   ⚠️ Empty geometry for ${f.properties.NAME}`);
      invalidCount++;
    }

    // Check for rectangles (simple heuristic: 5 coords in outer ring)
    if (f.geometry.type === 'Polygon' && f.geometry.coordinates[0].length === 5) {
      const coords = f.geometry.coordinates[0];
      // Check if it's a perfect rectangle
      const lngs = coords.map((c: number[]) => c[0]);
      const lats = coords.map((c: number[]) => c[1]);
      const uniqueLngs = new Set(lngs);
      const uniqueLats = new Set(lats);
      
      if (uniqueLngs.size === 2 && uniqueLats.size === 2) {
        console.warn(`   ⚠️ Rectangle detected: ${f.properties.NAME}`);
        rectangleCount++;
      }
    }
  });

  console.log(`   Total features: ${finalFeatures.length}`);
  console.log(`   Invalid properties: ${invalidCount}`);
  console.log(`   Rectangles: ${rectangleCount}`);
  
  if (invalidCount === 0 && rectangleCount === 0) {
    console.log(`   ✅ All features validated successfully`);
  }

  // Check for known MSAs
  console.log(`\n🔍 Checking for known MSAs:`);
  const knownMsas = {
    '37460': 'Panama City, FL',
    '38940': 'Port St. Lucie, FL',
    '33100': 'Miami-Fort Lauderdale-West Palm Beach, FL',
    '45300': 'Tampa-St. Petersburg-Clearwater, FL',
    '36740': 'Orlando-Kissimmee-Sanford, FL',
    '27740': 'Jacksonville, FL',
    '34940': 'Naples-Immokalee-Marco Island, FL',
  };

  Object.entries(knownMsas).forEach(([code, name]) => {
    const found = finalFeatures.find(f => f.properties.CBSAFP === code);
    if (found) {
      console.log(`   ✅ ${code}: ${name}`);
    } else {
      console.warn(`   ❌ MISSING: ${code}: ${name}`);
    }
  });

  // Save
  const msaGeoJson = {
    type: 'FeatureCollection',
    features: finalFeatures,
  };

  const outputPath = 'public/data/fl-msas.geojson';
  fs.writeFileSync(outputPath, JSON.stringify(msaGeoJson, null, 2));

  const stats = fs.statSync(outputPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  console.log(`\n✅ Florida MSA GeoJSON created`);
  console.log(`📁 Output: ${outputPath}`);
  console.log(`📦 File size: ${sizeMB} MB`);
  console.log(`🏢 MSA count: ${finalFeatures.length}`);
  
  if (parseFloat(sizeMB) > 5) {
    console.warn(`⚠️ Large file (${sizeMB} MB) - consider simplification`);
  }
}

buildMsaGeoJsonRobust().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});

