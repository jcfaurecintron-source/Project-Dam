/**
 * Process BLS OEWS May 2024 MSA Data
 * 
 * Reads official BLS OEWS Excel/CSV file, filters for Florida MSAs and target SOCs,
 * cleans and normalizes data, and generates JSON output for the map.
 * 
 * Input: data/raw/oews/all_data_M_2024.xlsx (or .csv)
 * Output: public/data/oews_fl_msa_2024.json
 */

import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

// Target SOC codes
const TARGET_SOCS = [
  '29-1141', // Registered Nurses
  '29-2032', // Diagnostic Medical Sonographers
  '31-9092', // Medical Assistants
  '29-2012', // Medical and Clinical Laboratory Technicians
  '29-2055', // Surgical Technologists
  '47-2111', // Electricians
  '49-9021', // HVAC Mechanics
  '51-4121', // Welders
  '31-9096', // Veterinary Assistants
];

// Florida MSA codes (from fl-msas.geojson)
const FLORIDA_MSA_CODES = [
  '15980', '18880', '19660', '23540', '26140', '27260', '29460',
  '33100', '34940', '35840', '36100', '36740', '37340', '37860',
  '38940', '39460', '42680', '42700', '45220', '45300', '48680'
];

interface RawOewsRow {
  area_code?: string;
  area_title?: string;
  area_name?: string;
  occ_code?: string;
  occ_title?: string;
  tot_emp?: string | number;
  jobs_1000?: string | number;
  a_mean?: string | number;
  mean_annual?: string | number;
  a_median?: string | number;
  median_annual?: string | number;
  a_pct10?: string | number;
  a_pct25?: string | number;
  a_pct75?: string | number;
  a_pct90?: string | number;
  year?: string | number;
  [key: string]: any;
}

interface OewsRecord {
  msa_code: string;
  msa_name: string;
  soc: string;
  employment: number | null;
  median_annual: number | null;
  mean_annual: number | null;
  p10_annual: number | null;
  p25_annual: number | null;
  p75_annual: number | null;
  p90_annual: number | null;
  year: number;
}

/**
 * Normalize MSA code to 5-digit string
 */
function normalizeMsaCode(areaCode: string): string | null {
  if (!areaCode) return null;
  
  // Extract digits only
  const digits = areaCode.replace(/\D/g, '');
  
  // Get last 5 digits, zero-pad if needed
  const code = digits.slice(-5).padStart(5, '0');
  
  return code;
}

/**
 * Normalize SOC code to 7-character format (e.g., "29-1141")
 */
