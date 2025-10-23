"""
Unit tests for IPEDS client.
"""
import unittest
from unittest.mock import Mock, patch, MagicMock
import json
import os
import tempfile
import shutil

from services.ipeds_client import IPEDSClient


class TestIPEDSClient(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.client = IPEDSClient(cache_dir=self.temp_dir)
    
    def tearDown(self):
        """Clean up test fixtures."""
        shutil.rmtree(self.temp_dir)
    
    def test_init(self):
        """Test client initialization."""
        self.assertIsNotNone(self.client.s)
        self.assertEqual(self.client.cache_dir, self.temp_dir)
        self.assertTrue(os.path.exists(self.temp_dir))
    
    def test_cache_hit(self):
        """Test that cached data is used when available."""
        # Create cache file
        cache_path = os.path.join(self.temp_dir, "ipeds_institutions_FL_2022.json")
        test_data = [{"unitid": 123, "inst_name": "Test University"}]
        with open(cache_path, "w") as f:
            json.dump(test_data, f)
        
        # Fetch should return cached data without API call
        result = self.client.fetch_institutions(year=2022, use_cache=True)
        self.assertEqual(result, test_data)
    
    @patch('services.ipeds_client.IPEDSClient._get')
    def test_pagination(self, mock_get):
        """Test pagination handling."""
        # Mock paginated responses
        page1_response = Mock()
        page1_response.json.return_value = {
            "results": [{"unitid": 1}, {"unitid": 2}],
            "next": "https://example.com/page2"
        }
        
        page2_response = Mock()
        page2_response.json.return_value = {
            "results": [{"unitid": 3}],
            "next": None
        }
        
        mock_get.side_effect = [page1_response, page2_response]
        
        # Fetch without cache
        result = self.client.fetch_institutions(year=2022, use_cache=False)
        
        self.assertEqual(len(result), 3)
        self.assertEqual(result[0]["unitid"], 1)
        self.assertEqual(result[2]["unitid"], 3)
        self.assertEqual(mock_get.call_count, 2)
    
    @patch('requests.Session.get')
    def test_retry_on_429(self, mock_get):
        """Test retry logic on rate limiting."""
        # First call returns 429, second succeeds
        rate_limited = Mock()
        rate_limited.status_code = 429
        rate_limited.headers = {"Retry-After": "1"}
        
        success = Mock()
        success.status_code = 200
        success.json.return_value = {"results": [], "next": None}
        
        mock_get.side_effect = [rate_limited, success]
        
        with patch('time.sleep'):  # Speed up test
            response = self.client._get("http://example.com")
        
        self.assertEqual(response, success)
        self.assertEqual(mock_get.call_count, 2)
    
    def test_cache_creation(self):
        """Test that results are cached correctly."""
        with patch('services.ipeds_client.IPEDSClient._get') as mock_get:
            mock_response = Mock()
            mock_response.json.return_value = {
                "results": [{"unitid": 999}],
                "next": None
            }
            mock_get.return_value = mock_response
            
            # Fetch with caching enabled
            result = self.client.fetch_institutions(year=2023, use_cache=True)
            
            # Check cache file was created
            cache_path = os.path.join(self.temp_dir, "ipeds_institutions_FL_2023.json")
            self.assertTrue(os.path.exists(cache_path))
            
            # Verify cache contents
            with open(cache_path, "r") as f:
                cached = json.load(f)
            self.assertEqual(cached, result)


if __name__ == "__main__":
    unittest.main()

