"""
Normalization utilities for county names and FIPS codes.
Ensures consistency between IPEDS data and MSA mapping.
"""
from __future__ import annotations
import re
import typing as t

# Florida county FIPS to name mapping (without " County" suffix)
FIPS_TO_COUNTY: dict[str, str] = {
    "12001": "Alachua",
    "12003": "Baker",
    "12005": "Bay",
    "12007": "Bradford",
    "12009": "Brevard",
    "12011": "Broward",
    "12013": "Calhoun",
    "12015": "Charlotte",
    "12017": "Citrus",
    "12019": "Clay",
    "12021": "Collier",
    "12023": "Columbia",
    "12027": "DeSoto",
    "12029": "Dixie",
    "12031": "Duval",
    "12033": "Escambia",
    "12035": "Flagler",
    "12037": "Franklin",
    "12039": "Gadsden",
    "12041": "Gilchrist",
    "12043": "Glades",
    "12045": "Gulf",
    "12047": "Hamilton",
    "12049": "Hardee",
    "12051": "Hendry",
    "12053": "Hernando",
    "12055": "Highlands",
    "12057": "Hillsborough",
    "12059": "Holmes",
    "12061": "Indian River",
    "12063": "Jackson",
    "12065": "Jefferson",
    "12067": "Lafayette",
    "12069": "Lake",
    "12071": "Lee",
    "12073": "Leon",
    "12075": "Levy",
    "12077": "Liberty",
    "12079": "Madison",
    "12081": "Manatee",
    "12083": "Marion",
    "12085": "Martin",
    "12086": "Miami-Dade",
    "12087": "Monroe",
    "12089": "Nassau",
    "12091": "Okaloosa",
    "12093": "Okeechobee",
    "12095": "Orange",
    "12097": "Osceola",
    "12099": "Palm Beach",
    "12101": "Pasco",
    "12103": "Pinellas",
    "12105": "Polk",
    "12107": "Putnam",
    "12109": "St. Johns",
    "12111": "St. Lucie",
    "12113": "Santa Rosa",
    "12115": "Sarasota",
    "12117": "Seminole",
    "12119": "Sumter",
    "12121": "Suwannee",
    "12123": "Taylor",
    "12125": "Union",
    "12127": "Volusia",
    "12129": "Wakulla",
    "12131": "Walton",
    "12133": "Washington",
}

# Reverse mapping
COUNTY_TO_FIPS: dict[str, str] = {v: k for k, v in FIPS_TO_COUNTY.items()}


def normalize_county_name(name: str) -> str:
    """
    Normalize county name to match FIPS mapping format.
    
    Args:
        name: Raw county name (e.g., "Miami-Dade County", "BROWARD", "St. Lucie")
        
    Returns:
        Normalized county name (e.g., "Miami-Dade", "Broward", "St. Lucie")
    """
    if not name:
        return ""
    
    # Strip whitespace and convert to title case
    name = name.strip()
    
    # Remove " County" suffix (case-insensitive)
    name = re.sub(r'\s+County$', '', name, flags=re.IGNORECASE)
    
    # Handle special cases
    name_lower = name.lower()
    
    # Saint -> St.
    if name_lower.startswith("saint "):
        name = "St. " + name[6:]
    
    # Title case with special handling for hyphens and "Mc"/"Mac"
    parts = name.split()
    normalized_parts = []
    
    for part in parts:
        if "-" in part:
            # Handle hyphenated names like "Miami-Dade"
            subparts = part.split("-")
            normalized_subparts = [sp.capitalize() for sp in subparts]
            normalized_parts.append("-".join(normalized_subparts))
        elif part.lower().startswith("mc") and len(part) > 2:
            # Handle "McDonald" style names
            normalized_parts.append("Mc" + part[2:].capitalize())
        else:
            normalized_parts.append(part.capitalize())
    
    return " ".join(normalized_parts)


def county_fips_to_name(fips: str) -> str | None:
    """
    Convert FIPS code to county name.
    
    Args:
        fips: 5-digit FIPS code (e.g., "12001")
        
    Returns:
        County name or None if not found
    """
    return FIPS_TO_COUNTY.get(fips)


def county_name_to_fips(name: str) -> str | None:
    """
    Convert county name to FIPS code.
    
    Args:
        name: County name (will be normalized)
        
    Returns:
        5-digit FIPS code or None if not found
    """
    normalized = normalize_county_name(name)
    return COUNTY_TO_FIPS.get(normalized)


def build_fips_to_msa_map(
    county_to_msa_json: dict
) -> dict[str, str]:
    """
    Build FIPS to MSA name mapping from county-to-msa JSON.
    
    Args:
        county_to_msa_json: Loaded JSON from county-to-msa.json
        
    Returns:
        Dict mapping FIPS codes to MSA names
    """
    mapping = {}
    county_msa = county_to_msa_json.get("countyToMsa", {})
    
    for fips, msa_info in county_msa.items():
        if isinstance(msa_info, dict):
            mapping[fips] = msa_info.get("msaName", "")
    
    return mapping


def enrich_with_fips(records: list[dict]) -> list[dict]:
    """
    Add FIPS codes to IPEDS records based on county name or county_fips field.
    Modifies records in place and returns them.
    
    Args:
        records: List of IPEDS institution records
        
    Returns:
        Same list with fips_derived field added
    """
    for record in records:
        # Try multiple FIPS fields in priority order
        county_fips = record.get("county_fips")
        fips_field = record.get("fips")
        county_name = record.get("county_name", "")
        
        # Priority 1: county_fips from API (most reliable)
        if county_fips:
            fips_str = str(county_fips)
            if len(fips_str) == 5:
                record["fips_derived"] = fips_str
                continue
        
        # Priority 2: fips field from API
        if fips_field:
            fips_str = str(fips_field)
            if len(fips_str) == 5:
                record["fips_derived"] = fips_str
                continue
        
        # Priority 3: Derive from county name
        if county_name:
            fips = county_name_to_fips(county_name)
            if fips:
                record["fips_derived"] = fips
    
    return records

