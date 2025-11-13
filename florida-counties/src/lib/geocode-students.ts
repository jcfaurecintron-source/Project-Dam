/**
 * Geocoding utility for student addresses
 * Uses Mapbox Geocoding API to convert addresses to coordinates
 */

export interface GeocodedStudent {
  SyStudentID: number;
  StuNum: string;
  StudentName: string;
  CampusDescrip: string;
  Phone: string | null;
  ProgramDescrip: string;
  Addr1: string | null;
  SCITY: string | null;
  STATE: string | null;
  ZIP: string | null;
  lng: number | null;
  lat: number | null;
  geocoded: boolean;
}

/**
 * Geocode a single address using Mapbox Geocoding API
 */
export async function geocodeAddress(
  address: string,
  city: string | null,
  state: string | null,
  zip: string | null,
  mapboxToken: string
): Promise<{ lng: number; lat: number } | null> {
  if (!address || !city || !state) {
    return null;
  }

  // Build full address string
  const addressParts = [address];
  if (city) addressParts.push(city);
  if (state) addressParts.push(state);
  if (zip) addressParts.push(zip);
  
  const fullAddress = addressParts.join(', ');
  
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      fullAddress
    )}.json?access_token=${mapboxToken}&limit=1&country=US`;
    
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`Geocode HTTP ${res.status} for: ${fullAddress}`);
      return null;
    }
    
    const data = await res.json();
    const feat = data.features?.[0];
    if (!feat) {
      console.warn(`No geocode result for: ${fullAddress}`);
      return null;
    }
    
    const [lng, lat] = feat.center;
    return { lng, lat };
  } catch (error) {
    console.error(`Geocode error for ${fullAddress}:`, error);
    return null;
  }
}

/**
 * Geocode multiple student addresses with rate limiting
 */
export async function geocodeStudents(
  students: Array<{
    SyStudentID: number;
    StuNum: string;
    StudentName: string;
    CampusDescrip: string;
    Phone: string | null;
    ProgramDescrip: string;
    Addr1: string | null;
    SCITY: string | null;
    STATE: string | null;
    ZIP: string | null;
  }>,
  mapboxToken: string,
  options: {
    batchSize?: number;
    delayMs?: number;
    maxRetries?: number;
  } = {}
): Promise<GeocodedStudent[]> {
  // Optimized defaults: 50 addresses per batch, 10ms delay (5x faster than previous 10/100ms)
  const { batchSize = 50, delayMs = 10, maxRetries = 2 } = options;
  const geocoded: GeocodedStudent[] = [];
  
  // Filter students with valid addresses
  const studentsWithAddresses = students.filter(
    s => s.Addr1 && s.SCITY && s.STATE
  );
  
  console.log(`📍 Geocoding ${studentsWithAddresses.length} students with addresses (out of ${students.length} total)`);
  
  // Process in batches to avoid rate limiting
  for (let i = 0; i < studentsWithAddresses.length; i += batchSize) {
    const batch = studentsWithAddresses.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (student) => {
      let attempts = 0;
      let coords: { lng: number; lat: number } | null = null;
      
      while (attempts <= maxRetries && !coords) {
        coords = await geocodeAddress(
          student.Addr1!,
          student.SCITY,
          student.STATE,
          student.ZIP,
          mapboxToken
        );
        
        if (!coords && attempts < maxRetries) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempts)));
        }
        attempts++;
      }
      
      return {
        ...student,
        lng: coords?.lng ?? null,
        lat: coords?.lat ?? null,
        geocoded: coords !== null,
      } as GeocodedStudent;
    });
    
    const batchResults = await Promise.all(batchPromises);
    geocoded.push(...batchResults);
    
    // Delay between batches
    if (i + batchSize < studentsWithAddresses.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  // Add students without addresses (with null coordinates)
  const studentsWithoutAddresses = students.filter(
    s => !s.Addr1 || !s.SCITY || !s.STATE
  );
  
  studentsWithoutAddresses.forEach(student => {
    geocoded.push({
      ...student,
      lng: null,
      lat: null,
      geocoded: false,
    });
  });
  
  const successCount = geocoded.filter(s => s.geocoded).length;
  console.log(`✅ Geocoded ${successCount} out of ${geocoded.length} students`);
  
  return geocoded;
}

