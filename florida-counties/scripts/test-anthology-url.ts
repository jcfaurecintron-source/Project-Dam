/**
 * Test script to compare our URL generation with PowerShell output
 */

// Simulate what we're generating
const today = new Date();
const startDate = new Date(today);
startDate.setDate(startDate.getDate() - 5);
startDate.setUTCHours(0, 0, 0, 0);
const endDate = new Date(today);
endDate.setDate(endDate.getDate() + 30);
endDate.setUTCHours(23, 59, 59, 999);

const formatDateForOData = (date: Date): string => {
  const iso = date.toISOString();
  return iso.replace(/\.(\d{3})Z$/, (match, digits) => `.${digits}0000Z`);
};

const startDateStr = formatDateForOData(startDate);
const endDateStr = formatDateForOData(endDate);

const filter = `((StartDate ge ${startDateStr}) and (StartDate le ${endDateStr})) and ((SchoolStatusId eq 13) or (SchoolStatusId eq 162) or (SchoolStatusId eq 150) or (SchoolStatusId eq 151) or (SchoolStatusId eq 155))`;

const select = 'Id,CampusId,SchoolStatusId,ProgramId,StudentNumber,FullName,FirstName,LastName,PhoneNumber,StartDate';
const expand = 'Campus($select=Name),Program($select=Name),SchoolStatus($select=Name),Person($expand=Addresses)';
const orderBy = 'Campus/Name,FullName';

const queryParams: string[] = [];
queryParams.push(`$select=${select}`);
queryParams.push(`$expand=${expand}`);
queryParams.push(`$filter=${encodeURIComponent(filter)}`);
queryParams.push(`$count=true`);
queryParams.push(`$orderby=${orderBy}`);

const rootURL = 'https://sisclientweb-100192.campusnexus.cloud/ds/campusnexus/';
const entity = 'Students';
const url = `${rootURL}${entity}?${queryParams.join('&')}`;

console.log('=== Our Generated URL ===');
console.log('Start date:', startDateStr);
console.log('End date:', endDateStr);
console.log('Filter (raw):', filter);
console.log('Filter (encoded):', encodeURIComponent(filter));
console.log('\nFull URL:');
console.log(url);
console.log('\n=== PowerShell Expected (from log) ===');
console.log('Filter: ((StartDate ge 2025-05-24T04:00:00.0000000Z) and (StartDate le 2025-06-28T04:00:00.0000000Z)) and ((SchoolStatusId eq 13) or (SchoolStatusId eq 162) or (SchoolStatusId eq 150) or (SchoolStatusId eq 151) or (SchoolStatusId eq 155))');
console.log('\n=== Differences to check ===');
console.log('1. Date format matches?');
console.log('2. Filter syntax matches?');
console.log('3. URL encoding correct?');

