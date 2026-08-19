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


def column_index(reference: str) -> int:
    letters = re.match(r"[A-Z]+", reference).group(0)
    value = 0
    for letter in letters:
        value = value * 26 + ord(letter) - 64
    return value - 1


def load_rows(path: Path) -> list[list[object]]:
    with zipfile.ZipFile(path) as archive:
        shared = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall("m:si", NS):
                shared.append("".join(node.text or "" for node in item.iterfind(".//m:t", NS)))

        sheet = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
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
                    text = "".join(node.text or "" for node in cell.iterfind(".//m:t", NS))
                    values[index] = text
                elif value_node is not None:
                    raw = value_node.text or ""
                    values[index] = shared[int(raw)] if kind == "s" else raw
            rows.append(values)
        return rows


rows = load_rows(SOURCE)
headers = [str(value or "").strip() for value in rows[0]]
required = {"id", "paper", "topic", "question", "needs_review"}
if not required.issubset(headers):
    raise SystemExit(f"Missing required columns: {sorted(required - set(headers))}")

answer_columns = [header for header in headers if re.fullmatch(r"answer_\d+", header)]
questions = []
for values in rows[1:]:
    values += [None] * (len(headers) - len(values))
    record = dict(zip(headers, values))
    question = {
        "id": str(record["id"]).strip(),
        "paper": str(record["paper"]).strip(),
        "topic": str(record["topic"]).strip(),
        "question": str(record["question"]).strip(),
        "answers": [str(record[column]).strip() for column in answer_columns if record.get(column)],
    }
    if not question["id"] or not question["question"] or not question["answers"]:
        raise SystemExit(f"Incomplete question row: {question['id'] or '(missing id)'}")
    questions.append(question)

if len({question["id"] for question in questions}) != len(questions):
    raise SystemExit("Question IDs must be unique")

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps(questions, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Synced {len(questions)} questions from {SOURCE.name}")
