/**
 * Next.js API Route for fetching student data from Anthology Student API
 * Returns geocoded student locations for heatmap display
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchAnthologyStudents } from '../../../src/lib/anthology-student-api';
import { geocodeStudents, GeocodedStudent } from '../../../src/lib/geocode-students';

// Increase timeout for large date ranges (Next.js default is 10s, we need more for 1 year of data)
export const maxDuration = 300; // 5 minutes (Vercel/Next.js limit)

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDateDaysAgo = parseInt(searchParams.get('startDateDaysAgo') || '365', 10); // Default: 1 year back
    const endDateDaysAheadParam = searchParams.get('endDateDaysAhead');
    const endDateDaysAhead = endDateDaysAheadParam ? parseInt(endDateDaysAheadParam, 10) : undefined; // undefined = end of year
    const geocode = searchParams.get('geocode') === 'true'; // Default to false for faster initial load
    
    console.log('📡 Fetching students from Anthology API...', {
      startDateDaysAgo,
      endDateDaysAhead,
      geocode,
      apiKeyPresent: !!process.env.ANTHOLOGY_API_KEY,
      nextPublicKeyPresent: !!process.env.NEXT_PUBLIC_ANTHOLOGY_API_KEY,
    });
    
    let students;
    try {
      students = await fetchAnthologyStudents(startDateDaysAgo, endDateDaysAhead);
    } catch (apiError) {
      console.error('❌ Error in fetchAnthologyStudents:', apiError);
      // Re-throw with more context
      throw new Error(
        `Failed to fetch from Anthology API: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`
      );
    }
    
    console.log(`✅ Successfully fetched ${students.length} students`);
    
    let geocodedStudents: GeocodedStudent[] = students.map(s => ({
      ...s,
      lng: null,
      lat: null,
      geocoded: false,
    }));
    
    // Geocode addresses if requested
    if (geocode) {
      const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      if (!mapboxToken) {
        console.warn('⚠️ Mapbox token not found, skipping geocoding');
      } else {
        console.log('📍 Geocoding student addresses...');
        geocodedStudents = await geocodeStudents(students, mapboxToken, {
          batchSize: 50, // Increased from 10 for 5x faster parallel processing
          delayMs: 10,   // Reduced from 100ms - Mapbox allows higher concurrency
          maxRetries: 2,
        });
      }
    }
    
    const geocodedCount = geocodedStudents.filter(s => s.geocoded).length;
    console.log(`✅ Returning ${geocodedStudents.length} students (${geocodedCount} geocoded)`);
    
    return NextResponse.json({
      success: true,
      count: geocodedStudents.length,
      geocodedCount,
      students: geocodedStudents,
    });
  } catch (error) {
    console.error('❌ Error fetching students:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

