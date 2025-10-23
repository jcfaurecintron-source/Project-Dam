"""
Unit tests for year resolver.
"""
import unittest
from unittest.mock import patch, Mock
import tempfile
import shutil
import os

from services.year_resolver import (
    resolve_latest_year,
    get_cached_latest_year
)


class TestYearResolver(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        """Clean up test fixtures."""
        shutil.rmtree(self.temp_dir)
    
    @patch('services.year_resolver.IPEDSClient')
    def test_resolve_latest_year_first_try(self, mock_client_class):
        """Test resolving year on first attempt."""
        mock_client = Mock()
        mock_client.fetch_institutions.return_value = [{"unitid": 1}]
        mock_client_class.return_value = mock_client
        
        result = resolve_latest_year(2023, cache_dir=self.temp_dir)
        
        self.assertEqual(result, 2023)
        mock_client.fetch_institutions.assert_called_once()
    
    @patch('services.year_resolver.IPEDSClient')
    def test_resolve_latest_year_backfill(self, mock_client_class):
        """Test resolving year with backfill."""
        mock_client = Mock()
        # First two years return empty, third returns data
        mock_client.fetch_institutions.side_effect = [
            [],  # 2023
            [],  # 2022
            [{"unitid": 1}]  # 2021
        ]
        mock_client_class.return_value = mock_client
        
        result = resolve_latest_year(2023, backfill=3, cache_dir=self.temp_dir)
        
        self.assertEqual(result, 2021)
        self.assertEqual(mock_client.fetch_institutions.call_count, 3)
    
    @patch('services.year_resolver.IPEDSClient')
    def test_resolve_with_exception(self, mock_client_class):
        """Test resolving year when API raises exception."""
        mock_client = Mock()
        mock_client.fetch_institutions.side_effect = [
            Exception("API Error"),
            [{"unitid": 1}]
        ]
        mock_client_class.return_value = mock_client
        
        result = resolve_latest_year(2023, cache_dir=self.temp_dir)
        
        self.assertEqual(result, 2022)
    
    def test_cached_year_read(self):
        """Test reading cached year."""
        cache_path = os.path.join(self.temp_dir, "ipeds_latest_year.txt")
        with open(cache_path, "w") as f:
            f.write("2022")
        
        result = get_cached_latest_year(cache_dir=self.temp_dir)
        
        self.assertEqual(result, 2022)
    
    def test_cached_year_missing(self):
        """Test reading cached year when file doesn't exist."""
        result = get_cached_latest_year(cache_dir=self.temp_dir)
        
        self.assertIsNone(result)
    
    @patch('services.year_resolver.IPEDSClient')
    def test_cache_write(self, mock_client_class):
        """Test that resolved year is cached."""
        mock_client = Mock()
        mock_client.fetch_institutions.return_value = [{"unitid": 1}]
        mock_client_class.return_value = mock_client
        
        result = resolve_latest_year(2023, cache_dir=self.temp_dir)
        
        cache_path = os.path.join(self.temp_dir, "ipeds_latest_year.txt")
        self.assertTrue(os.path.exists(cache_path))
        
        with open(cache_path, "r") as f:
            cached_year = int(f.read().strip())
        
        self.assertEqual(cached_year, 2023)


if __name__ == "__main__":
    unittest.main()

