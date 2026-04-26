from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


def _cli_path() -> Path:
    return Path(__file__).resolve().parents[1] / "app" / "cli.py"


def test_cli_returns_structured_json_for_valid_payload() -> None:
    completed = subprocess.run(
        [sys.executable, str(_cli_path())],
        input=json.dumps(
            {
                "source": "audit_log",
                "events": [
                    {
                        "projectId": "project-001",
                        "resourceType": "review_submission",
                        "action": "approve",
                        "operatorId": "reviewer-001",
                        "afterPayload": {
                            "comment": "Evidence confirmed",
                        },
                    }
                ],
            }
        ),
        text=True,
        capture_output=True,
        check=False,
    )

    assert completed.returncode == 0
    payload = json.loads(completed.stdout)
    assert payload["source"] == "audit_log"
    assert payload["result"]["summary"]["knowledgeCount"] == 1


def test_cli_returns_error_for_invalid_json() -> None:
    completed = subprocess.run(
        [sys.executable, str(_cli_path())],
        input="{bad-json",
        text=True,
        capture_output=True,
        check=False,
    )

    assert completed.returncode == 1
    assert "invalid json" in completed.stderr
