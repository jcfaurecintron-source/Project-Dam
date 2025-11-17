import { NextResponse } from 'next/server';
import { fetchInstitutionsByCip } from '@/lib/college-scorecard-api';

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

const STC_CIP_DETAILS: Record<string, string> = {
  '51.0910': 'Diagnostic Medical Sonography',
  '51.0801': 'Medical Assisting',
  '51.1004': 'Medical Laboratory Technician',
  '51.0909': 'Surgical Technology',
  '47.0201': 'HVAC / Refrigeration',
  '15.0303': 'Electrical Trades Technology',
  '48.0508': 'Welding Technology',
  '51.3801': 'Nursing (ADN)',
  '01.8301': 'Veterinary Assisting'
};

const PROGRAM_CATALOG = STC_CIP_CODES.map(code => ({
  code,
  name: STC_CIP_DETAILS[code] ?? `CIP ${code}`
}));

export async function GET() {
  try {
    const competitors = await fetchInstitutionsByCip(STC_CIP_CODES, 'FL');
    
    const mappedCompetitors = competitors.map(inst => ({
      school_id: inst.id,
      name: inst.name,
      state: inst.state,
      matching_programs: inst.cipCodes.map(code => ({
        code,
        name: STC_CIP_DETAILS[code] ?? `CIP ${code}`
      })),
      latitude: inst.latitude,
      longitude: inst.longitude,
      city: inst.city,
      website: inst.website,
      costs: inst.costs ?? null,
    }));

    return NextResponse.json({
      success: true,
      count: mappedCompetitors.length,
      competitors: mappedCompetitors,
      program_catalog: PROGRAM_CATALOG
    });
  } catch (error) {
    console.error('Error fetching competitors:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        competitors: [],
      },
      { status: 500 }
    );
  }
}
