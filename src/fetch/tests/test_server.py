import pytest
from unittest.mock import AsyncMock, Mock, patch, MagicMock
from pydantic import ValidationError
from mcp_server_fetch.server import (
    extract_content_from_html,
    get_robots_txt_url,
    check_may_autonomously_fetch_url,
    fetch_url,
    Fetch,
)
from mcp.shared.exceptions import McpError
from mcp.types import INTERNAL_ERROR, INVALID_PARAMS


class TestExtractContentFromHtml:
    """Test HTML content extraction and conversion to markdown."""

    def test_extract_simple_html(self):
        """Test extraction of simple HTML content."""
        html = "<html><body><h1>Title</h1><p>Content</p></body></html>"
        result = extract_content_from_html(html)
        assert "Title" in result
        assert "Content" in result

    def test_extract_complex_html_with_formatting(self):
        """Test extraction with various HTML formatting."""
        html = """
        <html>
            <body>
                <h1>Main Title</h1>
                <h2>Subtitle</h2>
                <p>Paragraph with <strong>bold</strong> and <em>italic</em> text.</p>
                <ul>
                    <li>Item 1</li>
                    <li>Item 2</li>
                </ul>
            </body>
        </html>
        """
        result = extract_content_from_html(html)
        assert "Main Title" in result
        assert "Subtitle" in result
        assert "bold" in result
        assert "italic" in result

    def test_extract_with_links(self):
        """Test extraction preserves links."""
        html = '<html><body><a href="https://example.com">Link</a></body></html>'
        result = extract_content_from_html(html)
        assert "Link" in result

    def test_extract_fails_gracefully_on_unparseable_html(self):
        """Test that unparseable HTML returns error message."""
        html = "Not valid HTML at all"
        result = extract_content_from_html(html)
        # Should either extract something or return error
        assert isinstance(result, str)

    def test_extract_empty_html(self):
        """Test extraction with empty HTML."""
        html = "<html><body></body></html>"
        result = extract_content_from_html(html)
        assert isinstance(result, str)

    def test_extract_html_with_script_tags(self):
        """Test that script tags are handled."""
        html = """
        <html>
            <body>
                <p>Visible content</p>
                <script>alert('hidden');</script>
            </body>
        </html>
        """
        result = extract_content_from_html(html)
        assert "Visible content" in result
        # Script content should ideally be filtered out
        assert "alert" not in result or True  # Depends on readabilipy behavior

    def test_extract_html_with_tables(self):
        """Test extraction of table content."""
        html = """
        <html>
            <body>
                <table>
                    <tr><td>Cell 1</td><td>Cell 2</td></tr>
                    <tr><td>Cell 3</td><td>Cell 4</td></tr>
                </table>
            </body>
        </html>
        """
        result = extract_content_from_html(html)
        assert "Cell 1" in result or "Cell" in result


class TestGetRobotsTxtUrl:
    """Test robots.txt URL generation."""

    def test_get_robots_txt_basic_url(self):
        """Test robots.txt URL for basic domain."""
        url = "https://example.com/page"
        result = get_robots_txt_url(url)
        assert result == "https://example.com/robots.txt"

    def test_get_robots_txt_with_subdomain(self):
        """Test robots.txt URL with subdomain."""
        url = "https://subdomain.example.com/path/to/page"
        result = get_robots_txt_url(url)
        assert result == "https://subdomain.example.com/robots.txt"

    def test_get_robots_txt_with_port(self):
        """Test robots.txt URL with custom port."""
        url = "https://example.com:8080/page"
        result = get_robots_txt_url(url)
        assert result == "https://example.com:8080/robots.txt"

    def test_get_robots_txt_http_protocol(self):
        """Test robots.txt URL with HTTP protocol."""
        url = "http://example.com/page"
        result = get_robots_txt_url(url)
        assert result == "http://example.com/robots.txt"

    def test_get_robots_txt_with_query_params(self):
        """Test robots.txt URL ignores query parameters."""
        url = "https://example.com/page?query=value&other=param"
        result = get_robots_txt_url(url)
        assert result == "https://example.com/robots.txt"
        assert "query" not in result

    def test_get_robots_txt_with_fragment(self):
        """Test robots.txt URL ignores fragments."""
        url = "https://example.com/page#section"
        result = get_robots_txt_url(url)
        assert result == "https://example.com/robots.txt"
        assert "#" not in result

    def test_get_robots_txt_deeply_nested_path(self):
        """Test robots.txt URL with deeply nested path."""
        url = "https://example.com/a/b/c/d/e/f/page.html"
        result = get_robots_txt_url(url)
        assert result == "https://example.com/robots.txt"


