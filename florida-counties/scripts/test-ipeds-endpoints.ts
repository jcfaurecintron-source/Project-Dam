/**
 * Test IPEDS endpoints to find correct field names
 */

const unitId = 366553;
const year = 2020;

async function testEndpoint(name: string, url: string) {
  try {
    const r = await fetch(url);
    const text = await r.text();
    if (r.ok) {
      try {
        const data = JSON.parse(text);
        console.log(`\n✅ ${name}:`);
        if (data.results && data.results[0]) {
          const result = data.results[0];
          console.log('   All fields:', Object.keys(result).join(', '));
          // Look for relevant fields
          const relevant = Object.keys(result).filter(k => 
            k.toLowerCase().includes('enroll') || 
            k.toLowerCase().includes('tuition') || 
            k.toLowerCase().includes('fee') ||
            k.toLowerCase().includes('book') ||
            k.toLowerCase().includes('supply') ||
            k.toLowerCase().includes('cost')
          );
          if (relevant.length > 0) {
            console.log('   Relevant fields found:');
            relevant.forEach(k => console.log(`     ${k}: ${result[k]}`));
          } else {
            console.log('   No relevant fields found');
          }
        } else {
          console.log('   No results or errors:', data.errors || 'none');
        }
      } catch (e) {
        console.log(`   Not JSON: ${text.substring(0, 200)}`);
      }
    } else {
      console.log(`\n❌ ${name}: ${r.status} ${r.statusText}`);
      console.log(`   Response: ${text.substring(0, 200)}`);
    }
  } catch (e: any) {
    console.log(`\n❌ ${name}: Error - ${e.message}`);
  }
}

async function runTests() {
  console.log(`Testing IPEDS endpoints for unitId ${unitId}, year ${year}\n`);
  
  await testEndpoint(
    'Fall Enrollment', 
    `https://educationdata.urban.org/api/v1/college-university/ipeds/fall-enrollment/${year}?unitid=${unitId}`
  );
  
  await testEndpoint(
    'Student Financial Aid', 
    `https://educationdata.urban.org/api/v1/college-university/ipeds/student-financial-aid/${year}?unitid=${unitId}`
  );
  
  await testEndpoint(
    'Institutional Characteristics', 
    `https://educationdata.urban.org/api/v1/college-university/ipeds/institutional-characteristics/${year}?unitid=${unitId}`
  );
}

runTests();

