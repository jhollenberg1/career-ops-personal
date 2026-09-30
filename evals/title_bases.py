"""Approved title-based starting scores for the role-evaluation rubric.

`title-bases.json` is the single source of truth, shared with the scanner's
route step (`scanner/rubric.mjs`). Edit the JSON, not this module.
"""
import json
import os

with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "title-bases.json"), encoding="utf-8") as handle:
    # An entry is a number or {"base": n, "aliases": [...]}; aliases only matter to
    # the scanner, which maps posting titles onto these approved names.
    TITLE_BASES = {name: value if isinstance(value, (int, float)) else value["base"] for name, value in json.load(handle).items()}


def title_base_for(role):
    try:
        return TITLE_BASES[role]
    except KeyError as exc:
        raise ValueError(f"No approved title base for {role!r}") from exc
