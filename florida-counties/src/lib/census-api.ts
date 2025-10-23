/**
 * U.S. Census API Client
 * Fetches population data for MSAs (CBSAs) from the Census Bureau API
 */

interface CensusApiResponse {
  error?: string;
  [key: string]: any;
}

/**
 * Fetch population for a CBSA from Census ACS 5-Year Estimates
 * Uses Table B01003 (Total Population)
 * 
 * @param cbsaCode - 5-digit CBSA code (e.g., "33100" for Miami MSA)
 * @returns Population count or null if unavailable
 */
export async function fetchCbsaPopulation(cbsaCode: string): Promise<number | null> {
  try {
    // Census API endpoint for ACS 5-Year estimates
    // Using 2022 as the most recent complete dataset
    const year = 2022;
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

    const data: CensusApiResponse = await response.json();
    
    // Check for API error response
    if (data.error) {
      console.error(`Census API error: ${data.error}`);
      return null;
    }

    // Response format: [["NAME", "B01003_001E", "metropolitan statistical area/micropolitan statistical area"], ["Miami-Fort Lauderdale-Pompano Beach, FL Metro Area", "6138333", "33100"]]
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

/**
 * Batch fetch populations for multiple CBSAs
 * Note: Census API has rate limits, so we'll fetch sequentially with a small delay
 */
export async function fetchMultipleCbsaPopulations(
  cbsaCodes: string[]
): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  
  for (const code of cbsaCodes) {
    const population = await fetchCbsaPopulation(code);
    if (population !== null) {
      results.set(code, population);
    }
    // Small delay to avoid rate limiting (500ms between requests)
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return results;
}

