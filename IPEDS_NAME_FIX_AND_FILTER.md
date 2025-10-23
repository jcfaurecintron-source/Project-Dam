# IPEDS Data Fixes: MSA Name Mapping & Optional Filtering

## Issues Identified

### 1. ❌ MSA Name Mismatch
**Problem**: Miami MSA was showing 0 institutions because of name mismatch between OEWS and IPEDS data sources.

**Root Cause**:
- **OEWS uses**: `"Miami-Fort Lauderdale-West Palm Beach, FL"`
- **IPEDS uses**: `"Miami-Fort Lauderdale-Pompano Beach, FL"`

When the map component looked up institution counts using the OEWS MSA name, it couldn't find a match!

**Similar Issues Found**:
- Naples: OEWS = "Naples-Marco Island" vs IPEDS = "Naples-Immokalee-Marco Island"
- Sarasota: OEWS = "North Port-Bradenton-Sarasota" vs IPEDS = "North Port-Sarasota-Bradenton"
- Vero Beach: OEWS = "Sebastian-Vero Beach-West Vero Corridor" vs IPEDS = "Sebastian-Vero Beach"
- The Villages: OEWS = "Wildwood-The Villages" vs IPEDS = "The Villages"

### 2. 🔢 High Institution Counts (Including Trade Schools)
**Question**: Are the counts too high? What's included?

**Answer**: Yes, IPEDS includes **ALL postsecondary institutions**:
- ✅ Traditional 4-year universities (132 total in FL)
- ✅ Community & state colleges (2-year) (83 total in FL)
- ✅ Technical colleges (less than 2-year) (22 public in FL)
- ✅ **Trade/vocational schools** (127 total in FL)
- ✅ **Beauty schools, aviation schools, career colleges**, etc.

**Breakdown for Miami-Dade County (72 institutions):**
- 2 public 4-year (FIU, etc.)
- 12 private nonprofit 4-year (Barry University, etc.)
- 9 private for-profit 4-year
- 4 public 2-year (Miami Dade College)
- 1 private nonprofit 2-year
- 15 private for-profit 2-year (career colleges)
- 3 public less-than-2-year (technical schools)
- **24 private for-profit less-than-2-year (beauty schools, trade schools)**

---

## Solutions Implemented

### ✅ Solution 1: MSA Name Mapping

**Created**: `florida-counties/src/lib/msa-name-mapping.ts`

Maps OEWS MSA names → IPEDS MSA names for seamless lookup:

```typescript
export const MSA_NAME_MAPPING: Record<string, string> = {
  'Miami-Fort Lauderdale-West Palm Beach, FL': 'Miami-Fort Lauderdale-Pompano Beach, FL',
  'Naples-Marco Island, FL': 'Naples-Immokalee-Marco Island, FL',
  'North Port-Bradenton-Sarasota, FL': 'North Port-Sarasota-Bradenton, FL',
  'Sebastian-Vero Beach-West Vero Corridor, FL': 'Sebastian-Vero Beach, FL',
  'Wildwood-The Villages, FL': 'The Villages, FL',
  // ... other MSAs ...
};
```

**Updated**: `MapLive.tsx` to use the mapping:
```typescript
const ipedsMsaName = mapOewsToIpedsMsaName(record.msa_name);
const institutionCount = institutionsDataRef.current[ipedsMsaName] ?? null;
```

**Result**: ✅ Miami now correctly shows 133 institutions!

---

### ✅ Solution 2: Filtered Version (Colleges Only)

**Created**: `bin/ipeds_dump_filtered.py` - Excludes less-than-2-year trade/beauty schools

**Filtering Logic**:
```python
# EXCLUDES (127 institutions):
- Sector 9: Private for-profit, less than 2-year (beauty schools, trade schools)
- Sector 8: Private nonprofit, less than 2-year
- Sector 7: Public, less than 2-year (some technical schools)

# INCLUDES (229 institutions):
- All 4-year universities (sectors 1, 2, 3)
- All 2-year colleges (sectors 4, 5, 6) - community/state colleges
```

**Generated**: `florida-counties/public/data/institutions_fl_filtered.json`

---

## Data Comparison

