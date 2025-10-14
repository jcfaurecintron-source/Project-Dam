/**
 * CareerOneStop API Proxy
 * 
 * Correct endpoint: GET /v1/comparesalaries/{userId}/wage
 * Returns: OEWS wage data including MSA-level breakdowns
 */

import { NextRequest, NextResponse } from 'next/server';

const USER_ID = process.env.CAREERONESTOP_USER_ID;
const AUTH_TOKEN = process.env.CAREERONESTOP_TOKEN;
const BASE_URL = 'https://api.careeronestop.org/v1';

// Log credential status on startup (not values!)
console.log('🔐 CareerOneStop credentials:', {
  userIdPresent: !!USER_ID,
  tokenPresent: !!AUTH_TOKEN,
  userIdLength: USER_ID?.length || 0,
});

interface NormalizedOewsData {
  areaCode: string;
  areaName: string;
  soc: string;
  socTitle: string;
  employment: number | null;
  meanAnnual: number | null;
  medianAnnual: number | null;
  p10: number | null;
  p25: number | null;
  p75: number | null;
  p90: number | null;
  year: number;
  source: 'CareerOneStop';
}

/**
 * GET /api/careeronestop?soc=29-1141&location=Naples,FL&msaCode=34940
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const soc = searchParams.get('soc');
  const location = searchParams.get('location') || 'FL';
  const targetMsaCode = searchParams.get('msaCode');

  if (!soc) {
    return NextResponse.json({ error: 'SOC code required' }, { status: 400 });
  }

  if (!USER_ID || !AUTH_TOKEN) {
    console.error('❌ CareerOneStop credentials not configured');
    console.error('   USER_ID present:', !!USER_ID);
    console.error('   TOKEN present:', !!AUTH_TOKEN);
    return NextResponse.json({ error: 'API credentials not configured' }, { status: 500 });
  }

  // Format SOC with decimals (CareerOneStop expects XX-XXXX.XX format)
  const socFormatted = soc.includes('.') ? soc : `${soc}.00`;
  
  // Build URL - credentials go in headers, NOT URL
  const url = `${BASE_URL}/comparesalaries/${USER_ID}/wage?keyword=${encodeURIComponent(socFormatted)}&location=${encodeURIComponent(location)}`;
  
  console.log(`📡 CareerOneStop GET: ${url}`);
  console.log(`   Auth header: Bearer ${AUTH_TOKEN.substring(0, 10)}...`);

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Accept': 'application/json',
      },
    });

    console.log(`   Response: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      console.error(`❌ CareerOneStop API error: ${response.status} ${response.statusText}`);
      
      // If location-specific fails, try state-level
      if (location !== 'FL') {
        console.log('⚠️ Retrying with state-level (FL)');
        const stateUrl = `${BASE_URL}/comparesalaries/${USER_ID}/wage?keyword=${encodeURIComponent(socFormatted)}&location=FL`;
        
        const stateResponse = await fetch(stateUrl, {
          headers: {
            'Authorization': `Bearer ${AUTH_TOKEN}`,
            'Accept': 'application/json',
          },
        });

        if (!stateResponse.ok) {
          return NextResponse.json({ error: 'API request failed' }, { status: 502 });
        }

        const stateData = await stateResponse.json();
        return processCareerOneStopResponse(stateData, soc, targetMsaCode, true);
      }
      
      return NextResponse.json({ error: 'API request failed' }, { status: 502 });
    }

    const data = await response.json();
    console.log(`   Response keys:`, Object.keys(data));
    
    // Debug: Log the full structure
    if (data.OccupationDetail) {
      console.log(`   OccupationDetail keys:`, Object.keys(data.OccupationDetail));
      console.log(`   OccupationDetail type:`, Array.isArray(data.OccupationDetail) ? 'Array' : 'Object');
      
      // If it's an array, check first element
      if (Array.isArray(data.OccupationDetail) && data.OccupationDetail.length > 0) {
        console.log(`   OccupationDetail[0] keys:`, Object.keys(data.OccupationDetail[0]));
      }
    }
    
    // Parse correct structure: OccupationDetail.Wages (not top-level Wages)
    const wages = data?.OccupationDetail?.Wages;
    console.log(`   Has OccupationDetail.Wages:`, !!wages);
    
    if (wages) {
      console.log(`   BLSAreaWagesList length:`, wages.BLSAreaWagesList?.length || 0);
      console.log(`   StateWagesList length:`, wages.StateWagesList?.length || 0);
      console.log(`   NationalWagesList length:`, wages.NationalWagesList?.length || 0);
    }
    
    // If BLSAreaWagesList is empty and we requested a city, retry with FL
    if (wages && (!wages.BLSAreaWagesList || wages.BLSAreaWagesList.length === 0) && location !== 'FL') {
      console.log(`⚠️ Empty BLSAreaWagesList for ${location}, retrying with location=FL to get all MSAs`);
      
      const stateUrl = `${BASE_URL}/comparesalaries/${USER_ID}/wage?keyword=${encodeURIComponent(socFormatted)}&location=FL`;
      console.log(`📡 CareerOneStop GET (retry): ${stateUrl}`);
      
      const stateResponse = await fetch(stateUrl, {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Accept': 'application/json',
        },
      });
      
      console.log(`   Response: ${stateResponse.status} ${stateResponse.statusText}`);
      
      if (stateResponse.ok) {
        const stateData = await stateResponse.json();
        const stateWages = stateData?.OccupationDetail?.Wages;
        if (stateWages) {
          console.log(`   BLSAreaWagesList length (retry):`, stateWages.BLSAreaWagesList?.length || 0);
        }
        return processCareerOneStopResponse(stateData, soc, targetMsaCode, true);
      }
    }
    
    return processCareerOneStopResponse(data, soc, targetMsaCode, false);

  } catch (error) {
    console.error('CareerOneStop fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function processCareerOneStopResponse(
  data: any,
  soc: string,
  targetMsaCode: string | null,
  isStateFallback: boolean
): NextResponse {
  try {
    // Correct path: OccupationDetail.Wages (not top-level)
    const wages = data?.OccupationDetail?.Wages;
    const occTitle = data?.OccupationDetail?.OnetTitle || soc;
    
    if (!wages) {
      console.error('❌ No OccupationDetail.Wages in response');
      return NextResponse.json({ error: 'No wage data in response' }, { status: 404 });
    }
    
    console.log(`✅ Processing wages for ${occTitle}`);

    // If targetMsaCode specified, try to find it in BLSAreaWagesList
    if (targetMsaCode && wages.BLSAreaWagesList && wages.BLSAreaWagesList.length > 0) {
      // Normalize: Extract digits only, take last 5, compare as strings
      const normalizeCode = (code: string): string => {
        const digits = code.replace(/\D/g, ''); // Remove non-digits
        return digits.slice(-5); // Take last 5 digits
      };
      
      const normalizedTarget = normalizeCode(targetMsaCode);
      console.log(`   Searching BLSAreaWagesList for MSA ${targetMsaCode} (normalized: ${normalizedTarget})...`);
      
      // Log first item for sanity check
      if (wages.BLSAreaWagesList[0]) {
        const first = wages.BLSAreaWagesList[0];
        console.log(`   Sample item - Raw Area: "${first.Area}", AreaName: "${first.AreaName}"`);
        console.log(`   Sample item - Normalized: "${normalizeCode(first.Area || first.AreaName)}"`);
      }
      
      // Extract and log available codes
      const availableCodes = wages.BLSAreaWagesList.map((a: any) => {
        const areaStr = a.Area || a.AreaCode || a.AreaName || '';
        return normalizeCode(areaStr);
      });
      console.log(`   Available MSA codes (normalized):`, availableCodes);
      
      // Find matching MSA by normalized code
      const msaData = wages.BLSAreaWagesList.find((area: any) => {
        const areaStr = area.Area || area.AreaCode || area.AreaName || '';
        const normalizedArea = normalizeCode(areaStr);
        return normalizedArea === normalizedTarget;
      });

      if (msaData) {
        console.log(`   ✅ Found MSA data:`, msaData.AreaName || msaData.Area);
        
        const normalized: NormalizedOewsData = {
          areaCode: msaData.Area || targetMsaCode,
          areaName: msaData.AreaName || 'MSA Area',
          soc,
          socTitle: occTitle,
          employment: null, // Not available in wage endpoint
          meanAnnual: parseFloat(msaData.Median || '0') || null,
          medianAnnual: parseFloat(msaData.Median || '0') || null,
          p10: parseFloat(msaData.Pct10 || '0') || null,
          p25: parseFloat(msaData.Pct25 || '0') || null,
          p75: parseFloat(msaData.Pct75 || '0') || null,
          p90: parseFloat(msaData.Pct90 || '0') || null,
          year: 2023,
          source: 'CareerOneStop',
        };
        return NextResponse.json(normalized);
      } else {
        console.log(`   ⚠️ MSA ${targetMsaCode} not found in BLSAreaWagesList`);
      }
    }

    // Fallback to state or national data
    const stateData = wages.StateWagesList?.[0];
    const nationalData = wages.NationalWagesList?.[0];
    const wageSource = stateData || nationalData;

    if (!wageSource) {
      console.error('❌ No wage data available (no state or national)');
      return NextResponse.json({ error: 'No wage data available' }, { status: 404 });
    }

    console.log(`   Using fallback: ${stateData ? 'State' : 'National'} level`);

    const normalized: NormalizedOewsData = {
      areaCode: stateData ? 'FL' : 'US',
      areaName: stateData ? 'Florida (Statewide)' : 'United States',
      soc,
      socTitle: occTitle,
      employment: null, // Wage endpoint does not include employment counts
      meanAnnual: parseFloat(wageSource.Median || '0') || null,
      medianAnnual: parseFloat(wageSource.Median || '0') || null,
      p10: parseFloat(wageSource.Pct10 || '0') || null,
      p25: parseFloat(wageSource.Pct25 || '0') || null,
      p75: parseFloat(wageSource.Pct75 || '0') || null,
      p90: parseFloat(wageSource.Pct90 || '0') || null,
      year: 2023,
      source: 'CareerOneStop',
    };

    return NextResponse.json(normalized);

  } catch (error) {
    console.error('Error processing response:', error);
    return NextResponse.json({ error: 'Failed to process data' }, { status: 500 });
  }
}
