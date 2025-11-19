import * as XLSX from 'xlsx';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const STC_CIP_CODES = [
  '51.0910',
  '51.0801',
  '51.1004',
  '51.0909',
  '47.0201',
  '15.0303',
  '48.0508',
  '51.3801',
  '01.8301'
];

interface CieInstitution {
  school_id: number;
  name: string;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  matching_programs: Array<{ code: string; name: string }>;
  website: string | null;
  costs: {
    tuitionInState: number | null;
    tuitionOutOfState: number | null;
    tuitionProgramYear: number | null;
    attendanceProgramYear: number | null;
    booksAndSupplies: number | null;
  } | null;
}

function normalizeCipCode(code: string | number | null | undefined): string {
  if (code == null) return '';
  const str = String(code).trim();
  const digits = str.replace(/[^0-9]/g, '');
  if (digits.length >= 4) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 4)}${digits.slice(4, 6) || ''}`;
  }
  return '';
}

function matchesStcCip(cieCip: string, stcCip: string): boolean {
  const cieNormalized = normalizeCipCode(cieCip);
  const stcNormalized = stcCip.replace(/[^0-9]/g, '');
  const cieDigits = cieNormalized.replace(/[^0-9]/g, '');
  
  if (cieDigits.length >= 4 && stcNormalized.length >= 4) {
    return cieDigits.slice(0, 4) === stcNormalized.slice(0, 4);
  }
  return cieNormalized === stcCip;
}

function convertCieToJson() {
  const inputPath = join(process.cwd(), 'local_data', 'cie_institutions.xlsx');
  const outputPath = join(process.cwd(), 'public', 'data', 'cie_institutions.json');

  console.log('Reading CIE Excel file...');
  const workbook = XLSX.readFile(inputPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { raw: false }) as any[];

  console.log(`Found ${rows.length} rows in Excel file`);

  const schools = new Map<number, CieInstitution>();

  for (const row of rows) {
    const schoolId = parseInt(String(row['School ID'] || row['school_id'] || row['ID'] || '0'));
    if (!schoolId || isNaN(schoolId)) continue;

    const state = String(row['State'] || row['state'] || '').trim().toUpperCase();
    if (state !== 'FL') continue;

    let school = schools.get(schoolId);
    if (!school) {
      const lat = parseFloat(String(row['Latitude'] || row['latitude'] || row['Lat'] || ''));
      const lon = parseFloat(String(row['Longitude'] || row['longitude'] || row['Lon'] || ''));
      
      school = {
        school_id: schoolId,
        name: String(row['School Name'] || row['name'] || row['Institution Name'] || 'Unknown').trim(),
        city: String(row['City'] || row['city'] || '').trim() || null,
        state: state || null,
        latitude: isNaN(lat) ? null : lat,
        longitude: isNaN(lon) ? null : lon,
        matching_programs: [],
        website: String(row['Website'] || row['website'] || row['URL'] || '').trim() || null,
        costs: null,
      };
      schools.set(schoolId, school);
    }

    const cipCode = String(row['CIP Code'] || row['cip_code'] || row['CIP'] || '').trim();
    if (!cipCode) continue;

    const matchingStcCip = STC_CIP_CODES.find(stcCip => matchesStcCip(cipCode, stcCip));
    if (matchingStcCip) {
      const programName = String(row['Program Name'] || row['program_name'] || row['Program'] || '').trim();
      const existing = school.matching_programs.find(p => p.code === matchingStcCip);
      if (!existing) {
        school.matching_programs.push({
          code: matchingStcCip,
          name: programName || `CIP ${matchingStcCip}`
        });
      }
    }
  }

  const competitors = Array.from(schools.values()).filter(s => s.matching_programs.length > 0);
  competitors.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  console.log(`Found ${competitors.length} competitor institutions with matching CIP codes`);

  const output = {
    source: 'CIE (College Information Exchange)',
    generated: new Date().toISOString(),
    count: competitors.length,
    competitors
  };

  writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`✅ Wrote ${competitors.length} competitors to ${outputPath}`);
}

convertCieToJson();

