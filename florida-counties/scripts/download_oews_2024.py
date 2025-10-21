#!/usr/bin/env python3
"""
Download BLS OEWS May 2024 Data
Python script to download with proper headers and session handling
"""

import requests
import os
from pathlib import Path

def download_oews_2024():
    """Download BLS OEWS May 2024 MSA data"""
    
    print("📥 Downloading BLS OEWS May 2024 MSA Data...\n")
    
    # Create output directory
    output_dir = Path("data/raw/oews")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Try multiple possible URLs
    urls = [
        "https://www.bls.gov/oes/special.requests/oesm24ma.zip",
        "https://www.bls.gov/oes/special.requests/oesm24all/all_data_M_2024.xlsx",
        "https://www.bls.gov/oes/special.requests/oesm24all/all_data_M_2024.zip",
    ]
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
    }
    
    session = requests.Session()
    session.headers.update(headers)
    
    for url in urls:
        print(f"Trying: {url}")
        
        try:
            response = session.get(url, timeout=30, allow_redirects=True)
            
            # Check if we got HTML (error page) or actual data
            content_type = response.headers.get('Content-Type', '')
            
            if response.status_code == 200:
                if 'html' in content_type.lower():
                    print(f"  ❌ Got HTML page (likely blocked or not found)")
                    continue
                
                # Determine filename
                if 'xlsx' in url:
                    filename = "all_data_M_2024.xlsx"
                elif 'zip' in url:
                    filename = "oews_msa_may2024.zip"
                else:
                    filename = "oews_data_2024.bin"
                
                filepath = output_dir / filename
                
                # Save file
                with open(filepath, 'wb') as f:
                    f.write(response.content)
                
                size_kb = len(response.content) / 1024
                
                if size_kb < 5:  # Less than 5KB is suspicious
                    print(f"  ⚠️ File too small ({size_kb:.1f} KB), likely an error page")
                    os.remove(filepath)
                    continue
                
                print(f"  ✅ Downloaded: {filename}")
                print(f"     Size: {size_kb:.1f} KB")
                print(f"     Saved to: {filepath}")
                return True
                
            else:
                print(f"  ❌ HTTP {response.status_code}")
                
        except requests.exceptions.RequestException as e:
            print(f"  ❌ Error: {e}")
            continue
    
    print("\n❌ All download attempts failed!")
    print("\n📝 Please download manually:")
    print("   1. Go to: https://www.bls.gov/oes/tables.htm")
    print("   2. Find May 2024 → MSA data")
    print("   3. Download the Excel or ZIP file")
    print("   4. Save to: data/raw/oews/")
    print("\nSee OEWS_2024_DOWNLOAD_INSTRUCTIONS.md for details.")
    
    return False

if __name__ == "__main__":
    success = download_oews_2024()
    exit(0 if success else 1)

