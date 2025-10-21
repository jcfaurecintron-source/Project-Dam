/**
 * Process OEWS Historical MSA Employment
 * 
 * Builds employment time series for each MSA×SOC from 2021-2024,
 * computes growth metrics (YoY, 3-year trend), and generates series JSON.
 */

import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

// Load config
const config = JSON.parse(fs.readFileSync('oews.config.json', 'utf-8'));

// Target SOC codes
const TARGET_SOCS = [
  '29-1141', '29-2032', '31-9092', '29-2055',
  '47-2111', '49-9021', '51-4121', '31-9096'
];

// Florida MSA codes
const FLORIDA_MSA_CODES = [
  '15980', '18880', '19660', '23540', '26140', '27260', '29460',
  '33100', '34940', '35840', '36100', '36740', '37340', '37860',
  '38940', '39460', '42680', '42700', '45220', '45300', '48680'
];

interface YearRecord {
  year: number;
  msa_code: string;
  msa_name: string;
  soc: string;
  employment: number | null;
}

interface SeriesRecord {
  msa_code: string;
  msa_name: string;
  soc: string;
  employment_by_year: Record<string, number | null>;
  yoy_abs: number | null;
  yoy_pct: number | null;
  abs_3y: number | null;
  pct_3y: number | null;
  cagr_3y: number | null;
  trend_yoy: 'Up' | 'Down' | 'Flat' | null;
  trend_3y: 'Up' | 'Down' | 'Flat' | null;
  latest_year: number;
}

function normalizeMsaCode(areaCode: string): string | null {
  if (!areaCode) return null;
  const digits = areaCode.replace(/\D/g, '');
  return digits.slice(-5).padStart(5, '0');
}

