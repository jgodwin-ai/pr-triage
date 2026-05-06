from unittest.mock import patch, MagicMock
from src.services.repo import clone_repo, cleanup_repo


def test_clone_repo_creates_directory(tmp_path):
    with patch("src.services.repo.Repo") as MockRepo:
        MockRepo.clone_from.return_value = MagicMock()
        result = clone_repo(
            "https://github.com/octocat/hello-world.git",
            "main",
            base_dir=str(tmp_path),
        )
        assert result.startswith(str(tmp_path))
        MockRepo.clone_from.assert_called_once()
        call_kwargs = MockRepo.clone_from.call_args
        assert call_kwargs[1]["depth"] == 1
        assert call_kwargs[1]["branch"] == "main"


def test_clone_repo_uses_unique_subdir(tmp_path):
    with patch("src.services.repo.Repo") as MockRepo:
        MockRepo.clone_from.return_value = MagicMock()
        a = clone_repo(
            "https://github.com/octocat/hello-world.git",
            "main",
            base_dir=str(tmp_path),
        )
        b = clone_repo(
            "https://github.com/octocat/hello-world.git",
            "main",
            base_dir=str(tmp_path),
        )
        assert a != b, "clone_repo should produce unique subdirs per call"


def test_cleanup_repo_removes_directory(tmp_path):
    repo_dir = tmp_path / "test-repo"
    repo_dir.mkdir()
    (repo_dir / "file.txt").write_text("content")

    cleanup_repo(str(repo_dir))
    assert not repo_dir.exists()


def test_cleanup_repo_ignores_nonexistent_directory():
    # Should not raise
    cleanup_repo("/nonexistent/path/that/does/not/exist")
