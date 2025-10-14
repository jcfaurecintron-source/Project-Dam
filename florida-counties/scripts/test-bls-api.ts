/**
 * Test BLS API connectivity and data availability
 */

const BLS_API_KEY = '7524e91b9fe945f486afd129a2b7db0f';
const BLS_BASE_URL = 'https://api.bls.gov/publicAPI/v2';

async function testBlsApi() {
  console.log('🧪 Testing BLS API...\n');

  // Test 1: Florida statewide Registered Nurses
  const floridaRnSeries = 'OEUS120000000000001141';
  
  console.log(`📊 Testing series: ${floridaRnSeries}`);
  console.log('   (Florida Statewide - Registered Nurses - All Industries)\n');

  const requestBody = {
    seriesid: [floridaRnSeries],
    startyear: '2022',
    endyear: '2023',
    registrationkey: BLS_API_KEY,
  };

  try {
    const response = await fetch(`${BLS_BASE_URL}/timeseries/data/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    
    console.log('API Response Status:', data.status);
    console.log('API Messages:', data.message);
    
    if (data.status === 'REQUEST_SUCCEEDED' && data.Results?.series?.length > 0) {
      const series = data.Results.series[0];
      console.log('\n✅ Data found!');
      console.log('Series ID:', series.seriesID);
      console.log('Data points:', series.data?.length || 0);
      
      if (series.data && series.data.length > 0) {
        console.log('\nLatest data:');
        series.data.slice(0, 3).forEach((d: any) => {
          console.log(`  ${d.year} ${d.periodName}: ${d.value}`);
        });
      }
    } else {
      console.log('\n❌ No data returned');
      console.log('Full response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testBlsApi();

