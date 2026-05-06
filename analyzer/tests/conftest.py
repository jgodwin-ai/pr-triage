import pytest


@pytest.fixture
def sample_python_file(tmp_path):
    code = '''
import os
from pathlib import Path

class FileManager:
    def __init__(self, base_dir: str):
        self.base_dir = base_dir

    def read_file(self, name: str) -> str:
        path = Path(self.base_dir) / name
        return path.read_text()

    def write_file(self, name: str, content: str) -> None:
        path = Path(self.base_dir) / name
        path.write_text(content)

def helper_function(x: int) -> int:
    return x * 2
'''
    file_path = tmp_path / "file_manager.py"
    file_path.write_text(code)
    return str(file_path)


@pytest.fixture
def sample_typescript_file(tmp_path):
    code = '''
import { Router } from "express";
import { parsePrUrl } from "../services/github";

const router = Router();

export function handleAnalyze(req: Request, res: Response): void {
    const url = parsePrUrl(req.body.prUrl);
    res.json({ ok: true });
}

export class AnalyzerService {
    constructor(private client: ApiClient) {}

    async analyze(url: string): Promise<Result> {
        return this.client.post("/analyze", { url });
    }
}
'''
    file_path = tmp_path / "analyze.ts"
    file_path.write_text(code)
    return str(file_path)
