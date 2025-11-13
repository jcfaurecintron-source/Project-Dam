/**
 * Direct test of Anthology API to see what's actually happening
 */

const authToken = 'Y291cnNla2V5YXBpQHNvdXRoZXJudGVjaC5lZHU6U1RjLUFQSS0yMDIyIQ==';

// Try using the EXACT dates from the working PowerShell log
// PowerShell log shows: 2025-05-24T04:00:00.0000000Z to 2025-06-28T04:00:00.0000000Z
const startDateStr = '2025-05-24T04:00:00.0000000Z';
const endDateStr = '2025-06-28T04:00:00.0000000Z';

console.log('Using EXACT dates from PowerShell log:');
console.log('Start:', startDateStr);
console.log('End:', endDateStr);

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

console.log('Testing Anthology API directly...\n');
console.log('URL:', url.substring(0, 200) + '...');
console.log('Filter:', filter);
console.log('\nMaking request...\n');

fetch(url, {
  method: 'GET',
  headers: {
    'Authorization': `Basic ${authToken}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
})
  .then(async (response) => {
    console.log('Response status:', response.status, response.statusText);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const text = await response.text();
    console.log('\nResponse body (first 500 chars):', text.substring(0, 500));
    
    if (!response.ok) {
      console.error('\n❌ Request failed!');
      try {
        const json = JSON.parse(text);
        console.error('Error JSON:', JSON.stringify(json, null, 2));
      } catch (e) {
        console.error('Could not parse as JSON');
      }
    } else {
      console.log('\n✅ Request succeeded!');
      try {
        const json = JSON.parse(text);
        console.log('Record count:', json['@odata.count'] || json.value?.length || 0);
      } catch (e) {
        console.error('Could not parse response as JSON');
      }
    }
  })
  .catch((error) => {
    console.error('❌ Fetch error:', error);
  });

