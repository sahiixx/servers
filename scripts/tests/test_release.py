import pytest
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import json
import datetime
import subprocess
from click.testing import CliRunner
import sys
import os

# Add scripts directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from release import (
    cli,
    gen_version,
    get_robots_txt_url,
    has_changes,
    find_changed_packages,
    NpmPackage,
    PyPiPackage,
    GitHashParamType,
    Version,
    GitHash,
)


class TestGenVersion:
    """Test version generation based on date."""

    def test_gen_version_format(self):
        """Test that generated version follows YYYY.MM.DD format."""
        version = gen_version()
        parts = version.split('.')
        assert len(parts) == 3
        assert len(parts[0]) == 4  # Year
        assert 1 <= int(parts[1]) <= 12  # Month
        assert 1 <= int(parts[2]) <= 31  # Day

    def test_gen_version_current_date(self):
        """Test that generated version matches current date."""
        now = datetime.datetime.now()
        expected = f"{now.year}.{now.month}.{now.day}"
        actual = gen_version()
        assert actual == expected

    @patch('release.datetime')
    def test_gen_version_with_mocked_date(self, mock_datetime):
        """Test version generation with mocked date."""
        mock_now = Mock()
        mock_now.year = 2024
        mock_now.month = 3
        mock_now.day = 15
        mock_datetime.datetime.now.return_value = mock_now
        
        version = gen_version()
        assert version == "2024.3.15"

    @patch('release.datetime')
    def test_gen_version_single_digit_month_and_day(self, mock_datetime):
        """Test version with single-digit month and day."""
        mock_now = Mock()
        mock_now.year = 2024
        mock_now.month = 1
        mock_now.day = 5
        mock_datetime.datetime.now.return_value = mock_now
        
        version = gen_version()
        assert version == "2024.1.5"


class TestGitHashParamType:
    """Test Git hash parameter type validation."""

    def test_valid_full_git_hash(self):
        """Test validation of 40-character git hash."""
        param_type = GitHashParamType()
        
        with patch('subprocess.run') as mock_run:
            mock_run.return_value = Mock(returncode=0)
            result = param_type.convert(
                'a' * 40,
                Mock(),
                Mock()
            )
            assert result == 'a' * 40

    def test_valid_short_git_hash(self):
        """Test validation of 8-character git hash."""
        param_type = GitHashParamType()
        
        with patch('subprocess.run') as mock_run:
            mock_run.return_value = Mock(returncode=0)
            result = param_type.convert(
                'abcd1234',
                Mock(),
                Mock()
            )
            assert result == 'abcd1234'

    def test_invalid_too_short_hash(self):
        """Test rejection of hash shorter than 8 characters."""
        param_type = GitHashParamType()
        
        with pytest.raises(Exception) as exc_info:
            param_type.convert('abc123', Mock(), Mock())
        
        assert "between 8 and 40" in str(exc_info.value)

    def test_invalid_too_long_hash(self):
        """Test rejection of hash longer than 40 characters."""
        param_type = GitHashParamType()
        
        with pytest.raises(Exception) as exc_info:
            param_type.convert('a' * 41, Mock(), Mock())
        
        assert "between 8 and 40" in str(exc_info.value)

    def test_invalid_non_hex_characters(self):
        """Test rejection of non-hexadecimal characters."""
        param_type = GitHashParamType()
        
        with pytest.raises(Exception) as exc_info:
            param_type.convert('gggggggg', Mock(), Mock())
        
        assert "hex digits" in str(exc_info.value)

    def test_nonexistent_git_hash(self):
        """Test rejection of hash that doesn't exist in repo."""
        param_type = GitHashParamType()
        
        with patch('subprocess.run') as mock_run:
            mock_run.side_effect = subprocess.CalledProcessError(1, 'git')
            
            with pytest.raises(Exception) as exc_info:
                param_type.convert('abcd1234', Mock(), Mock())
            
            assert "not found" in str(exc_info.value)

    def test_none_value_returns_none(self):
        """Test that None input returns None."""
        param_type = GitHashParamType()
        result = param_type.convert(None, Mock(), Mock())
        assert result is None

    def test_hash_converted_to_lowercase(self):
        """Test that hash is converted to lowercase."""
        param_type = GitHashParamType()
        
        with patch('subprocess.run') as mock_run:
            mock_run.return_value = Mock(returncode=0)
            result = param_type.convert('ABCD1234', Mock(), Mock())
            assert result == 'abcd1234'


