import json
import math
import re
from typing import Any


MAX_CAPTURED_DATA_DEPTH = 4
MAX_CAPTURED_DATA_ITEMS = 24
MAX_CAPTURED_DATA_STRING_LENGTH = 600


def clean_event_text(value: Any, *, max_len: int, collapse_spaces: bool = False) -> str:
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]+", "", str(value or ""))
    if collapse_spaces:
        text = re.sub(r"\s+", " ", text)
    text = text.strip()
    return text[:max_len] if text else ""


def _sanitize_value(value: Any, *, depth: int) -> Any:
    if depth >= MAX_CAPTURED_DATA_DEPTH:
        return "[truncated-depth]"
    if value is None or isinstance(value, (bool, int)):
        return value
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, str):
        return clean_event_text(value, max_len=MAX_CAPTURED_DATA_STRING_LENGTH)
    if isinstance(value, bytes):
        return clean_event_text(
            value.decode("utf-8", errors="replace"),
            max_len=MAX_CAPTURED_DATA_STRING_LENGTH,
        )
    if isinstance(value, dict):
        result: dict[str, Any] = {}
        items = list(value.items())
        for raw_key, raw_value in items[:MAX_CAPTURED_DATA_ITEMS]:
            key = clean_event_text(raw_key, max_len=80, collapse_spaces=True)
            if not key or key in result:
                continue
            result[key] = _sanitize_value(raw_value, depth=depth + 1)
        if len(items) > MAX_CAPTURED_DATA_ITEMS:
            result["__truncated_items__"] = len(items) - MAX_CAPTURED_DATA_ITEMS
        return result
    if isinstance(value, (list, tuple, set)):
        items = list(value)
        result = {
            "items": [_sanitize_value(item, depth=depth + 1) for item in items[:MAX_CAPTURED_DATA_ITEMS]]
        }
        if len(items) > MAX_CAPTURED_DATA_ITEMS:
            result["truncated_items"] = len(items) - MAX_CAPTURED_DATA_ITEMS
        return result
    try:
        serialized = json.dumps(value, default=str)
    except TypeError:
        serialized = str(value)
    return clean_event_text(serialized, max_len=MAX_CAPTURED_DATA_STRING_LENGTH)


def sanitize_captured_data(value: Any) -> dict[str, Any]:
    sanitized = _sanitize_value(value, depth=0)
    if isinstance(sanitized, dict):
        return sanitized
    return {"value": sanitized}
