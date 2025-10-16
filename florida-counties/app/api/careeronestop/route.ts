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
  const rawLocation = searchParams.get('location');
  const targetMsaCode = searchParams.get('msaCode');

  if (!soc) {
    return NextResponse.json({ error: 'SOC code required' }, { status: 400 });
  }

  if (!USER_ID || !AUTH_TOKEN) {
    console.error('❌ CareerOneStop credentials not configured');
    return NextResponse.json({ error: 'API credentials not configured' }, { status: 500 });
  }

  // Format SOC with decimals
  const socFormatted = soc.includes('.') ? soc : `${soc}.00`;
  
  // Build location variations (robust resolver for cities like Port St. Lucie)
  const locationVariations: string[] = [];
  
  if (rawLocation && rawLocation !== 'FL') {
    locationVariations.push(rawLocation);                              // Original
    locationVariations.push(rawLocation.replace(/\./g, ''));          // Remove periods
    locationVariations.push(rawLocation.replace(/St\./g, 'Saint'));   // St. → Saint
    locationVariations.push(rawLocation.replace(/St(?=\s)/g, 'Saint')); // St → Saint (before space)
    
    // Extract last 2 words + state (e.g., "Lucie, FL" from "Port St. Lucie, FL")
    const parts = rawLocation.split(',')[0].trim().split(/\s+/);
    if (parts.length >= 2) {
      const shortName = parts.slice(-2).join(' ') + ', FL';
      if (!locationVariations.includes(shortName)) {
        locationVariations.push(shortName);
      }
    }
  }
  
  // Always end with FL as final fallback
  locationVariations.push('FL');
  
  // Remove duplicates
  const uniqueLocations = [...new Set(locationVariations)];
  console.log(`🔍 Location attempts for MSA ${targetMsaCode}:`, uniqueLocations);

  const attemptLog: Array<{ location: string; status: number | string }> = [];
  let successfulData: any = null;

  // Try each location variant
  for (const location of uniqueLocations) {
    const url = `${BASE_URL}/comparesalaries/${USER_ID}/wage?keyword=${encodeURIComponent(socFormatted)}&location=${encodeURIComponent(location)}`;
    
    console.log(`📡 Trying: "${location}"`);

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Accept': 'application/json',
        },
      });

      attemptLog.push({ location, status: response.status });

      if (!response.ok) {
        console.log(`   ❌ ${response.status} ${response.statusText}`);
        continue;
      }

      const data = await response.json();
      const wages = data?.OccupationDetail?.Wages;

      if (!wages?.BLSAreaWagesList || wages.BLSAreaWagesList.length === 0) {
        console.log(`   ⚠️ Empty BLSAreaWagesList`);
        continue;
      }

      // Log sample of available MSAs
      const sample = wages.BLSAreaWagesList.slice(0, 3).map((x: any) => ({
        Area: x.Area,
        AreaName: x.AreaName,
        RateType: x.RateType,
        Year: x.Year,
      }));
      console.log(`   BLSAreaWagesList preview:`, sample);

      // Check if target MSA is in this response
      if (targetMsaCode) {
        const normalizedTarget = norm(targetMsaCode);
        const hasMsa = wages.BLSAreaWagesList.some((x: any) => 
          norm(x.Area || '') === normalizedTarget
        );

        if (hasMsa) {
          console.log(`   ✅ Found MSA ${normalizedTarget} in response`);
          successfulData = data;
          break;
        } else {
          console.log(`   ⚠️ MSA ${normalizedTarget} not found, continuing...`);
        }
      } else {
        // No MSA filter, use first successful response
        successfulData = data;
        break;
      }

    } catch (err) {
      console.error(`   ❌ Request error:`, err);
      attemptLog.push({ location, status: 'ERROR' });
    }
  }

  console.log(`📊 Attempt summary:`, attemptLog);

  if (!successfulData) {
    console.error(`❌ All attempts failed for ${soc} MSA ${targetMsaCode || 'N/A'}`);
    return NextResponse.json({ 
      error: `MISSING_CBSA_${targetMsaCode || 'UNKNOWN'}`,
      attempts: attemptLog 
    }, { status: 404 });
  }

  return processCareerOneStopResponse(successfulData, soc, targetMsaCode, false);
}

// Shared normalization utility
function norm(v: string): string {
  return (v ?? '').replace(/\D+/g, '').slice(-5).padStart(5, '0');
}

