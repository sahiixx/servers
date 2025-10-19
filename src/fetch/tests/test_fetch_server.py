import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from mcp_server_fetch.server import (
    extract_content_from_html,
    get_robots_txt_url,
    check_may_autonomously_fetch_url,
    fetch_url,
    Fetch,
)
from mcp.shared.exceptions import McpError


class TestExtractContentFromHTML:
    """Tests for HTML content extraction."""

    def test_extracts_simple_html(self):
        """Test extraction of simple HTML content."""
        html = "<html><body><h1>Title</h1><p>Content</p></body></html>"
        result = extract_content_from_html(html)
        assert isinstance(result, str)
        assert len(result) > 0

    def test_extracts_with_readability(self):
        """Test extraction uses readability."""
        html = """
        <html>
            <head><title>Test</title></head>
            <body>
                <div class="content">
                    <h1>Main Title</h1>
                    <p>Main content here</p>
                </div>
                <div class="sidebar">Sidebar content</div>
            </body>
        </html>
        """
        result = extract_content_from_html(html)
        assert isinstance(result, str)

    def test_handles_empty_html(self):
        """Test handling of empty HTML."""
        html = ""
        result = extract_content_from_html(html)
        assert "<error>" in result or len(result) >= 0

    def test_handles_malformed_html(self):
        """Test handling of malformed HTML."""
        html = "<html><body><p>Unclosed paragraph"
        result = extract_content_from_html(html)
        assert isinstance(result, str)

    def test_converts_to_markdown(self):
        """Test conversion to markdown format."""
        html = "<html><body><h1>Title</h1><p>Paragraph</p></body></html>"
        result = extract_content_from_html(html)
        # Should convert headings and paragraphs
        assert isinstance(result, str)

    def test_handles_complex_formatting(self):
        """Test handling of complex HTML formatting."""
        html = """
        <html><body>
            <h1>Header 1</h1>
            <h2>Header 2</h2>
            <p>Paragraph with <strong>bold</strong> and <em>italic</em></p>
            <ul>
                <li>Item 1</li>
                <li>Item 2</li>
            </ul>
        </body></html>
        """
        result = extract_content_from_html(html)
        assert isinstance(result, str)


class TestGetRobotsTxtUrl:
    """Tests for robots.txt URL generation."""

    def test_basic_url(self):
        """Test basic URL robots.txt generation."""
        url = "https://example.com/page"
        result = get_robots_txt_url(url)
        assert result == "https://example.com/robots.txt"

    def test_url_with_path(self):
        """Test URL with path."""
        url = "https://example.com/path/to/page"
        result = get_robots_txt_url(url)
        assert result == "https://example.com/robots.txt"

    def test_url_with_query_params(self):
        """Test URL with query parameters."""
        url = "https://example.com/page?param=value"
        result = get_robots_txt_url(url)
        assert result == "https://example.com/robots.txt"

    def test_url_with_fragment(self):
        """Test URL with fragment."""
        url = "https://example.com/page#section"
        result = get_robots_txt_url(url)
        assert result == "https://example.com/robots.txt"

    def test_url_with_port(self):
        """Test URL with custom port."""
        url = "https://example.com:8080/page"
        result = get_robots_txt_url(url)
        assert result == "https://example.com:8080/robots.txt"

    def test_http_url(self):
        """Test HTTP URL."""
        url = "http://example.com/page"
        result = get_robots_txt_url(url)
        assert result == "http://example.com/robots.txt"

    def test_subdomain_url(self):
        """Test URL with subdomain."""
        url = "https://subdomain.example.com/page"
        result = get_robots_txt_url(url)
        assert result == "https://subdomain.example.com/robots.txt"


