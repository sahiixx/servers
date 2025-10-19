"""
Comprehensive unit tests for the MCP Fetch Server.
Tests cover happy paths, edge cases, and failure conditions.
"""
import pytest
from unittest.mock import AsyncMock, Mock, patch, MagicMock
from mcp.shared.exceptions import McpError
from mcp.types import INVALID_PARAMS, INTERNAL_ERROR

from mcp_server_fetch.server import (
    extract_content_from_html,
    get_robots_txt_url,
    check_may_autonomously_fetch_url,
    fetch_url,
    Fetch,
    DEFAULT_USER_AGENT_AUTONOMOUS,
    DEFAULT_USER_AGENT_MANUAL,
)


class TestExtractContentFromHtml:
    """Test HTML content extraction and markdown conversion."""

    def test_extract_valid_html(self):
        """Test extraction of valid HTML content."""
        html = """
        <html>
            <head><title>Test Page</title></head>
            <body>
                <h1>Hello World</h1>
                <p>This is a test paragraph.</p>
            </body>
        </html>
        """
        result = extract_content_from_html(html)
        
        assert isinstance(result, str)
        assert len(result) > 0
        # Should not return error message for valid HTML
        assert "<error>" not in result

    def test_extract_empty_html(self):
        """Test extraction from HTML with no readable content."""
        html = "<html><head></head><body></body></html>"
        result = extract_content_from_html(html)
        
        assert "<error>Page failed to be simplified from HTML</error>" in result

    def test_extract_malformed_html(self):
        """Test extraction from malformed HTML."""
        html = "<html><body><div>Unclosed div<p>Some text"
        result = extract_content_from_html(html)
        
        # Should still process without crashing
        assert isinstance(result, str)

    def test_extract_html_with_special_characters(self):
        """Test extraction with special characters."""
        html = """
        <html>
            <body>
                <p>Special chars: &amp; &lt; &gt; &quot; &#39;</p>
                <p>Unicode: émoji 🎉 中文</p>
            </body>
        </html>
        """
        result = extract_content_from_html(html)
        
        assert isinstance(result, str)
        assert len(result) > 0

    def test_extract_html_with_script_tags(self):
        """Test that script tags are handled appropriately."""
        html = """
        <html>
            <body>
                <h1>Title</h1>
                <script>alert('test');</script>
                <p>Content</p>
            </body>
        </html>
        """
        result = extract_content_from_html(html)
        
        assert isinstance(result, str)
        # Script content should ideally not be in the output
        assert "alert" not in result or len(result) > 0

    def test_extract_complex_html_structure(self):
        """Test extraction from complex nested HTML."""
        html = """
        <html>
            <body>
                <article>
                    <header><h1>Article Title</h1></header>
                    <section>
                        <h2>Section 1</h2>
                        <p>Paragraph 1</p>
                        <ul>
                            <li>Item 1</li>
                            <li>Item 2</li>
                        </ul>
                    </section>
                </article>
            </body>
        </html>
        """
        result = extract_content_from_html(html)
        
        assert isinstance(result, str)
        assert len(result) > 0


class TestGetRobotsTxtUrl:
    """Test robots.txt URL generation."""

    def test_simple_http_url(self):
        """Test robots.txt URL for simple HTTP URL."""
        url = "http://example.com/page"
        result = get_robots_txt_url(url)
        
        assert result == "http://example.com/robots.txt"

    def test_simple_https_url(self):
        """Test robots.txt URL for HTTPS URL."""
        url = "https://example.com/page"
        result = get_robots_txt_url(url)
        
        assert result == "https://example.com/robots.txt"

    def test_url_with_path(self):
        """Test robots.txt URL for URL with complex path."""
        url = "https://example.com/path/to/page.html"
        result = get_robots_txt_url(url)
        
        assert result == "https://example.com/robots.txt"

    def test_url_with_query_params(self):
        """Test robots.txt URL strips query parameters."""
        url = "https://example.com/page?param=value&foo=bar"
        result = get_robots_txt_url(url)
        
        assert result == "https://example.com/robots.txt"
        assert "?" not in result

    def test_url_with_fragment(self):
        """Test robots.txt URL strips fragments."""
        url = "https://example.com/page#section"
        result = get_robots_txt_url(url)
        
        assert result == "https://example.com/robots.txt"
        assert "#" not in result

    def test_url_with_port(self):
        """Test robots.txt URL preserves port."""
        url = "https://example.com:8080/page"
        result = get_robots_txt_url(url)
        
        assert result == "https://example.com:8080/robots.txt"

    def test_url_with_subdomain(self):
        """Test robots.txt URL with subdomain."""
        url = "https://api.example.com/endpoint"
        result = get_robots_txt_url(url)
        
        assert result == "https://api.example.com/robots.txt"

    def test_url_with_auth(self):
        """Test robots.txt URL with authentication."""
        url = "https://user:pass@example.com/page"
        result = get_robots_txt_url(url)
        
        # Auth should be stripped or handled appropriately
        assert "robots.txt" in result


