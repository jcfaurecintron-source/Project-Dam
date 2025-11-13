/**
 * Anthology Student API Client
 * Fetches student data from CampusNexus/Anthology Student API
 * 
 * Note: Uses Node's https module instead of fetch() because the API
 * rejects requests from Node's fetch implementation but accepts https module requests
 */

import https from 'https';
import { URL } from 'url';

export interface AnthologyStudent {
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
}

interface AnthologyApiResponse {
  value: Array<{
    Id: number;
    StudentNumber: string;
    FullName: string;
    PhoneNumber: string | null;
    StartDate: string;
    Campus?: {
      Name: string;
    };
    Program?: {
      Name: string;
    };
    Person?: {
      Addresses?: Array<{
        StreetAddress?: string;
        City?: string;
        State?: string;
        PostalCode?: string;
      }>;
    };
  }>;
  '@odata.count'?: number;
}

/**
 * Fetch students from Anthology Student API
 * @param startDateDaysAgo - Number of days ago for start date filter (default: 365 - 1 year)
 * @param endDateDaysAhead - Number of days ahead for end date filter (default: to end of current year)
 * @returns Array of formatted student records
 */
export async function fetchAnthologyStudents(
  startDateDaysAgo: number = 365, // 1 year back
  endDateDaysAhead?: number // If not provided, calculate to end of current year
): Promise<AnthologyStudent[]> {
  // Get API key from environment variables only (never hardcode secrets!)
  const apiKey = process.env.ANTHOLOGY_API_KEY || process.env.NEXT_PUBLIC_ANTHOLOGY_API_KEY;
  
  if (!apiKey) {
    throw new Error(
      "ANTHOLOGY_API_KEY environment variable is not set. " +
      "Please set it in your .env.local file. " +
      "The API key should be the Base64-encoded Basic auth token."
    );
  }

  const rootURL = 'https://sisclientweb-100192.campusnexus.cloud/ds/campusnexus/';
  const entity = 'Students';
  
  // Calculate date range
  // Start: 1 year back from today
  // End: End of current year (December 31, 23:59:59)
  const today = new Date();
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0); // Midnight local
  
  // Start date: 1 year back (or specified days ago)
  const startDateLocal = new Date(todayLocal);
  startDateLocal.setDate(startDateLocal.getDate() - startDateDaysAgo);
  
  // End date: End of current year (December 31, 23:59:59) if not specified
  let endDateLocal: Date;
  if (endDateDaysAhead !== undefined) {
    // Use specified days ahead
    endDateLocal = new Date(todayLocal);
    endDateLocal.setDate(endDateLocal.getDate() + endDateDaysAhead);
    endDateLocal.setHours(23, 59, 59, 999);
  } else {
    // Default to end of current year (December 31, 23:59:59)
    // Create January 1 of next year, then subtract 1 day to get December 31
    endDateLocal = new Date(today.getFullYear() + 1, 0, 1); // January 1 of next year
    endDateLocal.setDate(endDateLocal.getDate() - 1); // Subtract 1 day = December 31
    endDateLocal.setHours(23, 59, 59, 999); // Set to end of day
  }
  
  // Convert to UTC - toISOString() converts local time to UTC
  // This matches PowerShell's ToUniversalTime() behavior
  const finalStartDate = new Date(startDateLocal.toISOString());
  const finalEndDate = new Date(endDateLocal.toISOString());
  
  // PowerShell GetDateTimeFormats("o") produces ISO 8601 format: 2022-04-06T00:00:00.0000000Z
  // JavaScript toISOString() produces: 2022-04-06T00:00:00.000Z
  // The PowerShell script inserts the date string directly into the filter
  // PowerShell: $Filter = "((StartDate ge $($StartDate_Past)) and ...)"
  // This means the date is inserted as a string literal, likely without quotes in the final URL
  // But OData typically requires quotes around string literals
  // Let's try matching PowerShell exactly - just the ISO string in single quotes
  const formatDateForOData = (date: Date): string => {
    // PowerShell's GetDateTimeFormats("o") produces: 2024-01-15T00:00:00.0000000Z (7-digit milliseconds)
    // JavaScript toISOString() produces: 2024-01-15T00:00:00.000Z (3-digit milliseconds)
    // Most OData APIs accept the 3-digit version, but let's match PowerShell exactly
    const iso = date.toISOString();
    // Pad milliseconds to 7 digits to match PowerShell
    return iso.replace(/\.(\d{3})Z$/, (match, digits) => `.${digits}0000Z`);
  };
  
  const startDateStr = formatDateForOData(finalStartDate);
  const endDateStr = formatDateForOData(finalEndDate);
  
  // PowerShell inserts dates directly WITHOUT quotes: StartDate ge $($StartDate_Past)
  // From the log: Filtering On: ((StartDate ge 2025-05-24T04:00:00.0000000Z) and ...)
  // Notice NO quotes around the dates! This is the key difference.
  const filter = `((StartDate ge ${startDateStr}) and (StartDate le ${endDateStr})) and ((SchoolStatusId eq 13) or (SchoolStatusId eq 162) or (SchoolStatusId eq 150) or (SchoolStatusId eq 151) or (SchoolStatusId eq 155))`;
  
  const select = 'Id,CampusId,SchoolStatusId,ProgramId,StudentNumber,FullName,FirstName,LastName,PhoneNumber,StartDate';
  const expand = 'Campus($select=Name),Program($select=Name),SchoolStatus($select=Name),Person($expand=Addresses)';
  const orderBy = 'Campus/Name,FullName';
  
  // Build query string EXACTLY like PowerShell script
  // PowerShell: $QueryString.Add("`$select=$($Select)") | Out-Null
  // PowerShell: $URI = "$($RootURL){0}?{1}" -f @($Entity, ($QueryString -join '&'))
  // PowerShell's -join '&' doesn't URL encode, but Invoke-RestMethod will encode it when making the HTTP request
  // We need to manually encode the filter value, but be careful with how we encode it
  // The key insight: PowerShell shows the filter WITHOUT encoding in the log, but HTTP requires encoding
  const queryParams: string[] = [];
  queryParams.push(`$select=${select}`);
  queryParams.push(`$expand=${expand}`);
  // Encode the filter - this is critical for HTTP, even though PowerShell log shows it unencoded
  queryParams.push(`$filter=${encodeURIComponent(filter)}`);
  queryParams.push(`$count=true`);
  queryParams.push(`$orderby=${orderBy}`);
  
  const url = `${rootURL}${entity}?${queryParams.join('&')}`;
  
  // Log for debugging - compare with PowerShell output
  console.log('🔍 Raw filter (matches PowerShell log format):', filter);
  console.log('🔍 Full URL (first 800 chars):', url.substring(0, 800));
  
  // Fetch all pages (pagination)
  const pageSize = 1000;
  let skip = 0;
  const allStudents: AnthologyStudent[] = [];
  
  do {
    // PowerShell pagination: $PagedQuery = $QueryString.Clone()
    // $PagedQuery.Add("`$top=$pageSize") | Out-Null
    // $PagedQuery.Add("`$skip=$skip") | Out-Null
    // $PagedURI = "$($RootURL){0}?{1}" -f @($Entity, ($PagedQuery -join '&'))
    // Build paged query - clone the base params and add pagination
    const pagedQueryParams = [...queryParams];
    pagedQueryParams.push(`$top=${pageSize}`);
    pagedQueryParams.push(`$skip=${skip}`);
    
    const pagedUrl = `${rootURL}${entity}?${pagedQueryParams.join('&')}`;
    
    // Log the URL for debugging (check server console)
    if (skip === 0) {
      console.log('🔍 First API call URL:', pagedUrl.substring(0, 500));
      console.log('🔍 Full URL:', pagedUrl);
      console.log('🔍 Filter value:', filter);
      console.log('🔍 Start date:', startDateStr);
      console.log('🔍 End date:', endDateStr);
    }
    
    // Use the API key from environment variable
    const authToken = apiKey;
  
    // Use Node's https module instead of fetch() because the API rejects fetch() requests
    // but accepts https module requests (likely due to TLS/SSL or header differences)
    const urlObj = new URL(pagedUrl);
    
    const data: AnthologyApiResponse = await new Promise((resolve, reject) => {
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'Authorization': `Basic ${authToken}`,
          'Accept': 'application/json',
        },
        timeout: 120000, // 2 minute timeout (larger date range = more data to fetch)
      };
      
      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const jsonData: AnthologyApiResponse = JSON.parse(responseData);
              resolve(jsonData);
            } catch (parseError) {
              reject(new Error(`Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`));
            }
          } else {
            let errorDetails = '';
            try {
              const errorJson = JSON.parse(responseData);
              errorDetails = errorJson.Message || responseData.substring(0, 500);
            } catch (e) {
              errorDetails = responseData.substring(0, 500);
            }
            
            console.error(`❌ Anthology API error (${res.statusCode}):`, {
              status: res.statusCode,
              statusText: res.statusMessage,
              url: pagedUrl.substring(0, 200),
              errorDetails,
            });
            
            reject(new Error(
              `Anthology API error: ${res.statusCode} ${res.statusMessage}${errorDetails ? ` - ${errorDetails}` : ''}`
            ));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`Network error: ${error.message}`));
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout after 2 minutes. The date range may be too large, or the API is slow.'));
      });
      
      req.end();
    });
    
    // Format and add students
    if (data.value && data.value.length > 0) {
      for (const student of data.value) {
        // Extract address from nested Person.Addresses
        let addr1: string | null = null;
        let city: string | null = null;
        let state: string | null = null;
        let zip: string | null = null;
        
        if (student.Person?.Addresses && student.Person.Addresses.length > 0) {
          // Find first valid address
          const validAddress = student.Person.Addresses.find(
            addr => addr.StreetAddress?.trim() && 
                    addr.City?.trim() && 
                    addr.PostalCode?.trim()
          );
          
          if (validAddress) {
            addr1 = validAddress.StreetAddress?.trim() || null;
            city = validAddress.City?.trim() || null;
            state = validAddress.State?.trim() || null;
            zip = validAddress.PostalCode?.trim() || null;
          }
        }
        
        allStudents.push({
          SyStudentID: student.Id,
          StuNum: student.StudentNumber,
          StudentName: student.FullName,
          CampusDescrip: student.Campus?.Name || 'Unknown',
          Phone: student.PhoneNumber || null,
          ProgramDescrip: student.Program?.Name || 'Unknown',
          Addr1: addr1,
          SCITY: city,
          STATE: state,
          ZIP: zip,
        });
      }
      
      // Check if we got a full page - if so, there might be more data
      const hasMore = data.value.length === pageSize;
      
      if (skip === 0) {
        const totalCount = data['@odata.count'] ?? allStudents.length;
        console.log(`📊 Total students available: ${totalCount}`);
        console.log(`📄 Fetched page 1: ${data.value.length} students`);
      } else {
        console.log(`📄 Fetched page ${Math.floor(skip / pageSize) + 1}: ${data.value.length} students (total so far: ${allStudents.length})`);
      }
      
      skip += pageSize;
      
      // Continue if we got a full page (might be more), or break if we got less than a full page
      if (!hasMore) {
        console.log(`✅ Reached end of data. Total students fetched: ${allStudents.length}`);
        break;
      }
    } else {
      console.log(`✅ No more data. Total students fetched: ${allStudents.length}`);
      break; // No more data
    }
  } while (true); // Continue until no more pages
  
  return allStudents;
}

