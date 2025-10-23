"""
Unit tests for aggregation functions.
"""
import unittest
from services.aggregation import (
    count_by_county,
    count_by_fips,
    count_by_msa,
    aggregate_with_details
)


class TestAggregation(unittest.TestCase):
    
    def test_count_by_county(self):
        """Test county-level aggregation."""
        recs = [
            {"county_name": "Miami-Dade"},
            {"county_name": "Miami-Dade"},
            {"county_name": "Broward"},
            {"county_name": ""},
            {"inst_name": "No County"}
        ]
        
        result = count_by_county(recs)
        
        self.assertEqual(result["Miami-Dade"], 2)
        self.assertEqual(result["Broward"], 1)
        self.assertNotIn("", result)
    
    def test_count_by_fips(self):
        """Test FIPS-level aggregation."""
        recs = [
            {"fips": "12086"},
            {"fips": "12086"},
            {"fips_derived": "12011"},
            {"fips": 12011},  # numeric
            {"fips": "12"},  # state-level, should be ignored
            {"inst_name": "No FIPS"}
        ]
        
        result = count_by_fips(recs)
        
        self.assertEqual(result["12086"], 2)
        self.assertEqual(result["12011"], 2)
        self.assertNotIn("12", result)
    
    def test_count_by_msa(self):
        """Test MSA-level aggregation."""
        recs = [
            {"fips_derived": "12086"},
            {"fips": "12011"},
            {"fips": "12099"},
            {"fips": "12001"},  # Not in MSA map
        ]
        
        fips_to_msa = {
            "12086": "Miami-Fort Lauderdale-Pompano Beach, FL",
            "12011": "Miami-Fort Lauderdale-Pompano Beach, FL",
            "12099": "Miami-Fort Lauderdale-Pompano Beach, FL"
        }
        
        result = count_by_msa(recs, fips_to_msa)
        
        self.assertEqual(result["Miami-Fort Lauderdale-Pompano Beach, FL"], 3)
        self.assertEqual(len(result), 1)
    
    def test_aggregate_with_details(self):
        """Test full aggregation."""
        recs = [
            {"fips": "12086", "year": 2022},
            {"fips": "12011", "year": 2022},
        ]
        
        fips_to_msa = {
            "12086": "Miami MSA",
            "12011": "Miami MSA"
        }
        
        result = aggregate_with_details(recs, fips_to_msa)
        
        self.assertEqual(result["total"], 2)
        self.assertEqual(result["year"], 2022)
        self.assertEqual(result["county_counts"]["12086"], 1)
        self.assertEqual(result["msa_counts"]["Miami MSA"], 2)
    
    def test_empty_records(self):
        """Test aggregation with empty input."""
        result = count_by_fips([])
        self.assertEqual(result, {})
        
        result = count_by_msa([], {})
        self.assertEqual(result, {})


if __name__ == "__main__":
    unittest.main()

