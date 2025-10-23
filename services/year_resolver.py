"""
Year resolution utilities for finding the latest available IPEDS data.
"""
from __future__ import annotations
import os
from services.ipeds_client import IPEDSClient


def resolve_latest_year(
    start_year: int,
    backfill: int = 5,
    cache_dir: str = "data"
) -> int:
    """
    Find the latest year with available IPEDS data.
    
    Tries start_year first, then walks backward up to backfill years
    until finding non-empty results.
    
    Args:
        start_year: Year to start checking (e.g., 2024)
        backfill: Maximum number of years to check backward
        cache_dir: Directory for caching results
        
    Returns:
        Latest available year with data
    """
    # Check for cached latest year
    cache_path = os.path.join(cache_dir, "ipeds_latest_year.txt")
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r") as f:
                cached_year = int(f.read().strip())
                # Validate cached year is reasonable
                if start_year - backfill <= cached_year <= start_year:
                    print(f"Using cached latest year: {cached_year}")
                    return cached_year
        except (ValueError, IOError):
            pass
    
    client = IPEDSClient(cache_dir=cache_dir)
    yr = start_year
    
    for i in range(backfill + 1):
        print(f"Checking year {yr} for data availability...")
        try:
            results = client.fetch_institutions(year=yr, use_cache=True)
            if results:
                print(f"Found {len(results)} institutions for year {yr}")
                # Cache the result
                with open(cache_path, "w") as f:
                    f.write(str(yr))
                return yr
        except Exception as e:
            print(f"Year {yr} not available: {e}")
        
        yr -= 1
    
    # Fallback to start year even if empty
    print(f"No data found, falling back to {start_year}")
    return start_year


def get_cached_latest_year(cache_dir: str = "data") -> int | None:
    """
    Get cached latest year without API calls.
    
    Args:
        cache_dir: Directory containing cache
        
    Returns:
        Cached year or None
    """
    cache_path = os.path.join(cache_dir, "ipeds_latest_year.txt")
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r") as f:
                return int(f.read().strip())
        except (ValueError, IOError):
            pass
    return None

