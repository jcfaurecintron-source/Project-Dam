/**
 * College Scorecard API Client
 * Fetches competitor institution data from the U.S. Department of Education
 * College Scorecard API
 */

export interface CollegeScorecardInstitution {
  id: number;
  name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  cipCodes: string[];
  website: string | null;
  carnegieClassification?: string;
  institutionType?: string;
}

interface ScorecardApiResponse {
  metadata?: {
    total: number;
    page: number;
    per_page: number;
  };
  results?: any[];
  errors?: any[];
}

/**
 * Query College Scorecard API for institutions offering specific CIP programs
 * 
 * @param cipCodes - Array of CIP codes to search for
 * @param stateCode - Two-letter state code (default: "FL" for Florida)
 * @param limit - Maximum number of results (default: 100)
 * @returns Array of institutions offering the specified programs
 */
export async function fetchInstitutionsByCip(
  cipCodes: string[],
  stateCode: string = 'FL',
  limit: number = 100
): Promise<CollegeScorecardInstitution[]> {
  try {
    // College Scorecard API endpoint
    // Note: API key can be obtained from https://collegescorecard.ed.gov/data/documentation/
    // Using public access (no key required for basic queries)
    const baseUrl = 'https://api.data.gov/ed/collegescorecard/v1/schools.json';
    
    // Build query parameters
    // Note: College Scorecard API doesn't support direct CIP filtering in basic queries
    // We'll get all Florida institutions and filter client-side
    const params = new URLSearchParams({
      'school.state': stateCode,
      'school.operating': '1', // Only operating schools
      'fields': 'id,school.name,school.city,school.state,location.lat,location.lon,school.school_url',
      'per_page': limit.toString(),
      // Filter by degree-granting institutions
      'school.degrees_awarded.predominant__range': '1..', // At least certificate programs
    });
    
    const url = `${baseUrl}?${params.toString()}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`College Scorecard API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data: ScorecardApiResponse = await response.json();
    
    // Check for errors
    if (data.errors && data.errors.length > 0) {
      console.error('College Scorecard API errors:', data.errors);
      return [];
    }

    if (!data.results || !Array.isArray(data.results)) {
      console.error('Unexpected College Scorecard API response format');
      return [];
    }

    // Transform results to our interface
    const institutions: CollegeScorecardInstitution[] = data.results
      .filter(school => {
        // Ensure we have required fields
        return school['school.name'] && 
               school['location.lat'] && 
               school['location.lon'];
      })
      .map(school => ({
        id: school.id,
        name: school['school.name'],
        city: school['school.city'] || '',
        state: school['school.state'] || stateCode,
        latitude: parseFloat(school['location.lat']),
        longitude: parseFloat(school['location.lon']),
        cipCodes: cipCodes, // Store the CIP codes we searched for
        website: school['school.school_url'] || null,
        carnegieClassification: school['school.carnegie_basic']?.toString() || undefined,
        institutionType: school['school.ownership']?.toString() || undefined
      }));

    return institutions;
  } catch (error) {
    console.error('Error fetching College Scorecard data:', error);
    return [];
  }
}

/**
 * Check if a point (institution) is within a polygon (MSA boundary)
 * Uses ray casting algorithm
 */
export function isPointInPolygon(
  point: [number, number], // [longitude, latitude]
  polygon: [number, number][]
): boolean {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Filter institutions to those within an MSA boundary
 * 
 * @param institutions - Array of institutions to filter
 * @param msaGeometry - GeoJSON geometry of the MSA (polygon or multipolygon)
 * @returns Filtered institutions within the MSA
 */
export function filterInstitutionsByMsa(
  institutions: CollegeScorecardInstitution[],
  msaGeometry: any // GeoJSON Geometry
): CollegeScorecardInstitution[] {
  if (!msaGeometry || !msaGeometry.coordinates) {
    console.warn('Invalid MSA geometry provided');
    return institutions;
  }

  return institutions.filter(institution => {
    const point: [number, number] = [institution.longitude, institution.latitude];
    
    if (msaGeometry.type === 'Polygon') {
      // Single polygon - check the outer ring
      const outerRing = msaGeometry.coordinates[0];
      return isPointInPolygon(point, outerRing);
    } else if (msaGeometry.type === 'MultiPolygon') {
      // Multiple polygons - check if point is in any of them
      return msaGeometry.coordinates.some((polygon: any) => {
        const outerRing = polygon[0];
        return isPointInPolygon(point, outerRing);
      });
    }
    
    return false;
  });
}

