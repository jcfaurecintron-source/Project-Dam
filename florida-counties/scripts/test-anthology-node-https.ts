// Test using Node's https module directly (closer to PowerShell's behavior)

import https from 'https';
import { URL } from 'url';

const urlString =
  "https://sisclientweb-100192.campusnexus.cloud/ds/campusnexus/Students?$select=Id,CampusId,SchoolStatusId,ProgramId,StudentNumber,FullName,FirstName,LastName,PhoneNumber,StartDate&$expand=Campus($select=Name),Program($select=Name),SchoolStatus($select=Name),Person($expand=Addresses)&$filter=((StartDate ge 2025-11-08T05:00:00.0000000Z) and (StartDate le 2025-12-13T05:00:00.0000000Z)) and ((SchoolStatusId eq 13) or (SchoolStatusId eq 162) or (SchoolStatusId eq 150) or (SchoolStatusId eq 151) or (SchoolStatusId eq 155))&$count=true&$orderby=Campus/Name,FullName&$top=1000&$skip=0";

const url = new URL(urlString);
const auth = "Basic Y291cnNla2V5YXBpQHNvdXRoZXJudGVjaC5lZHU6U1RjLUFQSS0yMDIyIQ==";

const options = {
  hostname: url.hostname,
  path: url.pathname + url.search,
  method: 'GET',
  headers: {
    'Authorization': auth,
    'Accept': 'application/json',
    'User-Agent': 'Node.js',
  },
};

console.log('Making request with Node.js https module...');
console.log('Hostname:', options.hostname);
console.log('Path:', options.path.substring(0, 200) + '...');

const req = https.request(options, (res) => {
  console.log('Status:', res.statusCode, res.statusMessage);
  console.log('Headers:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\nResponse body (first 500 chars):');
    console.log(data.slice(0, 500));
    
    if (res.statusCode === 200) {
      try {
        const json = JSON.parse(data);
        console.log('\n✅ SUCCESS! Record count:', json['@odata.count'] || json.value?.length || 0);
      } catch (e) {
        console.log('\nCould not parse JSON');
      }
    } else {
      console.log('\n❌ Request failed');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error);
});

req.end();

