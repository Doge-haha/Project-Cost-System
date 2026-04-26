from __future__ import annotations

import json
import sys
from pathlib import Path

if __package__ in {None, ""}:
    sys.path.append(str(Path(__file__).resolve().parents[1]))
    from app.runtime_service import process_event_batch
else:
    from .runtime_service import process_event_batch


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError as error:
        sys.stderr.write(f"invalid json: {error.msg}\n")
        return 1

    try:
        result = process_event_batch(payload)
    except ValueError as error:
        sys.stderr.write(f"{error}\n")
        return 1

    json.dump(result, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
