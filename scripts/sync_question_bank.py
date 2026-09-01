#!/usr/bin/env python3
"""Convert the maintained Excel question bank into app-ready JSON."""

import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "question-bank.xlsx"
OUTPUT = ROOT / "app" / "data" / "question-bank.json"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL_NS = {"r": "http://schemas.openxmlformats.org/package/2006/relationships"}
RELATIONSHIP_ID = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
SCRIPT_NAMES = {"subscript": "sub", "superscript": "sup"}


def merge_segments(segments: list[dict[str, str]]) -> list[dict[str, str]]:
    merged = []
    for segment in segments:
        if not segment["text"]:
            continue
        if merged and merged[-1].get("script") == segment.get("script"):
            merged[-1]["text"] += segment["text"]
        else:
            merged.append(segment)
    return merged


def rich_text(element: ET.Element) -> object:
    runs = element.findall("m:r", NS)
    if not runs:
        return "".join(node.text or "" for node in element.iterfind(".//m:t", NS))

    segments = []
    for run in runs:
        alignment = run.find("m:rPr/m:vertAlign", NS)
        script = SCRIPT_NAMES.get(alignment.attrib.get("val")) if alignment is not None else None
        text = "".join(node.text or "" for node in run.iterfind("m:t", NS))
        segment = {"text": text}
        if script:
            segment["script"] = script
        segments.append(segment)
    segments = merge_segments(segments)
    plain_text = "".join(segment["text"] for segment in segments)
    if not any(segment.get("script") for segment in segments):
        return plain_text
    return {"text": plain_text, "segments": segments}


def convert_script_markup(text: str) -> object:
    """Preserve explicit plain-text notation such as H_2O and SO_4^2-."""

    pattern = re.compile(r"([_^])(?:\{([^{}]+)\}|([0-9+-]+))")
    segments = []
    position = 0
    for match in pattern.finditer(text):
        if match.start() > position:
            segments.append({"text": text[position:match.start()]})
        segments.append({
            "text": match.group(2) or match.group(3),
            "script": "sub" if match.group(1) == "_" else "sup",
        })
        position = match.end()
    if not segments:
        return text
    if position < len(text):
        segments.append({"text": text[position:]})
    segments = merge_segments(segments)
    return {"text": "".join(segment["text"] for segment in segments), "segments": segments}


def plain_text(value: object) -> str:
    if isinstance(value, dict):
        return str(value["text"])
    return str(value or "")


def display_text(value: object) -> object:
    if isinstance(value, dict):
        segments = [dict(segment) for segment in value["segments"]]
        if segments:
            segments[0]["text"] = segments[0]["text"].lstrip()
            segments[-1]["text"] = segments[-1]["text"].rstrip()
        segments = merge_segments(segments)
        return {"text": "".join(segment["text"] for segment in segments), "segments": segments}
    return convert_script_markup(str(value or "").strip())


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
        headers = [plain_text(value).strip() for value in rows[0]]
        if not required.issubset(headers):
            raise SystemExit(f"{course_id}: Missing required columns: {sorted(required - set(headers))}")
        answer_columns = [header for header in headers if re.fullmatch(r"answer_\d+", header)]
        for values in rows[1:]:
            values += [None] * (len(headers) - len(values))
            record = dict(zip(headers, values))
            if not any(plain_text(value).strip() for value in record.values()):
                continue
            question = {
                "course_id": course_id,
                "id": plain_text(record["id"]).strip(),
                "paper": plain_text(record["paper"]).strip(),
                "topic": plain_text(record["topic"]).strip(),
                "question": display_text(record["question"]),
                "answers": [display_text(record[column]) for column in answer_columns if plain_text(record.get(column)).strip()],
            }
            if not question["id"] or not question["paper"] or not question["topic"] or not plain_text(question["question"]) or not question["answers"]:
                raise SystemExit(f"{course_id}: Incomplete question row: {question['id'] or '(missing id)'}")
            questions.append(question)
    if len({question["id"] for question in questions}) != len(questions):
        raise SystemExit("Question IDs must be unique across all courses")
    return questions


def audit_rich_text(path: Path) -> list[dict[str, object]]:
    audit = []
    for course_id, rows in load_sheets(path):
        if not rows:
            continue
        headers = [plain_text(value).strip() for value in rows[0]]
        for row_number, values in enumerate(rows[1:], start=2):
            values += [None] * (len(headers) - len(values))
            record = dict(zip(headers, values))
            question_id = plain_text(record.get("id")).strip()
            for field, value in record.items():
                if isinstance(value, dict):
                    scripted = [segment for segment in value["segments"] if segment.get("script")]
                    if scripted:
                        audit.append({
                            "course_id": course_id,
                            "row": row_number,
                            "id": question_id,
                            "field": field,
                            "text": value["text"],
                            "scripted_segments": scripted,
                        })
    return audit


if __name__ == "__main__":
    questions = build_question_bank(SOURCE)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(questions, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    totals = {}
    for question in questions:
        totals[question["course_id"]] = totals.get(question["course_id"], 0) + 1
    print(f"Synced {len(questions)} questions from {SOURCE.name}: {totals}")
