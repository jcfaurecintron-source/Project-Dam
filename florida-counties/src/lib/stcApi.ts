/**
 * STC Institution Data API Client
 * Fetches institution-level data for Southern Technical College from:
 * - College Scorecard API (primary)
 * - NCES EducationData API (fallback)
 */

export interface StcInstitutionInfo {
  unitId: number;
  name: string;
  studentCount: number | null;
  tuition: number | null;
  booksSupplies: number | null;
  source: "scorecard" | "nces" | "partial";
}

interface ScorecardResponse {
  results?: Array<{
    id: number;
    "school.name": string;
    "latest.student.size"?: number | null;
    "latest.cost.tuition.program_year"?: number | null;
    "latest.cost.booksupplies"?: number | null;
  }>;
  metadata?: {
    total: number;
    page: number;
    per_page: number;
  };
  errors?: Array<{ message: string }>;
}

interface NcesDirectoryResponse {
  results?: Array<{
    unitid: number;
    inst_name?: string;
    total_enrollment?: number | null;
    enrollment?: number | null;
    [key: string]: any; // Allow other fields
  }>;
  errors?: Array<{ message: string }>;
}

interface NcesCostResponse {
  results?: Array<{
    unitid: number;
    tuition_fees_in_state?: number | null;
    tuition_fees_out_of_state?: number | null;
    tuition_fees_program_year?: number | null;
    books_supplies?: number | null;
    cost_attendance?: number | null;
    [key: string]: any; // Allow other fields
  }>;
  errors?: Array<{ message: string }>;
}

/**
 * Retry wrapper with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxAttempts) {
        throw lastError;
      }

      // Exponential backoff: delay = baseDelay * 2^(attempt - 1)
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error("Retry failed");
}

/**
 * Fetch STC institution data from College Scorecard API
 */