class TestHasChanges:
    """Test detection of changes in directories."""

    @patch('subprocess.run')
    def test_has_changes_with_python_files(self, mock_run):
        """Test detection when Python files changed."""
        mock_run.return_value = Mock(
            stdout='path/to/file.py\npath/to/other.py\n',
            returncode=0
        )
        
        result = has_changes(Path('/test'), GitHash('abc123'))
        assert result is True

    @patch('subprocess.run')
    def test_has_changes_with_typescript_files(self, mock_run):
        """Test detection when TypeScript files changed."""
        mock_run.return_value = Mock(
            stdout='path/to/file.ts\npath/to/other.ts\n',
            returncode=0
        )
        
        result = has_changes(Path('/test'), GitHash('abc123'))
        assert result is True

    @patch('subprocess.run')
    def test_has_changes_with_mixed_files(self, mock_run):
        """Test detection with mix of relevant and irrelevant files."""
        mock_run.return_value = Mock(
            stdout='file.py\nfile.txt\nfile.md\nfile.ts\n',
            returncode=0
        )
        
        result = has_changes(Path('/test'), GitHash('abc123'))
        assert result is True

    @patch('subprocess.run')
    def test_no_changes_with_irrelevant_files(self, mock_run):
        """Test no detection when only irrelevant files changed."""
        mock_run.return_value = Mock(
            stdout='README.md\nCHANGELOG.txt\nimage.png\n',
            returncode=0
        )
        
        result = has_changes(Path('/test'), GitHash('abc123'))
        assert result is False

    @patch('subprocess.run')
    def test_no_changes_with_empty_diff(self, mock_run):
        """Test no detection with empty diff."""
        mock_run.return_value = Mock(stdout='', returncode=0)
        
        result = has_changes(Path('/test'), GitHash('abc123'))
        assert result is False

    @patch('subprocess.run')
    def test_handles_subprocess_error(self, mock_run):
        """Test handling of subprocess errors."""
        mock_run.side_effect = subprocess.CalledProcessError(1, 'git')
        
        result = has_changes(Path('/test'), GitHash('abc123'))
        assert result is False


class TestNpmPackage:
    """Test NPM package operations."""

    def test_npm_package_name(self, tmp_path):
        """Test reading package name from package.json."""
        package_json = tmp_path / 'package.json'
        package_json.write_text(json.dumps({
            'name': '@test/my-package',
            'version': '1.0.0'
        }))
        
        npm_pkg = NpmPackage(tmp_path)
        assert npm_pkg.package_name() == '@test/my-package'

    def test_npm_update_version(self, tmp_path):
        """Test updating version in package.json."""
        package_json = tmp_path / 'package.json'
        package_json.write_text(json.dumps({
            'name': 'my-package',
            'version': '1.0.0'
        }, indent=2))
        
        npm_pkg = NpmPackage(tmp_path)
        npm_pkg.update_version(Version('2024.3.15'))
        
        updated_data = json.loads(package_json.read_text())
        assert updated_data['version'] == '2024.3.15'

    def test_npm_preserves_other_fields(self, tmp_path):
        """Test that updating version preserves other fields."""
        package_json = tmp_path / 'package.json'
        original_data = {
            'name': 'my-package',
            'version': '1.0.0',
            'description': 'Test package',
            'dependencies': {'foo': '1.0.0'}
        }
        package_json.write_text(json.dumps(original_data, indent=2))
        
        npm_pkg = NpmPackage(tmp_path)
        npm_pkg.update_version(Version('2024.3.15'))
        
        updated_data = json.loads(package_json.read_text())
        assert updated_data['name'] == 'my-package'
        assert updated_data['description'] == 'Test package'
        assert updated_data['dependencies'] == {'foo': '1.0.0'}