function normalizeSocCode(socCode: string): string | null {
  if (!socCode) return null;
  
  // Remove all non-digit/non-dash characters
  let cleaned = socCode.replace(/[^0-9-]/g, '');
  
  // Ensure format is XX-XXXX
  if (cleaned.length >= 6) {
    const digits = cleaned.replace(/-/g, '');
    if (digits.length >= 6) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 6)}`;
    }
  }
  
  return null;
}

/**
 * Parse numeric value, handling suppressed data (**, #, blank)
 */
function parseNumeric(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  
  const str = String(value).trim();
  
  // Suppressed indicators
  if (str === '**' || str === '#' || str === '*' || str === 'NA' || str === 'N/A') {
    return null;
  }
  
  // Remove commas and parse
  const cleaned = str.replace(/,/g, '');
  const num = parseFloat(cleaned);
  
  return isNaN(num) ? null : num;
}

/**
 * Find the correct column name in the raw data (handles variations)
 */
function findColumn(row: RawOewsRow, possibleNames: string[]): any {
  for (const name of possibleNames) {
    const lowerName = name.toLowerCase();
    const found = Object.keys(row).find(k => k.toLowerCase() === lowerName);
    if (found && row[found] !== undefined) {
      return row[found];
    }
  }
  return null;
}

/**
 * Count non-null wage fields
 */
function countNonNullWages(record: Partial<OewsRecord>): number {
  let count = 0;
  if (record.mean_annual !== null) count++;
  if (record.median_annual !== null) count++;
  if (record.p10_annual !== null) count++;
  if (record.p25_annual !== null) count++;
  if (record.p75_annual !== null) count++;
  if (record.p90_annual !== null) count++;
  return count;
}

/**
 * Read and parse Excel or CSV file
 */
function readOewsFile(filePath: string): RawOewsRow[] {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.xlsx' || ext === '.xls') {
    // Read Excel file
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as RawOewsRow[];
    return data;
  } else if (ext === '.csv') {
    // Read CSV file
    const csvData = fs.readFileSync(filePath, 'utf-8');
    const workbook = XLSX.read(csvData, { type: 'string' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as RawOewsRow[];
    return data;
  } else {
    throw new Error(`Unsupported file format: ${ext}`);
  }
}

/**
 * Find input file (from CLI arg, fetch result, or auto-detect)
 */
function findInputFile(): string | null {
  // Check CLI argument
  const cliArg = process.argv[2];
  if (cliArg && fs.existsSync(cliArg)) {
    return cliArg;
  }
  
  // Check fetch result
  const fetchResultPath = 'data/raw/oews/fetch-result.json';
  if (fs.existsSync(fetchResultPath)) {
    const fetchResult = JSON.parse(fs.readFileSync(fetchResultPath, 'utf-8'));
    if (fetchResult.xlsxPaths && fetchResult.xlsxPaths.length > 0) {
      const xlsxPath = fetchResult.xlsxPaths[0];
      if (fs.existsSync(xlsxPath)) {
        return xlsxPath;
      }
    }
  }
  
  // Auto-detect in extraction directory
  const extractDir = 'data/raw/oews/msa';
  if (fs.existsSync(extractDir)) {
    const workbooks: string[] = [];
    
    function searchDir(currentDir: string) {
      const items = fs.readdirSync(currentDir);
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          searchDir(fullPath);
        } else if (item.match(/\.(xlsx|xls)$/i)) {
          workbooks.push(fullPath);
        }
      }
    }
    
    searchDir(extractDir);
    
    // Prioritize MSA files
    workbooks.sort((a, b) => {
      const aIsMsa = /MSA.*\.xlsx?$/i.test(a);
      const bIsMsa = /MSA.*\.xlsx?$/i.test(b);
      if (aIsMsa && !bIsMsa) return -1;
      if (!aIsMsa && bIsMsa) return 1;
      return a.localeCompare(b);
    });
    
    if (workbooks.length > 0) {
      return workbooks[0];
    }
  }
  
  // Fallback to raw directory
  const rawDir = 'data/raw/oews';
  const possibleFiles = [
    'all_data_M_2024.xlsx',
    'all_data_M_2024.xls',
    'all_data_M_2024.csv',
    'oesm24ma.xlsx',
    'MSA_M_2024.xlsx',
  ];
  
  for (const filename of possibleFiles) {
    const filepath = path.join(rawDir, filename);
    if (fs.existsSync(filepath)) {
      return filepath;
    }
  }
  
  return null;
}

/**
 * Main processing function
 */
async function processOews2024(): Promise<void> {
  console.log('📊 Processing BLS OEWS May 2024 MSA Data\n');
  
  const inputFile = findInputFile();
  
  if (!inputFile) {
    console.error('❌ ERROR: No OEWS May 2024 file found!');
    console.error('\nTried:');
    console.error('  - CLI argument (pass file path as first argument)');
    console.error('  - Fetch result (data/raw/oews/fetch-result.json)');
    console.error('  - Auto-detect in data/raw/oews/msa/');
    console.error('  - Auto-detect in data/raw/oews/');
    console.error('\nPlease run: npm run oews:fetch');
    console.error('Or download manually - see OEWS_2024_DOWNLOAD_INSTRUCTIONS.md');
    process.exit(1);
  }
  
  console.log(`📁 Reading: ${inputFile}`);
  
  // Read raw data
  const rawData = readOewsFile(inputFile);
  console.log(`   Total rows: ${rawData.length.toLocaleString()}\n`);
  
  // Process records
  const processed: OewsRecord[] = [];
  const msaSocMap = new Map<string, OewsRecord>();
  
  let filteredCount = 0;
  let suppressedCount = 0;
  
  for (const row of rawData) {
    // Extract area code
    const areaCode = findColumn(row, ['area_code', 'AREA', 'AREA_CODE', 'area', 'PRIM_STATE']);
    const msaCode = normalizeMsaCode(String(areaCode || ''));
    
    if (!msaCode || !FLORIDA_MSA_CODES.includes(msaCode)) {
      continue;
    }
    
    // Extract SOC code
    const occCode = findColumn(row, ['occ_code', 'OCC_CODE', 'OCC', 'SOC_CODE']);
    const soc = normalizeSocCode(String(occCode || ''));
    
    if (!soc || !TARGET_SOCS.includes(soc)) {
      continue;
    }
    
    filteredCount++;
    
    // Extract fields
    const areaTitle = findColumn(row, ['area_title', 'AREA_TITLE', 'area_name', 'AREA_NAME']) || `MSA ${msaCode}`;
    const occTitle = findColumn(row, ['occ_title', 'OCC_TITLE']) || soc;
    
    const employment = parseNumeric(findColumn(row, ['tot_emp', 'TOT_EMP', 'employment', 'EMPLOYMENT']));
    const meanAnnual = parseNumeric(findColumn(row, ['a_mean', 'A_MEAN', 'mean_annual', 'MEAN_ANNUAL']));
    const medianAnnual = parseNumeric(findColumn(row, ['a_median', 'A_MEDIAN', 'median_annual', 'MEDIAN_ANNUAL']));
    const p10 = parseNumeric(findColumn(row, ['a_pct10', 'A_PCT10', 'p10_annual', 'P10_ANNUAL']));
    const p25 = parseNumeric(findColumn(row, ['a_pct25', 'A_PCT25', 'p25_annual', 'P25_ANNUAL']));
    const p75 = parseNumeric(findColumn(row, ['a_pct75', 'A_PCT75', 'p75_annual', 'P75_ANNUAL']));
    const p90 = parseNumeric(findColumn(row, ['a_pct90', 'A_PCT90', 'p90_annual', 'P90_ANNUAL']));
    
    const record: OewsRecord = {
      msa_code: msaCode,
      msa_name: String(areaTitle),
      soc,
      employment,
      median_annual: medianAnnual,
      mean_annual: meanAnnual,
      p10_annual: p10,
      p25_annual: p25,
      p75_annual: p75,
      p90_annual: p90,
      year: 2024,
    };
    
    // Deduplication: keep best record for each MSA×SOC
    const key = `${msaCode}|${soc}`;
    const existing = msaSocMap.get(key);
    
    if (!existing) {
      msaSocMap.set(key, record);
    } else {
      // Prefer record with employment data
      if (employment !== null && existing.employment === null) {
        msaSocMap.set(key, record);
      } else if (employment === null && existing.employment !== null) {
        // Keep existing
      } else {
        // Both have employment or both null - keep the one with more wage data
        if (countNonNullWages(record) > countNonNullWages(existing)) {
          msaSocMap.set(key, record);
        }
      }
    }
    
    if (employment === null && medianAnnual === null && meanAnnual === null) {
      suppressedCount++;
    }
  }
  
  // Convert to array
  const output = Array.from(msaSocMap.values());
  
  console.log('✅ Processing complete!');
  console.log(`   Filtered rows: ${filteredCount.toLocaleString()}`);
  console.log(`   Deduplicated records: ${output.length}`);
  console.log(`   Suppressed data: ${suppressedCount} rows\n`);
  
  // Validation
  console.log('🔍 Validation:\n');
  
  // Check MSA coverage
  const foundMsas = new Set(output.map(r => r.msa_code));
  const missingMsas = FLORIDA_MSA_CODES.filter(code => !foundMsas.has(code));
  
  if (missingMsas.length > 0) {
    console.warn(`⚠️  WARNING: Missing MSAs: ${missingMsas.join(', ')}`);
  } else {
    console.log('✅ All Florida MSAs have data');
  }
  
  // Check SOC coverage
  const foundSocs = new Set(output.map(r => r.soc));
  console.log(`   SOCs found: ${foundSocs.size} of ${TARGET_SOCS.length}`);
  
  // Anomaly detection
  const anomalies = output.filter(r => {
    if (r.median_annual === null) return false;
    return r.median_annual < 20000 || r.median_annual > 300000;
  });
  
  if (anomalies.length > 0) {
    console.warn(`\n⚠️  ANOMALIES: ${anomalies.length} records with unusual median wages:`);
    anomalies.slice(0, 5).forEach(a => {
      console.warn(`   ${a.msa_name} (${a.msa_code}) - ${a.soc}: $${a.median_annual?.toLocaleString()}`);
    });
    if (anomalies.length > 5) {
      console.warn(`   ... and ${anomalies.length - 5} more`);
    }
  }
  
  // Spot checks
  console.log('\n🔬 Spot Checks (RNs - SOC 29-1141):\n');
  const spotChecks = [
    { code: '33100', name: 'Miami' },
    { code: '45300', name: 'Tampa' },
    { code: '27260', name: 'Jacksonville' },
  ];
  
  for (const check of spotChecks) {
    const record = output.find(r => r.msa_code === check.code && r.soc === '29-1141');
    if (record) {
      console.log(`   ${check.name} (${check.code}):`);
      console.log(`     Employment: ${record.employment?.toLocaleString() || 'N/A'}`);
      console.log(`     Median: $${record.median_annual?.toLocaleString() || 'N/A'}/year`);
      console.log(`     Mean: $${record.mean_annual?.toLocaleString() || 'N/A'}/year`);
    } else {
      console.warn(`   ⚠️  ${check.name}: NO DATA FOUND`);
    }
  }
  
  // Save output
  const outputPath = 'public/data/oews_fl_msa_2024.json';
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  
  const stats = fs.statSync(outputPath);
  console.log(`\n✅ Output saved: ${outputPath}`);
  console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);
  console.log(`   Records: ${output.length}\n`);
  
  // Summary by MSA
  console.log('📊 Records by MSA:\n');
  const msaCounts = new Map<string, { name: string; count: number }>();
  
  output.forEach(r => {
    const existing = msaCounts.get(r.msa_code) || { name: r.msa_name, count: 0 };
    existing.count++;
    msaCounts.set(r.msa_code, existing);
  });
  
  const sorted = Array.from(msaCounts.entries()).sort((a, b) => b[1].count - a[1].count);
  sorted.forEach(([code, data]) => {
    console.log(`   ${code}: ${data.name.padEnd(45)} ${data.count} SOCs`);
  });
  
  console.log('\n✨ Done! Data ready for mapping.\n');
}

// Run
processOews2024().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

