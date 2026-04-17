from pathlib import Path
import importlib.util


def test_ai_runtime_entrypoint_exists() -> None:
    module_path = Path(__file__).resolve().parents[1] / "app" / "main.py"
    assert module_path.exists()
    spec = importlib.util.spec_from_file_location("ai_runtime_main", module_path)
    assert spec is not None
    assert spec.loader is not None
