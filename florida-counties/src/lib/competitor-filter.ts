const STC_CIP_CODES = [
  '51.0910',
  '51.0801',
  '51.1004',
  '51.0909',
  '47.0201',
  '15.0303',
  '48.0508',
  '51.3801',
  '01.8301'
];

export interface SchoolRecord {
  name: string;
  state: string;
  programs?: Array<{ cipCode?: string }>;
  cipCodes?: string[];
}

export function isCompetitorSchool(school: SchoolRecord): boolean {
  if (school.state !== 'FL') {
    return false;
  }

  const cipCodes = school.cipCodes || school.programs?.map(p => p.cipCode).filter(Boolean) || [];

  return cipCodes.some(cipCode => 
    STC_CIP_CODES.some(stcCip => 
      cipCode?.startsWith(stcCip) || cipCode === stcCip
    )
  );
}

export function filterCompetitorSchools<T extends SchoolRecord>(schools: T[]): T[] {
  return schools.filter(isCompetitorSchool);
}