function normalizeSocCode(socCode: string): string | null {
  if (!socCode) return null;
  let cleaned = socCode.replace(/[^0-9-]/g, '');
  if (cleaned.length >= 6) {
    const digits = cleaned.replace(/-/g, '');
    if (digits.length >= 6) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 6)}`;
    }
  }
  return null;
}

function parseNumeric(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const str = String(value).trim();
  if (str === '**' || str === '#' || str === '*' || str === 'NA') return null;
  const cleaned = str.replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function findColumn(row: any, possibleNames: string[]): any {
  for (const name of possibleNames) {
    const lowerName = name.toLowerCase();
    const found = Object.keys(row).find(k => k.toLowerCase() === lowerName);
    if (found && row[found] !== undefined) {
      return row[found];
    }
  }
  return null;
}

function parseYear(year: number, manifest?: any[]): YearRecord[] {
  console.log(`\n📅 Processing ${year}...`);
  
  // Try to find file from manifest first
  let msaFile: string | null = null;
  
  if (manifest) {
    const yearEntry = manifest.find(m => m.year === year);
    if (yearEntry && yearEntry.xlsxPaths) {
      const msaPath = yearEntry.xlsxPaths.find((p: string) => /MSA_M\d{4}_dl\.xlsx$/i.test(p));
      if (msaPath && fs.existsSync(msaPath)) {
        msaFile = msaPath;
      }
    }
  }
  
  // Fallback: search in standard location
  if (!msaFile) {
    const extractDir = path.join(config.rawDir, 'msa', String(year));
    
    function findMsaWorkbook(dir: string): string | null {
      if (!fs.existsSync(dir)) return null;
      
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          const found = findMsaWorkbook(fullPath);
          if (found) return found;
        } else if (/MSA_M\d{4}_dl\.xlsx$/i.test(item)) {
          return fullPath;
        }
      }
      return null;
    }
    
    msaFile = findMsaWorkbook(extractDir);
  }
  
  // Also check in old location for 2024
  if (!msaFile && year === 2024) {
    const oldPath = path.join(config.rawDir, 'msa/oesm24ma/MSA_M2024_dl.xlsx');
    if (fs.existsSync(oldPath)) {
      msaFile = oldPath;
    }
  }
  
  if (!msaFile) {
    console.warn(`   ⚠️  No MSA workbook found for ${year}`);
    return [];
  }

  console.log(`   📁 Reading: ${path.basename(msaFile)}`);
  
  const workbook = XLSX.readFile(msaFile);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  const records: YearRecord[] = [];
  let filtered = 0;

  for (const row of data) {
    const areaCode = findColumn(row, ['area_code', 'AREA', 'AREA_CODE']);
    const msaCode = normalizeMsaCode(String(areaCode || ''));
    
    if (!msaCode || !FLORIDA_MSA_CODES.includes(msaCode)) continue;

    const occCode = findColumn(row, ['occ_code', 'OCC_CODE', 'OCC']);
    const soc = normalizeSocCode(String(occCode || ''));
    
    if (!soc || !TARGET_SOCS.includes(soc)) continue;

    filtered++;

    const areaTitle = findColumn(row, ['area_title', 'AREA_TITLE', 'area_name']) || `MSA ${msaCode}`;
    const employment = parseNumeric(findColumn(row, ['tot_emp', 'TOT_EMP', 'employment']));

    records.push({
      year,
      msa_code: msaCode,
      msa_name: String(areaTitle),
      soc,
      employment,
    });
  }

  console.log(`   ✅ Filtered: ${filtered} rows, Records: ${records.length}`);
  return records;
}

function buildSeries(allRecords: YearRecord[]): SeriesRecord[] {
  console.log('\n📊 Building time series...');
  
  // Group by MSA×SOC
  const groups = new Map<string, YearRecord[]>();
  
  for (const record of allRecords) {
    const key = `${record.msa_code}|${record.soc}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(record);
  }

  console.log(`   Found ${groups.size} unique MSA×SOC combinations`);

  const series: SeriesRecord[] = [];
  let yoyCount = 0;
  let trend3yCount = 0;

  for (const [key, records] of groups.entries()) {
    const [msa_code, soc] = key.split('|');
    const msa_name = records[0].msa_name;

    // Build employment_by_year
    const employment_by_year: Record<string, number | null> = {};
    for (const year of config.years) {
      const record = records.find(r => r.year === year);
      employment_by_year[String(year)] = record?.employment ?? null;
    }

    // Get employment values
    const e2024 = employment_by_year['2024'];
    const e2023 = employment_by_year['2023'];
    const e2022 = employment_by_year['2022'];
    const e2021 = employment_by_year['2021'];

    // YoY metrics (2024 vs 2023)
    let yoy_abs: number | null = null;
    let yoy_pct: number | null = null;
    let trend_yoy: 'Up' | 'Down' | 'Flat' | null = null;

    if (e2024 !== null && e2023 !== null && e2023 > 0) {
      yoy_abs = e2024 - e2023;
      yoy_pct = ((e2024 / e2023) - 1) * 100;
      yoy_pct = Math.round(yoy_pct * 10) / 10; // Round to 1 decimal
      
      if (yoy_pct >= 1.0) trend_yoy = 'Up';
      else if (yoy_pct <= -1.0) trend_yoy = 'Down';
      else trend_yoy = 'Flat';
      
      yoyCount++;
    }

    // 3-Year metrics (prefer 2024 vs 2021, fallback to 2022)
    let abs_3y: number | null = null;
    let pct_3y: number | null = null;
    let cagr_3y: number | null = null;
    let trend_3y: 'Up' | 'Down' | 'Flat' | null = null;
    let span_years = 0;

    if (e2024 !== null && e2021 !== null && e2021 > 0) {
      abs_3y = e2024 - e2021;
      pct_3y = ((e2024 / e2021) - 1) * 100;
      pct_3y = Math.round(pct_3y * 10) / 10;
      cagr_3y = (Math.pow(e2024 / e2021, 1/3) - 1) * 100;
      cagr_3y = Math.round(cagr_3y * 10) / 10;
      span_years = 3;
      trend3yCount++;
    } else if (e2024 !== null && e2022 !== null && e2022 > 0) {
      // Fallback to 2-year
      abs_3y = e2024 - e2022;
      pct_3y = ((e2024 / e2022) - 1) * 100;
      pct_3y = Math.round(pct_3y * 10) / 10;
      cagr_3y = null; // Only compute CAGR for true 3-year span
      span_years = 2;
    }

    if (pct_3y !== null) {
      if (pct_3y >= 1.0) trend_3y = 'Up';
      else if (pct_3y <= -1.0) trend_3y = 'Down';
      else trend_3y = 'Flat';
    }

    series.push({
      msa_code,
      msa_name,
      soc,
      employment_by_year,
      yoy_abs: yoy_abs !== null ? Math.round(yoy_abs) : null,
      yoy_pct,
      abs_3y: abs_3y !== null ? Math.round(abs_3y) : null,
      pct_3y,
      cagr_3y,
      trend_yoy,
      trend_3y,
      latest_year: 2024,
    });
  }

  console.log(`   ✅ YoY metrics: ${yoyCount}`);
  console.log(`   ✅ 3-year trends: ${trend3yCount}`);

  return series;
}

