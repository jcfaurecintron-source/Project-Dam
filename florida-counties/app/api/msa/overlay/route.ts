/**
 * MSA Competitor Overlay API
 * 
 * Provides competitor institution data, population, and density metrics
 * for a given MSA and SOC code combination.
 * 
 * Query Parameters:
 *   - msa: CBSA code (e.g., "33100")
 *   - soc: SOC code (e.g., "29-1141")
 * 
 * Returns:
 *   - MSA population (from Census API)
 *   - Competitor institutions (from College Scorecard API, spatially filtered)
 *   - Competition density metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCipsForSoc, getSocCipMapping } from '@/lib/soc-cip-mapping';
import { fetchCbsaPopulation } from '@/lib/census-api';
import { 
  filterInstitutionsByMsa,
  type CollegeScorecardInstitution 
} from '@/lib/college-scorecard-api';
import { findInstitutionsByCip } from '@/lib/florida-institutions';

// In-memory cache with 24-hour TTL
interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

function getCacheKey(msa: string, soc: string): string {
  return `${msa}:${soc}`;
}

function getCachedData(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) return null;
  
  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL) {
    // Expired
    cache.delete(key);
    return null;
  }
  
  return entry.data;
}

function setCachedData(key: string, data: any): void {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const msaCode = searchParams.get('msa');
    const socCode = searchParams.get('soc');

    // Validate parameters
    if (!msaCode || !socCode) {
      return NextResponse.json(
        { error: 'Missing required parameters: msa and soc' },
        { status: 400 }
      );
    }

    // Check cache first
    const cacheKey = getCacheKey(msaCode, socCode);
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      console.log(`✅ Cache hit for ${cacheKey}`);
      return NextResponse.json(cachedData);
    }

    // Check if SOC has CIP mapping
    const socMapping = getSocCipMapping(socCode);
    if (!socMapping) {
      return NextResponse.json({
        msa: { code: msaCode, name: 'Unknown MSA' },
        soc: socCode,
        population: null,
        competitor_count: 0,
        competitors: [],
        density_per_100k: null,
        sources: { census: 'N/A', scorecard: 'N/A' },
        error: 'No CIP mapping available for this SOC code'
      });
    }

    const cipCodes = socMapping.cips;

    // Fetch MSA GeoJSON for spatial filtering
    // Load Florida MSAs geometry
    let msaGeometry: any = null;
    let msaName = 'Unknown MSA';
    
    try {
      const fs = await import('fs').then(mod => mod.promises);
      const path = await import('path');
      const publicDir = path.join(process.cwd(), 'public');
      const msaGeojsonPath = path.join(publicDir, 'data', 'fl-msas.geojson');
      
      const geojsonContent = await fs.readFile(msaGeojsonPath, 'utf-8');
      const geojson = JSON.parse(geojsonContent);
      
      // Find the MSA feature
      const msaFeature = geojson.features.find((f: any) => 
        f.properties?.CBSAFP === msaCode || 
        f.properties?.CBSA === msaCode || 
        f.properties?.cbsa_code === msaCode ||
        f.properties?.GEOID === msaCode
      );
      
      if (msaFeature) {
        msaGeometry = msaFeature.geometry;
        msaName = msaFeature.properties?.NAME || 
                  msaFeature.properties?.cbsa_title || 
                  msaFeature.properties?.name ||
                  'Unknown MSA';
      }
    } catch (error) {
      console.error('Error loading MSA geometry:', error);
    }

    // Fetch population from Census API
    const population = await fetchCbsaPopulation(msaCode);
    
    // Get institutions from static database (Phase 1)
    // Phase 2: Replace with live College Scorecard API
    const allInstitutions: CollegeScorecardInstitution[] = findInstitutionsByCip(cipCodes).map(inst => ({
      id: parseInt(inst.id.replace(/[^0-9]/g, '') || '0'),
      name: inst.name,
      city: inst.city,
      state: 'FL',
      latitude: inst.latitude,
      longitude: inst.longitude,
      cipCodes: cipCodes,
      website: inst.website,
      institutionType: inst.type
    }));

    // Spatially filter institutions to MSA boundary
    let competitors: CollegeScorecardInstitution[] = allInstitutions;
    if (msaGeometry) {
      competitors = filterInstitutionsByMsa(allInstitutions, msaGeometry);
    }

    // Phase 1: Limit to ONE institution per MSA for stability testing
    const limitedCompetitors = competitors.slice(0, 1);

    // Calculate metrics
    const competitorCount = limitedCompetitors.length;
    const densityPer100k = population 
      ? (competitorCount / population) * 100000 
      : null;

    // Build response
    const response = {
      msa: {
        code: msaCode,
        name: msaName
      },
      soc: socCode,
      population,
      competitor_count: competitorCount,
      competitors: limitedCompetitors.map(inst => ({
        name: inst.name,
        city: inst.city,
        lat: inst.latitude,
        lon: inst.longitude,
        cips: inst.cipCodes,
        url: inst.website
      })),
      density_per_100k: densityPer100k,
      sources: {
        census: 'ACS 2022',
        scorecard: '2024'
      },
      _debug: {
        total_institutions_found: allInstitutions.length,
        institutions_in_msa: competitors.length,
        limited_to_phase1: limitedCompetitors.length,
        cip_codes_searched: cipCodes
      }
    };

    // Cache the response
    setCachedData(cacheKey, response);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in MSA overlay API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