function processCareerOneStopResponse(
  data: any,
  soc: string,
  targetMsaCode: string | null,
  isStateFallback: boolean
): NextResponse {
  try {
    const wages = data?.OccupationDetail?.Wages;
    const occTitle = data?.OccupationDetail?.OnetTitle || soc;
    
    if (!wages) {
      console.error('❌ No OccupationDetail.Wages in response');
      return NextResponse.json({ error: 'No wage data in response' }, { status: 404 });
    }
    
    console.log(`✅ Processing wages for ${soc}`);

    // Strict MSA filtering (no state fallback if MSA requested)
    let candidates: any[] = [];
    let scope = 'State';

    if (targetMsaCode) {
      const normalizedTarget = norm(targetMsaCode);
      console.log(`   Target MSA: ${targetMsaCode} (normalized: ${normalizedTarget})`);
      
      if (wages.BLSAreaWagesList && wages.BLSAreaWagesList.length > 0) {
        // Filter ONLY by exact MSA match
        candidates = wages.BLSAreaWagesList.filter((area: any) => {
          const areaStr = area.Area || '';
          return norm(areaStr) === normalizedTarget;
        });

        if (candidates.length > 0) {
          scope = 'MSA';
          console.log(`   ✅ Found ${candidates.length} MSA candidate(s) for ${normalizedTarget}`);
        } else {
          // MSA requested but not found - HARD FAIL (no state fallback)
          console.error(`   ❌ MISSING_CBSA_${targetMsaCode}`);
          console.error(`   Available MSAs:`, wages.BLSAreaWagesList.map((a: any) => ({
            code: a.Area,
            name: a.AreaName
          })).slice(0, 5));
          
          return NextResponse.json({ 
            error: `MISSING_CBSA_${targetMsaCode}`,
            available: wages.BLSAreaWagesList.map((a: any) => norm(a.Area || '')).slice(0, 10)
          }, { status: 404 });
        }
      } else {
        console.error(`   ❌ No BLSAreaWagesList in response`);
        return NextResponse.json({ error: 'No MSA data available' }, { status: 404 });
      }
    } else {
      // No MSA filter - use state or national
      if (wages.StateWagesList && wages.StateWagesList.length > 0) {
        candidates = wages.StateWagesList;
        scope = 'State';
      } else if (wages.NationalWagesList && wages.NationalWagesList.length > 0) {
        candidates = wages.NationalWagesList;
        scope = 'National';
      }
    }

    if (candidates.length === 0) {
      console.error('❌ No wage candidates found');
      return NextResponse.json({ error: 'No wage data available' }, { status: 404 });
    }

    // Prefer Annual over Hourly
    const annual = candidates.filter((r: any) => r.RateType === 'Annual');
    const hourly = candidates.filter((r: any) => r.RateType === 'Hourly');
    
    let pool: any[] = [];
    let convertedFromHourly = false;

    if (annual.length > 0) {
      pool = annual;
      console.log(`   Using Annual rates (${annual.length} record(s))`);
    } else if (hourly.length > 0) {
      pool = hourly;
      convertedFromHourly = true;
      console.log(`   Using Hourly rates (${hourly.length} record(s)), will convert`);
    } else {
      pool = candidates; // Use whatever we have
    }

    // Pick latest year
    const chosen = pool.reduce((a, b) => {
      const yearA = parseInt(a.Year || '0');
      const yearB = parseInt(b.Year || '0');
      return yearB > yearA ? b : a;
    });

    // Comprehensive logging
    console.log(`   📊 Final chosen record:`, {
      Area: chosen.Area,
      AreaName: chosen.AreaName,
      RateType: chosen.RateType,
      Year: chosen.Year,
      Median: chosen.Median,
      Mean: chosen.Mean,
      Pct10: chosen.Pct10,
      Pct25: chosen.Pct25,
      Pct75: chosen.Pct75,
      Pct90: chosen.Pct90,
      convertedFromHourly
    });

    // Convert hourly to annual if needed
    const parseWage = (value: string | number | undefined): number | null => {
      if (!value) return null;
      const num = parseFloat(String(value).replace(/,/g, ''));
      if (isNaN(num)) return null;
      return convertedFromHourly ? Math.round(num * 2080) : num;
    };

    const medianAnnual = parseWage(chosen.Median);
    const meanAnnual = parseWage(chosen.Mean);
    const p10 = parseWage(chosen.Pct10);
    const p25 = parseWage(chosen.Pct25);
    const p75 = parseWage(chosen.Pct75);
    const p90 = parseWage(chosen.Pct90);

    // Validate median
    if (medianAnnual && medianAnnual < 20000) {
      console.warn(`   ⚠️ Suspiciously low median: $${medianAnnual}`);
    }

    const normalized: NormalizedOewsData = {
      areaCode: chosen.Area || (scope === 'State' ? 'FL' : 'US'),
      areaName: chosen.AreaName || `${scope} Average`,
      soc,
      socTitle: occTitle,
      employment: null,
      meanAnnual,
      medianAnnual,
      p10,
      p25,
      p75,
      p90,
      year: parseInt(chosen.Year || '2023'),
      source: 'CareerOneStop',
    };

    return NextResponse.json(normalized);

  } catch (error) {
    console.error('Error processing response:', error);
    return NextResponse.json({ error: 'Failed to process data' }, { status: 500 });
  }
}
