/**
 * CareerOneStop API Client
 * 
 * Utilities for fetching live OEWS data from CareerOneStop
 */

export interface OccupationData {
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
 * Fetch live occupation data from CareerOneStop via our proxy
 */
export async function fetchOccupationData(
  soc: string,
  location: string,
  msaCode?: string
): Promise<OccupationData | null> {
  try {
    // Build query params
    const params = new URLSearchParams({
      soc,
      location,
    });
    
    if (msaCode) {
      params.append('msaCode', msaCode);
    }

    const response = await fetch(`/api/careeronestop?${params}`, {
      method: 'GET',
      cache: 'no-store', // Always fetch fresh data
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error(`CareerOneStop ${response.status} error for ${soc}${msaCode ? ` MSA ${msaCode}` : ''}:`, error);
      
      // Log helpful details if it's a missing CBSA
      if (error.error?.startsWith('MISSING_CBSA')) {
        console.warn(`   MSA ${msaCode} not found in CareerOneStop API`);
        if (error.available) {
          console.warn(`   Available MSAs:`, error.available.slice(0, 5));
        }
      }
      
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch occupation data:', error);
    return null;
  }
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

