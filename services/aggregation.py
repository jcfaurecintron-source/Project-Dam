"""
Aggregation utilities for counting institutions by county and MSA.
"""
from __future__ import annotations
import typing as t
from collections import Counter


def count_by_county(recs: list[dict]) -> dict[str, int]:
    """
    Count institutions by county name.
    
    Args:
        recs: List of institution records with county_name field
        
    Returns:
        Dict mapping county names to institution counts
    """
    c = Counter()
    
    for r in recs:
        name = (r.get("county_name") or "").strip()
        if name:
            c[name] += 1
    
    return dict(c)


def count_by_fips(recs: list[dict]) -> dict[str, int]:
    """
    Count institutions by FIPS code.
    
    Args:
        recs: List of institution records with fips or fips_derived field
        
    Returns:
        Dict mapping FIPS codes to institution counts
    """
    c = Counter()
    
    for r in recs:
        # Try fips_derived first (from normalization), then fips
        fips = r.get("fips_derived") or r.get("fips")
        if fips:
            fips_str = str(fips).strip()
            if len(fips_str) == 5:  # County-level FIPS
                c[fips_str] += 1
    
    return dict(c)


def count_by_msa(
    recs: list[dict],
    fips_to_msa: dict[str, str]
) -> dict[str, int]:
    """
    Count institutions by MSA using FIPS-to-MSA mapping.
    
    Args:
        recs: List of institution records with FIPS codes
        fips_to_msa: Dict mapping FIPS codes to MSA names
        
    Returns:
        Dict mapping MSA names to institution counts
    """
    c = Counter()
    
    for r in recs:
        fips = r.get("fips_derived") or r.get("fips")
        if not fips:
            continue
        
        fips_str = str(fips).strip()
        if len(fips_str) != 5:
            continue
        
        msa = fips_to_msa.get(fips_str)
        if msa:
            c[msa] += 1
    
    return dict(c)


def aggregate_with_details(
    recs: list[dict],
    fips_to_msa: dict[str, str]
) -> dict:
    """
    Aggregate institutions with full details by county and MSA.
    
    Args:
        recs: List of institution records
        fips_to_msa: Dict mapping FIPS codes to MSA names
        
    Returns:
        Dict with county_counts, msa_counts, and total
    """
    return {
        "county_counts": count_by_fips(recs),
        "msa_counts": count_by_msa(recs, fips_to_msa),
        "total": len(recs),
        "year": recs[0].get("year") if recs else None
    }

