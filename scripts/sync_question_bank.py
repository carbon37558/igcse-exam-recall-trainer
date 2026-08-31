#!/usr/bin/env python3
"""Convert the maintained Excel question bank into app-ready JSON."""

import json
import re
import zipfile
from pathlib import Path
from typing import Optional
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "question-bank.xlsx"
OUTPUT = ROOT / "app" / "data" / "question-bank.json"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL_NS = {"r": "http://schemas.openxmlformats.org/package/2006/relationships"}
RELATIONSHIP_ID = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
SUBSCRIPT = str.maketrans("0123456789+-", "₀₁₂₃₄₅₆₇₈₉₊₋")
SUPERSCRIPT = str.maketrans("0123456789+-", "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻")
SUBSCRIPT.update(str.maketrans("aehijklmnoprstuvx", "ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ"))


def scripted_text(text: str, script: Optional[str]) -> str:
    if script == "subscript":
        return text.translate(SUBSCRIPT)
    if script == "superscript":
        return text.translate(SUPERSCRIPT)
    return text


def rich_text(element: ET.Element) -> str:
    runs = element.findall("m:r", NS)
    if not runs:
        return "".join(node.text or "" for node in element.iterfind(".//m:t", NS))

    parts = []
    for run in runs:
        alignment = run.find("m:rPr/m:vertAlign", NS)
        script = alignment.attrib.get("val") if alignment is not None else None
        text = "".join(node.text or "" for node in run.iterfind("m:t", NS))
        parts.append(scripted_text(text, script))
    return "".join(parts)


def convert_script_markup(text: str) -> str:
    """Convert explicit plain-text notation such as H_2O and SO_4^2-."""

    def replace(match: re.Match[str]) -> str:
        value = match.group(2) or match.group(3)
        table = SUBSCRIPT if match.group(1) == "_" else SUPERSCRIPT
        converted = value.translate(table)
        return converted if all(character in "0123456789+-" for character in value) else match.group(0)

    return re.sub(r"([_^])(?:\{([^{}]+)\}|([0-9+-]+))", replace, text)


def column_index(reference: str) -> int:
    letters = re.match(r"[A-Z]+", reference).group(0)
    value = 0
    for letter in letters:
        value = value * 26 + ord(letter) - 64
    return value - 1


def worksheet_paths(archive: zipfile.ZipFile) -> list[tuple[str, str]]:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    targets = {
        relation.attrib["Id"]: relation.attrib["Target"]
        for relation in relationships.findall("r:Relationship", REL_NS)
        if relation.attrib.get("Type", "").endswith("/worksheet")
    }
    sheets = []
    for sheet in workbook.findall("m:sheets/m:sheet", NS):
        target = targets.get(sheet.attrib[RELATIONSHIP_ID])
        if target:
            sheets.append((sheet.attrib["name"], f"xl/{target.lstrip('/')}"))
    return sheets


def load_sheets(path: Path) -> list[tuple[str, list[list[object]]]]:
    with zipfile.ZipFile(path) as archive:
        shared = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall("m:si", NS):
                shared.append(rich_text(item))

        sheets = []
        for name, sheet_path in worksheet_paths(archive):
            sheet = ET.fromstring(archive.read(sheet_path))
            rows = []
            for row in sheet.findall(".//m:sheetData/m:row", NS):
                values: list[object] = []
                for cell in row.findall("m:c", NS):
                    index = column_index(cell.attrib["r"])
                    while len(values) <= index:
                        values.append(None)
                    kind = cell.attrib.get("t")
                    value_node = cell.find("m:v", NS)
                    if kind == "inlineStr":
                        values[index] = rich_text(cell.find("m:is", NS))
                    elif value_node is not None:
                        raw = value_node.text or ""
                        values[index] = shared[int(raw)] if kind == "s" else raw
                rows.append(values)
            sheets.append((name, rows))
        return sheets


def build_question_bank(path: Path) -> list[dict[str, object]]:
    required = {"id", "paper", "topic", "question", "needs_review"}
    questions = []
    for course_id, rows in load_sheets(path):
        if not rows:
            continue
        headers = [str(value or "").strip() for value in rows[0]]
        if not required.issubset(headers):
            raise SystemExit(f"{course_id}: Missing required columns: {sorted(required - set(headers))}")
        answer_columns = [header for header in headers if re.fullmatch(r"answer_\d+", header)]
        for values in rows[1:]:
            values += [None] * (len(headers) - len(values))
            record = dict(zip(headers, values))
            if not any(str(value or "").strip() for value in record.values()):
                continue
            question = {
                "course_id": course_id,
                "id": str(record["id"] or "").strip(),
                "paper": str(record["paper"] or "").strip(),
                "topic": str(record["topic"] or "").strip(),
                "question": convert_script_markup(str(record["question"] or "").strip()),
                "answers": [convert_script_markup(str(record[column]).strip()) for column in answer_columns if record.get(column)],
            }
            if not question["id"] or not question["paper"] or not question["topic"] or not question["question"] or not question["answers"]:
                raise SystemExit(f"{course_id}: Incomplete question row: {question['id'] or '(missing id)'}")
            questions.append(question)
    if len({question["id"] for question in questions}) != len(questions):
        raise SystemExit("Question IDs must be unique across all courses")
    return questions


if __name__ == "__main__":
    questions = build_question_bank(SOURCE)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(questions, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    totals = {}
    for question in questions:
        totals[question["course_id"]] = totals.get(question["course_id"], 0) + 1
    print(f"Synced {len(questions)} questions from {SOURCE.name}: {totals}")