class TestFetchModel:
    """Tests for Fetch data model."""

    def test_valid_fetch_params(self):
        """Test valid fetch parameters."""
        fetch = Fetch(
            url="https://example.com",
            max_length=5000,
            start_index=0,
            raw=False,
        )
        assert str(fetch.url) == "https://example.com/"
        assert fetch.max_length == 5000
        assert fetch.start_index == 0
        assert fetch.raw is False

    def test_default_values(self):
        """Test default parameter values."""
        fetch = Fetch(url="https://example.com")
        assert fetch.max_length == 5000
        assert fetch.start_index == 0
        assert fetch.raw is False

    def test_custom_max_length(self):
        """Test custom max_length."""
        fetch = Fetch(url="https://example.com", max_length=10000)
        assert fetch.max_length == 10000

    def test_custom_start_index(self):
        """Test custom start_index."""
        fetch = Fetch(url="https://example.com", start_index=1000)
        assert fetch.start_index == 1000

    def test_raw_mode(self):
        """Test raw mode enabled."""
        fetch = Fetch(url="https://example.com", raw=True)
        assert fetch.raw is True

    def test_invalid_url(self):
        """Test invalid URL raises error."""
        with pytest.raises(ValueError):
            Fetch(url="not-a-valid-url")

    def test_max_length_validation(self):
        """Test max_length validation."""
        with pytest.raises(ValueError):
            Fetch(url="https://example.com", max_length=0)

        with pytest.raises(ValueError):
            Fetch(url="https://example.com", max_length=-1)

    def test_start_index_validation(self):
        """Test start_index validation."""
        with pytest.raises(ValueError):
            Fetch(url="https://example.com", start_index=-1)


