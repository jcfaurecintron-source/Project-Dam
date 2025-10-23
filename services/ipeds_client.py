"""
IPEDS Client for Urban Institute Education Data API
Fetches institution data without requiring API keys.
"""
from __future__ import annotations
import time
import json
import os
import typing as t
import requests

BASE_URL = "https://educationdata.urban.org/api/v1/college-university/ipeds/directory/"
DEFAULT_FIELDS = "unitid,inst_name,county_name,county_fips,city,zip,sector,inst_control,latitude,longitude"


class IPEDSClient:
    """Client for fetching IPEDS institution data from Urban Institute API."""
    
    def __init__(
        self,
        session: t.Optional[requests.Session] = None,
        cache_dir: str = "data"
    ):
        """
        Initialize IPEDS client.
        
        Args:
            session: Optional requests session for connection pooling
            cache_dir: Directory for caching API responses
        """
        self.s = session or requests.Session()
        self.s.headers.update({
            'User-Agent': 'Florida-MSA-Analytics/1.0'
        })
        self.cache_dir = cache_dir
        os.makedirs(cache_dir, exist_ok=True)

    def fetch_institutions(
        self,
        year: int,
        state_fips: str = "12",  # Florida FIPS code
        use_cache: bool = True
    ) -> list[dict]:
        """
        Fetch all institutions for a given year and state.
        
        Args:
            year: Data year (e.g., 2022)
            state_fips: State FIPS code (default: "12" for Florida)
            use_cache: Whether to use cached data if available
            
        Returns:
            List of institution records
        """
        cache_path = os.path.join(
            self.cache_dir,
            f"ipeds_institutions_FL_{year}.json"
        )
        
        if use_cache and os.path.exists(cache_path):
            with open(cache_path, "r") as f:
                return json.load(f)

        # Build URL with year in path
        url = f"{BASE_URL}{year}/"
        params = {
            "fips": state_fips,
            "per_page": 500
        }
        
        out: list[dict] = []
        page = 1
        
        while url:
            print(f"Fetching page {page} for year {year}...")
            resp = self._get(url, params=params if page == 1 else None)
            data = resp.json()
            
            results = data.get("results", [])
            out.extend(results)
            
            url = data.get("next")
            page += 1
            
            # Small delay to be respectful to the API
            if url:
                time.sleep(0.1)
        
        print(f"Fetched {len(out)} institutions for year {year}")
        
        if use_cache and out:
            with open(cache_path, "w") as f:
                json.dump(out, f, indent=2)
        
        return out

    def _get(
        self,
        url: str,
        params: dict | None = None,
        max_retries: int = 6
    ) -> requests.Response:
        """
        Make GET request with retry logic.
        
        Args:
            url: URL to fetch
            params: Query parameters
            max_retries: Maximum number of retry attempts
            
        Returns:
            Response object
            
        Raises:
            requests.HTTPError: If request fails after all retries
        """
        for attempt in range(max_retries):
            try:
                r = self.s.get(url, params=params, timeout=30)
                
                if r.status_code in (429, 500, 502, 503, 504):
                    retry_after = r.headers.get("Retry-After")
                    sleep_s = int(retry_after) if retry_after else (2 ** attempt)
                    print(f"Rate limited or server error, retrying in {sleep_s}s...")
                    time.sleep(sleep_s)
                    continue
                
                r.raise_for_status()
                return r
                
            except requests.exceptions.RequestException as e:
                if attempt == max_retries - 1:
                    raise
                print(f"Request failed: {e}, retrying...")
                time.sleep(2 ** attempt)
        
        r.raise_for_status()
        return r

