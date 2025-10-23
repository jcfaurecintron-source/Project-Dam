"""
Competition Density Service
Computes institutions per capita for Florida MSAs using Census ACS population data.
"""
from __future__ import annotations
import requests
import json
from typing import Dict, List

ACS_BASE = "https://api.census.gov/data/2022/acs/acs5"
POP_FIELD = "B01003_001E"  # Total Population

# MSA Code Translation: Our codes → Census codes
# Some MSA codes changed between BLS and Census datasets
MSA_CODE_TRANSLATION = {
    "30460": "26140",  # Homosassa Springs
    "27740": "27260",  # Jacksonville
    "37300": "36100",  # Ocala
    "48680": "45540",  # The Villages (updated to match BLS OEWS code)
}


def fetch_msa_population(state: str = "12") -> Dict[str, Dict]:
    """
    Fetch MSA population data from Census ACS API.
    
    Args:
        state: State FIPS code (default: "12" for Florida)
        
    Returns:
        Dict mapping MSA code to population info
    """
    # Fetch MSA population - Census API uses "metropolitan statistical area/micropolitan statistical area" as geography
    url = f"{ACS_BASE}?get=NAME,{POP_FIELD}&for=metropolitan%20statistical%20area/micropolitan%20statistical%20area:*"
    
    print(f"Fetching MSA population data from Census ACS...")
    r = requests.get(url, timeout=60)
    r.raise_for_status()
    
    data = r.json()
    headers = data[0]
    rows = data[1:]
    
    # Parse into dictionary - filter for Florida MSAs only
    msa_pop = {}
    florida_count = 0
    for row in rows:
        record = dict(zip(headers, row))
        msa_code = record.get("metropolitan statistical area/micropolitan statistical area")
        name = record.get("NAME", "")
        pop = int(record.get(POP_FIELD, 0))
        
        # Filter for Florida MSAs (name contains ", FL")
        if msa_code and pop > 0 and ", FL" in name:
            msa_pop[msa_code] = {
                "msa_code": msa_code,
                "census_name": name,
                "population": pop
            }
            florida_count += 1
    
    print(f"✅ Fetched population for {florida_count} Florida MSAs (from {len(rows)} total)")
    return msa_pop


def compute_competition_density(
    institution_counts: Dict[str, int],
    msa_population: Dict[str, Dict],
    msa_code_mapping: Dict[str, str]
) -> List[Dict]:
    """
    Compute competition density (institutions per capita) for MSAs.
    
    Args:
        institution_counts: Dict mapping MSA name to institution count
        msa_population: Dict mapping MSA code to population info
        msa_code_mapping: Dict mapping MSA name to MSA code
        
    Returns:
        List of dicts with density metrics per MSA
    """
    results = []
    
    for msa_name, inst_count in institution_counts.items():
        # Get MSA code from mapping
        msa_code = msa_code_mapping.get(msa_name)
        if not msa_code:
            print(f"⚠️  Warning: No MSA code found for {msa_name}")
            continue
        
        # Translate MSA code if needed (BLS → Census code mapping)
        census_msa_code = MSA_CODE_TRANSLATION.get(msa_code, msa_code)
        
        # Get population
        pop_data = msa_population.get(census_msa_code)
        if not pop_data:
            print(f"⚠️  Warning: No population data for {msa_name} (BLS code: {msa_code}, Census code: {census_msa_code})")
            continue
        
        population = pop_data["population"]
        
        # Compute density metrics
        competition_density = inst_count / population if population > 0 else 0
        institutions_per_100k = competition_density * 100000
        
        results.append({
            "msa_code": msa_code,
            "msa_name": msa_name,
            "census_name": pop_data["census_name"],
            "institution_count": inst_count,
            "population": population,
            "competition_density": competition_density,
            "institutions_per_100k": round(institutions_per_100k, 2)
        })
    
    # Sort by density (highest first)
    results.sort(key=lambda x: x["institutions_per_100k"], reverse=True)
    
    return results


def validate_results(results: List[Dict]) -> None:
    """
    Validate competition density results.
    
    Args:
        results: List of density records
    """
    print("\n=== Validation ===")
    
    # Check for zero populations
    zero_pop = [r for r in results if r["population"] == 0]
    if zero_pop:
        print(f"⚠️  {len(zero_pop)} MSAs have zero population")
    else:
        print("✅ All MSAs have nonzero population")
    
    # Check total population
    total_pop = sum(r["population"] for r in results)
    print(f"✅ Total MSA population: {total_pop:,}")
    
    # Florida population is ~22 million (2022 ACS estimate)
    # MSA population should be ~20-21 million (most of state)
    if 18_000_000 <= total_pop <= 23_000_000:
        print(f"✅ Total population in expected range for Florida MSAs")
    else:
        print(f"⚠️  Total population ({total_pop:,}) outside expected range")
    
    # Check density range
    densities = [r["institutions_per_100k"] for r in results]
    print(f"✅ Density range: {min(densities):.2f} - {max(densities):.2f} per 100k")
    
    print(f"✅ Successfully computed density for {len(results)} MSAs\n")


def load_msa_code_mapping(mapping_path: str) -> Dict[str, str]:
    """
    Load MSA name to code mapping from county-to-msa.json.
    
    Args:
        mapping_path: Path to county-to-msa.json
        
    Returns:
        Dict mapping MSA name to MSA code
    """
    with open(mapping_path, "r") as f:
        data = json.load(f)
    
    # Extract unique MSA name -> code mappings
    msa_codes = {}
    for county_data in data["countyToMsa"].values():
        msa_name = county_data["msaName"]
        msa_code = county_data["msaCode"]
        msa_codes[msa_name] = msa_code
    
    return msa_codes

