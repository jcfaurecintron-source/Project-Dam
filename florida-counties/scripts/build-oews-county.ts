/**
 * OEWS County-Level ETL Script
 * 
 * Reads Florida OEWS data (typically MSA-level), joins with CBSA-County crosswalk,
 * and outputs normalized county-level employment and wage data.
 * 
 * Input: 
 *  - data/raw/oews/oews_fl_msa_<year>.csv (OEWS MSA data)
 *  - data/intermediate/cbsa-county-crosswalk.json
 * Output: data/intermediate/oews_fl_county_<year>.json
 * 
 * Usage: npx tsx scripts/build-oews-county.ts [year]
 */

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import type { CountyOews, CbsaCountyCrosswalk } from '../src/lib/types';

interface OewsCsvRow {
  area_code: string;
  area_title: string;
  occ_code: string;
  occ_title: string;
  tot_emp?: string;
  emp_prse?: string;
  a_mean?: string;
  mean_prse?: string;
  a_median?: string;
  a_pct10?: string;
  a_pct25?: string;
  a_pct75?: string;
  a_pct90?: string;
  h_mean?: string;
  h_median?: string;
}

const YEAR = process.argv[2] || '2023';
const INPUT_PATH = `data/raw/oews/oews_fl_msa_${YEAR}.csv`;
const CROSSWALK_PATH = 'data/intermediate/cbsa-county-crosswalk.json';
const OUTPUT_PATH = `data/intermediate/oews_fl_county_${YEAR}.json`;

function parseNumeric(value: string | undefined): number | null {
  if (!value || value === '' || value === '#' || value === '*' || value === '**') {
    return null;
  }
  const parsed = parseFloat(value.replace(/,/g, ''));
  return isNaN(parsed) ? null : parsed;
}

async function buildCountyOews(): Promise<void> {
  console.log(`🔄 Building county-level OEWS data for ${YEAR}...`);

  // Load crosswalk
  if (!fs.existsSync(CROSSWALK_PATH)) {
    console.error(`❌ Crosswalk not found: ${CROSSWALK_PATH}`);
    console.log('💡 Run: npx tsx scripts/build-cbsa-crosswalk.ts first');
    process.exit(1);
  }

  const crosswalk: CbsaCountyCrosswalk[] = JSON.parse(
    fs.readFileSync(CROSSWALK_PATH, 'utf-8')
  );
  console.log(`📊 Loaded ${crosswalk.length} CBSA-County mappings`);

  // Check if input file exists
  if (!fs.existsSync(INPUT_PATH)) {
    console.warn(`⚠️  Input file not found: ${INPUT_PATH}`);
    console.log('📝 Creating example OEWS data for development...');

    // Create example data for a few SOC codes
    const exampleData: CountyOews[] = [
      {
        geoid: '12009',
        countyName: 'Brevard',
        state: 'FL',
        year: parseInt(YEAR),
        soc: '29-1141',
        socTitle: 'Registered Nurses',
        employment: 8540,
        meanWage: 75680,
        medianWage: 73420,
        hourlyMeanWage: 36.38,
        hourlyMedianWage: 35.30,
      },
      {
        geoid: '12057',
        countyName: 'Hillsborough',
        state: 'FL',
        year: parseInt(YEAR),
        soc: '29-1141',
        socTitle: 'Registered Nurses',
        employment: 18230,
        meanWage: 78950,
        medianWage: 76840,
        hourlyMeanWage: 37.96,
        hourlyMedianWage: 36.94,
      },
      {
        geoid: '12103',
        countyName: 'Pinellas',
        state: 'FL',
        year: parseInt(YEAR),
        soc: '29-1141',
        socTitle: 'Registered Nurses',
        employment: 15670,
        meanWage: 77420,
        medianWage: 75110,
        hourlyMeanWage: 37.22,
        hourlyMedianWage: 36.11,
      },
    ];

    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(exampleData, null, 2));
    console.log(`✅ Created example OEWS data: ${OUTPUT_PATH}`);
    console.log(`📊 Example records: ${exampleData.length}`);
    return;
  }

  // Read and parse CSV
  const csvContent = fs.readFileSync(INPUT_PATH, 'utf-8');
  const records: OewsCsvRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`📊 Parsed ${records.length} OEWS records`);

  // Filter for MSA/CBSA data only
  const msaRecords = records.filter((row) => 
    row.area_code.startsWith('M') || row.area_code.length === 5
  );
  console.log(`🏢 MSA records: ${msaRecords.length}`);

  // Build county data by allocating MSA employment/wages
  const countyDataMap = new Map<string, CountyOews>();

  msaRecords.forEach((row) => {
    const cbsaCode = row.area_code.replace(/^M/, ''); // Remove 'M' prefix if present
    
    // Find counties in this CBSA
    const countiesInCbsa = crosswalk.filter((x) => x.cbsaCode === cbsaCode);
    
    if (countiesInCbsa.length === 0) {
      return; // Skip if no county mapping
    }

    const employment = parseNumeric(row.tot_emp);
    const meanWage = parseNumeric(row.a_mean);
    const medianWage = parseNumeric(row.a_median);

    countiesInCbsa.forEach((county) => {
      const key = `${county.countyGeoid}-${row.occ_code}`;
      
      // Allocate employment using weight, but keep wages as-is (regional average)
      const allocatedEmployment = employment !== null 
        ? Math.round(employment * county.allocationWeight)
        : null;

      countyDataMap.set(key, {
        geoid: county.countyGeoid,
        countyName: county.countyName,
        state: county.state,
        year: parseInt(YEAR),
        soc: row.occ_code,
        socTitle: row.occ_title,
        employment: allocatedEmployment,
        employmentRse: parseNumeric(row.emp_prse) || undefined,
        meanWage: meanWage,
        meanWageRse: parseNumeric(row.mean_prse) || undefined,
        medianWage: medianWage,
        hourlyMeanWage: parseNumeric(row.h_mean) || undefined,
        hourlyMedianWage: parseNumeric(row.h_median) || undefined,
        pct10Wage: parseNumeric(row.a_pct10) || undefined,
        pct25Wage: parseNumeric(row.a_pct25) || undefined,
        pct75Wage: parseNumeric(row.a_pct75) || undefined,
        pct90Wage: parseNumeric(row.a_pct90) || undefined,
      });
    });
  });

  const countyData = Array.from(countyDataMap.values());
  console.log(`🏛️  County-level records created: ${countyData.length}`);

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write output
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(countyData, null, 2));

  console.log(`✅ County OEWS data built successfully!`);
  console.log(`📁 Output: ${OUTPUT_PATH}`);
  console.log(`📊 Records: ${countyData.length}`);

  // Summary statistics
  const uniqueCounties = new Set(countyData.map((d) => d.geoid)).size;
  const uniqueSocs = new Set(countyData.map((d) => d.soc)).size;
  console.log(`🏛️  Unique counties: ${uniqueCounties}`);
  console.log(`👔 Unique occupations: ${uniqueSocs}`);
}

// Run if called directly
if (require.main === module) {
  buildCountyOews().catch((error) => {
    console.error('❌ Error building county OEWS:', error);
    process.exit(1);
  });
}

export { buildCountyOews };