class TestPyPiPackage:
    """Test PyPI package operations."""

    def test_pypi_package_name(self, tmp_path):
        """Test reading package name from pyproject.toml."""
        pyproject_toml = tmp_path / 'pyproject.toml'
        pyproject_toml.write_text("""
[project]
name = "my-python-package"
version = "1.0.0"
""")
        
        pypi_pkg = PyPiPackage(tmp_path)
        assert pypi_pkg.package_name() == 'my-python-package'

    def test_pypi_update_version(self, tmp_path):
        """Test updating version in pyproject.toml."""
        pyproject_toml = tmp_path / 'pyproject.toml'
        pyproject_toml.write_text("""
[project]
name = "my-python-package"
version = "1.0.0"
description = "A test package"
""")
        
        pypi_pkg = PyPiPackage(tmp_path)
        pypi_pkg.update_version(Version('2024.3.15'))
        
        updated_content = pyproject_toml.read_text()
        assert 'version = "2024.3.15"' in updated_content

    def test_pypi_missing_name_raises_error(self, tmp_path):
        """Test that missing name raises error."""
        pyproject_toml = tmp_path / 'pyproject.toml'
        pyproject_toml.write_text("""
[project]
version = "1.0.0"
""")
        
        pypi_pkg = PyPiPackage(tmp_path)
        with pytest.raises(Exception) as exc_info:
            pypi_pkg.package_name()
        
        assert "No name" in str(exc_info.value)


class TestCLICommands:
    """Test CLI commands."""

    def test_update_packages_command(self, tmp_path):
        """Test update-packages command."""
        # Create a test package
        pkg_dir = tmp_path / 'test-pkg'
        pkg_dir.mkdir()
        package_json = pkg_dir / 'package.json'
        package_json.write_text(json.dumps({
            'name': 'test-package',
            'version': '1.0.0'
        }))
        
        runner = CliRunner()
        
        with patch('release.has_changes', return_value=True):
            with patch('subprocess.run') as mock_run:
                mock_run.return_value = Mock(returncode=0, stdout=b'', stderr=b'')
                
                result = runner.invoke(cli, [
                    'update-packages',
                    '--directory', str(tmp_path),
                    'abc12345'
                ])
        
        assert result.exit_code == 0

    def test_generate_notes_command(self):
        """Test generate-notes command."""
        runner = CliRunner()
        
        with patch('release.find_changed_packages', return_value=[]):
            with patch('subprocess.run') as mock_run:
                mock_run.return_value = Mock(returncode=0, stdout=b'', stderr=b'')
                
                result = runner.invoke(cli, [
                    'generate-notes',
                    'abc12345'
                ])
        
        assert result.exit_code == 0
        assert "Release" in result.output

    def test_generate_version_command(self):
        """Test generate-version command."""
        runner = CliRunner()
        result = runner.invoke(cli, ['generate-version'])
        
        assert result.exit_code == 0
        # Should output version in YYYY.M.D or YYYY.MM.DD format
        assert '.' in result.output
        parts = result.output.strip().split('.')
        assert len(parts) == 3

    def test_generate_matrix_npm_only(self, tmp_path):
        """Test generate-matrix command for NPM packages only."""
        runner = CliRunner()
        
        with patch('release.find_changed_packages') as mock_find:
            npm_pkg = Mock(spec=NpmPackage)
            npm_pkg.path = Path('src/package1')
            mock_find.return_value = [npm_pkg]
            
            with patch('subprocess.run') as mock_run:
                mock_run.return_value = Mock(returncode=0, stdout=b'', stderr=b'')
                
                result = runner.invoke(cli, [
                    'generate-matrix',
                    '--directory', str(tmp_path),
                    '--npm',
                    'abc12345'
                ])
        
        assert result.exit_code == 0
        output_json = json.loads(result.output)
        assert isinstance(output_json, list)

    def test_generate_matrix_pypi_only(self, tmp_path):
        """Test generate-matrix command for PyPI packages only."""
        runner = CliRunner()
        
        with patch('release.find_changed_packages') as mock_find:
            pypi_pkg = Mock(spec=PyPiPackage)
            pypi_pkg.path = Path('src/package1')
            mock_find.return_value = [pypi_pkg]
            
            with patch('subprocess.run') as mock_run:
                mock_run.return_value = Mock(returncode=0, stdout=b'', stderr=b'')
                
                result = runner.invoke(cli, [
                    'generate-matrix',
                    '--directory', str(tmp_path),
                    '--pypi',
                    'abc12345'
                ])
        
        assert result.exit_code == 0
        output_json = json.loads(result.output)
        assert isinstance(output_json, list)

    def test_command_with_invalid_git_hash(self):
        """Test command with invalid git hash."""
        runner = CliRunner()
        result = runner.invoke(cli, [
            'update-packages',
            'invalid'
        ])
        
        # Should fail due to invalid git hash
        assert result.exit_code != 0


