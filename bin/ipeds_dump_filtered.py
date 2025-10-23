#!/usr/bin/env python3
"""
CLI tool for dumping IPEDS institution counts by county or MSA.
FILTERED VERSION: Excludes trade schools, beauty schools, and very small private for-profit institutions.
"""
from __future__ import annotations
import sys
import os
import json
import argparse

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.ipeds_client import IPEDSClient
from services.normalization import enrich_with_fips, build_fips_to_msa_map
from services.aggregation import count_by_fips, count_by_msa


def filter_institutions(records: list[dict]) -> list[dict]:
    """
    Filter institutions to include only traditional colleges/universities.
    
    Excludes:
    - Sector 9: Private for-profit, less than 2-year (beauty schools, trade schools)
    - Sector 8: Private nonprofit, less than 2-year
    - Sector 7: Public, less than 2-year (some technical schools)
    
    Includes:
    - All 4-year institutions (sectors 1, 2, 3)
    - All 2-year institutions (sectors 4, 5, 6) - community/state colleges
    """
    filtered = []
    excluded_sectors = {7, 8, 9}  # Less-than-2-year institutions
    
    for record in records:
        sector = record.get('sector')
        if sector not in excluded_sectors:
            filtered.append(record)
    
    return filtered


def main():
    parser = argparse.ArgumentParser(
        description="Dump IPEDS institution counts (filtered to exclude trade schools)"
    )
    parser.add_argument(
        "--year",
        type=int,
        default=2020,
        help="Data year (default: 2020)"
    )
    parser.add_argument(
        "--by",
        choices=["county", "msa", "full"],
        default="msa",
        help="Aggregation level (default: msa)"
    )
    parser.add_argument(
        "--out",
        type=str,
        default=None,
        help="Output file path (default: stdout)"
    )
    parser.add_argument(
        "--cache-dir",
        type=str,
        default="data",
        help="Cache directory (default: data)"
    )
    parser.add_argument(
        "--mapping",
        type=str,
        default=None,
        help="Path to county-to-msa.json (default: auto-detect)"
    )
    parser.add_argument(
        "--pretty",
        action="store_true",
        help="Pretty-print JSON output"
    )
    
    args = parser.parse_args()
    
    try:
        # Load MSA mapping
        if args.mapping:
            mapping_path = args.mapping
        else:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            mapping_path = os.path.join(
                base_dir,
                "florida-counties",
                "public",
                "data",
                "county-to-msa.json"
            )
        
        with open(mapping_path, "r") as f:
            mapping_data = json.load(f)
        fips_to_msa = build_fips_to_msa_map(mapping_data)
        
        # Fetch institutions
        client = IPEDSClient(cache_dir=args.cache_dir)
        recs = client.fetch_institutions(year=args.year, use_cache=True)
        
        # Filter out trade schools
        original_count = len(recs)
        recs = filter_institutions(recs)
        filtered_count = len(recs)
        print(f"Filtered: {original_count} → {filtered_count} institutions (excluded {original_count - filtered_count} trade/beauty schools)", file=sys.stderr)
        
        # Enrich with FIPS
        recs = enrich_with_fips(recs)
        
        # Aggregate
        if args.by == "county":
            data = count_by_fips(recs)
        elif args.by == "msa":
            data = count_by_msa(recs, fips_to_msa)
        else:  # full
            data = {
                "county_counts": count_by_fips(recs),
                "msa_counts": count_by_msa(recs, fips_to_msa),
                "total": len(recs),
                "year": args.year,
                "note": "Filtered to exclude less-than-2-year trade/beauty schools"
            }
        
        # Format output
        indent = 2 if args.pretty else None
        output = json.dumps(data, indent=indent, sort_keys=True)
        
        # Write to file or stdout
        if args.out:
            with open(args.out, "w") as f:
                f.write(output)
            print(f"✓ Wrote {len(data)} entries to {args.out}", file=sys.stderr)
        else:
            print(output)
        
        return 0
        
    except Exception as e:
        print(f"✗ Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())

