/**
 * Phase 2: MSA Labor Context API
 * 
 * Fetches Local Area Unemployment Statistics (LAUS) from BLS API
 * for a given CBSA. Returns labor force, employed, unemployed, and
 * unemployment rate for the last 24 months.
 * 
 * Query Parameters:
 *   - cbsa: CBSA code (e.g., "33100" for Miami)
 * 
 * Returns:
 *   - cbsa: CBSA code
 *   - name: MSA name
 *   - timeseries: Monthly data (last 24 months)
 *   - latest: Most recent month's data
 */

import { NextRequest, NextResponse } from 'next/server';

// In-memory cache with 24-hour TTL
interface CacheEntry {
  data: LausData;
  timestamp: number;
}

interface LausDataPoint {
  year: number;
  month: number;
  period: string; // "M01", "M02", etc.
  date: string; // "2024-01" for display
  labor_force: number | null;
  employed: number | null;
  unemployed: number | null;
  unemployment_rate: number | null;
}

interface LausData {
  cbsa: string;
  name: string;
  timeseries: LausDataPoint[];
  latest: LausDataPoint | null;
  vintage: string;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getCachedData(cbsa: string): LausData | null {
  const entry = cache.get(cbsa);
  if (!entry) return null;
  
  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL) {
    cache.delete(cbsa);
    return null;
  }
  
  return entry.data;
}

function setCachedData(cbsa: string, data: LausData): void {
  cache.set(cbsa, {
    data,
    timestamp: Date.now()
  });
}

/**
 * Get MSA name from GeoJSON
 */
async function getMsaName(cbsaCode: string): Promise<string> {
  try {
    const fs = await import('fs').then(mod => mod.promises);
    const path = await import('path');
    const publicDir = path.join(process.cwd(), 'public');
    const msaGeojsonPath = path.join(publicDir, 'data', 'fl-msas.geojson');
    
    const geojsonContent = await fs.readFile(msaGeojsonPath, 'utf-8');
    const geojson = JSON.parse(geojsonContent);
    
    const msaFeature = geojson.features.find((f: any) => 
      f.properties?.CBSAFP === cbsaCode
    );
    
    if (msaFeature && msaFeature.properties?.NAME) {
      return msaFeature.properties.NAME;
    }
  } catch (error) {
    console.error('Error loading MSA name:', error);
  }
  
  return 'Unknown MSA';
}

/**
 * Build BLS LAUS series IDs for Florida MSA
 * Format: LAUMT{state_fips}{cbsa}0000000{measure}
 * Florida FIPS: 12
 * Measures: 03=rate, 04=unemployed, 05=employed, 06=labor_force
 */
function buildLausSeriesIds(cbsaCode: string): string[] {
  const stateFips = '12'; // Florida
  const baseSeries = `LAUMT${stateFips}${cbsaCode}000000000`;
  
  return [
    `${baseSeries}6`, // Labor force
    `${baseSeries}5`, // Employed
    `${baseSeries}4`, // Unemployed
    `${baseSeries}3`, // Unemployment rate
  ];
}

/**
 * Fetch LAUS data from BLS API
 */
async function fetchLausData(cbsaCode: string): Promise<LausDataPoint[]> {
  try {
    const seriesIds = buildLausSeriesIds(cbsaCode);
    
    // Get last 2 years of data
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 2;
    
    const requestBody = {
      seriesid: seriesIds,
      startyear: startYear.toString(),
      endyear: currentYear.toString(),
      registrationkey: process.env.BLS_API_KEY || undefined
    };

    const response = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      console.error(`BLS API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    
    if (data.status !== 'REQUEST_SUCCEEDED') {
      console.error('BLS API request failed:', data.message);
      return [];
    }

    if (!data.Results?.series || data.Results.series.length === 0) {
      console.error('No LAUS data returned from BLS');
      return [];
    }

    // Parse and combine the series data
    const seriesData = data.Results.series;
    
    // Create a map of date -> data point
    const dataMap = new Map<string, LausDataPoint>();
    
    seriesData.forEach((series: any) => {
      const seriesId = series.seriesID;
      const measure = seriesId.slice(-1); // Last digit indicates measure
      
      series.data.forEach((point: any) => {
        const key = `${point.year}-${point.period}`;
        
        if (!dataMap.has(key)) {
          dataMap.set(key, {
            year: parseInt(point.year),
            month: parseInt(point.period.substring(1)), // "M01" -> 1
            period: point.period,
            date: `${point.year}-${point.period.substring(1).padStart(2, '0')}`,
            labor_force: null,
            employed: null,
            unemployed: null,
            unemployment_rate: null
          });
        }
        
        const dataPoint = dataMap.get(key)!;
        const value = parseFloat(point.value);
        
        // Assign value based on measure type
        if (measure === '6') {
          dataPoint.labor_force = value;
        } else if (measure === '5') {
          dataPoint.employed = value;
        } else if (measure === '4') {
          dataPoint.unemployed = value;
        } else if (measure === '3') {
          dataPoint.unemployment_rate = value;
        }
      });
    });

    // Convert map to array and sort by date (newest first)
    const timeseries = Array.from(dataMap.values())
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });

    // Return last 24 months
    return timeseries.slice(0, 24).reverse(); // Reverse to oldest->newest for display

  } catch (error) {
    console.error('Error fetching BLS LAUS data:', error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const cbsaCode = searchParams.get('cbsa');

    // Validate parameter
    if (!cbsaCode) {
      return NextResponse.json(
        { error: 'Missing required parameter: cbsa' },
        { status: 400 }
      );
    }

    // Check cache first
    const cachedData = getCachedData(cbsaCode);
    if (cachedData) {
      const duration = Date.now() - startTime;
      console.log(`✅ Cache hit for LAUS ${cbsaCode} (${duration}ms)`);
      return NextResponse.json({
        ...cachedData,
        cached: true,
        duration_ms: duration
      });
    }

    // Fetch MSA name and LAUS data in parallel
    const [msaName, timeseries] = await Promise.all([
      getMsaName(cbsaCode),
      fetchLausData(cbsaCode)
    ]);

    // Get latest data point (most recent month)
    const latest = timeseries.length > 0 ? timeseries[timeseries.length - 1] : null;

    // Build response
    const response: LausData = {
      cbsa: cbsaCode,
      name: msaName,
      timeseries,
      latest,
      vintage: 'BLS LAUS'
    };

    // Cache the response
    setCachedData(cbsaCode, response);

    const duration = Date.now() - startTime;
    console.log(`✅ Fetched LAUS for ${msaName} (${cbsaCode}): ${timeseries.length} months, latest rate: ${latest?.unemployment_rate}% (${duration}ms)`);

    return NextResponse.json({
      ...response,
      cached: false,
      duration_ms: duration
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Error in MSA LAUS API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: duration
      },
      { status: 500 }
    );
  }
}


