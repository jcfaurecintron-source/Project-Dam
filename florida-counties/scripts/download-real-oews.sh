#!/bin/bash

# Download Real BLS OEWS Data for Florida

echo "📥 Downloading BLS OEWS Data..."

# Create directories
mkdir -p data/raw/oews

# Download 2023 MSA data (includes Florida metros)
echo "Downloading MSA employment data..."
curl -L -o data/raw/oews/oews_msa_2023.zip \
  "https://www.bls.gov/oes/special.requests/oesm23ma.zip"

# Unzip
echo "Extracting..."
cd data/raw/oews
unzip -o oews_msa_2023.zip

echo "✅ Downloaded!"
echo ""
echo "📝 Next steps:"
echo "1. Open the Excel file in data/raw/oews/"
echo "2. Filter for Florida (column 'area_title' contains 'FL')"
echo "3. Save as: oews_fl_msa_2023.csv"
echo "4. Run: npm run etl:all"