class TestFindChangedPackages:
    """Test finding changed packages."""

    def test_find_npm_packages(self, tmp_path):
        """Test finding changed NPM packages."""
        pkg_dir = tmp_path / 'pkg1'
        pkg_dir.mkdir()
        (pkg_dir / 'package.json').write_text(json.dumps({
            'name': 'pkg1',
            'version': '1.0.0'
        }))
        
        with patch('release.has_changes', return_value=True):
            packages = list(find_changed_packages(tmp_path, GitHash('abc123')))
        
        assert len(packages) == 1
        assert isinstance(packages[0], NpmPackage)

    def test_find_pypi_packages(self, tmp_path):
        """Test finding changed PyPI packages."""
        pkg_dir = tmp_path / 'pkg1'
        pkg_dir.mkdir()
        (pkg_dir / 'pyproject.toml').write_text("""
[project]
name = "pkg1"
version = "1.0.0"
""")
        
        with patch('release.has_changes', return_value=True):
            packages = list(find_changed_packages(tmp_path, GitHash('abc123')))
        
        assert len(packages) == 1
        assert isinstance(packages[0], PyPiPackage)

    def test_find_mixed_packages(self, tmp_path):
        """Test finding both NPM and PyPI packages."""
        npm_dir = tmp_path / 'npm-pkg'
        npm_dir.mkdir()
        (npm_dir / 'package.json').write_text(json.dumps({
            'name': 'npm-pkg',
            'version': '1.0.0'
        }))
        
        pypi_dir = tmp_path / 'pypi-pkg'
        pypi_dir.mkdir()
        (pypi_dir / 'pyproject.toml').write_text("""
[project]
name = "pypi-pkg"
version = "1.0.0"
""")
        
        with patch('release.has_changes', return_value=True):
            packages = list(find_changed_packages(tmp_path, GitHash('abc123')))
        
        assert len(packages) == 2

    def test_skip_unchanged_packages(self, tmp_path):
        """Test that unchanged packages are skipped."""
        pkg_dir = tmp_path / 'pkg1'
        pkg_dir.mkdir()
        (pkg_dir / 'package.json').write_text(json.dumps({
            'name': 'pkg1',
            'version': '1.0.0'
        }))
        
        with patch('release.has_changes', return_value=False):
            packages = list(find_changed_packages(tmp_path, GitHash('abc123')))
        
        assert len(packages) == 0


class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_npm_package_with_malformed_json(self, tmp_path):
        """Test handling of malformed package.json."""
        package_json = tmp_path / 'package.json'
        package_json.write_text('{ invalid json }')
        
        npm_pkg = NpmPackage(tmp_path)
        with pytest.raises(json.JSONDecodeError):
            npm_pkg.package_name()

    def test_pypi_package_with_malformed_toml(self, tmp_path):
        """Test handling of malformed pyproject.toml."""
        pyproject_toml = tmp_path / 'pyproject.toml'
        pyproject_toml.write_text('[invalid toml')
        
        pypi_pkg = PyPiPackage(tmp_path)
        with pytest.raises(ValueError):
            pypi_pkg.package_name()

    def test_version_type_is_string(self):
        """Test that Version is a string type."""
        v = Version("2024.3.15")
        assert isinstance(v, str)

    def test_git_hash_type_is_string(self):
        """Test that GitHash is a string type."""
        h = GitHash("abc12345")
        assert isinstance(h, str)