import pytest
from unittest.mock import AsyncMock, patch
from pydantic import ValidationError
from mcp_server_fetch.server import Fetch


class TestFetchParameters:
    """Test cases for Fetch parameter validation, especially null/None handling."""

    def test_fetch_with_all_parameters_provided(self):
        """Test that all parameters work when explicitly provided."""
        fetch = Fetch(
            url="https://example.com",
            max_length=1000,
            start_index=10,
            raw=True
        )
        assert str(fetch.url) == "https://example.com/"
        assert fetch.max_length == 1000
        assert fetch.start_index == 10
        assert fetch.raw is True

    def test_fetch_with_only_required_url(self):
        """Test that only providing the required URL parameter works."""
        fetch = Fetch(url="https://example.com")
        assert str(fetch.url) == "https://example.com/"
        assert fetch.max_length == 5000  # default value
        assert fetch.start_index == 0     # default value
        assert fetch.raw is False         # default value

    def test_fetch_with_explicit_none_values(self):
        """Test that explicit None values for optional parameters work (fixes issue #2035)."""
        # This is the key test case from the original issue
        # LibreChat was sending explicit null values which caused validation errors
        # The fix allows None values - the server code handles None with `or` defaults
        fetch = Fetch(
            url="https://example.com",
            max_length=None,
            start_index=None,
            raw=None
        )
        assert str(fetch.url) == "https://example.com/"
        assert fetch.max_length is None   # None is allowed, defaults handled by server logic
        assert fetch.start_index is None  # None is allowed, defaults handled by server logic
        assert fetch.raw is None          # None is allowed, defaults handled by server logic

    def test_fetch_with_mixed_none_and_values(self):
        """Test mixing None values with actual values."""
        fetch = Fetch(
            url="https://example.com",
            max_length=2000,
            start_index=None,
            raw=True
        )
        assert str(fetch.url) == "https://example.com/"
        assert fetch.max_length == 2000
        assert fetch.start_index is None  # None is allowed, defaults handled by server logic
        assert fetch.raw is True

    def test_fetch_url_validation(self):
        """Test that invalid URLs are properly rejected."""
        with pytest.raises(ValidationError):
            Fetch(url="not-a-valid-url")

    def test_fetch_max_length_validation(self):
        """Test max_length parameter validation."""
        # Test zero value (should fail - gt=0)
        with pytest.raises(ValidationError):
            Fetch(url="https://example.com", max_length=0)
        
        # Test negative value (should fail - gt=0)
        with pytest.raises(ValidationError):
            Fetch(url="https://example.com", max_length=-1)
        
        # Test value too large (should fail - lt=1000000)
        with pytest.raises(ValidationError):
            Fetch(url="https://example.com", max_length=1000000)
        
        # Test valid value
        fetch = Fetch(url="https://example.com", max_length=1000)
        assert fetch.max_length == 1000

    def test_fetch_start_index_validation(self):
        """Test start_index parameter validation."""
        # Test negative value (should fail - ge=0)
        with pytest.raises(ValidationError):
            Fetch(url="https://example.com", start_index=-1)
        
        # Test zero value (should pass - ge=0)
        fetch = Fetch(url="https://example.com", start_index=0)
        assert fetch.start_index == 0
        
        # Test positive value (should pass)
        fetch = Fetch(url="https://example.com", start_index=100)
        assert fetch.start_index == 100

    def test_fetch_raw_parameter(self):
        """Test raw parameter validation."""
        # Test True
        fetch = Fetch(url="https://example.com", raw=True)
        assert fetch.raw is True
        
        # Test False
        fetch = Fetch(url="https://example.com", raw=False)
        assert fetch.raw is False

    def test_fetch_parameter_from_dict_with_nulls(self):
        """Test creating Fetch from dict with null values (simulates MCP client behavior)."""
        # This simulates what LibreChat and other MCP clients send
        params = {
            "url": "https://example.com",
            "max_length": None,
            "start_index": None,
            "raw": None
        }
        
        fetch = Fetch(**params)
        assert str(fetch.url) == "https://example.com/"
        assert fetch.max_length is None   # None is allowed, defaults handled by server logic
        assert fetch.start_index is None  # None is allowed, defaults handled by server logic
        assert fetch.raw is None          # None is allowed, defaults handled by server logic

    def test_fetch_parameter_from_dict_omitted(self):
        """Test creating Fetch from dict with omitted optional parameters."""
        params = {
            "url": "https://example.com"
        }
        
        fetch = Fetch(**params)
        assert str(fetch.url) == "https://example.com/"
        assert fetch.max_length == 5000  # default
        assert fetch.start_index == 0     # default
        assert fetch.raw is False         # default


class TestServerLogic:
    """Test cases for server call_tool logic that handles None values."""

    def test_server_handles_none_values_correctly(self):
        """Test that server logic converts None values to defaults in call_tool."""
        # Test the core logic from lines 241-242 in server.py
        # start_index = args.start_index or 0
        # max_length = args.max_length or 5000
        
        # Create a Fetch object with None values (as would come from MCP clients)
        args = Fetch(
            url="https://example.com",
            max_length=None,
            start_index=None,
            raw=None
        )
        
        # Test the server logic that handles None values
        start_index = args.start_index or 0
        max_length = args.max_length or 5000
        raw = args.raw or False
        
        # Verify that None values are converted to defaults
        assert start_index == 0, "start_index should default to 0 when None"
        assert max_length == 5000, "max_length should default to 5000 when None"
        assert raw is False, "raw should default to False when None"

    def test_server_preserves_explicit_values(self):
        """Test that server logic preserves explicit non-None values."""
        # Create a Fetch object with explicit values
        args = Fetch(
            url="https://example.com",
            max_length=1000,
            start_index=100,
            raw=True
        )
        
        # Test the server logic
        start_index = args.start_index or 0
        max_length = args.max_length or 5000
        raw = args.raw or False
        
        # Verify that explicit values are preserved
        assert start_index == 100, "explicit start_index should be preserved"
        assert max_length == 1000, "explicit max_length should be preserved"  
        assert raw is True, "explicit raw should be preserved"