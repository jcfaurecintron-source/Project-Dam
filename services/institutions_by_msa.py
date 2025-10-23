"""
Main integration module for fetching and aggregating institution counts.
Provides typed accessors for county and MSA level data.
"""
from __future__ import annotations
import json
import os
import typing as t
from services.ipeds_client import IPEDSClient
from services.aggregation import count_by_fips, count_by_msa, aggregate_with_details
from services.normalization import enrich_with_fips, build_fips_to_msa_map
from services.year_resolver import resolve_latest_year


def load_msa_mapping(mapping_path: str | None = None) -> dict[str, str]:
    """
    Load FIPS-to-MSA mapping from county-to-msa.json.
    
    Args:
        mapping_path: Optional path to county-to-msa.json
        
    Returns:
        Dict mapping FIPS codes to MSA names
    """
    if mapping_path is None:
        # Default to florida-counties/public/data/county-to-msa.json
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        mapping_path = os.path.join(
            base_dir,
            "florida-counties",
            "public",
            "data",
            "county-to-msa.json"
        )
    
    with open(mapping_path, "r") as f:
        data = json.load(f)
    
    return build_fips_to_msa_map(data)


def get_institution_counts_by_county(
    year: int | None = None,
    cache_dir: str = "data"
) -> dict[str, int]:
    """
    Get institution counts aggregated by county (FIPS code).
    
    Args:
        year: Data year (if None, resolves latest available)
        cache_dir: Directory for caching
        
    Returns:
        Dict mapping FIPS codes to institution counts
    """
    if year is None:
        year = resolve_latest_year(2024, cache_dir=cache_dir)
    
    client = IPEDSClient(cache_dir=cache_dir)
    recs = client.fetch_institutions(year=year, use_cache=True)
    
    # Enrich with FIPS codes if not present
    recs = enrich_with_fips(recs)
    
    return count_by_fips(recs)


def get_institution_counts_by_msa(
    year: int | None = None,
    cache_dir: str = "data",
    mapping_path: str | None = None
) -> dict[str, int]:
    """
    Get institution counts aggregated by MSA.
    
    Args:
        year: Data year (if None, resolves latest available)
        cache_dir: Directory for caching
        mapping_path: Optional path to county-to-msa.json
        
    Returns:
        Dict mapping MSA names to institution counts
    """
    if year is None:
        year = resolve_latest_year(2024, cache_dir=cache_dir)
    
    fips_to_msa = load_msa_mapping(mapping_path)
    
    client = IPEDSClient(cache_dir=cache_dir)
    recs = client.fetch_institutions(year=year, use_cache=True)
    
    # Enrich with FIPS codes if not present
    recs = enrich_with_fips(recs)
    
    return count_by_msa(recs, fips_to_msa)


def get_full_aggregation(
    year: int | None = None,
    cache_dir: str = "data",
    mapping_path: str | None = None
) -> dict:
    """
    Get full aggregation with county and MSA counts.
    
    Args:
        year: Data year (if None, resolves latest available)
        cache_dir: Directory for caching
        mapping_path: Optional path to county-to-msa.json
        
    Returns:
        Dict with county_counts, msa_counts, total, and year
    """
    if year is None:
        year = resolve_latest_year(2024, cache_dir=cache_dir)
    
    fips_to_msa = load_msa_mapping(mapping_path)
    
    client = IPEDSClient(cache_dir=cache_dir)
    recs = client.fetch_institutions(year=year, use_cache=True)
    
    # Enrich with FIPS codes if not present
    recs = enrich_with_fips(recs)
    
    return aggregate_with_details(recs, fips_to_msa)

