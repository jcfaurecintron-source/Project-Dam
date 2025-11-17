import { NextRequest, NextResponse } from 'next/server';
import { fetchInstitutionsByCip } from '../../../src/lib/college-scorecard-api';

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

export async function GET(request: NextRequest) {
  try {
    const competitors = await fetchInstitutionsByCip(STC_CIP_CODES, 'FL', 500);
    
    const mappedCompetitors = competitors.map(inst => ({
      name: inst.name,
      state: inst.state,
      cipCodes: STC_CIP_CODES,
      latitude: inst.latitude,
      longitude: inst.longitude,
      city: inst.city,
      website: inst.website,
    }));

    return NextResponse.json({
      success: true,
      count: mappedCompetitors.length,
      competitors: mappedCompetitors,
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

