/**
 * SOC to CIP Mapping
 * Maps Standard Occupational Classification (SOC) codes to
 * Classification of Instructional Programs (CIP) codes for
 * identifying relevant educational programs.
 */

export interface SocCipMapping {
  soc: string;
  socTitle: string;
  cips: string[];
  cipTitles: string[];
}

/**
 * Static SOC → CIP mapping for healthcare and technical occupations
 */
export const SOC_CIP_MAP: Record<string, SocCipMapping> = {
  '29-1141': {
    soc: '29-1141',
    socTitle: 'Registered Nurses',
    cips: ['51.3801', '51.3803'],
    cipTitles: ['Registered Nursing/Registered Nurse', 'Adult Health Nurse/Nursing']
  },
  '29-2032': {
    soc: '29-2032',
    socTitle: 'Diagnostic Medical Sonographers',
    cips: ['51.0910'],
    cipTitles: ['Diagnostic Medical Sonography/Sonographer and Ultrasound Technician']
  },
  '31-9092': {
    soc: '31-9092',
    socTitle: 'Medical Assistants',
    cips: ['51.0801', '51.0805'],
    cipTitles: ['Medical/Clinical Assistant', 'Pharmacy Technician/Assistant']
  },
  '29-2012': {
    soc: '29-2012',
    socTitle: 'Diagnostic Medical Technologists',
    cips: ['51.1004'],
    cipTitles: ['Clinical/Medical Laboratory Technician']
  },
  '29-2055': {
    soc: '29-2055',
    socTitle: 'Surgical Technologists',
    cips: ['51.0909'],
    cipTitles: ['Surgical Technology/Technologist']
  },
  '47-2111': {
    soc: '47-2111',
    socTitle: 'Electricians',
    cips: ['46.0302'],
    cipTitles: ['Electrician']
  },
  '49-9021': {
    soc: '49-9021',
    socTitle: 'Heating, Air Conditioning, and Refrigeration Mechanics',
    cips: ['47.0201'],
    cipTitles: ['Heating, Air Conditioning, Ventilation and Refrigeration Maintenance Technology/Technician']
  },
  '51-4121': {
    soc: '51-4121',
    socTitle: 'Welders, Cutters, Solderers, and Brazers',
    cips: ['48.0508'],
    cipTitles: ['Welding Technology/Welder']
  },
  '31-9096': {
    soc: '31-9096',
    socTitle: 'Veterinary Assistants and Laboratory Animal Caretakers',
    cips: ['51.0808'],
    cipTitles: ['Veterinary/Animal Health Technology/Technician and Veterinary Assistant']
  }
};

/**
 * Get CIP codes for a given SOC code
 */
export function getCipsForSoc(soc: string): string[] {
  const mapping = SOC_CIP_MAP[soc];
  return mapping ? mapping.cips : [];
}

/**
 * Get all mapped SOC codes
 */
export function getMappedSocCodes(): string[] {
  return Object.keys(SOC_CIP_MAP);
}

/**
 * Check if a SOC code has a CIP mapping
 */
export function hasCipMapping(soc: string): boolean {
  return soc in SOC_CIP_MAP;
}

/**
 * Get the mapping details for a SOC code
 */
export function getSocCipMapping(soc: string): SocCipMapping | null {
  return SOC_CIP_MAP[soc] || null;
}