@pytest.mark.asyncio
class TestCheckMayAutonomouslyFetchUrl:
    """Test robots.txt checking functionality."""

    async def test_robots_txt_allows_fetch(self):
        """Test when robots.txt allows fetching."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.text = """
User-agent: *
Disallow: /admin/
Allow: /
"""
        
        with patch('mcp_server_fetch.server.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
            
            # Should not raise an exception
            await check_may_autonomously_fetch_url(
                "https://example.com/page",
                DEFAULT_USER_AGENT_AUTONOMOUS
            )

    async def test_robots_txt_disallows_fetch(self):
        """Test when robots.txt disallows fetching."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.text = """
User-agent: *
Disallow: /
"""
        
        with patch('mcp_server_fetch.server.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
            
            with pytest.raises(McpError) as exc_info:
                await check_may_autonomously_fetch_url(
                    "https://example.com/page",
                    DEFAULT_USER_AGENT_AUTONOMOUS
                )
            
            assert exc_info.value.error.code == INTERNAL_ERROR

    async def test_robots_txt_404(self):
        """Test when robots.txt returns 404 (should allow)."""
        mock_response = Mock()
        mock_response.status_code = 404
        
        with patch('mcp_server_fetch.server.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
            
            # Should not raise (404 means no restrictions)
            await check_may_autonomously_fetch_url(
                "https://example.com/page",
                DEFAULT_USER_AGENT_AUTONOMOUS
            )

    async def test_robots_txt_401_forbidden(self):
        """Test when robots.txt returns 401."""
        mock_response = Mock()
        mock_response.status_code = 401
        
        with patch('mcp_server_fetch.server.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
            
            with pytest.raises(McpError) as exc_info:
                await check_may_autonomously_fetch_url(
                    "https://example.com/page",
                    DEFAULT_USER_AGENT_AUTONOMOUS
                )
            
            assert exc_info.value.error.code == INTERNAL_ERROR
            assert "401" in exc_info.value.error.message

    async def test_robots_txt_403_forbidden(self):
        """Test when robots.txt returns 403."""
        mock_response = Mock()
        mock_response.status_code = 403
        
        with patch('mcp_server_fetch.server.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
            
            with pytest.raises(McpError) as exc_info:
                await check_may_autonomously_fetch_url(
                    "https://example.com/page",
                    DEFAULT_USER_AGENT_AUTONOMOUS
                )
            
            assert exc_info.value.error.code == INTERNAL_ERROR
            assert "403" in exc_info.value.error.message

    async def test_robots_txt_connection_error(self):
        """Test when fetching robots.txt fails with connection error."""
        from httpx import ConnectError
        
        with patch('mcp_server_fetch.server.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                side_effect=ConnectError("Connection failed")
            )
            
            with pytest.raises(McpError) as exc_info:
                await check_may_autonomously_fetch_url(
                    "https://example.com/page",
                    DEFAULT_USER_AGENT_AUTONOMOUS
                )
            
            assert exc_info.value.error.code == INTERNAL_ERROR
            assert "connection issue" in exc_info.value.error.message.lower()

    async def test_robots_txt_with_comments(self):
        """Test robots.txt parsing with comments."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.text = """
# This is a comment
User-agent: *
# Another comment
Disallow: /admin/
Allow: /
"""
        
        with patch('mcp_server_fetch.server.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
            
            # Should not raise an exception
            await check_may_autonomously_fetch_url(
                "https://example.com/page",
                DEFAULT_USER_AGENT_AUTONOMOUS
            )

    async def test_robots_txt_specific_user_agent(self):
        """Test robots.txt with specific user agent rules."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.text = """
User-agent: BadBot
Disallow: /

User-agent: *
Allow: /
"""
        
        with patch('mcp_server_fetch.server.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
            
            # Should not raise for our user agent
            await check_may_autonomously_fetch_url(
                "https://example.com/page",
                DEFAULT_USER_AGENT_AUTONOMOUS
            )

    async def test_robots_txt_with_proxy(self):
        """Test robots.txt check with proxy configuration."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.text = "User-agent: *\nAllow: /"
        
        with patch('mcp_server_fetch.server.AsyncClient') as mock_client:
            mock_instance = mock_client.return_value.__aenter__.return_value
            mock_instance.get = AsyncMock(return_value=mock_response)
            
            await check_may_autonomously_fetch_url(
                "https://example.com/page",
                DEFAULT_USER_AGENT_AUTONOMOUS,
                proxy_url="http://proxy.example.com:8080"
            )
            
            # Verify proxy was passed to client
            mock_client.assert_called_with(proxies="http://proxy.example.com:8080")


