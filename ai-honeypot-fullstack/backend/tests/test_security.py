"""
Automated Security Tests
Tests for security validation functions
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routers.telemetry import (
    _validate_terminal_command,
    _validate_sql_query,
    _normalize_sql_query,
    MAX_COMMAND_LENGTH,
    MAX_ARGS_COUNT,
    MAX_ARG_LENGTH,
    MAX_SQL_QUERY_LENGTH,
)


def test_command_validation_empty():
    """Test validation of empty commands"""
    is_valid, msg = _validate_terminal_command("")
    assert not is_valid, "Empty command should be invalid"
    assert "Empty" in msg, "Error message should mention empty"
    print("✅ test_command_validation_empty PASSED")


def test_command_validation_too_long():
    """Test validation of oversized commands (buffer overflow protection)"""
    long_cmd = "a" * (MAX_COMMAND_LENGTH + 1)
    is_valid, msg = _validate_terminal_command(long_cmd)
    assert not is_valid, "Command exceeding max length should be invalid"
    assert "too long" in msg.lower(), "Error should mention length"
    print("✅ test_command_validation_too_long PASSED")


def test_command_validation_too_many_args():
    """Test validation of commands with too many arguments"""
    many_args = " ".join(["arg"] * (MAX_ARGS_COUNT + 1))
    is_valid, msg = _validate_terminal_command(many_args)
    assert not is_valid, "Command with too many args should be invalid"
    assert "Too many arguments" in msg, "Error should mention argument count"
    print("✅ test_command_validation_too_many_args PASSED")


def test_command_validation_arg_too_long():
    """Test validation of commands with oversized arguments"""
    long_arg = "cmd " + ("a" * (MAX_ARG_LENGTH + 1))
    is_valid, msg = _validate_terminal_command(long_arg)
    assert not is_valid, "Command with long arg should be invalid"
    assert "Argument too long" in msg, "Error should mention argument length"
    print("✅ test_command_validation_arg_too_long PASSED")


def test_command_validation_valid():
    """Test that valid commands pass validation"""
    valid_cmds = [
        "ls -la",
        "pwd",
        "whoami",
        "cat /etc/passwd",
        "echo hello world",
        "find . -name '*.txt'",
    ]
    for cmd in valid_cmds:
        is_valid, msg = _validate_terminal_command(cmd)
        assert is_valid, f"Command '{cmd}' should be valid but got: {msg}"
    print("✅ test_command_validation_valid PASSED")


def test_sql_validation_empty():
    """Test validation of empty SQL queries"""
    is_valid, msg = _validate_sql_query("")
    assert not is_valid, "Empty SQL should be invalid"
    assert "Empty" in msg, "Error should mention empty"
    print("✅ test_sql_validation_empty PASSED")


def test_sql_validation_too_long():
    """Test validation of oversized SQL queries"""
    long_query = "SELECT " + "a" * (MAX_SQL_QUERY_LENGTH + 1)
    is_valid, msg = _validate_sql_query(long_query)
    assert not is_valid, "Long SQL should be invalid"
    assert "too long" in msg.lower(), "Error should mention length"
    print("✅ test_sql_validation_too_long PASSED")


def test_sql_injection_detection_drop():
    """Test detection of DROP TABLE SQL injection"""
    malicious = "DROP TABLE users"
    is_valid, msg = _validate_sql_query(malicious)
    assert not is_valid, "DROP statement should be blocked"
    print("✅ test_sql_injection_detection_drop PASSED")


def test_sql_injection_detection_union():
    """Test detection of UNION SELECT SQL injection"""
    malicious = "SELECT * FROM users UNION SELECT * FROM passwords"
    is_valid, msg = _validate_sql_query(malicious)
    assert not is_valid, "UNION SELECT should be blocked"
    print("✅ test_sql_injection_detection_union PASSED")


def test_sql_injection_detection_sleep():
    """Test detection of time-based SQL injection (SLEEP)"""
    malicious = "SELECT SLEEP(10)"
    is_valid, msg = _validate_sql_query(malicious)
    assert not is_valid, "SLEEP function should be blocked"
    print("✅ test_sql_injection_detection_sleep PASSED")


def test_sql_injection_detection_benchmark():
    """Test detection of benchmark-based SQL injection"""
    malicious = "SELECT BENCHMARK(1000000, MD5('test'))"
    is_valid, msg = _validate_sql_query(malicious)
    assert not is_valid, "BENCHMARK should be blocked"
    print("✅ test_sql_injection_detection_benchmark PASSED")


def test_sql_injection_detection_outfile():
    """Test detection of outfile SQL injection"""
    malicious = "SELECT * INTO OUTFILE '/tmp/test.txt'"
    is_valid, msg = _validate_sql_query(malicious)
    assert not is_valid, "INTO OUTFILE should be blocked"
    print("✅ test_sql_injection_detection_outfile PASSED")


def test_sql_normalization_unicode():
    """Test Unicode normalization for SQL bypass prevention"""
    # Unicode homoglyph attack attempt
    malicious_unicode = "DR\u043EP TABLE users"  # Cyrillic 'о' instead of Latin 'o'
    normalized = _normalize_sql_query(malicious_unicode)
    # Should normalize to ASCII or empty
    assert normalized != malicious_unicode, "Unicode should be normalized"
    print("✅ test_sql_normalization_unicode PASSED")


def test_sql_validation_valid():
    """Test that valid SQL queries pass validation"""
    valid_queries = [
        "SELECT * FROM users",
        "SELECT id, name FROM products WHERE active = 1",
        "SELECT COUNT(*) FROM orders",
        "SHOW TABLES",
        "DESCRIBE users",
    ]
    for query in valid_queries:
        is_valid, msg = _validate_sql_query(query)
        assert is_valid, f"Query '{query[:30]}...' should be valid but got: {msg}"
    print("✅ test_sql_validation_valid PASSED")


def run_all_tests():
    """Run all security tests"""
    print("\n" + "="*60)
    print("SECURITY TEST SUITE")
    print("="*60 + "\n")
    
    tests = [
        test_command_validation_empty,
        test_command_validation_too_long,
        test_command_validation_too_many_args,
        test_command_validation_arg_too_long,
        test_command_validation_valid,
        test_sql_validation_empty,
        test_sql_validation_too_long,
        test_sql_injection_detection_drop,
        test_sql_injection_detection_union,
        test_sql_injection_detection_sleep,
        test_sql_injection_detection_benchmark,
        test_sql_injection_detection_outfile,
        test_sql_normalization_unicode,
        test_sql_validation_valid,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            test()
            passed += 1
        except AssertionError as e:
            print(f"❌ {test.__name__} FAILED: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ {test.__name__} ERROR: {e}")
            failed += 1
    
    print("\n" + "="*60)
    print(f"RESULTS: {passed} PASSED, {failed} FAILED")
    print("="*60 + "\n")
    
    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
