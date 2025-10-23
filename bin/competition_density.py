#!/usr/bin/env python3
"""
CLI tool for computing MSA competition density (institutions per capita).
"""
from __future__ import annotations
import sys
import os
import json
import argparse

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.competition_density import (
    fetch_msa_population,
    compute_competition_density,
    validate_results,
    load_msa_code_mapping
)


def main():
    parser = argparse.ArgumentParser(
        description="Compute MSA competition density (institutions per capita)"
    )
    parser.add_argument(
        "--institutions",
        type=str,
        default=None,
        help="Path to institutions JSON file (default: auto-detect)"
    )
    parser.add_argument(
        "--mapping",
        type=str,
        default=None,
        help="Path to county-to-msa.json (default: auto-detect)"
    )
    parser.add_argument(
        "--out",
        type=str,
        required=True,
        help="Output file path for density JSON"
    )
    parser.add_argument(
        "--pretty",
        action="store_true",
        help="Pretty-print JSON output"
    )
    parser.add_argument(
        "--state",
        type=str,
        default="12",
        help="State FIPS code (default: 12 for Florida)"
    )
    
    args = parser.parse_args()
    
    try:
        # Determine paths
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        
        if args.institutions:
            institutions_path = args.institutions
        else:
            institutions_path = os.path.join(
                base_dir,
                "florida-counties",
                "public",
                "data",
                "institutions_fl.json"
            )
        
        if args.mapping:
            mapping_path = args.mapping
        else:
            mapping_path = os.path.join(
                base_dir,
                "florida-counties",
                "public",
                "data",
                "county-to-msa.json"
            )
        
        print("=" * 80)
        print("MSA COMPETITION DENSITY CALCULATOR")
        print("=" * 80)
        
        # Load institution counts
        print(f"\n📊 Loading institution counts from {institutions_path}")
        with open(institutions_path, "r") as f:
            inst_data = json.load(f)
        
        institution_counts = inst_data.get("msa_counts", {})
        print(f"✅ Loaded institution counts for {len(institution_counts)} MSAs")
        
        # Load MSA code mapping
        print(f"\n🗺️  Loading MSA mapping from {mapping_path}")
        msa_code_mapping = load_msa_code_mapping(mapping_path)
        print(f"✅ Loaded MSA codes for {len(msa_code_mapping)} MSAs")
        
        # Fetch population data
        print(f"\n👥 Fetching population data from Census ACS API (state={args.state})")
        msa_population = fetch_msa_population(state=args.state)
        
        # Compute density
        print(f"\n🧮 Computing competition density...")
        results = compute_competition_density(
            institution_counts,
            msa_population,
            msa_code_mapping
        )
        
        # Validate
        validate_results(results)
        
        # Prepare output with metadata
        output = {
            "metadata": {
                "source": "Census ACS 5-Year (2022) + IPEDS (2020)",
                "generated": "2025-10-22",
                "metric": "institutions_per_100k",
                "description": "Higher education institutions per 100,000 population",
                "total_msas": len(results),
                "total_institutions": sum(r["institution_count"] for r in results),
                "total_population": sum(r["population"] for r in results)
            },
            "msas": results
        }
        
        # Write output
        indent = 2 if args.pretty else None
        with open(args.out, "w") as f:
            json.dump(output, f, indent=indent)
        
        print(f"✅ Wrote competition density data to {args.out}")
        
        # Display top 5
        print("\n" + "=" * 80)
        print("TOP 5 MSAs BY COMPETITION DENSITY")
        print("=" * 80)
        print(f"{'Rank':<6} {'MSA':<45} {'Institutions':>13} {'Per 100k':>10}")
        print("-" * 80)
        
        for i, record in enumerate(results[:5], 1):
            print(f"{i:<6} {record['msa_name']:<45} {record['institution_count']:>13} {record['institutions_per_100k']:>10.2f}")
        
        print("\n" + "=" * 80)
        print("BOTTOM 5 MSAs BY COMPETITION DENSITY")
        print("=" * 80)
        print(f"{'Rank':<6} {'MSA':<45} {'Institutions':>13} {'Per 100k':>10}")
        print("-" * 80)
        
        for i, record in enumerate(results[-5:], len(results) - 4):
            print(f"{i:<6} {record['msa_name']:<45} {record['institution_count']:>13} {record['institutions_per_100k']:>10.2f}")
        
        print("\n" + "=" * 80)
        return 0
        
    except Exception as e:
        print(f"\n✗ Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())