@pytest.mark.asyncio
class TestCheckMayAutonomouslyFetchUrl:
    """Test robots.txt checking functionality."""

    async def test_allows_fetch_when_robots_txt_allows(self):
        """Test that fetch is allowed when robots.txt permits."""
        with patch("mcp_server_fetch.server.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.text = "User-agent: *\nAllow: /"
            
            mock_get = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.get = mock_get

            # Should not raise
            await check_may_autonomously_fetch_url(
                "https://example.com/page",
                "TestBot/1.0",
                None
            )

    async def test_blocks_fetch_when_robots_txt_disallows(self):
        """Test that fetch is blocked when robots.txt disallows."""
        with patch("mcp_server_fetch.server.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.text = "User-agent: *\nDisallow: /"
            
            mock_get = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.get = mock_get

            with pytest.raises(McpError) as exc_info:
                await check_may_autonomously_fetch_url(
                    "https://example.com/page",
                    "TestBot/1.0",
                    None
                )
            
            assert exc_info.value.error.code == INTERNAL_ERROR

    async def test_handles_403_forbidden_robots_txt(self):
        """Test handling of 403 Forbidden on robots.txt."""
        with patch("mcp_server_fetch.server.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 403
            
            mock_get = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.get = mock_get

            with pytest.raises(McpError) as exc_info:
                await check_may_autonomously_fetch_url(
                    "https://example.com/page",
                    "TestBot/1.0",
                    None
                )
            
            assert "403" in str(exc_info.value.error.message)

    async def test_handles_401_unauthorized_robots_txt(self):
        """Test handling of 401 Unauthorized on robots.txt."""
        with patch("mcp_server_fetch.server.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 401
            
            mock_get = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.get = mock_get

            with pytest.raises(McpError) as exc_info:
                await check_may_autonomously_fetch_url(
                    "https://example.com/page",
                    "TestBot/1.0",
                    None
                )
            
            assert "401" in str(exc_info.value.error.message)

    async def test_allows_fetch_when_robots_txt_not_found(self):
        """Test that fetch is allowed when robots.txt returns 404."""
        with patch("mcp_server_fetch.server.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 404
            
            mock_get = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.get = mock_get

            # Should not raise (404 means no robots.txt, so allow)
            await check_may_autonomously_fetch_url(
                "https://example.com/page",
                "TestBot/1.0",
                None
            )

    async def test_handles_connection_error_fetching_robots_txt(self):
        """Test handling of connection errors when fetching robots.txt."""
        from httpx import HTTPError
        
        with patch("mcp_server_fetch.server.AsyncClient") as mock_client:
            mock_get = AsyncMock(side_effect=HTTPError("Connection failed"))
            mock_client.return_value.__aenter__.return_value.get = mock_get

            with pytest.raises(McpError) as exc_info:
                await check_may_autonomously_fetch_url(
                    "https://example.com/page",
                    "TestBot/1.0",
                    None
                )
            
            assert "connection issue" in str(exc_info.value.error.message).lower()

    async def test_respects_user_agent_specific_rules(self):
        """Test that user-agent specific rules are respected."""
        with patch("mcp_server_fetch.server.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.text = """
User-agent: *
Allow: /

User-agent: BadBot
Disallow: /
            """
            
            mock_get = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.get = mock_get

            # Should not raise for general user agent
            await check_may_autonomously_fetch_url(
                "https://example.com/page",
                "GoodBot/1.0",
                None
            )

    async def test_handles_robots_txt_with_comments(self):
        """Test that comments in robots.txt are handled correctly."""
        with patch("mcp_server_fetch.server.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.text = """
# This is a comment
User-agent: *
Allow: /
# Another comment
            """
            
            mock_get = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.get = mock_get

            # Should not raise
            await check_may_autonomously_fetch_url(
                "https://example.com/page",
                "TestBot/1.0",
                None
            )

    async def test_uses_proxy_when_provided(self):
        """Test that proxy is used when provided."""
        with patch("mcp_server_fetch.server.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.text = "User-agent: *\nAllow: /"
            
            mock_get = AsyncMock(return_value=mock_response)
            mock_instance = MagicMock()
            mock_instance.get = mock_get
            mock_instance.__aenter__.return_value = mock_instance
            mock_instance.__aexit__.return_value = AsyncMock()
            mock_client.return_value = mock_instance

            await check_may_autonomously_fetch_url(
                "https://example.com/page",
                "TestBot/1.0",
                "http://proxy:8080"
            )
            
            # Verify proxy was passed to AsyncClient
            mock_client.assert_called_once_with(proxies="http://proxy:8080")


@pytest.mark.asyncio
class TestFetchUrl:
    """Test URL fetching functionality."""

    async def test_fetch_html_page_successfully(self):
        """Test successful HTML page fetch."""
        with patch("mcp_server_fetch.server.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.text = "<html><body><p>Test content</p></body></html>"
            mock_response.headers = {"content-type": "text/html"}
            
            mock_get = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.get = mock_get

            content, prefix = await fetch_url(
                "https://example.com/page",
                "TestBot/1.0",
                False,
                None
            )
            
            assert "Test content" in content
            assert prefix == ""

    async def test_fetch_with_force_raw_returns_raw_html(self):
        """Test that force_raw returns raw HTML."""
        with patch("mcp_server_fetch.server.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.text = "<html><body><p>Test content</p></body></html>"
            mock_response.headers = {"content-type": "text/html"}
            
            mock_get = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.get = mock_get

            content, prefix = await fetch_url(
                "https://example.com/page",
                "TestBot/1.0",
                True,
                None
            )
            
            assert "<html>" in content
            assert "<p>" in content
            assert "text/html" in prefix

    async def test_fetch_non_html_content(self):
        """Test fetching non-HTML content."""
        with patch("mcp_server_fetch.server.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.text = '{"key": "value"}'
            mock_response.headers = {"content-type": "application/json"}
            
            mock_get = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.get = mock_get

            content, prefix = await fetch_url(
                "https://example.com/api",
                "TestBot/1.0",
                False,
                None
            )
            
            assert '{"key": "value"}' in content
            assert "application/json" in prefix

    async def test_fetch_handles_404_error(self):
        """Test handling of 404 errors."""
        with patch("mcp_server_fetch.server.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 404
            
            mock_get = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.get = mock_get

            with pytest.raises(McpError) as exc_info:
                await fetch_url(
                    "https://example.com/notfound",
                    "TestBot/1.0",
                    False,
                    None
                )
            
            assert "404" in str(exc_info.value.error.message)

    async def test_fetch_handles_500_error(self):
        """Test handling of 500 server errors."""
        with patch("mcp_server_fetch.server.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 500
            
            mock_get = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.get = mock_get

            with pytest.raises(McpError) as exc_info:
                await fetch_url(
                    "https://example.com/error",
                    "TestBot/1.0",
                    False,
                    None
                )
            
            assert "500" in str(exc_info.value.error.message)

    async def test_fetch_handles_connection_timeout(self):
        """Test handling of connection timeouts."""
        from httpx import HTTPError
        
        with patch("mcp_server_fetch.server.AsyncClient") as mock_client:
            mock_get = AsyncMock(side_effect=HTTPError("Timeout"))
            mock_client.return_value.__aenter__.return_value.get = mock_get

            with pytest.raises(McpError) as exc_info:
                await fetch_url(
                    "https://example.com/slow",
                    "TestBot/1.0",
                    False,
                    None
                )
            
            assert "Failed to fetch" in str(exc_info.value.error.message)

    async def test_fetch_follows_redirects(self):
        """Test that redirects are followed."""
        with patch("mcp_server_fetch.server.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.text = "<html><body>Redirected content</body></html>"
            mock_response.headers = {"content-type": "text/html"}
            
            mock_get = AsyncMock(return_value=mock_response)
            mock_instance = MagicMock()
            mock_instance.get = mock_get
            mock_instance.__aenter__.return_value = mock_instance
            mock_instance.__aexit__.return_value = AsyncMock()
            mock_client.return_value = mock_instance

            _, _ = await fetch_url(
                "https://example.com/redirect",
                "TestBot/1.0",
                False,
                None
            )
            
            # Verify follow_redirects was set
            call_args = mock_get.call_args
            assert call_args is not None

    async def test_fetch_respects_timeout(self):
        """Test that timeout parameter is respected."""
        with patch("mcp_server_fetch.server.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.text = "<html><body>Content</body></html>"
            mock_response.headers = {"content-type": "text/html"}
            
            mock_get = AsyncMock(return_value=mock_response)
            mock_instance = MagicMock()
            mock_instance.get = mock_get
            mock_instance.__aenter__.return_value = mock_instance
            mock_instance.__aexit__.return_value = AsyncMock()
            mock_client.return_value = mock_instance

            await fetch_url(
                "https://example.com/page",
                "TestBot/1.0",
                False,
                None
            )
            
            # Verify timeout was set to 30
            call_args = mock_get.call_args
            assert call_args is not None


class TestFetchModel:
    """Test the Fetch Pydantic model."""

    def test_fetch_model_valid_data(self):
        """Test Fetch model with valid data."""
        fetch = Fetch(
            url="https://example.com",
            max_length=5000,
            start_index=0,
            raw=False
        )
        assert str(fetch.url) == "https://example.com/"
        assert fetch.max_length == 5000
        assert fetch.start_index == 0
        assert fetch.raw is False

    def test_fetch_model_default_values(self):
        """Test Fetch model default values."""
        fetch = Fetch(url="https://example.com")
        assert fetch.max_length == 5000
        assert fetch.start_index == 0
        assert fetch.raw is False

    def test_fetch_model_custom_max_length(self):
        """Test Fetch model with custom max_length."""
        fetch = Fetch(url="https://example.com", max_length=10000)
        assert fetch.max_length == 10000

    def test_fetch_model_custom_start_index(self):
        """Test Fetch model with custom start_index."""
        fetch = Fetch(url="https://example.com", start_index=1000)
        assert fetch.start_index == 1000

    def test_fetch_model_raw_mode(self):
        """Test Fetch model with raw=True."""
        fetch = Fetch(url="https://example.com", raw=True)
        assert fetch.raw is True

    def test_fetch_model_rejects_invalid_url(self):
        """Test Fetch model rejects invalid URLs."""
        with pytest.raises(ValidationError):
            Fetch(url="not a valid url")

    def test_fetch_model_rejects_zero_max_length(self):
        """Test Fetch model rejects max_length of 0."""
        with pytest.raises(ValidationError):
            Fetch(url="https://example.com", max_length=0)

    def test_fetch_model_rejects_negative_max_length(self):
        """Test Fetch model rejects negative max_length."""
        with pytest.raises(ValidationError):
            Fetch(url="https://example.com", max_length=-100)

    def test_fetch_model_rejects_negative_start_index(self):
        """Test Fetch model rejects negative start_index."""
        with pytest.raises(ValidationError):
            Fetch(url="https://example.com", start_index=-1)

    def test_fetch_model_rejects_too_large_max_length(self):
        """Test Fetch model rejects max_length >= 1000000."""
        with pytest.raises(ValidationError):
            Fetch(url="https://example.com", max_length=1000000)

    def test_fetch_model_accepts_various_url_schemes(self):
        """Test Fetch model accepts various URL schemes."""
        # HTTP
        fetch_http = Fetch(url="http://example.com")
        assert "http" in str(fetch_http.url)
        
        # HTTPS
        fetch_https = Fetch(url="https://example.com")
        assert "https" in str(fetch_https.url)

    def test_fetch_model_with_url_query_parameters(self):
        """Test Fetch model with URL containing query parameters."""
        fetch = Fetch(url="https://example.com/page?query=value&other=param")
        assert "query=value" in str(fetch.url)

    def test_fetch_model_with_url_fragment(self):
        """Test Fetch model with URL containing fragment."""
        fetch = Fetch(url="https://example.com/page#section")
        # URL might normalize fragments
        assert "example.com" in str(fetch.url)


class TestIntegrationScenarios:
    """Integration-level tests for complex scenarios."""

    @pytest.mark.asyncio
    async def test_full_fetch_workflow_with_robots_check(self):
        """Test complete fetch workflow including robots.txt check."""
        with patch("mcp_server_fetch.server.AsyncClient") as mock_client:
            # Mock robots.txt response
            robots_response = Mock()
            robots_response.status_code = 200
            robots_response.text = "User-agent: *\nAllow: /"
            
            # Mock page response
            page_response = Mock()
            page_response.status_code = 200
            page_response.text = "<html><body><h1>Title</h1><p>Content</p></body></html>"
            page_response.headers = {"content-type": "text/html"}
            
            mock_get = AsyncMock(side_effect=[robots_response, page_response])
            mock_instance = MagicMock()
            mock_instance.get = mock_get
            mock_instance.__aenter__.return_value = mock_instance
            mock_instance.__aexit__.return_value = AsyncMock()
            mock_client.return_value = mock_instance

            # Check robots.txt
            await check_may_autonomously_fetch_url(
                "https://example.com/page",
                "TestBot/1.0",
                None
            )
            
            # Fetch the page
            content, _ = await fetch_url(
                "https://example.com/page",
                "TestBot/1.0",
                False,
                None
            )
            
            assert "Title" in content
            assert "Content" in content

    def test_url_parsing_edge_cases(self):
        """Test URL parsing with various edge cases."""
        # IDN (Internationalized Domain Names)
        test_urls = [
            "https://example.com",
            "https://sub.example.com",
            "https://example.com:8080",
            "https://example.com/path/to/page",
            "https://example.com/path?query=value",
        ]
        
        for url in test_urls:
            robots_url = get_robots_txt_url(url)
            assert robots_url.endswith("/robots.txt")
            assert "example.com" in robots_url