import * as XLSX from 'xlsx';
import { join } from 'path';

const inputPath = join(process.cwd(), 'local_data', 'cie_institutions.xlsx');
const workbook = XLSX.readFile(inputPath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

console.log(`Sheet: ${sheetName}`);
console.log(`Range: ${worksheet['!ref']}`);

const rows = XLSX.utils.sheet_to_json(worksheet, { raw: false, header: 1 }) as any[][];

console.log(`\nTotal rows: ${rows.length}`);
console.log('\nFirst 20 rows:');
rows.slice(0, 20).forEach((row, i) => {
  console.log(`\nRow ${i + 1}:`, row);
});

console.log('\n\nLooking for rows with numeric IDs or CIP codes...');
rows.forEach((row, i) => {
  const rowStr = JSON.stringify(row);
  if (rowStr.match(/\d{4,}/) || rowStr.match(/51\.|47\.|15\.|48\.|01\./)) {
    console.log(`\nRow ${i + 1} (potential data):`, row);
  }
});

