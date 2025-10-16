/**
 * State Projections ETL Script
 * 
 * Extracts state-level employment projections for Florida, calculating growth
 * percentages and annual openings for target SOC codes.
 * 
 * Input: data/raw/emp/projections_fl.xlsx or .csv (State projections data)
 * Output: data/intermediate/projections_fl.json
 * 
 * Usage: npx tsx scripts/build-projections.ts
 */

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import type { StateProjection } from '../src/lib/types';

interface ProjectionsCsvRow {
  soc_code: string;
  soc_title: string;
  base_year?: string;
  base_employment?: string;
  projected_year?: string;
  projected_employment?: string;
  employment_change?: string;
  employment_change_percent?: string;
  annual_openings?: string;
  growth_openings?: string;
  replacement_openings?: string;
}

const INPUT_PATH = 'data/raw/emp/projections_fl.csv';
const OUTPUT_PATH = 'data/intermediate/projections_fl.json';
const BASE_YEAR = 2022;
const PROJECTION_YEAR = 2032;

function parseNumeric(value: string | undefined): number {
  if (!value || value === '' || value === 'N/A' || value === '-') {
    return 0;
  }
  const parsed = parseFloat(value.replace(/,/g, '').replace(/%/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

async function buildProjections(): Promise<void> {
  console.log('🔄 Building state-level projections...');

  // Check if input file exists
  if (!fs.existsSync(INPUT_PATH)) {
    console.warn(`⚠️  Input file not found: ${INPUT_PATH}`);
    console.log('📝 Creating example projections data for development...');

    // Create example projections for key SOC codes
    const exampleProjections: StateProjection[] = [
      {
        state: 'FL',
        soc: '29-1141',
        socTitle: 'Registered Nurses',
        baseYear: BASE_YEAR,
        projectionYear: PROJECTION_YEAR,
        baseEmployment: 198450,
        projectedEmployment: 223870,
        employmentChange: 25420,
        employmentChangePercent: 12.8,
        annualOpenings: 18560,
        growthOpenings: 2542,
        exitingOpenings: 16018,
      },
      {
        state: 'FL',
        soc: '47-2111',
        socTitle: 'Electricians',
        baseYear: BASE_YEAR,
        projectionYear: PROJECTION_YEAR,
        baseEmployment: 52340,
        projectedEmployment: 59120,
        employmentChange: 6780,
        employmentChangePercent: 13.0,
        annualOpenings: 5240,
        growthOpenings: 678,
        exitingOpenings: 4562,
      },
      {
        state: 'FL',
        soc: '31-9092',
        socTitle: 'Medical Assistants',
        baseYear: BASE_YEAR,
        projectionYear: PROJECTION_YEAR,
        baseEmployment: 48920,
        projectedEmployment: 58340,
        employmentChange: 9420,
        employmentChangePercent: 19.3,
        annualOpenings: 6780,
        growthOpenings: 942,
        exitingOpenings: 5838,
      },
      {
        state: 'FL',
        soc: '49-9021',
        socTitle: 'Heating, Air Conditioning, and Refrigeration Mechanics',
        baseYear: BASE_YEAR,
        projectionYear: PROJECTION_YEAR,
        baseEmployment: 34560,
        projectedEmployment: 39870,
        employmentChange: 5310,
        employmentChangePercent: 15.4,
        annualOpenings: 3920,
        growthOpenings: 531,
        exitingOpenings: 3389,
      },
      {
        state: 'FL',
        soc: '29-2061',
        socTitle: 'Licensed Practical and Licensed Vocational Nurses',
        baseYear: BASE_YEAR,
        projectionYear: PROJECTION_YEAR,
        baseEmployment: 45230,
        projectedEmployment: 49560,
        employmentChange: 4330,
        employmentChangePercent: 9.6,
        annualOpenings: 4120,
        growthOpenings: 433,
        exitingOpenings: 3687,
      },
    ];

    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(exampleProjections, null, 2));
    console.log(`✅ Created example projections: ${OUTPUT_PATH}`);
    console.log(`📊 Example records: ${exampleProjections.length}`);
    return;
  }

  // Read and parse CSV
  const csvContent = fs.readFileSync(INPUT_PATH, 'utf-8');
  const records: ProjectionsCsvRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`📊 Parsed ${records.length} projection records`);

  // Transform to StateProjection format
  const projections: StateProjection[] = records.map((row) => {
    const baseEmployment = parseNumeric(row.base_employment);
    const projectedEmployment = parseNumeric(row.projected_employment);
    const employmentChange = parseNumeric(row.employment_change) || 
      (projectedEmployment - baseEmployment);
    const employmentChangePercent = parseNumeric(row.employment_change_percent) ||
      (baseEmployment > 0 ? ((employmentChange / baseEmployment) * 100) : 0);
    
    const annualOpenings = parseNumeric(row.annual_openings);
    const growthOpenings = parseNumeric(row.growth_openings);
    const replacementOpenings = parseNumeric(row.replacement_openings);

    return {
      state: 'FL',
      soc: row.soc_code,
      socTitle: row.soc_title,
      baseYear: parseNumeric(row.base_year) || BASE_YEAR,
      projectionYear: parseNumeric(row.projected_year) || PROJECTION_YEAR,
      baseEmployment,
      projectedEmployment,
      employmentChange,
      employmentChangePercent,
      annualOpenings,
      growthOpenings,
      exitingOpenings: replacementOpenings,
    };
  });

  // Filter out invalid records
  const validProjections = projections.filter((p) => 
    p.soc && p.baseEmployment > 0
  );

  console.log(`✅ Valid projections: ${validProjections.length}`);

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write output
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(validProjections, null, 2));

  console.log(`✅ Projections built successfully!`);
  console.log(`📁 Output: ${OUTPUT_PATH}`);
  console.log(`📊 Records: ${validProjections.length}`);
}

// Run if called directly
if (require.main === module) {
  buildProjections().catch((error) => {
    console.error('❌ Error building projections:', error);
    process.exit(1);
  });
}

export { buildProjections };

