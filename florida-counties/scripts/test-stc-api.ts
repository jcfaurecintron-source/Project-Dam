/**
 * Test STC Institution Data API
 * Tests fetching Southern Technical College data from College Scorecard and NCES APIs
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { getStcInstitutionData } from '../src/lib/stcApi';

// Load .env.local file explicitly
config({ path: resolve(__dirname, '../.env.local') });
// Also try loading regular .env as fallback
config({ path: resolve(__dirname, '../.env') });

async function testStcApi() {
  console.log('🧪 Testing STC Institution Data API...\n');

  // Check if API key is configured (check all possible variable names)
  const apiKey = 
    process.env.SCORECARD_KEY || 
    process.env.NEXT_PUBLIC_SCORECARD_KEY ||
    process.env.COLLEGE_SCORECARD_API_KEY ||
    process.env.NEXT_PUBLIC_COLLEGE_SCORECARD_API_KEY;
  
  if (!apiKey) {
    console.error('❌ Error: College Scorecard API key not found in environment variables');
    console.log('\nAvailable environment variables (keys only):');
    const envKeys = Object.keys(process.env)
      .filter(key => key.includes('SCORE') || key.includes('API') || key.includes('KEY'))
      .sort();
    
    if (envKeys.length > 0) {
      console.log('   Found related keys:');
      envKeys.forEach(key => console.log(`   - ${key}`));
    } else {
      console.log('   No related keys found');
    }
    
    console.log('\nPlease set one of the following in .env.local:');
    console.log('   - SCORECARD_KEY');
    console.log('   - COLLEGE_SCORECARD_API_KEY');
    console.log('   - NEXT_PUBLIC_SCORECARD_KEY');
    console.log('   - NEXT_PUBLIC_COLLEGE_SCORECARD_API_KEY');
    process.exit(1);
  }

  console.log('✅ API Key found');
  console.log(`   Key prefix: ${apiKey.substring(0, 8)}...\n`);

  console.log('📡 Fetching STC institution data...\n');
  console.log('   Primary source: College Scorecard API');
  console.log('   Fallback source: NCES EducationData API\n');

  try {
    const startTime = Date.now();
    const data = await getStcInstitutionData();
    const duration = Date.now() - startTime;

    console.log('✅ Successfully fetched STC institution data!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Institution Data:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log(`   Unit ID:        ${data.unitId}`);
    console.log(`   Name:           ${data.name}`);
    console.log(`   Data Source:    ${data.source.toUpperCase()}\n`);
    
    console.log('   Student Count:');
    if (data.studentCount !== null) {
      console.log(`      ${data.studentCount.toLocaleString()} students`);
    } else {
      console.log('      ❌ Not available');
    }
    
    console.log('\n   Tuition:');
    if (data.tuition !== null) {
      console.log(`      $${data.tuition.toLocaleString()} per program year`);
    } else {
      console.log('      ❌ Not available');
    }
    
    console.log('\n   Books & Supplies:');
    if (data.booksSupplies !== null) {
      console.log(`      $${data.booksSupplies.toLocaleString()}`);
    } else {
      console.log('      ❌ Not available');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`⏱️  Fetch completed in ${duration}ms\n`);

    // Data completeness check
    const fieldsAvailable = [
      data.studentCount !== null,
      data.tuition !== null,
      data.booksSupplies !== null,
    ].filter(Boolean).length;

    console.log(`📈 Data Completeness: ${fieldsAvailable}/3 fields available\n`);

    if (fieldsAvailable === 3) {
      console.log('✅ All fields successfully retrieved!');
    } else if (fieldsAvailable > 0) {
      console.log('⚠️  Some fields are missing. Fallback to NCES may be needed.');
    } else {
      console.log('❌ No data fields available. Check API responses.');
    }

  } catch (error) {
    console.error('\n❌ Error fetching STC institution data:\n');
    
    if (error instanceof Error) {
      console.error(`   ${error.message}\n`);
      
      if (error.message.includes('SCORECARD_KEY')) {
        console.log('💡 Tip: Make sure SCORECARD_KEY is set in .env.local');
      } else if (error.message.includes('API error')) {
        console.log('💡 Tip: Check your API key and network connection');
      }
    } else {
      console.error('   Unknown error:', error);
    }
    
    process.exit(1);
  }
}

// Run the test
testStcApi();