async function fetchScorecardInstitution(): Promise<StcInstitutionInfo | null> {
  const apiKey = 
    process.env.SCORECARD_KEY || 
    process.env.NEXT_PUBLIC_SCORECARD_KEY ||
    process.env.COLLEGE_SCORECARD_API_KEY ||
    process.env.NEXT_PUBLIC_COLLEGE_SCORECARD_API_KEY;
  
  if (!apiKey) {
    throw new Error(
      "College Scorecard API key not found. " +
      "Please set SCORECARD_KEY, COLLEGE_SCORECARD_API_KEY, or their NEXT_PUBLIC_ variants."
    );
  }

  const baseUrl = "https://api.data.gov/ed/collegescorecard/v1/schools";
  const params = new URLSearchParams({
    api_key: apiKey,
    "school.name": "southern technical college",
    "school.state": "FL", // Filter to Florida only
    fields: [
      "id",
      "school.name",
      "school.state",
      "latest.student.size",
      "latest.cost.tuition.program_year",
      "latest.cost.booksupply",
      "latest.cost.tuition.in_state",
      "latest.cost.tuition.out_of_state",
      "latest.cost.otherexpense.offcampus"
    ].join(",")
  });

  const url = `${baseUrl}?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `College Scorecard API error: ${response.status} ${response.statusText}`
    );
  }

  const data: ScorecardResponse = await response.json();

  // Check for API errors
  if (data.errors && data.errors.length > 0) {
    throw new Error(
      `College Scorecard API errors: ${data.errors.map(e => e.message).join(", ")}`
    );
  }

  if (!data.results || !Array.isArray(data.results) || data.results.length === 0) {
    return null;
  }

  // Filter to only STC institutions in Florida
  const stcResults = data.results.filter(
    r => r["school.name"]?.toLowerCase().includes("southern technical college") ||
         r["school.name"]?.toLowerCase().includes("southern technical")
  );

  if (stcResults.length === 0) {
    return null;
  }

  // Aggregate data across all STC campuses
  let totalStudents = 0;
  let tuitionValues: number[] = [];
  let booksSuppliesValues: number[] = [];
  const unitIds: number[] = [];

  for (const result of stcResults) {
    const unitId = result.id;
    unitIds.push(unitId);

    // Sum student counts
    if (result["latest.student.size"] !== null && result["latest.student.size"] !== undefined) {
      totalStudents += result["latest.student.size"];
    }

    // Collect tuition values - try program_year first, then in_state/out_of_state
    const tuitionProgramYear = result["latest.cost.tuition.program_year"];
    const tuitionInState = result["latest.cost.tuition.in_state"];
    const tuitionOutOfState = result["latest.cost.tuition.out_of_state"];
    
    if (tuitionProgramYear !== null && tuitionProgramYear !== undefined) {
      tuitionValues.push(tuitionProgramYear);
    } else if (tuitionInState !== null && tuitionInState !== undefined) {
      tuitionValues.push(tuitionInState);
    } else if (tuitionOutOfState !== null && tuitionOutOfState !== undefined) {
      tuitionValues.push(tuitionOutOfState);
    }

    // Collect books & supplies values - field name is "booksupply" (singular)
    // If not available, use otherexpense.offcampus as fallback (often includes books & supplies)
    const booksupply = result["latest.cost.booksupply"];
    const otherExpense = result["latest.cost.otherexpense.offcampus"];
    
    if (booksupply !== null && booksupply !== undefined) {
      booksSuppliesValues.push(booksupply);
    } else if (otherExpense !== null && otherExpense !== undefined) {
      // Use other expense as proxy for books & supplies (typically includes it)
      booksSuppliesValues.push(otherExpense);
    }
  }

  // Use primary unitId (first one) for NCES lookup
  const primaryUnitId = unitIds[0];
  const studentCount = totalStudents > 0 ? totalStudents : null;
  
  // Use first available tuition, or average if multiple
  const tuition = tuitionValues.length > 0 
    ? (tuitionValues.length === 1 ? tuitionValues[0] : Math.round(tuitionValues.reduce((a, b) => a + b, 0) / tuitionValues.length))
    : null;
  
  // Use first available books & supplies, or average if multiple
  const booksSupplies = booksSuppliesValues.length > 0
    ? (booksSuppliesValues.length === 1 ? booksSuppliesValues[0] : Math.round(booksSuppliesValues.reduce((a, b) => a + b, 0) / booksSuppliesValues.length))
    : null;

  return {
    unitId: primaryUnitId, // Use primary for NCES fallback
    name: "Southern Technical College",
    studentCount,
    tuition,
    booksSupplies,
    source: "scorecard",
  };
}

/**
 * Fetch STC institution data from NCES EducationData API (IPEDS)
 * Uses multiple IPEDS survey endpoints to get enrollment, tuition, and cost data
 * @param unitId - The unit ID from College Scorecard (required for NCES lookup)
 */
async function fetchNcesInstitution(unitId: number): Promise<StcInstitutionInfo | null> {
  // Try multiple years (2021, 2020, 2019) to find available data
  const years = [2021, 2020, 2019];
  let enrollmentData: any = null;
  let tuitionData: any = null;
  let costData: any = null;
  let workingYear: number | null = null;

  // IPEDS has separate surveys for different data:
  // - Fall Enrollment (EF) for enrollment numbers
  // - Student Financial Aid (SFA) for tuition/fees
  // - Institutional Characteristics (IC) for some cost data

  for (const year of years) {
    try {
      // 1. Fetch Fall Enrollment data
      const enrollUrl = `https://educationdata.urban.org/api/v1/college-university/ipeds/fall-enrollment/${year}?unitid=${unitId}`;
      const enrollResponse = await fetch(enrollUrl);
      
      if (enrollResponse.ok) {
        const enrollJson: any = await enrollResponse.json();
        if (enrollJson.results && enrollJson.results.length > 0 && !enrollJson.errors) {
          enrollmentData = enrollJson.results[0];
          workingYear = year;
        }
      }

      // 2. Fetch Student Financial Aid data (has tuition/fees)
      const sfaUrl = `https://educationdata.urban.org/api/v1/college-university/ipeds/student-financial-aid/${year}?unitid=${unitId}`;
      const sfaResponse = await fetch(sfaUrl);
      
      if (sfaResponse.ok) {
        const sfaJson: any = await sfaResponse.json();
        if (sfaJson.results && sfaJson.results.length > 0 && !sfaJson.errors) {
          tuitionData = sfaJson.results[0];
        }
      }

      // 3. Fetch Institutional Characteristics (may have cost data)
      const icUrl = `https://educationdata.urban.org/api/v1/college-university/ipeds/institutional-characteristics/${year}?unitid=${unitId}`;
      const icResponse = await fetch(icUrl);
      
      if (icResponse.ok) {
        const icJson: any = await icResponse.json();
        if (icJson.results && icJson.results.length > 0 && !icJson.errors) {
          costData = icJson.results[0];
        }
      }

      // If we got at least enrollment data, we can proceed
      if (enrollmentData) {
        break;
      }
    } catch (e) {
      // Continue to next year
      continue;
    }
  }

  if (!enrollmentData) {
    return null;
  }

  // Extract enrollment - calculate from IC data or use Fall Enrollment
  let studentCount: number | null = null;
  
  if (enrollmentData) {
    // Try Fall Enrollment fields first
    studentCount = 
      enrollmentData.total_enrollment ??
      enrollmentData.enrollment_total ??
      enrollmentData.ef_total ??
      enrollmentData.enrollment ??
      null;
  }
  
  // If not found, calculate from IC enrollment fields
  if (!studentCount && costData) {
    const ft = costData.enrolled_undergrad_fulltime ?? 0;
    const pt = costData.enrolled_undergrad_parttime ?? 0;
    const gradFt = costData.enrolled_graduate_fulltime ?? 0;
    const gradPt = costData.enrolled_graduate_parttime ?? 0;
    
    // Sum all enrollment (only if values are valid numbers, not -2 which means "not applicable")
    const total = [ft, pt, gradFt, gradPt]
      .filter(v => typeof v === 'number' && v >= 0)
      .reduce((sum, v) => sum + v, 0);
    
    studentCount = total > 0 ? total : null;
  }

  // Extract tuition - IPEDS may not have this in Urban Institute API
  // Try IC data first, then any other sources
  const tuition = 
    costData?.tuition_fees ??
    costData?.tuition_fees_in_state ??
    costData?.tuition_fees_out_of_state ??
    costData?.typical_room_charge ??
    costData?.typical_board_charge ??
    tuitionData?.tuition_fees ??
    tuitionData?.tuition_fees_in_state ??
    tuitionData?.tuition_fees_out_of_state ??
    tuitionData?.tuition_and_fees ??
    null;

  // Extract books & supplies - IPEDS may not have this directly
  // This data is typically in Cost of Attendance survey which may not be available
  const booksSupplies = 
    costData?.books_supplies ??
    costData?.books_and_supplies ??
    costData?.books ??
    tuitionData?.books_supplies ??
    null;

  // Get institution name from directory if available
  let instName = "Southern Technical College";
  try {
    const dirUrl = `https://educationdata.urban.org/api/v1/college-university/ipeds/directory/${workingYear}?unitid=${unitId}`;
    const dirResponse = await fetch(dirUrl);
    if (dirResponse.ok) {
      const dirJson: any = await dirResponse.json();
      if (dirJson.results && dirJson.results[0]?.inst_name) {
        instName = dirJson.results[0].inst_name;
      }
    }
  } catch (e) {
    // Use default name
  }

  return {
    unitId,
    name: instName,
    studentCount,
    tuition,
    booksSupplies,
    source: "nces",
  };
}

