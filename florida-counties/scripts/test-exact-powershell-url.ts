/**
 * Test using the EXACT URL from PowerShell output
 */

const authToken = 'Y291cnNla2V5YXBpQHNvdXRoZXJudGVjaC5lZHU6U1RjLUFQSS0yMDIyIQ==';

// EXACT URL from PowerShell output (with pagination)
const exactUrl = 'https://sisclientweb-100192.campusnexus.cloud/ds/campusnexus/Students?$select=Id,CampusId,SchoolStatusId,ProgramId,StudentNumber,FullName,FirstName,LastName,PhoneNumber,StartDate&$expand=Campus($select=Name),Program($select=Name),SchoolStatus($select=Name),Person($expand=Addresses)&$filter=((StartDate ge 2025-11-08T05:00:00.0000000Z) and (StartDate le 2025-12-13T05:00:00.0000000Z)) and ((SchoolStatusId eq 13) or (SchoolStatusId eq 162) or (SchoolStatusId eq 150) or (SchoolStatusId eq 151) or (SchoolStatusId eq 155))&$count=true&$orderby=Campus/Name,FullName&$top=1000&$skip=0';

console.log('Testing with EXACT URL from PowerShell output...\n');
console.log('URL length:', exactUrl.length);
console.log('URL (first 300 chars):', exactUrl.substring(0, 300));
console.log('\nMaking request...\n');

// Try with different header combinations to match PowerShell's Invoke-RestMethod
const headerOptions = [
  {
    name: 'Option 1: Minimal headers',
    headers: {
      'Authorization': `Basic ${authToken}`,
    },
  },
  {
    name: 'Option 2: With Accept',
    headers: {
      'Authorization': `Basic ${authToken}`,
      'Accept': 'application/json',
    },
  },
  {
    name: 'Option 3: Full headers',
    headers: {
      'Authorization': `Basic ${authToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0',
    },
  },
  {
    name: 'Option 4: PowerShell-like headers',
    headers: {
      'Authorization': `Basic ${authToken}`,
      'Accept': '*/*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  },
];

(async () => {
  for (const option of headerOptions) {
    console.log(`\n${option.name}...`);
    try {
      const response = await fetch(exactUrl, {
        method: 'GET',
        headers: option.headers,
      });
      
      console.log(`  Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`  ✅ SUCCESS! Record count: ${data['@odata.count'] || data.value?.length || 0}`);
        break; // Stop on first success
      } else {
        const text = await response.text();
        console.log(`  ❌ Failed: ${text.substring(0, 100)}`);
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }
})();
