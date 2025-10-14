# CareerOneStop API Integration Guide

## Overview

This application now uses **CareerOneStop Web API** for **live OEWS data** (employment and wages by occupation).

**Key Benefits:**
- ✅ **Live data** - No manual downloads needed
- ✅ **Official OEWS** - Same data as BLS, via DOL
- ✅ **MSA & State levels** - Proper geographic granularity
- ✅ **Free API access** - Government service

## Why CareerOneStop?

### The Problem with BLS API
❌ **BLS Public Data API does NOT serve OEWS data**
- BLS API only has time-series data (CES, JOLTS, CPS)
- OEWS published as static Excel files
- No programmatic access to occupation×area data

### The Solution: CareerOneStop
✅ **CareerOneStop exposes OEWS via REST API**
- Maintained by U.S. Department of Labor
- Real-time access to OEWS occupation data
- MSA-level and State-level endpoints
- Free with registration

## Getting API Credentials

### Step 1: Register for API Access

1. Visit: https://www.careeronestop.org/WebAPI/Home
2. Click "Register for API Access"
3. Fill out the registration form:
   - **Purpose**: Educational/Research
   - **Usage**: Labor market visualization
   - **Public/Free**: Yes (required)
4. Submit and wait for approval email (usually same day)

### Step 2: Get Your Credentials

After approval, you'll receive:
- **User ID**: Your unique identifier
- **Authorization Token**: API key

### Step 3: Add to Environment Variables

Update `.env.local`:
```bash
# CareerOneStop API (Live OEWS Data)
CAREERONESTOP_USER_ID=your_user_id_here
CAREERONESTOP_TOKEN=your_authorization_token_here
```

⚠️ **Important**: Keep these secret! They're server-side only.

## API Endpoints Used

### 1. Get Occupation Details (Salary & Employment)

**Endpoint Pattern:**
```
GET /v1/occupation/{userId}/{onet}/{location}
GET /v1/occupation/{userId}/{onet}/{location}/MSA
```

**Examples:**
```
# Florida statewide
GET /v1/occupation/{userId}/291141/FL

# Naples MSA
GET /v1/occupation/{userId}/291141/34940/MSA
```

**Parameters:**
- `userId`: Your CareerOneStop user ID
- `onet`: SOC code without hyphen (29-1141 → 291141)
- `location`: State code (FL) or MSA code (34940)

**Headers:**
```
Authorization: Bearer {your_token}
Accept: application/json
```

## Data Flow Architecture

```
User clicks county
    ↓
Map identifies MSA (via county-to-msa.json)
    ↓
Calls /api/careeronestop proxy
    ↓
Server fetches from CareerOneStop
    ↓
Returns live OEWS data
    ↓
Popup displays employment + wages
```

## County-to-MSA Mapping

### MSA Counties (40)
Counties in metropolitan areas get MSA-level data:
- **Naples MSA (34940)** → Collier County
- **Tampa MSA (45300)** → Hillsborough, Pinellas, Pasco, Hernando
- **Miami MSA (33100)** → Miami-Dade, Broward, Palm Beach

### Non-MSA Counties (27)
Rural counties fallback to Florida statewide data:
- Monroe (Key West) → STATE: FL
- Baker, Bradford, etc. → STATE: FL

## API Response Example

### Request
```bash
POST /api/careeronestop
Content-Type: application/json

{
  "soc": "29-1141",
  "areaType": "MSA",
  "areaCode": "34940"
}
```

### Response
```json
{
  "areaCode": "34940",
  "areaName": "Naples-Immokalee-Marco Island, FL",
  "soc": "29-1141",
  "socTitle": "Registered Nurses",
  "employment": 3200,
  "meanAnnual": 79500,
  "medianAnnual": 76800,
  "p10": 52000,
  "p25": 65000,
  "p75": 92000,
  "p90": 110000,
  "year": 2023,
  "source": "CareerOneStop"
}
```

## Compliance Requirements

