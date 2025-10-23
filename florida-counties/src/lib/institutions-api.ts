/**
 * Client library for fetching institution data from the API.
 */

export interface InstitutionCountByMsa {
  msa: string;
  count: number;
}

export interface InstitutionCountByCounty {
  fips: string;
  count: number;
}

export interface InstitutionAggregation {
  msa_counts: InstitutionCountByMsa[];
  county_counts: InstitutionCountByCounty[];
  total: number;
  year: number;
}

/**
 * Fetch institution counts by MSA.
 */
export async function fetchInstitutionsByMsa(): Promise<InstitutionCountByMsa[]> {
  const response = await fetch('/api/institutions?by=msa');
  
  if (!response.ok) {
    throw new Error(`Failed to fetch institutions by MSA: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetch institution counts by county (FIPS).
 */
export async function fetchInstitutionsByCounty(): Promise<InstitutionCountByCounty[]> {
  const response = await fetch('/api/institutions?by=county');
  
  if (!response.ok) {
    throw new Error(`Failed to fetch institutions by county: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetch full aggregation with both MSA and county counts.
 */
export async function fetchInstitutionsFull(): Promise<InstitutionAggregation> {
  const response = await fetch('/api/institutions?by=full');
  
  if (!response.ok) {
    throw new Error(`Failed to fetch full institution data: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get institution count for a specific MSA.
 */
export async function getInstitutionCountForMsa(msaName: string): Promise<number> {
  const data = await fetchInstitutionsByMsa();
  const match = data.find(item => item.msa === msaName);
  return match?.count || 0;
}

/**
 * Get institution count for a specific county (by FIPS).
 */
export async function getInstitutionCountForCounty(fips: string): Promise<number> {
  const data = await fetchInstitutionsByCounty();
  const match = data.find(item => item.fips === fips);
  return match?.count || 0;
}