### Total Counts
| Dataset | Institutions | Description |
|---------|-------------|-------------|
| **All Institutions** | **356** | Everything including trade schools |
| **Filtered (Colleges Only)** | **229** | Traditional colleges/universities only |
| **Excluded** | **127** | Trade schools, beauty schools, vocational |

### MSA Comparison (Top 10)

| MSA | All | Filtered | Excluded |
|-----|-----|----------|----------|
| Miami-Fort Lauderdale-Pompano Beach, FL | **133** | **87** | 46 |
| Tampa-St. Petersburg-Clearwater, FL | **46** | **35** | 11 |
| Orlando-Kissimmee-Sanford, FL | **42** | **29** | 13 |
| Jacksonville, FL | **25** | **17** | 8 |
| Cape Coral-Fort Myers, FL | **14** | **10** | 4 |
| Lakeland-Winter Haven, FL | **12** | **8** | 4 |
| Deltona-Daytona Beach-Ormond Beach, FL | **10** | **9** | 1 |
| North Port-Sarasota-Bradenton, FL | **10** | **7** | 3 |
| Gainesville, FL | **9** | **6** | 3 |
| Tallahassee, FL | **8** | **7** | 1 |
| Pensacola-Ferry Pass-Brent, FL | **8** | **6** | 2 |

---

## Which Version Should You Use?

### Option A: **All Institutions** (`institutions_fl.json`)
**Use when**:
- Want complete picture of postsecondary education capacity
- Tracking ALL training pathways (including vocational/technical)
- Workforce planning needs to include trade schools

**Pros**: Complete, comprehensive
**Cons**: Numbers look inflated due to beauty schools, etc.

### Option B: **Filtered (Colleges Only)** (`institutions_fl_filtered.json`)
**Use when**:
- Want to show traditional colleges/universities only
- More intuitive numbers for general audience
- Focus on 2-year and 4-year degree programs

**Pros**: Cleaner numbers, more recognizable institutions
**Cons**: Excludes legitimate technical training options

---

## How to Switch Data Sources

### To Use Filtered Version (Colleges Only):

Update `MapLive.tsx` line ~117:
```typescript
// Change from:
const institutionsResponse = await fetch('/data/institutions_fl.json');

// To:
const institutionsResponse = await fetch('/data/institutions_fl_filtered.json');
```

### To Update Filtered Data:
```bash
cd /Users/juanquifaure/Desktop/Project-Dam
./bin/ipeds_dump_filtered.py --year 2020 --by full \
  --out florida-counties/public/data/institutions_fl_filtered.json --pretty
```

---

## Files Created/Modified

### New Files:
1. ✅ `/florida-counties/src/lib/msa-name-mapping.ts` - MSA name translation
2. ✅ `/bin/ipeds_dump_filtered.py` - Filtered data generator
3. ✅ `/florida-counties/public/data/institutions_fl_filtered.json` - Filtered dataset

### Modified Files:
1. ✅ `/florida-counties/components/MapLive.tsx` - Added name mapping import and usage

---

## Testing Checklist

✅ Miami MSA now shows institution count (was 0, now 133 or 87 filtered)  
✅ All MSA names correctly mapped  
✅ Filtered version excludes beauty schools and trade schools  
✅ No linter errors  
✅ Both data files generated and working  

---

## Recommendation

**For your use case**, I recommend using the **filtered version** because:
1. ✅ **More intuitive numbers** - "87 colleges" vs "133 institutions"
2. ✅ **Better match for workforce planning** - Community colleges and universities directly align with healthcare/technical jobs
3. ✅ **Cleaner UX** - Users understand "colleges" better than "all postsecondary institutions"
4. ✅ **Still comprehensive** - Includes all 4-year universities, state colleges, and community colleges

To switch, just change the data file path from `institutions_fl.json` → `institutions_fl_filtered.json` in the MapLive component.

---

## Summary

**Problem**: Miami showed 0 institutions due to MSA name mismatch  
**Solution 1**: Created MSA name mapping → ✅ Fixed  
**Problem**: High counts including beauty schools  
**Solution 2**: Created filtered version → ✅ Now have both options  

**Current Status**: Both issues resolved! Map now correctly shows institution counts for all MSAs including Miami. You can choose between showing all 356 institutions or filtered 229 traditional colleges.

