"""
Unit tests for normalization utilities.
"""
import unittest
from services.normalization import (
    normalize_county_name,
    county_fips_to_name,
    county_name_to_fips,
    enrich_with_fips,
    build_fips_to_msa_map
)


class TestNormalization(unittest.TestCase):
    
    def test_normalize_county_name(self):
        """Test county name normalization."""
        # Test removing "County" suffix
        self.assertEqual(
            normalize_county_name("Miami-Dade County"),
            "Miami-Dade"
        )
        
        # Test case conversion
        self.assertEqual(
            normalize_county_name("BROWARD COUNTY"),
            "Broward"
        )
        
        # Test Saint -> St.
        self.assertEqual(
            normalize_county_name("Saint Lucie County"),
            "St. Lucie"
        )
        
        # Test already normalized
        self.assertEqual(
            normalize_county_name("Hillsborough"),
            "Hillsborough"
        )
        
        # Test empty/whitespace
        self.assertEqual(normalize_county_name(""), "")
        self.assertEqual(normalize_county_name("  "), "")
    
    def test_fips_to_county(self):
        """Test FIPS to county name conversion."""
        self.assertEqual(county_fips_to_name("12086"), "Miami-Dade")
        self.assertEqual(county_fips_to_name("12011"), "Broward")
        self.assertEqual(county_fips_to_name("12111"), "St. Lucie")
        self.assertIsNone(county_fips_to_name("99999"))
    
    def test_county_to_fips(self):
        """Test county name to FIPS conversion."""
        self.assertEqual(county_name_to_fips("Miami-Dade"), "12086")
        self.assertEqual(county_name_to_fips("BROWARD COUNTY"), "12011")
        self.assertEqual(county_name_to_fips("st. lucie"), "12111")
        self.assertEqual(county_name_to_fips("Saint Lucie County"), "12111")
        self.assertIsNone(county_name_to_fips("Unknown County"))
    
    def test_enrich_with_fips(self):
        """Test FIPS enrichment."""
        recs = [
            {"county_name": "Miami-Dade County", "inst_name": "FIU"},
            {"county_name": "Broward", "inst_name": "NSU"},
            {"fips": "12057", "inst_name": "USF"},
            {"inst_name": "No Location"}
        ]
        
        result = enrich_with_fips(recs)
        
        self.assertEqual(result[0]["fips_derived"], "12086")
        self.assertEqual(result[1]["fips_derived"], "12011")
        self.assertEqual(result[2]["fips_derived"], "12057")  # Normalizes existing fips
        self.assertNotIn("fips_derived", result[3])
    
    def test_build_fips_to_msa_map(self):
        """Test building FIPS to MSA mapping."""
        json_data = {
            "countyToMsa": {
                "12086": {"msaCode": "33100", "msaName": "Miami MSA"},
                "12011": {"msaCode": "33100", "msaName": "Miami MSA"}
            },
            "nonMsaCounties": ["12001"]
        }
        
        result = build_fips_to_msa_map(json_data)
        
        self.assertEqual(result["12086"], "Miami MSA")
        self.assertEqual(result["12011"], "Miami MSA")
        self.assertNotIn("12001", result)


if __name__ == "__main__":
    unittest.main()