/**
 * Merge data from two sources, prioritizing Scorecard values
 */
function mergeInstitutionData(
  primary: StcInstitutionInfo,
  fallback: StcInstitutionInfo | null
): StcInstitutionInfo {
  if (!fallback) {
    return primary;
  }

  // Use primary source values, fall back to NCES if primary is null
  return {
    unitId: primary.unitId,
    name: primary.name,
    studentCount: primary.studentCount ?? fallback.studentCount,
    tuition: primary.tuition ?? fallback.tuition,
    booksSupplies: primary.booksSupplies ?? fallback.booksSupplies,
    source: 
      (primary.studentCount !== null && primary.tuition !== null && primary.booksSupplies !== null)
        ? "scorecard"
        : (primary.studentCount !== null || primary.tuition !== null || primary.booksSupplies !== null)
        ? "partial"
        : "nces",
  };
}

/**
 * Get STC institution data from College Scorecard API with NCES fallback
 * Tries both STC unitIds from IPEDS to get books & supplies
 * 
 * @returns Institution data with student count, tuition, and books/supplies
 * @throws Error if both APIs fail or if required environment variables are missing
 */
export async function getStcInstitutionData(): Promise<StcInstitutionInfo> {
  let scorecardData: StcInstitutionInfo | null = null;
  let ncesData: StcInstitutionInfo | null = null;

  // Try to fetch from College Scorecard (primary source)
  try {
    scorecardData = await retryWithBackoff(() => fetchScorecardInstitution());
  } catch (error) {
    console.error("Failed to fetch from College Scorecard API:", error);
    // Continue to try NCES fallback
  }

  // If we got Scorecard data, try NCES as fallback for missing fields
  if (scorecardData) {
    // Try both known STC unitIds (366553 and 446552) to get books & supplies
    const stcUnitIds = [366553, 446552];
    
    for (const unitId of stcUnitIds) {
      try {
        const ncesResult = await retryWithBackoff(() => 
          fetchNcesInstitution(unitId)
        );
        
        // If we got books & supplies from this unitId, use it
        if (ncesResult && ncesResult.booksSupplies !== null) {
          ncesData = ncesResult;
          break;
        }
        
        // Otherwise, keep the first result we get (for enrollment/tuition fallback)
        if (!ncesData) {
          ncesData = ncesResult;
        }
      } catch (error) {
        // Continue to next unitId
        continue;
      }
    }

    // Merge data if we have both sources
    if (ncesData) {
      return mergeInstitutionData(scorecardData, ncesData);
    }

    return scorecardData;
  }

  // If Scorecard failed, we can't get unitId for NCES lookup
  // Try to find STC in NCES by searching (this would require a different endpoint)
  // For now, throw an error since we need unitId from Scorecard
  throw new Error(
    "Failed to fetch STC data from College Scorecard API. " +
    "NCES fallback requires unitId which is only available from Scorecard."
  );
}

