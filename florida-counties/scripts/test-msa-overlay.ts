/**
 * Test Script for MSA Competitor Overlay API
 * 
 * Tests the /api/msa/overlay endpoint with various Florida MSAs
 * to verify population data, competitor detection, and density calculations.
 */

// Sample Florida MSAs to test
const testMSAs = [
  { code: '33100', name: 'Miami-Fort Lauderdale-Pompano Beach' },
  { code: '45300', name: 'Tampa-St. Petersburg-Clearwater' },
  { code: '27260', name: 'Jacksonville' },
  { code: '37860', name: 'Orlando-Kissimmee-Sanford' },
  { code: '45220', name: 'Tallahassee' },
  { code: '15980', name: 'Cape Coral-Fort Myers' },
];

// Sample SOC codes to test
const testSOCs = [
  { code: '29-1141', name: 'Registered Nurses' },
  { code: '29-2032', name: 'Diagnostic Medical Sonographers' },
  { code: '47-2111', name: 'Electricians' },
];

async function testOverlayAPI() {
  console.log('🧪 Testing MSA Competitor Overlay API\n');
  console.log('=' .repeat(80));

  let successCount = 0;
  let failCount = 0;
  let totalTests = 0;

  for (const msa of testMSAs) {
    console.log(`\n📍 Testing MSA: ${msa.name} (${msa.code})`);
    console.log('-'.repeat(80));

    for (const soc of testSOCs) {
      totalTests++;
      const url = `http://localhost:3000/api/msa/overlay?msa=${msa.code}&soc=${soc.code}`;
      
      try {
        const response = await fetch(url);
        
        if (!response.ok) {
          console.log(`  ❌ ${soc.name}: HTTP ${response.status}`);
          failCount++;
          continue;
        }

        const data = await response.json();
        
        // Validate response structure
        if (!data.msa || !data.soc) {
          console.log(`  ⚠️  ${soc.name}: Invalid response structure`);
          failCount++;
          continue;
        }

        // Display results
        const status = data.population !== null ? '✅' : '⚠️';
        console.log(`  ${status} ${soc.name}:`);
        console.log(`     Population: ${data.population?.toLocaleString() || 'N/A'}`);
        console.log(`     Competitors: ${data.competitor_count}`);
        console.log(`     Density: ${data.density_per_100k?.toFixed(3) || 'N/A'} per 100k`);
        
        if (data.competitors && data.competitors.length > 0) {
          data.competitors.forEach((comp: any) => {
            console.log(`     → ${comp.name} (${comp.city})`);
          });
        }

        if (data.error) {
          console.log(`     Note: ${data.error}`);
        }

        successCount++;
      } catch (error) {
        console.log(`  ❌ ${soc.name}: ${error}`);
        failCount++;
      }

      // Small delay to avoid overwhelming the APIs
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 Test Results:`);
  console.log(`   Total Tests: ${totalTests}`);
  console.log(`   Passed: ${successCount} ✅`);
  console.log(`   Failed: ${failCount} ❌`);
  console.log(`   Success Rate: ${((successCount / totalTests) * 100).toFixed(1)}%`);
  console.log('\n' + '='.repeat(80));
}

// Run tests
testOverlayAPI().catch(console.error);

