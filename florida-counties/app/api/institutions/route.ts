/**
 * API route for fetching institution counts by MSA and county.
 * Data is sourced from precomputed IPEDS aggregations.
 */
import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export interface InstitutionCountByMsa {
  msa: string;
  count: number;
}

export interface InstitutionCountByCounty {
  fips: string;
  count: number;
}

export interface InstitutionAggregation {
  msa_counts: InstitutionCountByMsa[];
  county_counts: InstitutionCountByCounty[];
  total: number;
  year: number;
}

/**
 * GET /api/institutions?by=msa|county|full
 * 
 * Returns institution counts aggregated by the specified level.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const by = searchParams.get('by') || 'msa';
    
    // Path to precomputed data
    const dataDir = join(process.cwd(), 'public', 'data');
    const filePath = join(dataDir, 'institutions_fl.json');
    
    // Read precomputed data
    let data: any;
    try {
      const fileContent = await readFile(filePath, 'utf-8');
      data = JSON.parse(fileContent);
    } catch (error) {
      return NextResponse.json(
        { error: 'Institution data not available. Run data pipeline to generate.' },
        { status: 404 }
      );
    }
    
    // Transform based on requested aggregation level
    if (by === 'msa') {
      const msaCounts: InstitutionCountByMsa[] = Object.entries(
        data.msa_counts || {}
      ).map(([msa, count]) => ({
        msa,
        count: count as number
      }));
      
      return NextResponse.json(msaCounts);
      
    } else if (by === 'county') {
      const countyCounts: InstitutionCountByCounty[] = Object.entries(
        data.county_counts || {}
      ).map(([fips, count]) => ({
        fips,
        count: count as number
      }));
      
      return NextResponse.json(countyCounts);
      
    } else if (by === 'full') {
      const aggregation: InstitutionAggregation = {
        msa_counts: Object.entries(data.msa_counts || {}).map(
          ([msa, count]) => ({ msa, count: count as number })
        ),
        county_counts: Object.entries(data.county_counts || {}).map(
          ([fips, count]) => ({ fips, count: count as number })
        ),
        total: data.total || 0,
        year: data.year || 0
      };
      
      return NextResponse.json(aggregation);
      
    } else {
      return NextResponse.json(
        { error: 'Invalid aggregation level. Use by=msa|county|full' },
        { status: 400 }
      );
    }
    
  } catch (error) {
    console.error('Error fetching institution data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