Per CareerOneStop Terms of Service:

### ✅ Required
- Display CareerOneStop logo/attribution
- Application must be **public and free**
- No login required to view data
- Acknowledge U.S. Department of Labor

### ✅ Implemented
- Logo in top-right corner
- "Data provided by CareerOneStop"
- "Sponsored by U.S. DOL"
- Source attribution in popups

### ❌ Prohibited
- Charging for access to the data
- Hiding data behind paywalls
- Claiming data as your own

## Error Handling

### Scenario 1: MSA Data Unavailable
```
Request: Naples MSA, Welders (51-4121)
CareerOneStop: 404 (not enough data)
Fallback: Florida statewide for Welders
```

### Scenario 2: Occupation Not Found
```
Request: Obscure SOC code
Response: Show error message
Suggest: Select different occupation
```

### Scenario 3: API Down/Rate Limited
```
Show: "Data temporarily unavailable"
Log: Error details to console
Graceful: Map still functional, just no popup data
```

## Testing the Integration

### 1. Check API Configuration
```bash
curl http://localhost:3000/api/careeronestop

# Expected: { status: 'ok', configured: true }
```

### 2. Test with RNs in Naples MSA
Click Collier County (Naples area)
Expected:
- Loading spinner appears
- Live data fetched
- Employment: ~3,000-4,000
- Mean wage: $75,000-$85,000

### 3. Test State Fallback
Click Monroe County (Key West, non-MSA)
Expected:
- Falls back to Florida statewide
- Shows "(State fallback)" in popup

## Rate Limits

CareerOneStop rate limits (check your plan):
- **Free tier**: ~1,000 requests/day (typical)
- **Per-click**: 1 API call
- **Caching**: Consider adding to reduce calls

## Advantages Over Synthetic Data

| Aspect | Synthetic | CareerOneStop |
|--------|-----------|---------------|
| Data freshness | Static | Live (annual OEWS) |
| Accuracy | ~85-95% | 100% (BLS official) |
| Employment counts | Estimated | Actual |
| Wages | Range-based | OEWS precise |
| Updates | Manual regenerate | Automatic |
| Coverage | All counties | MSA + State |

## Limitations

### What CareerOneStop Provides
✅ MSA-level OEWS data  
✅ State-level OEWS data  
✅ Percentile wages  
✅ Annual employment  

### What It Doesn't Provide
❌ Direct county-level (not published by BLS)  
❌ Sub-MSA detail  
❌ Monthly/quarterly updates (OEWS is annual)  
❌ Projections (use separate endpoint/source)  

## Migration from Synthetic Data

### Removed
- ❌ `generate-comprehensive-data.ts`
- ❌ `fetch-florida-oews.ts`
- ❌ BLS time-series API attempts
- ❌ Static JSON with fake numbers

### Added
- ✅ CareerOneStop API proxy
- ✅ Live data fetching on click
- ✅ MSA-based requests
- ✅ State fallback for rural counties
- ✅ Proper attribution/compliance

## Documentation Updated

See also:
- `README.md` - Updated with CareerOneStop info
- `DATA_README.md` - Notes CareerOneStop as source
- `REAL_DATA_GUIDE.md` - Explains why BLS API doesn't work

## Troubleshooting

### "Data unavailable" popup
- Check `.env.local` has valid credentials
- Verify SOC code is common (try 29-1141 first)
- Check console for API error messages

### Slow popups
- CareerOneStop can take 1-2 seconds per request
- Loading spinner shows during fetch
- Consider caching responses

### Wrong data showing
- Verify MSA codes in `county-to-msa.json`
- Check areaType is correct (MSA vs STATE)
- Review CareerOneStop response structure

## Next Steps

1. ✅ Get CareerOneStop credentials
2. ✅ Add to `.env.local`
3. ✅ Restart dev server
4. ✅ Click counties to see live data!

**This is the proper, official way to access OEWS occupation data programmatically.** 🎯

