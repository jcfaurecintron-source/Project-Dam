/**
 * Static Database of Florida Educational Institutions
 * Phase 1: Using known institutions for reliable testing
 * Phase 2: Can be replaced with live College Scorecard API
 */

export interface FloridaInstitution {
  id: string;
  name: string;
  city: string;
  latitude: number;
  longitude: number;
  website: string | null;
  programs: string[]; // CIP codes offered
  type: 'community_college' | 'state_college' | 'university' | 'technical_college' | 'private';
}

/**
 * Major Florida Educational Institutions with Healthcare and Technical Programs
 * Source: Florida Department of Education, institutional websites
 */
export const FLORIDA_INSTITUTIONS: FloridaInstitution[] = [
  // Miami MSA (33100)
  {
    id: 'mdc',
    name: 'Miami Dade College',
    city: 'Miami',
    latitude: 25.7791,
    longitude: -80.2094,
    website: 'https://www.mdc.edu',
    programs: ['51.3801', '51.3803', '51.0910', '51.0801', '51.1004', '51.0909', '51.0808'],
    type: 'community_college'
  },
  {
    id: 'broward',
    name: 'Broward College',
    city: 'Fort Lauderdale',
    latitude: 26.1224,
    longitude: -80.1373,
    website: 'https://www.broward.edu',
    programs: ['51.3801', '51.0910', '51.0801', '51.0909'],
    type: 'community_college'
  },
  {
    id: 'palmbeach',
    name: 'Palm Beach State College',
    city: 'Lake Worth',
    latitude: 26.6169,
    longitude: -80.0707,
    website: 'https://www.palmbeachstate.edu',
    programs: ['51.3801', '51.0910', '51.0801', '51.0909'],
    type: 'community_college'
  },
  
  // Tampa MSA (45300)
  {
    id: 'hcc',
    name: 'Hillsborough Community College',
    city: 'Tampa',
    latitude: 27.9945,
    longitude: -82.3024,
    website: 'https://www.hccfl.edu',
    programs: ['51.3801', '51.0910', '51.0801', '51.1004', '51.0909', '46.0302', '47.0201', '48.0508'],
    type: 'community_college'
  },
  {
    id: 'spc',
    name: 'St. Petersburg College',
    city: 'St. Petersburg',
    latitude: 27.7781,
    longitude: -82.6403,
    website: 'https://www.spcollege.edu',
    programs: ['51.3801', '51.0910', '51.0801', '51.0909', '51.0808'],
    type: 'state_college'
  },
  
  // Orlando MSA (36740)
  {
    id: 'valencia',
    name: 'Valencia College',
    city: 'Orlando',
    latitude: 28.5924,
    longitude: -81.2048,
    website: 'https://www.valenciacollege.edu',
    programs: ['51.3801', '51.0910', '51.0801', '51.1004', '51.0909'],
    type: 'state_college'
  },
  {
    id: 'seminole',
    name: 'Seminole State College',
    city: 'Sanford',
    latitude: 28.7391,
    longitude: -81.2962,
    website: 'https://www.seminolestate.edu',
    programs: ['51.3801', '51.0801', '51.0909'],
    type: 'state_college'
  },
  
  // Jacksonville MSA (27260)
  {
    id: 'fscj',
    name: 'Florida State College at Jacksonville',
    city: 'Jacksonville',
    latitude: 30.2656,
    longitude: -81.5158,
    website: 'https://www.fscj.edu',
    programs: ['51.3801', '51.0910', '51.0801', '51.1004', '51.0909', '46.0302', '47.0201', '48.0508'],
    type: 'state_college'
  },
  
  // Naples MSA (34940)
  {
    id: 'lorenzo-walker',
    name: 'Lorenzo Walker Technical College',
    city: 'Naples',
    latitude: 26.1873,
    longitude: -81.7248,
    website: 'https://www.lwtech.edu',
    programs: ['51.0801', '46.0302', '47.0201', '48.0508'],
    type: 'technical_college'
  },
  
  // Fort Myers MSA (15980)
  {
    id: 'fswc',
    name: 'Florida SouthWestern State College',
    city: 'Fort Myers',
    latitude: 26.5628,
    longitude: -81.8725,
    website: 'https://www.fsw.edu',
    programs: ['51.3801', '51.0910', '51.0801', '51.0909', '51.0808'],
    type: 'state_college'
  },
  
  // Tallahassee MSA (45220)
  {
    id: 'tcc',
    name: 'Tallahassee Community College',
    city: 'Tallahassee',
    latitude: 30.4515,
    longitude: -84.2533,
    website: 'https://www.tcc.fl.edu',
    programs: ['51.3801', '51.0801', '51.0909', '46.0302', '47.0201'],
    type: 'community_college'
  },
  
  // Pensacola MSA (37860)
  {
    id: 'psc',
    name: 'Pensacola State College',
    city: 'Pensacola',
    latitude: 30.4382,
    longitude: -87.1892,
    website: 'https://www.pensacolastate.edu',
    programs: ['51.3801', '51.0801', '51.0909', '46.0302', '47.0201', '48.0508'],
    type: 'community_college'
  },
  
  // Gainesville MSA (23540)
  {
    id: 'sfcollege',
    name: 'Santa Fe College',
    city: 'Gainesville',
    latitude: 29.7104,
    longitude: -82.3640,
    website: 'https://www.sfcollege.edu',
    programs: ['51.3801', '51.0910', '51.0801', '51.1004', '51.0909', '51.0808'],
    type: 'community_college'
  },
  
  // Lakeland MSA (29460)
  {
    id: 'polk',
    name: 'Polk State College',
    city: 'Lakeland',
    latitude: 28.0367,
    longitude: -81.9498,
    website: 'https://www.polk.edu',
    programs: ['51.3801', '51.0801', '51.0909', '46.0302', '47.0201'],
    type: 'state_college'
  },
  
  // Daytona Beach MSA (19660)
  {
    id: 'daytonastate',
    name: 'Daytona State College',
    city: 'Daytona Beach',
    latitude: 29.1901,
    longitude: -81.0574,
    website: 'https://www.daytonastate.edu',
    programs: ['51.3801', '51.0910', '51.0801', '51.0909', '46.0302', '47.0201'],
    type: 'state_college'
  },
  
  // Sarasota MSA (35840)
  {
    id: 'scf',
    name: 'State College of Florida',
    city: 'Bradenton',
    latitude: 27.4830,
    longitude: -82.5748,
    website: 'https://www.scf.edu',
    programs: ['51.3801', '51.0801', '51.0909'],
    type: 'state_college'
  },
  
  // Port St. Lucie MSA (38460)
  {
    id: 'irsc',
    name: 'Indian River State College',
    city: 'Fort Pierce',
    latitude: 27.4248,
    longitude: -80.3431,
    website: 'https://www.irsc.edu',
    programs: ['51.3801', '51.0801', '51.0909', '46.0302', '47.0201', '48.0508'],
    type: 'state_college'
  },
  
  // Punta Gorda MSA (39460)
  {
    id: 'charlotte-tech',
    name: 'Charlotte Technical College',
    city: 'Port Charlotte',
    latitude: 26.9766,
    longitude: -82.1101,
    website: 'https://www.charlottetechnicalcollege.edu',
    programs: ['51.0801', '46.0302', '47.0201', '48.0508', '51.0808'],
    type: 'technical_college'
  },
  
  // Panama City MSA (37460)
  {
    id: 'gulf-coast',
    name: 'Gulf Coast State College',
    city: 'Panama City',
    latitude: 30.1588,
    longitude: -85.6602,
    website: 'https://www.gulfcoast.edu',
    programs: ['51.3801', '51.0801', '51.0909', '46.0302', '47.0201'],
    type: 'state_college'
  },
  
  // Ocala MSA (36100)
  {
    id: 'cf',
    name: 'College of Central Florida',
    city: 'Ocala',
    latitude: 29.1872,
    longitude: -82.0548,
    website: 'https://www.cf.edu',
    programs: ['51.3801', '51.0910', '51.0801', '51.0909', '46.0302'],
    type: 'state_college'
  }
];

/**
 * Find institutions offering specific CIP programs
 */
export function findInstitutionsByCip(cipCodes: string[]): FloridaInstitution[] {
  return FLORIDA_INSTITUTIONS.filter(inst => 
    inst.programs.some(program => cipCodes.includes(program))
  );
}

/**
 * Get all institutions in Florida
 */
export function getAllInstitutions(): FloridaInstitution[] {
  return FLORIDA_INSTITUTIONS;
}

