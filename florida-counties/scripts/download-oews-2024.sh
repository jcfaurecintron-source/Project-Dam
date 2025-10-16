#!/bin/bash

# Download Official BLS OEWS May 2024 Data
# OEWS is published as downloadable Excel/CSV files, NOT via API

set -e

echo "📥 Downloading BLS OEWS May 2024 Data for Florida MSAs..."
echo ""

# Create directories
mkdir -p data/raw/oews

cd data/raw/oews

# Download May 2024 MSA data
echo "1️⃣  Downloading MSA-level OEWS data (May 2024)..."
curl -L -o oews_msa_may2024.zip \
  "https://www.bls.gov/oes/special.requests/oesm24ma.zip"

echo "   ✓ Downloaded oesm24ma.zip"

# Extract
echo ""
echo "2️⃣  Extracting files..."
unzip -o oews_msa_may2024.zip
echo "   ✓ Extracted"

# List what we got
echo ""
echo "3️⃣  Files in data/raw/oews:"
ls -lh | grep -E "\.(xlsx|xls|csv)"

echo ""
echo "✅ Download complete!"
echo ""
echo "📝 Next steps:"
echo "1. The MSA file contains ALL US metros"
echo "2. Run ETL script to extract Florida MSAs: npm run etl:parse-oews"
echo "3. Target SOCs will be filtered automatically"
echo ""
echo "📊 Florida MSAs included:"
echo "   - Miami-Fort Lauderdale-West Palm Beach"
echo "   - Tampa-St. Petersburg-Clearwater"
echo "   - Orlando-Kissimmee-Sanford"
echo "   - Jacksonville"
echo "   - Cape Coral-Fort Myers"
echo "   - North Port-Sarasota-Bradenton"
echo "   - Naples-Immokalee-Marco Island (Collier!)"
echo "   - And 15+ more..."

cd ../../..

