/**
 * MSA Name Mapping
 * 
 * Maps OEWS MSA names (used by map component) to IPEDS MSA names (used by institution data).
 * This is necessary because BLS and Census use slightly different naming conventions.
 */

export const MSA_NAME_MAPPING: Record<string, string> = {
  // OEWS Name → IPEDS Name
  'Miami-Fort Lauderdale-West Palm Beach, FL': 'Miami-Fort Lauderdale-Pompano Beach, FL',
  'Naples-Marco Island, FL': 'Naples-Immokalee-Marco Island, FL',
  'North Port-Bradenton-Sarasota, FL': 'North Port-Sarasota-Bradenton, FL',
  'Sebastian-Vero Beach-West Vero Corridor, FL': 'Sebastian-Vero Beach, FL',
  'Wildwood-The Villages, FL': 'The Villages, FL',  // Note: OEWS uses 48680, not 46060
  
  // These match exactly - kept for completeness
  'Cape Coral-Fort Myers, FL': 'Cape Coral-Fort Myers, FL',
  'Crestview-Fort Walton Beach-Destin, FL': 'Crestview-Fort Walton Beach-Destin, FL',
  'Deltona-Daytona Beach-Ormond Beach, FL': 'Deltona-Daytona Beach-Ormond Beach, FL',
  'Gainesville, FL': 'Gainesville, FL',
  'Homosassa Springs, FL': 'Homosassa Springs, FL',
  'Jacksonville, FL': 'Jacksonville, FL',
  'Lakeland-Winter Haven, FL': 'Lakeland-Winter Haven, FL',
  'Ocala, FL': 'Ocala, FL',
  'Orlando-Kissimmee-Sanford, FL': 'Orlando-Kissimmee-Sanford, FL',
  'Palm Bay-Melbourne-Titusville, FL': 'Palm Bay-Melbourne-Titusville, FL',
  'Pensacola-Ferry Pass-Brent, FL': 'Pensacola-Ferry Pass-Brent, FL',
  'Port St. Lucie, FL': 'Port St. Lucie, FL',
  'Punta Gorda, FL': 'Punta Gorda, FL',
  'Sebring, FL': 'Sebring, FL',
  'Tallahassee, FL': 'Tallahassee, FL',
  'Tampa-St. Petersburg-Clearwater, FL': 'Tampa-St. Petersburg-Clearwater, FL',
};

/**
 * Map an OEWS MSA name to the corresponding IPEDS MSA name
 */
export function mapOewsToIpedsMsaName(oewsName: string): string {
  return MSA_NAME_MAPPING[oewsName] || oewsName;
}

/**
 * Get all OEWS MSA names that have mappings
 */
export function getAllOewsMsaNames(): string[] {
  return Object.keys(MSA_NAME_MAPPING);
}

/**
 * Get all IPEDS MSA names that have mappings
 */
export function getAllIpedsMsaNames(): string[] {
  return [...new Set(Object.values(MSA_NAME_MAPPING))];
}

