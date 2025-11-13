/**
 * Test with properly URL-encoded filter (like PowerShell actually sends)
 */

const authToken = 'Y291cnNla2V5YXBpQHNvdXRoZXJudGVjaC5lZHU6U1RjLUFQSS0yMDIyIQ==';

// Build the URL with proper encoding (like PowerShell's Invoke-RestMethod does)
const baseUrl = 'https://sisclientweb-100192.campusnexus.cloud/ds/campusnexus/Students';
const select = 'Id,CampusId,SchoolStatusId,ProgramId,StudentNumber,FullName,FirstName,LastName,PhoneNumber,StartDate';
const expand = 'Campus($select=Name),Program($select=Name),SchoolStatus($select=Name),Person($expand=Addresses)';
const filter = '((StartDate ge 2025-11-08T05:00:00.0000000Z) and (StartDate le 2025-12-13T05:00:00.0000000Z)) and ((SchoolStatusId eq 13) or (SchoolStatusId eq 162) or (SchoolStatusId eq 150) or (SchoolStatusId eq 151) or (SchoolStatusId eq 155))';
const orderBy = 'Campus/Name,FullName';

// Build query params with proper encoding
const params = new URLSearchParams();
params.set('$select', select);
params.set('$expand', expand);
params.set('$filter', filter); // URLSearchParams will encode this
params.set('$count', 'true');
params.set('$orderby', orderBy);
params.set('$top', '1000');
params.set('$skip', '0');

// Fix the $ signs (URLSearchParams encodes them as %24)
let queryString = params.toString().replace(/%24/g, '$');
const url = `${baseUrl}?${queryString}`;

console.log('Testing with properly URL-encoded parameters...\n');
console.log('Filter (raw):', filter);
console.log('Filter (encoded):', encodeURIComponent(filter));
console.log('Full URL (first 400 chars):', url.substring(0, 400));
console.log('\nMaking request...\n');

fetch(url, {
  method: 'GET',
  headers: {
    'Authorization': `Basic ${authToken}`,
    'Accept': 'application/json',
  },
})
  .then(async (response) => {
    console.log('Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      const text = await response.text();
      console.error('\n❌ Request failed!');
      console.error('Response body:', text);
      return;
    }
    
    const data = await response.json();
    console.log('\n✅ Request succeeded!');
    console.log('Record count:', data['@odata.count'] || data.value?.length || 0);
    if (data.value && data.value.length > 0) {
      console.log('First student:', data.value[0].FullName || 'N/A');
    }
  })
  .catch((error) => {
    console.error('❌ Fetch error:', error);
  });

