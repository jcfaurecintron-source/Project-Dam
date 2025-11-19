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
  costs?: {
    tuitionInState: number | null;
    tuitionOutOfState: number | null;
    tuitionProgramYear: number | null;
    attendanceProgramYear: number | null;
    booksAndSupplies: number | null;
    programReporterFullProgram?: number | null;
  };
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

const SCORECARD_API_URL = 'https://api.data.gov/ed/collegescorecard/v1/schools.json';
const SCORECARD_FIELDS = [
  'id',
  'school.name',
  'school.city',
  'school.state',
  'school.school_url',
  'school.carnegie_basic',
  'school.ownership',
  'location.lat',
  'location.lon',
  'latest.programs.cip_4_digit',
  'latest.cost.tuition.in_state',
  'latest.cost.tuition.out_of_state',
  'latest.cost.tuition.program_year',
  'latest.cost.attendance.program_year',
  'latest.cost.booksupply',
  'latest.cost.program_reporter.program_1.cip_6_digit.full_program'
].join(',');
const PAGE_SIZE = 100;

interface CipMatcher {
  original: string;
  normalized: string;
  prefix: string;
}

function assertScorecardApiKey(): string {
  const key = process.env.COLLEGE_SCORECARD_API_KEY?.trim();
  if (!key) {
    throw new Error('COLLEGE_SCORECARD_API_KEY is missing or empty');
  }
  return key;
}

function normalizeCipCode(code: string | number | null | undefined): string {
  if (code == null) return '';
  return String(code).replace(/[^0-9]/g, '');
}

function buildCipMatchers(cipCodes: string[]): CipMatcher[] {
  return cipCodes.map(code => {
    const normalized = normalizeCipCode(code);
    return {
      original: code,
      normalized,
      prefix: normalized.slice(0, 4)
    };
  });
}

function findMatchingCips(code: unknown, matchers: CipMatcher[]): string[] {
  const normalized = normalizeCipCode(typeof code === 'object' ? null : (code as string | number | null | undefined));
  if (!normalized) return [];

  const directMatches = matchers.filter(m => m.normalized === normalized).map(m => m.original);
  if (directMatches.length > 0) {
    return directMatches;
  }

  const prefix = normalized.slice(0, 4);
  if (!prefix) return [];

  return matchers
    .filter(m => m.prefix === prefix)
    .map(m => m.original);
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function firstValidNumber(...values: (number | null | undefined)[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

async function fetchScorecardPage(
  stateCode: string,
  page: number,
  apiKey: string
): Promise<ScorecardApiResponse> {
  const params = new URLSearchParams({
    api_key: apiKey,
    'school.state': stateCode,
    'school.operating': '1',
    fields: SCORECARD_FIELDS,
    per_page: String(PAGE_SIZE),
    page: String(page),
  });

  const response = await fetch(`${SCORECARD_API_URL}?${params.toString()}`, {
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`College Scorecard API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (data.errors && data.errors.length > 0) {
    throw new Error(`College Scorecard API responded with errors: ${JSON.stringify(data.errors)}`);
  }

  return data as ScorecardApiResponse;
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
  stateCode: string = 'FL'
): Promise<CollegeScorecardInstitution[]> {
  const apiKey = assertScorecardApiKey();
  const matchers = buildCipMatchers(cipCodes);
  const schools = new Map<number, {
    id: number;
    name: string;
    city: string;
    state: string;
    latitude: number;
    longitude: number;
    website: string | null;
    carnegieClassification?: string;
    institutionType?: string;
    cipCodes: Set<string>;
    costs?: CollegeScorecardInstitution['costs'];
  }>();

  let page = 0;
  let totalPages: number | null = null;

  while (true) {
    const response = await fetchScorecardPage(stateCode, page, apiKey);
    const results = response.results ?? [];
    const metadata = response.metadata;

    if (metadata && typeof metadata.total === 'number' && typeof metadata.per_page === 'number' && metadata.per_page > 0) {
      totalPages = Math.ceil(metadata.total / metadata.per_page);
    }

    for (const school of results) {
      const lat = toNumber(school?.['location.lat']);
      const lon = toNumber(school?.['location.lon']);
      if (lat == null || lon == null) continue;

      const programs = Array.isArray(school?.['latest.programs.cip_4_digit'])
        ? school['latest.programs.cip_4_digit']
        : [];

      let schoolRecord = schools.get(school.id);
      if (!schoolRecord) {
        const baseTuitionInState = toNumber(school?.['latest.cost.tuition.in_state']);
        const baseTuitionOutOfState = toNumber(school?.['latest.cost.tuition.out_of_state']);
        const tuitionProgramYear = toNumber(school?.['latest.cost.tuition.program_year']);
        const attendanceProgramYear = toNumber(school?.['latest.cost.attendance.program_year']);
        const programReporterFullProgram = toNumber(
          school?.['latest.cost.program_reporter.program_1.cip_6_digit.full_program']
        );
        const fallbackTuition = firstValidNumber(
          tuitionProgramYear,
          programReporterFullProgram,
          attendanceProgramYear
        );
        const tuitionInState = firstValidNumber(baseTuitionInState, fallbackTuition);
        const tuitionOutOfState = firstValidNumber(baseTuitionOutOfState, fallbackTuition);
        const booksAndSupplies = toNumber(school?.['latest.cost.booksupply']);

        schoolRecord = {
          id: school.id,
          name: school?.['school.name'] || 'Unknown institution',
          city: school?.['school.city'] || '',
          state: school?.['school.state'] || stateCode,
          latitude: lat,
          longitude: lon,
          website: typeof school?.['school.school_url'] === 'string' ? school['school.school_url'] : null,
          carnegieClassification: school?.['school.carnegie_basic']?.toString(),
          institutionType: school?.['school.ownership']?.toString(),
          cipCodes: new Set<string>(),
          costs: {
            tuitionInState,
            tuitionOutOfState,
            tuitionProgramYear,
            attendanceProgramYear,
            booksAndSupplies,
            programReporterFullProgram,
          },
        };
      }

      for (const program of programs) {
        const matches = findMatchingCips(program?.code, matchers);
        matches.forEach(code => schoolRecord!.cipCodes.add(code));
      }

      if (schoolRecord.cipCodes.size > 0) {
        schools.set(school.id, schoolRecord);
      }
    }

    page += 1;
    if ((totalPages !== null && page >= totalPages) || results.length === 0) {
      break;
    }
  }

  return Array.from(schools.values()).map(inst => ({
    id: inst.id,
    name: inst.name,
    city: inst.city,
    state: inst.state,
    latitude: inst.latitude,
    longitude: inst.longitude,
    cipCodes: Array.from(inst.cipCodes).sort(),
    website: inst.website,
    carnegieClassification: inst.carnegieClassification,
    institutionType: inst.institutionType,
    costs: inst.costs,
  }));
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
