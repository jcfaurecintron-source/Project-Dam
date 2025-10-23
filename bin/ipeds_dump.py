#!/usr/bin/env python3
"""
CLI tool for dumping IPEDS institution counts by county or MSA.
"""
from __future__ import annotations
import sys
import os
import json
import argparse

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.institutions_by_msa import (
    get_institution_counts_by_county,
    get_institution_counts_by_msa,
    get_full_aggregation
)


def main():
    parser = argparse.ArgumentParser(
        description="Dump IPEDS institution counts for Florida"
    )
    parser.add_argument(
        "--year",
        type=int,
        default=None,
        help="Data year (default: latest available)"
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
        if args.by == "county":
            data = get_institution_counts_by_county(
                year=args.year,
                cache_dir=args.cache_dir
            )
        elif args.by == "msa":
            data = get_institution_counts_by_msa(
                year=args.year,
                cache_dir=args.cache_dir,
                mapping_path=args.mapping
            )
        else:  # full
            data = get_full_aggregation(
                year=args.year,
                cache_dir=args.cache_dir,
                mapping_path=args.mapping
            )
        
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

