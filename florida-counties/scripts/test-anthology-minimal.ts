/**
 * Minimal test - try without $expand to see if that's the issue
 */

const authToken = 'Y291cnNla2V5YXBpQHNvdXRoZXJudGVjaC5lZHU6U1RjLUFQSS0yMDIyIQ==';

// Try with CURRENT dates (not past dates from May)
const now = new Date();
const startDate = new Date(now);
startDate.setUTCDate(startDate.getUTCDate() - 5);
startDate.setUTCHours(0, 0, 0, 0);
const endDate = new Date(now);
endDate.setUTCDate(endDate.getUTCDate() + 30);
endDate.setUTCHours(23, 59, 59, 999);

const formatDate = (date: Date): string => {
  const iso = date.toISOString();
  return iso.replace(/\.(\d{3})Z$/, (match, digits) => `.${digits}0000Z`);
};

const startDateStr = formatDate(startDate);
const endDateStr = formatDate(endDate);

console.log('Using CURRENT dates:');
console.log('Start:', startDateStr);
console.log('End:', endDateStr);
console.log('');

console.log('Testing with minimal query (no $expand)...\n');

// Test 1: Just $select and $filter
const url1 = `https://sisclientweb-100192.campusnexus.cloud/ds/campusnexus/Students?$select=Id,StudentNumber,FullName&$filter=((StartDate ge ${startDateStr}) and (StartDate le ${endDateStr})) and ((SchoolStatusId eq 13) or (SchoolStatusId eq 162))&$count=true`;

console.log('Test 1 - Minimal query:');
console.log(url1.substring(0, 200) + '...\n');

fetch(url1, {
  method: 'GET',
  headers: {
    'Authorization': `Basic ${authToken}`,
    'Accept': 'application/json',
  },
})
  .then(async (response) => {
    console.log('Response status:', response.status, response.statusText);
    const text = await response.text();
    console.log('Response:', text.substring(0, 200));
    if (response.ok) {
      console.log('✅ Minimal query works!');
    } else {
      console.log('❌ Minimal query also fails');
      
      // Try with URL-encoded filter
      console.log('\nTest 2 - With URL-encoded filter...');
      const filter = `((StartDate ge ${startDateStr}) and (StartDate le ${endDateStr})) and ((SchoolStatusId eq 13) or (SchoolStatusId eq 162))`;
      const url2 = `https://sisclientweb-100192.campusnexus.cloud/ds/campusnexus/Students?$select=Id,StudentNumber,FullName&$filter=${encodeURIComponent(filter)}&$count=true`;
      
      return fetch(url2, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${authToken}`,
          'Accept': 'application/json',
        },
      });
    }
  })
  .then(async (response) => {
    if (response) {
      console.log('Response status:', response.status, response.statusText);
      const text = await response.text();
      console.log('Response:', text.substring(0, 200));
    }
  })
  .catch((error) => {
    console.error('Error:', error);
  });

