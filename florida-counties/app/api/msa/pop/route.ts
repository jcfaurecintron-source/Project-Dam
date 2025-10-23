/**
 * Phase 1: MSA Population API
 * 
 * Simple, fast endpoint that returns population data for a CBSA
 * from the U.S. Census Bureau API (ACS 5-Year Estimates)
 * 
 * Query Parameters:
 *   - cbsa: CBSA code (e.g., "33100" for Miami)
 * 
 * Returns:
 *   - cbsa: CBSA code
 *   - name: MSA name
 *   - population: Total population
 *   - vintage: Data year/vintage
 */

import { NextRequest, NextResponse } from 'next/server';

// In-memory cache with 24-hour TTL
interface CacheEntry {
  data: PopulationData;
  timestamp: number;
}

interface PopulationData {
  cbsa: string;
  name: string;
  population: number | null;
  vintage: string;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getCachedData(cbsa: string): PopulationData | null {
  const entry = cache.get(cbsa);
  if (!entry) return null;
  
  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL) {
    cache.delete(cbsa);
    return null;
  }
  
  return entry.data;
}

function setCachedData(cbsa: string, data: PopulationData): void {
  cache.set(cbsa, {
    data,
    timestamp: Date.now()
  });
}

/**
 * Fetch MSA name from GeoJSON
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
 * Fetch population from Census API
 */
async function fetchPopulation(cbsaCode: string): Promise<number | null> {
  try {
    // Census API: ACS 5-Year Estimates, Table B01003 (Total Population)
    const year = 2022; // Most recent complete ACS 5-year
    const url = `https://api.census.gov/data/${year}/acs/acs5?get=NAME,B01003_001E&for=metropolitan%20statistical%20area/micropolitan%20statistical%20area:${cbsaCode}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Census API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    // Check for API error
    if (data.error) {
      console.error(`Census API error: ${data.error}`);
      return null;
    }

    // Response format: [["NAME", "B01003_001E", "metro area"], ["Miami-Fort Lauderdale...", "6138333", "33100"]]
    if (Array.isArray(data) && data.length >= 2) {
      const populationStr = data[1][1];
      const population = parseInt(populationStr, 10);
      
      if (isNaN(population)) {
        console.error(`Invalid population value: ${populationStr}`);
        return null;
      }
      
      return population;
    }

    console.error('Unexpected Census API response format', data);
    return null;
  } catch (error) {
    console.error('Error fetching Census population:', error);
    return null;
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
      console.log(`✅ Cache hit for CBSA ${cbsaCode} (${duration}ms)`);
      return NextResponse.json({
        ...cachedData,
        cached: true,
        duration_ms: duration
      });
    }

    // Parallel fetch: MSA name + population
    const [msaName, population] = await Promise.all([
      getMsaName(cbsaCode),
      fetchPopulation(cbsaCode)
    ]);

    // Build response
    const response: PopulationData = {
      cbsa: cbsaCode,
      name: msaName,
      population,
      vintage: 'ACS 2022'
    };

    // Cache the response
    setCachedData(cbsaCode, response);

    const duration = Date.now() - startTime;
    console.log(`✅ Fetched population for ${msaName} (${cbsaCode}): ${population?.toLocaleString() || 'null'} (${duration}ms)`);

    return NextResponse.json({
      ...response,
      cached: false,
      duration_ms: duration
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Error in MSA population API:', error);
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


