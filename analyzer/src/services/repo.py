import os
import shutil
import uuid
from git import Repo


def clone_repo(
    repo_url: str,
    branch: str,
    base_dir: str = "/tmp/pr-triage",
) -> str:
    repo_id = uuid.uuid4().hex[:12]
    clone_dir = os.path.join(base_dir, repo_id)
    os.makedirs(clone_dir, exist_ok=True)

    Repo.clone_from(
        repo_url,
        clone_dir,
        depth=1,
        branch=branch,
        single_branch=True,
    )

    return clone_dir


def cleanup_repo(repo_dir: str) -> None:
    if os.path.exists(repo_dir):
        shutil.rmtree(repo_dir)
