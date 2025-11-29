"""Tests for dotfiles_kaizen.main module."""

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from dotfiles_kaizen.main import (
    DotfilesKaizen,
    ResearchOutput,
    SearchResult,
    get_domain_config,
    load_config,
)


@pytest.fixture
def sample_config() -> dict:
    """Sample configuration for testing."""
    return {
        "version": "1.0",
        "domains": [
            {
                "id": "test-domain",
                "name": "Test Domain",
                "description": "Test description",
                "day_of_week": 1,
                "target_files": ["**/*.md"],
                "search_hints": {
                    "primary_keywords": ["test", "keyword"],
                    "focus_areas": ["area1", "area2"],
                    "exclude_terms": ["exclude"],
                },
                "analysis_context": {
                    "current_version": "1.0",
                    "priority_aspects": ["aspect1", "aspect2"],
                },
            }
        ],
        "global_settings": {
            "max_search_results": 5,
            "analysis_temperature": 0.3,
            "issue_labels": ["test-label"],
        },
    }


@pytest.fixture
def config_file(tmp_path: Path, sample_config: dict) -> Path:
    """Create a temporary config file."""
    config_path = tmp_path / "config.json"
    config_path.write_text(json.dumps(sample_config))
    return config_path


class TestLoadConfig:
    """Tests for load_config function."""

    def test_load_valid_config(self, config_file: Path, sample_config: dict):
        """Test loading a valid configuration file."""
        result = load_config(str(config_file))
        assert result == sample_config

    def test_load_nonexistent_file(self):
        """Test loading a non-existent file raises error."""
        with pytest.raises(FileNotFoundError):
            load_config("/nonexistent/path/config.json")


class TestGetDomainConfig:
    """Tests for get_domain_config function."""

    def test_get_existing_domain(self, sample_config: dict):
        """Test getting an existing domain configuration."""
        result = get_domain_config(sample_config, "test-domain")
        assert result is not None
        assert result["id"] == "test-domain"
        assert result["name"] == "Test Domain"

    def test_get_nonexistent_domain(self, sample_config: dict):
        """Test getting a non-existent domain returns None."""
        result = get_domain_config(sample_config, "nonexistent")
        assert result is None


class TestDotfilesKaizen:
    """Tests for DotfilesKaizen class."""

    def test_read_target_files(self, tmp_path: Path, sample_config: dict):
        """Test reading target files."""
        # Create test files
        (tmp_path / "test.md").write_text("# Test content")
        (tmp_path / "other.md").write_text("# Other content")

        with (
            patch.dict(
                "os.environ",
                {"TAVILY_API_KEY": "test", "ANTHROPIC_API_KEY": "test", "GITHUB_TOKEN": "test", "GITHUB_REPOSITORY": "test/repo"},
            ),
        ):
            kaizen = DotfilesKaizen(sample_config, content_base=tmp_path)
            result = kaizen.read_target_files(["*.md"], base_path=tmp_path)

        assert "# Test content" in result
        assert "# Other content" in result

    def test_read_target_files_no_match(self, tmp_path: Path, sample_config: dict):
        """Test reading target files with no matches."""
        with (
            patch.dict(
                "os.environ",
                {"TAVILY_API_KEY": "test", "ANTHROPIC_API_KEY": "test", "GITHUB_TOKEN": "test", "GITHUB_REPOSITORY": "test/repo"},
            ),
        ):
            kaizen = DotfilesKaizen(sample_config, content_base=tmp_path)
            result = kaizen.read_target_files(["*.nonexistent"], base_path=tmp_path)

        assert result == "No matching files found."

    def test_format_sources(self, sample_config: dict):
        """Test formatting sources for prompt."""
        sources = [
            SearchResult(
                title="Source 1",
                url="https://example.com/1",
                content="Content 1" * 50,
                score=0.9,
            ),
            SearchResult(
                title="Source 2",
                url="https://example.com/2",
                content="Short",
                score=0.8,
            ),
        ]

        with (
            patch.dict(
                "os.environ",
                {"TAVILY_API_KEY": "test", "ANTHROPIC_API_KEY": "test", "GITHUB_TOKEN": "test", "GITHUB_REPOSITORY": "test/repo"},
            ),
        ):
            kaizen = DotfilesKaizen(sample_config)
            result = kaizen._format_sources(sources)

        assert "Source 1" in result
        assert "Source 2" in result
        assert "..." in result  # Long content should be truncated

    def test_format_sources_list(self, sample_config: dict):
        """Test formatting sources for issue body."""
        sources = [
            SearchResult(
                title="Source 1",
                url="https://example.com/1",
                content="Content 1",
                score=0.9,
            ),
        ]

        with (
            patch.dict(
                "os.environ",
                {"TAVILY_API_KEY": "test", "ANTHROPIC_API_KEY": "test", "GITHUB_TOKEN": "test", "GITHUB_REPOSITORY": "test/repo"},
            ),
        ):
            kaizen = DotfilesKaizen(sample_config)
            result = kaizen._format_sources_list(sources)

        assert "[Source 1](https://example.com/1)" in result

    def test_extract_section(self, sample_config: dict):
        """Test extracting a section from markdown."""
        text = """
## Gap Analysis
This is the gap analysis content.

## Recommendations
These are recommendations.
"""
        with (
            patch.dict(
                "os.environ",
                {"TAVILY_API_KEY": "test", "ANTHROPIC_API_KEY": "test", "GITHUB_TOKEN": "test", "GITHUB_REPOSITORY": "test/repo"},
            ),
        ):
            kaizen = DotfilesKaizen(sample_config)
            result = kaizen._extract_section(text, "Gap Analysis")

        assert "This is the gap analysis content." in result
        assert "Recommendations" not in result

    def test_extract_section_not_found(self, sample_config: dict):
        """Test extracting a non-existent section."""
        text = "## Other Section\nContent"

        with (
            patch.dict(
                "os.environ",
                {"TAVILY_API_KEY": "test", "ANTHROPIC_API_KEY": "test", "GITHUB_TOKEN": "test", "GITHUB_REPOSITORY": "test/repo"},
            ),
        ):
            kaizen = DotfilesKaizen(sample_config)
            result = kaizen._extract_section(text, "Gap Analysis")

        assert result == ""