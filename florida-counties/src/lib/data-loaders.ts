/**
 * Data Loaders
 * 
 * Utilities to fetch preprocessed OEWS, projections, and SOC mapping data.
 * These loaders handle both static JSON files and optional BLS API calls.
 */

import type { 
  CountyOews, 
  StateProjection, 
  SocMap, 
  BlsSeriesRequest,
  BlsApiResponse 
} from './types';

/**
 * Load SOC mapping data (programs to SOC codes)
 */
export async function loadSocMap(): Promise<SocMap> {
  try {
    const response = await fetch('/data/soc-map.json');
    if (!response.ok) {
      throw new Error(`Failed to load SOC map: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading SOC map:', error);
    throw error;
  }
}

/**
 * Load county-level OEWS data for a specific year
 */
export async function loadCountyOews(year: number = 2023): Promise<CountyOews[]> {
  try {
    const response = await fetch(`/data/oews_fl_county_${year}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load OEWS data: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error loading OEWS data for ${year}:`, error);
    throw error;
  }
}

/**
 * Load state-level projections data
 */
export async function loadStateProjections(): Promise<StateProjection[]> {
  try {
    const response = await fetch('/data/projections_fl.json');
    if (!response.ok) {
      throw new Error(`Failed to load projections: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading projections:', error);
    throw error;
  }
}

/**
 * Load all labor statistics data (OEWS + Projections)
 */
export async function loadLaborStatistics(year: number = 2023): Promise<{
  oews: CountyOews[];
  projections: StateProjection[];
  socMap: SocMap;
}> {
  try {
    const [oews, projections, socMap] = await Promise.all([
      loadCountyOews(year),
      loadStateProjections(),
      loadSocMap(),
    ]);

    return { oews, projections, socMap };
  } catch (error) {
    console.error('Error loading labor statistics:', error);
    throw error;
  }
}

/**
 * Fetch data from BLS API via our proxy (for live updates)
 */
export async function fetchFromBlsApi(
  seriesIds: string[],
  startYear?: number,
  endYear?: number
): Promise<BlsApiResponse> {
  try {
    const request: BlsSeriesRequest = {
      seriesid: seriesIds,
      startyear: startYear?.toString(),
      endyear: endYear?.toString(),
    };

    const response = await fetch('/api/bls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'BLS API request failed');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching from BLS API:', error);
    throw error;
  }
}

/**
 * Get OEWS data for a specific county and SOC code
 */
export function getCountyData(
  oews: CountyOews[],
  geoid: string,
  soc?: string
): CountyOews[] {
  let filtered = oews.filter((d) => d.geoid === geoid);
  
  if (soc) {
    filtered = filtered.filter((d) => d.soc === soc);
  }
  
  return filtered;
}

/**
 * Get projection data for a specific SOC code
 */
export function getProjectionData(
  projections: StateProjection[],
  soc: string
): StateProjection | undefined {
  return projections.find((p) => p.soc === soc);
}

/**
 * Combine OEWS and projection data for a county/SOC
 */
export function getCombinedData(
  oews: CountyOews[],
  projections: StateProjection[],
  geoid: string,
  soc: string
): {
  oews: CountyOews | undefined;
  projection: StateProjection | undefined;
} {
  const countyData = oews.find((d) => d.geoid === geoid && d.soc === soc);
  const projectionData = projections.find((p) => p.soc === soc);
  
  return {
    oews: countyData,
    projection: projectionData,
  };
}

/**
 * Get all SOC codes from the SOC map
 */
export function getAllSocCodes(socMap: SocMap): Array<{ soc: string; name: string; category: string }> {
  const codes: Array<{ soc: string; name: string; category: string }> = [];
  
  socMap.programs.forEach((category) => {
    category.programs.forEach((program) => {
      codes.push({
        soc: program.soc,
        name: program.name,
        category: category.category,
      });
    });
  });
  
  return codes;
}

/**
 * Format wage as currency
 */
export function formatWage(wage: number | null | undefined): string {
  if (wage === null || wage === undefined) {
    return 'N/A';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(wage);
}

/**
 * Format employment number
 */
export function formatEmployment(employment: number | null | undefined): string {
  if (employment === null || employment === undefined) {
    return 'N/A';
  }
  return new Intl.NumberFormat('en-US').format(employment);
}

/**
 * Format percentage
 */
export function formatPercent(percent: number | null | undefined): string {
  if (percent === null || percent === undefined) {
    return 'N/A';
  }
  return `${percent.toFixed(1)}%`;
}