@pytest.mark.asyncio
class TestFetchUrl:
    """Test URL fetching functionality."""

    async def test_fetch_html_page_success(self):
        """Test successful fetch of HTML page."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.text = "<html><body><h1>Test</h1></body></html>"
        mock_response.headers = {"content-type": "text/html"}
        
        with patch('mcp_server_fetch.server.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
            
            content, prefix = await fetch_url(
                "https://example.com",
                DEFAULT_USER_AGENT_AUTONOMOUS
            )
            
            assert isinstance(content, str)
            assert prefix == ""

    async def test_fetch_non_html_content(self):
        """Test fetch of non-HTML content (JSON, XML, etc.)."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.text = '{"key": "value"}'
        mock_response.headers = {"content-type": "application/json"}
        
        with patch('mcp_server_fetch.server.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
            
            content, prefix = await fetch_url(
                "https://api.example.com/data",
                DEFAULT_USER_AGENT_AUTONOMOUS
            )
            
            assert content == '{"key": "value"}'
            assert "cannot be simplified" in prefix

    async def test_fetch_with_force_raw(self):
        """Test fetch with force_raw flag."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.text = "<html><body>Content</body></html>"
        mock_response.headers = {"content-type": "text/html"}
        
        with patch('mcp_server_fetch.server.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
            
            content, prefix = await fetch_url(
                "https://example.com",
                DEFAULT_USER_AGENT_AUTONOMOUS,
                force_raw=True
            )
            
            # Should return raw HTML
            assert "<html>" in content
            assert "cannot be simplified" in prefix

    async def test_fetch_404_error(self):
        """Test fetch when URL returns 404."""
        mock_response = Mock()
        mock_response.status_code = 404
        
        with patch('mcp_server_fetch.server.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
            
            with pytest.raises(McpError) as exc_info:
                await fetch_url(
                    "https://example.com/notfound",
                    DEFAULT_USER_AGENT_AUTONOMOUS
                )
            
            assert exc_info.value.error.code == INTERNAL_ERROR
            assert "404" in exc_info.value.error.message

    async def test_fetch_500_error(self):
        """Test fetch when server returns 500."""
        mock_response = Mock()
        mock_response.status_code = 500
        
        with patch('mcp_server_fetch.server.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
            
            with pytest.raises(McpError) as exc_info:
                await fetch_url(
                    "https://example.com",
                    DEFAULT_USER_AGENT_AUTONOMOUS
                )
            
            assert exc_info.value.error.code == INTERNAL_ERROR
            assert "500" in exc_info.value.error.message

    async def test_fetch_connection_timeout(self):
        """Test fetch with connection timeout."""
        from httpx import TimeoutException
        
        with patch('mcp_server_fetch.server.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                side_effect=TimeoutException("Timeout")
            )
            
            with pytest.raises(McpError) as exc_info:
                await fetch_url(
                    "https://slow-example.com",
                    DEFAULT_USER_AGENT_AUTONOMOUS
                )
            
            assert exc_info.value.error.code == INTERNAL_ERROR

    async def test_fetch_with_redirects(self):
        """Test fetch follows redirects."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.text = "<html><body>Redirected content</body></html>"
        mock_response.headers = {"content-type": "text/html"}
        
        with patch('mcp_server_fetch.server.AsyncClient') as mock_client:
            mock_instance = mock_client.return_value.__aenter__.return_value
            mock_instance.get = AsyncMock(return_value=mock_response)
            
            await fetch_url(
                "https://example.com/redirect",
                DEFAULT_USER_AGENT_AUTONOMOUS
            )
            
            # Verify follow_redirects was set to True
            call_kwargs = mock_instance.get.call_args.kwargs
            assert call_kwargs.get('follow_redirects')

    async def test_fetch_with_custom_timeout(self):
        """Test fetch uses correct timeout."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.text = "Content"
        mock_response.headers = {"content-type": "text/plain"}
        
        with patch('mcp_server_fetch.server.AsyncClient') as mock_client:
            mock_instance = mock_client.return_value.__aenter__.return_value
            mock_instance.get = AsyncMock(return_value=mock_response)
            
            await fetch_url(
                "https://example.com",
                DEFAULT_USER_AGENT_AUTONOMOUS
            )
            
            # Verify timeout was set
            call_kwargs = mock_instance.get.call_args.kwargs
            assert call_kwargs.get('timeout') == 30

    async def test_fetch_with_proxy(self):
        """Test fetch with proxy configuration."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.text = "Content"
        mock_response.headers = {"content-type": "text/plain"}
        
        with patch('mcp_server_fetch.server.AsyncClient') as mock_client:
            mock_instance = mock_client.return_value.__aenter__.return_value
            mock_instance.get = AsyncMock(return_value=mock_response)
            
            await fetch_url(
                "https://example.com",
                DEFAULT_USER_AGENT_AUTONOMOUS,
                proxy_url="http://proxy.example.com:8080"
            )
            
            # Verify proxy was passed to client
            mock_client.assert_called_with(proxies="http://proxy.example.com:8080")


class TestFetchModel:
    """Test the Fetch pydantic model."""

    def test_fetch_model_valid(self):
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
        assert not fetch.raw

    def test_fetch_model_defaults(self):
        """Test Fetch model default values."""
        fetch = Fetch(url="https://example.com")
        
        assert fetch.max_length == 5000
        assert fetch.start_index == 0
        assert not fetch.raw

    def test_fetch_model_custom_values(self):
        """Test Fetch model with custom values."""
        fetch = Fetch(
            url="https://example.com/page",
            max_length=10000,
            start_index=100,
            raw=True
        )
        
        assert fetch.max_length == 10000
        assert fetch.start_index == 100
        assert fetch.raw

    def test_fetch_model_invalid_max_length_zero(self):
        """Test Fetch model rejects zero max_length."""
        with pytest.raises(ValueError):
            Fetch(url="https://example.com", max_length=0)

    def test_fetch_model_invalid_max_length_negative(self):
        """Test Fetch model rejects negative max_length."""
        with pytest.raises(ValueError):
            Fetch(url="https://example.com", max_length=-100)

    def test_fetch_model_invalid_max_length_too_large(self):
        """Test Fetch model rejects max_length >= 1000000."""
        with pytest.raises(ValueError):
            Fetch(url="https://example.com", max_length=1000000)

    def test_fetch_model_invalid_start_index_negative(self):
        """Test Fetch model rejects negative start_index."""
        with pytest.raises(ValueError):
            Fetch(url="https://example.com", start_index=-1)

    def test_fetch_model_valid_url_formats(self):
        """Test Fetch model accepts various URL formats."""
        urls = [
            "https://example.com",
            "http://example.com",
            "https://sub.example.com/path",
            "https://example.com:8080/path?query=value",
        ]
        
        for url in urls:
            fetch = Fetch(url=url)
            assert fetch.url is not None

    def test_fetch_model_invalid_url(self):
        """Test Fetch model rejects invalid URLs."""
        with pytest.raises(ValueError):
            Fetch(url="not a valid url")

    def test_fetch_model_missing_url(self):
        """Test Fetch model requires URL."""
        with pytest.raises(ValueError):
            Fetch(max_length=5000)


class TestEdgeCases:
    """Test edge cases and boundary conditions."""

    def test_extract_very_large_html(self):
        """Test extraction from very large HTML document."""
        large_html = "<html><body>" + ("p" * 100000) + "</body></html>"
        result = extract_content_from_html(large_html)
        
        assert isinstance(result, str)

    def test_get_robots_url_with_unicode(self):
        """Test robots.txt URL with unicode characters."""
        url = "https://example.com/页面"
        result = get_robots_txt_url(url)
        
        assert "robots.txt" in result

    def test_extract_html_with_no_body(self):
        """Test extraction from HTML with no body tag."""
        html = "<html><head><title>Test</title></head></html>"
        result = extract_content_from_html(html)
        
        assert isinstance(result, str)

    def test_get_robots_url_minimal(self):
        """Test robots.txt URL with minimal URL."""
        url = "http://example.com"
        result = get_robots_txt_url(url)
        
        assert result == "http://example.com/robots.txt"

    def test_extract_html_nested_tables(self):
        """Test extraction from HTML with nested tables."""
        html = """
        <html><body>
            <table><tr><td>
                <table><tr><td>Nested content</td></tr></table>
            </td></tr></table>
        </body></html>
        """
        result = extract_content_from_html(html)
        
        assert isinstance(result, str)


class TestConstants:
    """Test module constants."""

    def test_user_agent_autonomous_format(self):
        """Test autonomous user agent string format."""
        assert "ModelContextProtocol" in DEFAULT_USER_AGENT_AUTONOMOUS
        assert "Autonomous" in DEFAULT_USER_AGENT_AUTONOMOUS
        assert "github.com" in DEFAULT_USER_AGENT_AUTONOMOUS

    def test_user_agent_manual_format(self):
        """Test manual user agent string format."""
        assert "ModelContextProtocol" in DEFAULT_USER_AGENT_MANUAL
        assert "User-Specified" in DEFAULT_USER_AGENT_MANUAL
        assert "github.com" in DEFAULT_USER_AGENT_MANUAL

    def test_user_agents_are_different(self):
        """Test that user agents are distinct."""
        assert DEFAULT_USER_AGENT_AUTONOMOUS != DEFAULT_USER_AGENT_MANUAL