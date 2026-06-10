"""Security tests for compiler-service project file handling.

Verifies the core hardening: the client can only submit L4-L5 application
sources, never build-system files that could carry build-time code execution.
"""
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import server  # noqa: E402


def _fresh_build_dir():
    d = Path(tempfile.mkdtemp(prefix="vb-sec-test-"))
    (d / "main").mkdir()
    # Simulate a template-provided system file that must survive untouched.
    (d / "CMakeLists.txt").write_text("# trusted template root cmake\n")
    return d


def test_client_cmakelists_is_ignored():
    """A client-supplied CMakeLists.txt must NOT overwrite the template's."""
    build_dir = _fresh_build_dir()
    trusted = (build_dir / "CMakeLists.txt").read_text()
    server.sync_project_files(
        build_dir,
        "void app_main(void){}",
        {
            "__mainFile": "main.c",
            "main/CMakeLists.txt": "idf_component_register()",
            # The dangerous one: a root build file carrying executable logic.
            "CMakeLists.txt": "execute_process(COMMAND rm -rf /)",
        },
    )
    assert (build_dir / "CMakeLists.txt").read_text() == trusted, \
        "template root CMakeLists.txt was overwritten by client input"


def test_client_sdkconfig_rejected():
    build_dir = _fresh_build_dir()
    server.sync_project_files(
        build_dir,
        "void app_main(void){}",
        {"__mainFile": "main.c", "sdkconfig.defaults": "CONFIG_EVIL=y"},
    )
    assert not (build_dir / "sdkconfig.defaults").exists(), \
        "client sdkconfig.defaults should have been ignored"


def test_path_traversal_rejected():
    build_dir = _fresh_build_dir()
    raised = False
    try:
        server.validate_project_path(build_dir, "../../etc/passwd")
    except ValueError:
        raised = True
    assert raised, "path traversal was not rejected"


def test_top_level_source_rejected():
    """A bare top-level file (not under main/components/spiffs) is rejected."""
    build_dir = _fresh_build_dir()
    raised = False
    try:
        server.validate_project_path(build_dir, "rogue.c")
    except ValueError:
        raised = True
    assert raised, "top-level source file should be rejected"


def test_legitimate_main_source_written():
    build_dir = _fresh_build_dir()
    server.sync_project_files(
        build_dir,
        "void app_main(void){}",
        {"__mainFile": "main.c", "main/app_ui.c": "void app_ui_create(void){}"},
    )
    assert (build_dir / "main" / "main.c").exists()
    assert (build_dir / "main" / "app_ui.c").exists()
    assert "app_main" in (build_dir / "main" / "main.c").read_text()


def test_system_file_raises_specific_signal():
    build_dir = _fresh_build_dir()
    raised = False
    try:
        server.validate_project_path(build_dir, "partitions.csv")
    except server.SystemFileRejected:
        raised = True
    assert raised, "system-managed file should raise SystemFileRejected"


TESTS = [
    ("client CMakeLists.txt ignored", test_client_cmakelists_is_ignored),
    ("client sdkconfig rejected", test_client_sdkconfig_rejected),
    ("path traversal rejected", test_path_traversal_rejected),
    ("top-level source rejected", test_top_level_source_rejected),
    ("legitimate main source written", test_legitimate_main_source_written),
    ("system file raises specific signal", test_system_file_raises_specific_signal),
]


def main():
    failed = 0
    for name, fn in TESTS:
        try:
            fn()
            print(f"  ok - {name}")
        except AssertionError as exc:
            failed += 1
            print(f"  FAIL - {name}: {exc}")
        except Exception as exc:  # noqa: BLE001
            failed += 1
            print(f"  ERROR - {name}: {type(exc).__name__}: {exc}")
    if failed:
        print(f"compiler security tests FAILED ({failed})")
        sys.exit(1)
    print("compiler security tests passed")


if __name__ == "__main__":
    main()
