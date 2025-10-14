/**
 * CBSA to County Crosswalk ETL Script
 * 
 * Builds a mapping from CBSA (Metropolitan/Micropolitan Statistical Areas) to counties.
 * When OEWS data is reported at MSA level, this crosswalk allocates employment/wages
 * to constituent counties using equal shares (or custom weights if available).
 * 
 * Input: data/raw/oews/cbsa-county-crosswalk.csv (from Census Bureau)
 * Output: data/intermediate/cbsa-county-crosswalk.json
 * 
 * Usage: npx tsx scripts/build-cbsa-crosswalk.ts
 */

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import type { CbsaCountyCrosswalk } from '../src/lib/types';

interface CbsaCsvRow {
  cbsa_code: string;
  cbsa_title: string;
  county_fips: string;
  county_name: string;
  state_fips: string;
  state_abbr: string;
}

const INPUT_PATH = 'data/raw/oews/cbsa-county-crosswalk.csv';
const OUTPUT_PATH = 'data/intermediate/cbsa-county-crosswalk.json';

async function buildCbsaCrosswalk(): Promise<void> {
  console.log('🔄 Building CBSA-County crosswalk...');

  // Check if input file exists
  if (!fs.existsSync(INPUT_PATH)) {
    console.warn(`⚠️  Input file not found: ${INPUT_PATH}`);
    console.log('📝 Creating example crosswalk for Florida counties...');
    
    // Create a minimal example for development
    const exampleCrosswalk: CbsaCountyCrosswalk[] = [
      {
        cbsaCode: '37340',
        cbsaTitle: 'Palm Bay-Melbourne-Titusville, FL',
        countyGeoid: '12009',
        countyName: 'Brevard',
        state: 'FL',
        allocationWeight: 1.0,
      },
      {
        cbsaCode: '45300',
        cbsaTitle: 'Tampa-St. Petersburg-Clearwater, FL',
        countyGeoid: '12057',
        countyName: 'Hillsborough',
        state: 'FL',
        allocationWeight: 0.5,
      },
      {
        cbsaCode: '45300',
        cbsaTitle: 'Tampa-St. Petersburg-Clearwater, FL',
        countyGeoid: '12103',
        countyName: 'Pinellas',
        state: 'FL',
        allocationWeight: 0.5,
      },
    ];

    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(exampleCrosswalk, null, 2));
    console.log(`✅ Created example crosswalk: ${OUTPUT_PATH}`);
    console.log(`📊 Example records: ${exampleCrosswalk.length}`);
    return;
  }

  // Read and parse CSV
  const csvContent = fs.readFileSync(INPUT_PATH, 'utf-8');
  const records: CbsaCsvRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`📊 Parsed ${records.length} CBSA-County relationships`);

  // Filter for Florida only
  const floridaRecords = records.filter((row) => row.state_abbr === 'FL');
  console.log(`🌴 Filtered to ${floridaRecords.length} Florida relationships`);

  // Group by CBSA to calculate equal shares
  const cbsaGroups = new Map<string, CbsaCsvRow[]>();
  floridaRecords.forEach((row) => {
    if (!cbsaGroups.has(row.cbsa_code)) {
      cbsaGroups.set(row.cbsa_code, []);
    }
    cbsaGroups.get(row.cbsa_code)!.push(row);
  });

  // Build crosswalk with equal allocation weights
  const crosswalk: CbsaCountyCrosswalk[] = [];
  cbsaGroups.forEach((counties, cbsaCode) => {
    const weight = 1.0 / counties.length; // Equal shares
    counties.forEach((county) => {
      crosswalk.push({
        cbsaCode: cbsaCode,
        cbsaTitle: county.cbsa_title,
        countyGeoid: county.county_fips,
        countyName: county.county_name,
        state: county.state_abbr,
        allocationWeight: weight,
      });
    });
  });

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write output
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(crosswalk, null, 2));

  console.log(`✅ Crosswalk built successfully!`);
  console.log(`📁 Output: ${OUTPUT_PATH}`);
  console.log(`🏢 CBSAs: ${cbsaGroups.size}`);
  console.log(`🏛️  Counties: ${crosswalk.length}`);
}

// Run if called directly
if (require.main === module) {
  buildCbsaCrosswalk().catch((error) => {
    console.error('❌ Error building crosswalk:', error);
    process.exit(1);
  });
}

export { buildCbsaCrosswalk };