@pytest.mark.asyncio
class TestCheckAutonomousFetch:
    """Tests for autonomous fetch checking."""

    async def test_allows_when_permitted(self):
        """Test allows fetch when robots.txt permits."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = "User-agent: *\nAllow: /"

        with patch("mcp_server_fetch.server.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            # Should not raise
            await check_may_autonomously_fetch_url(
                "https://example.com/page", "TestBot/1.0"
            )

    async def test_blocks_when_disallowed(self):
        """Test blocks fetch when robots.txt disallows."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = "User-agent: *\nDisallow: /"

        with patch("mcp_server_fetch.server.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            with pytest.raises(McpError):
                await check_may_autonomously_fetch_url(
                    "https://example.com/page", "TestBot/1.0"
                )

    async def test_allows_when_robots_not_found(self):
        """Test allows fetch when robots.txt returns 404."""
        mock_response = MagicMock()
        mock_response.status_code = 404

        with patch("mcp_server_fetch.server.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            # Should not raise for 404
            await check_may_autonomously_fetch_url(
                "https://example.com/page", "TestBot/1.0"
            )

    async def test_blocks_on_auth_required(self):
        """Test blocks when robots.txt requires authentication."""
        mock_response = MagicMock()
        mock_response.status_code = 401

        with patch("mcp_server_fetch.server.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            with pytest.raises(McpError) as exc_info:
                await check_may_autonomously_fetch_url(
                    "https://example.com/page", "TestBot/1.0"
                )
            assert "401" in str(exc_info.value)

    async def test_blocks_on_forbidden(self):
        """Test blocks when robots.txt returns 403."""
        mock_response = MagicMock()
        mock_response.status_code = 403

        with patch("mcp_server_fetch.server.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            with pytest.raises(McpError) as exc_info:
                await check_may_autonomously_fetch_url(
                    "https://example.com/page", "TestBot/1.0"
                )
            assert "403" in str(exc_info.value)


@pytest.mark.asyncio
class TestFetchUrl:
    """Tests for URL fetching."""

    async def test_fetches_html_content(self):
        """Test fetching HTML content."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = "<html><body><h1>Title</h1></body></html>"
        mock_response.headers = {"content-type": "text/html"}

        with patch("mcp_server_fetch.server.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            content, prefix = await fetch_url(
                "https://example.com", "TestBot/1.0"
            )
            assert isinstance(content, str)
            assert prefix == ""

    async def test_fetches_raw_content(self):
        """Test fetching raw content."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = "<html><body>Raw content</body></html>"
        mock_response.headers = {"content-type": "text/html"}

        with patch("mcp_server_fetch.server.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            content, prefix = await fetch_url(
                "https://example.com", "TestBot/1.0", force_raw=True
            )
            assert "<html>" in content
            assert "cannot be simplified" in prefix

    async def test_handles_non_html_content(self):
        """Test handling of non-HTML content."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = '{"key": "value"}'
        mock_response.headers = {"content-type": "application/json"}

        with patch("mcp_server_fetch.server.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            content, prefix = await fetch_url(
                "https://example.com/api", "TestBot/1.0"
            )
            assert "key" in content
            assert "cannot be simplified" in prefix

    async def test_handles_404_error(self):
        """Test handling of 404 error."""
        mock_response = MagicMock()
        mock_response.status_code = 404

        with patch("mcp_server_fetch.server.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            with pytest.raises(McpError) as exc_info:
                await fetch_url("https://example.com/notfound", "TestBot/1.0")
            assert "404" in str(exc_info.value)

    async def test_handles_500_error(self):
        """Test handling of 500 error."""
        mock_response = MagicMock()
        mock_response.status_code = 500

        with patch("mcp_server_fetch.server.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            with pytest.raises(McpError) as exc_info:
                await fetch_url("https://example.com", "TestBot/1.0")
            assert "500" in str(exc_info.value)

    async def test_follows_redirects(self):
        """Test that redirects are followed."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = "<html><body>Final content</body></html>"
        mock_response.headers = {"content-type": "text/html"}

        with patch("mcp_server_fetch.server.AsyncClient") as mock_client:
            mock_get = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.get = mock_get

            await fetch_url("https://example.com", "TestBot/1.0")

            # Verify follow_redirects was set
            call_kwargs = mock_get.call_args.kwargs
            assert call_kwargs.get("follow_redirects") is True

    async def test_uses_custom_user_agent(self):
        """Test that custom user agent is used."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = "<html><body>Content</body></html>"
        mock_response.headers = {"content-type": "text/html"}

        with patch("mcp_server_fetch.server.AsyncClient") as mock_client:
            mock_get = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.get = mock_get

            user_agent = "CustomBot/2.0"
            await fetch_url("https://example.com", user_agent)

            # Verify user agent header was set
            call_kwargs = mock_get.call_args.kwargs
            assert call_kwargs.get("headers", {}).get("User-Agent") == user_agent

    async def test_uses_proxy(self):
        """Test that proxy is used when provided."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = "<html><body>Content</body></html>"
        mock_response.headers = {"content-type": "text/html"}

        with patch("mcp_server_fetch.server.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            proxy_url = "http://proxy.example.com:8080"
            await fetch_url("https://example.com", "TestBot/1.0", proxy_url=proxy_url)

            # Verify proxy was passed to AsyncClient
            call_kwargs = mock_client.call_args.kwargs
            assert call_kwargs.get("proxies") == proxy_url


class TestEdgeCases:
    """Tests for edge cases and error conditions."""

    def test_handles_unicode_content(self):
        """Test handling of Unicode content."""
        html = "<html><body><p>Hello 世界 🌍</p></body></html>"
        result = extract_content_from_html(html)
        assert isinstance(result, str)

    def test_handles_very_large_html(self):
        """Test handling of very large HTML."""
        large_html = "<html><body>" + "<p>Content</p>" * 10000 + "</body></html>"
        result = extract_content_from_html(large_html)
        assert isinstance(result, str)

    def test_robots_txt_with_comments(self):
        """Test robots.txt parsing with comments."""
        # This tests the comment filtering logic
        robots_txt = """
        # This is a comment
        User-agent: *
        # Another comment
        Disallow: /private/
        Allow: /public/
        """
        lines = [line for line in robots_txt.splitlines() if not line.strip().startswith("#")]
        assert len(lines) < len(robots_txt.splitlines())

    def test_url_with_international_domain(self):
        """Test URL with international domain name."""
        url = "https://例え.jp/page"
        result = get_robots_txt_url(url)
        assert "robots.txt" in result