function validate(series: SeriesRecord[]): void {
  console.log('\n🔍 Validation...');

  // Check YoY coverage
  const with2023and2024 = series.filter(s => 
    s.employment_by_year['2023'] !== null && 
    s.employment_by_year['2024'] !== null
  );
  const withYoY = series.filter(s => s.yoy_pct !== null);
  
  console.log(`   Records with 2023 & 2024: ${with2023and2024.length}`);
  console.log(`   Records with YoY metrics: ${withYoY.length}`);
  
  if (with2023and2024.length !== withYoY.length) {
    console.warn(`   ⚠️  Mismatch: Expected ${with2023and2024.length}, got ${withYoY.length}`);
  }

  // Check for zero valid years
  const noData = series.filter(s => 
    Object.values(s.employment_by_year).every(v => v === null)
  );
  if (noData.length > 0) {
    console.warn(`   ⚠️  ${noData.length} MSA×SOC with zero valid years`);
  }

  // Spot checks (Miami, Tampa, Jacksonville - RNs)
  console.log('\n🔬 Spot Checks (RN 29-1141):');
  const checks = [
    { code: '33100', name: 'Miami' },
    { code: '45300', name: 'Tampa' },
    { code: '27260', name: 'Jacksonville' },
  ];

  for (const check of checks) {
    const record = series.find(s => s.msa_code === check.code && s.soc === '29-1141');
    if (record) {
      console.log(`   ${check.name} (${check.code}):`);
      console.log(`     2021: ${record.employment_by_year['2021'] || 'N/A'}`);
      console.log(`     2024: ${record.employment_by_year['2024'] || 'N/A'}`);
      console.log(`     YoY: ${record.yoy_pct !== null ? `${record.yoy_pct > 0 ? '+' : ''}${record.yoy_pct}%` : 'N/A'} (${record.trend_yoy || 'N/A'})`);
      console.log(`     3y: ${record.pct_3y !== null ? `${record.pct_3y > 0 ? '+' : ''}${record.pct_3y}%` : 'N/A'} (${record.trend_3y || 'N/A'})`);
    } else {
      console.warn(`   ⚠️  ${check.name}: NO DATA FOUND`);
    }
  }
}

async function main() {
  console.log('📊 Processing OEWS Historical MSA Employment\n');
  console.log(`📅 Years: ${config.years.join(', ')}\n`);

  // Load manifest
  const manifestPath = path.join(config.rawDir, 'fetch-manifest.json');
  let manifest: any[] | undefined;
  if (fs.existsSync(manifestPath)) {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  }

  // Parse each year
  const allRecords: YearRecord[] = [];
  for (const year of config.years) {
    const records = parseYear(year, manifest);
    allRecords.push(...records);
  }

  console.log(`\n✅ Total records parsed: ${allRecords.length}`);

  // Build series with growth metrics
  const series = buildSeries(allRecords);

  // Validate
  validate(series);

  // Save output
  const outputPath = config.seriesFile;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(series, null, 2));

  const stats = fs.statSync(outputPath);
  console.log(`\n✅ Output saved: ${outputPath}`);
  console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);
  console.log(`   Records: ${series.length}\n`);

  console.log('✨ Done!\n');
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

