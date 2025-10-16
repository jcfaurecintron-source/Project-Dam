# BLS OEWS Data Guide for Florida Counties

## Problem Statement

County-level employment data from synthetic generation shows **undercounting** for mid-sized counties like Collier County (Naples area). For example:
- **Collier County RNs (29-1141)**: 80 employees (likely 10x too low)
- **Expected**: ~800-1,200 based on population and healthcare demand

## Root Cause

The synthetic data generator uses:
1. Base employment of 150 per occupation
2. County multipliers only defined for largest counties
3. Default 0.5x multiplier for unlisted counties → 75 employees

Collier County (population ~380k, wealthy retirees) needs healthcare staffing but gets default small-county treatment.

## BLS OEWS Data Structure

### Series ID Format

**Employment Series**: `OEUM[AREA][INDUSTRY][OCCUPATION]`
- `OEUM` = OEWS Metro/Micro Area
- `OEUS` = OEWS State
- `AREA` = 5-digit area code (MSA CBSA code or state FIPS)
- `INDUSTRY` = 6-digit NAICS code (`000000` = all industries)
- `OCCUPATION` = 7-digit SOC code (no hyphen)

**Wage Series**: `OEWM` prefix (mean wage), similar structure

### Examples

| Series ID | Description |
|-----------|-------------|
| `OEUS120000000000001141` | Florida statewide Registered Nurses employment |
| `OEUM332600000000001141` | Miami-Fort Lauderdale-West Palm Beach MSA RNs |
| `OEUM453000000000001141` | Tampa-St. Petersburg-Clearwater MSA RNs |
| `OEUM276000000000001141` | Fort Myers-Cape Coral MSA RNs |

## Data Availability Levels

### 1. **State Level** (Best Coverage)
- **Series**: `OEUS` prefix
- **Geography**: Entire state
- **Pros**: Complete data for all SOCs
- **Cons**: No county detail
- **Use case**: Fallback for missing county data

### 2. **MSA/Metro Level** (Most Common)
- **Series**: `OEUM` prefix  
- **Geography**: Metropolitan/Micropolitan Statistical Areas
- **Pros**: Good coverage for urban areas
- **Cons**: 
  - Not all counties in MSAs
  - Multi-county MSAs require allocation
  - Rural counties excluded

### 3. **County Level** (Rare)
- **Series**: Direct county series not generally published
- **Geography**: Individual counties
- **Status**: ❌ Not available in standard OEWS
- **Workaround**: Allocate from MSA using weights

## Florida MSA Coverage

### Major MSAs with Nursing Data

| CBSA Code | MSA Name | Counties Included | Typical RN Employment |
|-----------|----------|-------------------|----------------------|
| 33100 | Miami-Fort Lauderdale-Pompano Beach | Miami-Dade, Broward, Palm Beach | 60,000+ |
| 45300 | Tampa-St. Petersburg-Clearwater | Hillsborough, Pinellas, Pasco, Hernando | 35,000+ |
| 36740 | Orlando-Kissimmee-Sanford | Orange, Osceola, Lake, Seminole | 28,000+ |
| 27740 | Jacksonville | Duval, Clay, St. Johns, Nassau | 16,000+ |
| 27260 | Fort Myers-Cape Coral | Lee | 7,500+ |
| 35840 | North Port-Sarasota-Bradenton | Manatee, Sarasota | 8,500+ |

### Collier County Specific Issue

**Problem**: Collier County (Naples) is **not part of any MSA** in standard OEWS reporting.

**Options**:
1. **Use nearby MSA data** (Fort Myers-Cape Coral) as proxy
2. **State-level allocation** using population/healthcare ratios
3. **Synthetic but realistic** multipliers based on:
   - County population (~380k)
   - Median age (high retirees = high healthcare demand)
   - Hospital beds per capita
   - Physician employment ratios

## Recommended Solution

### Short Term: Improved Synthetic Data

Update `generate-comprehensive-data.ts` with better county multipliers:

```typescript
const COUNTY_MULTIPLIERS: Record<string, number> = {
  // Tier 1: Major metros
  '12086': 8.0,   // Miami-Dade
  '12011': 5.5,   // Broward
  '12099': 4.2,   // Palm Beach
  '12057': 3.8,   // Hillsborough
  '12095': 3.5,   // Orange
  
  // Tier 2: Mid-size metros
  '12103': 2.8,   // Pinellas
  '12031': 2.5,   // Duval
  '12071': 2.0,   // Lee
  '12021': 1.8,   // Collier ⭐ UPDATED
  '12105': 1.8,   // Polk
  '12115': 1.5,   // Sarasota
  '12081': 1.4,   // Manatee
  '12117': 1.4,   // Seminole
  
  // Tier 3: Smaller counties
  '12069': 1.2,   // Lake
  '12101': 1.2,   // Pasco
  '12127': 1.6,   // Volusia
  '12109': 1.1,   // St. Johns
  '12053': 0.9,   // Hernando
  
  // Default for rural: 0.4-0.5
};
```

### Medium Term: BLS API Integration

Use the `fetch-bls-oews.ts` script to:
1. Fetch real MSA-level employment for key occupations
2. Allocate to counties using:
   - Population weights
   - Healthcare establishment counts
   - Hospital bed ratios
3. Supplement with state-level data for non-MSA counties

```bash
npm run fetch:bls
```

### Long Term: Hybrid Approach

1. **Real data for MSA counties** from BLS API
2. **State-level proportional allocation** for rural counties
3. **Annual updates** via automated scripts
4. **Data validation** against state totals

## BLS API Constraints

### Rate Limits
- **Without API Key**: 25 queries/day, 10 years of data
- **With API Key**: 500 queries/day, 20 years of data
- **Series per query**: Max 50

### Data Lag
- Published annually in March/April
- Latest available: ~6-9 months behind

### Suppression Rules
- Small cell sizes (<3 establishments or dominance) suppressed
- Rural counties often suppressed
- Wage data more suppressed than employment

## Implementation Steps

### Step 1: Update County Multipliers (Immediate)

```bash
# Edit scripts/generate-comprehensive-data.ts
# Add Collier (12021) with 1.8x multiplier
npm run generate:sample
```

**Expected Collier County RN result**: 150 × 1.8 = 270 employees

### Step 2: Fetch Real BLS Data (Optional)

```bash
# Fetch MSA-level data from BLS
npm run fetch:bls

# Review data/intermediate/bls_real_data.json
# Merge with synthetic data
npm run merge:data
```

### Step 3: Validate Against State Totals

```bash
# Florida statewide RNs: ~198,000 (from BLS)
# Sum of all counties should be close
npm run validate:totals
```

## Data Quality Checklist

- [ ] Collier County RNs >200 (realistic minimum)
- [ ] Miami-Dade largest county by employment
- [ ] State totals within 10% of BLS official numbers
- [ ] No counties with zero employment for major occupations
- [ ] Wage data correlates with cost of living

## Resources

- [BLS OEWS Data](https://www.bls.gov/oes/)
- [BLS API Documentation](https://www.bls.gov/developers/api_signature_v2.htm)
- [OEWS Technical Notes](https://www.bls.gov/oes/current/oes_tec.htm)
- [Florida MSA Definitions](https://www.census.gov/programs-surveys/metro-micro/about/delineation-files.html)

