import unittest
from xml.etree import ElementTree as ET

from scripts.sync_question_bank import (
    NS,
    SOURCE,
    audit_rich_text,
    build_question_bank,
    convert_script_markup,
    load_sheets,
    rich_text,
)


def formatted_text(runs):
    parts = []
    for text, script in runs:
        properties = f'<rPr><vertAlign val="{script}"/></rPr>' if script else ""
        parts.append(f"<r>{properties}<t>{text}</t></r>")
    return rich_text(ET.fromstring(f'<si xmlns="{NS["m"]}">{"".join(parts)}</si>'))


class QuestionBankImporterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.questions = build_question_bank(SOURCE)
        cls.by_id = {question["id"]: question for question in cls.questions}

    def test_reads_courses_by_sheet_name_and_skips_blank_rows(self):
        self.assertEqual([name for name, _ in load_sheets(SOURCE)], ["CIE_IGCSE_CHEM", "IB_CHEM_HL"])
        by_course = {
            course_id: [question for question in self.questions if question["course_id"] == course_id]
            for course_id in {question["course_id"] for question in self.questions}
        }
        self.assertEqual(len(by_course["CIE_IGCSE_CHEM"]), 231)
        self.assertEqual(len(by_course["IB_CHEM_HL"]), 161)
        self.assertEqual(by_course["CIE_IGCSE_CHEM"][-1]["id"], "CIE231")
        self.assertEqual(by_course["IB_CHEM_HL"][-1]["id"], "IBHL161")
        self.assertEqual({item["paper"] for item in by_course["IB_CHEM_HL"]}, {"1B", "2"})

    def test_preserves_numeric_subscripts_and_baseline_coefficients(self):
        value = formatted_text([("2H", None), ("2", "subscript"), ("O + O", None), ("2", "subscript")])
        self.assertEqual(value["text"], "2H2O + O2")
        self.assertEqual(value["segments"], [
            {"text": "2H"}, {"text": "2", "script": "sub"},
            {"text": "O + O"}, {"text": "2", "script": "sub"},
        ])
        self.assertEqual(rich_text(ET.fromstring(f'<si xmlns="{NS["m"]}"><t>450℃</t></si>')), "450℃")

    def test_preserves_formula_and_charge_runs(self):
        formula = formatted_text([
            ("KMnO", None), ("4", "subscript"), (" Mg", None), ("2+", "superscript"),
            (" Al", None), ("3+", "superscript"), (" OH", None), ("-", "superscript"),
            (" e", None), ("-", "superscript"),
        ])
        self.assertEqual(formula["text"], "KMnO4 Mg2+ Al3+ OH- e-")
        self.assertEqual([segment for segment in formula["segments"] if segment.get("script")], [
            {"text": "4", "script": "sub"},
            {"text": "2+", "script": "sup"},
            {"text": "3+", "script": "sup"},
            {"text": "-", "script": "sup"},
            {"text": "-", "script": "sup"},
        ])

    def test_preserves_unsupported_letter_subscripts_without_unicode_guessing(self):
        sn = formatted_text([("S", None), ("N", "subscript"), ("1 / S", None), ("N", "subscript"), ("2", None)])
        enthalpy = formatted_text([("ΔH", None), ("f", "subscript")])
        self.assertEqual(sn["segments"][1], {"text": "N", "script": "sub"})
        self.assertEqual(sn["segments"][3], {"text": "N", "script": "sub"})
        self.assertEqual(enthalpy["segments"][-1], {"text": "f", "script": "sub"})

    def test_explicit_plain_text_markup_is_structured_but_unmarked_text_is_unchanged(self):
        self.assertEqual(convert_script_markup("SO_4^2-"), {
            "text": "SO42-",
            "segments": [
                {"text": "SO"}, {"text": "4", "script": "sub"}, {"text": "2-", "script": "sup"},
            ],
        })
        self.assertEqual(convert_script_markup("S_{N}1 and ΔH_{f}"), {
            "text": "SN1 and ΔHf",
            "segments": [
                {"text": "S"}, {"text": "N", "script": "sub"},
                {"text": "1 and ΔH"}, {"text": "f", "script": "sub"},
            ],
        })
        self.assertEqual(convert_script_markup("2H2O at 450℃"), "2H2O at 450℃")

    def test_question_and_answers_keep_excel_letter_subscripts(self):
        self.assertIn({"text": "N", "script": "sub"}, self.by_id["IBHL124"]["question"]["segments"])
        self.assertIn({"text": "N", "script": "sub"}, self.by_id["IBHL125"]["question"]["segments"])
        self.assertIn({"text": "f", "script": "sub"}, self.by_id["IBHL070"]["question"]["segments"])
        self.assertIn({"text": "N", "script": "sub"}, self.by_id["IBHL126"]["answers"][1]["segments"])
        self.assertIn({"text": "N", "script": "sub"}, self.by_id["IBHL126"]["answers"][2]["segments"])
        self.assertIn({"text": "−", "script": "sup"}, self.by_id["IBHL104"]["answers"][1]["segments"])

    def test_every_excel_scripted_cell_has_structured_output(self):
        audit = audit_rich_text(SOURCE)
        self.assertEqual(len(audit), 68)
        for entry in audit:
            question = self.by_id[entry["id"]]
            if entry["field"] == "question":
                output = question["question"]
            else:
                output = question["answers"][int(entry["field"].split("_")[1]) - 1]
            self.assertIsInstance(output, dict, f'{entry["id"]} {entry["field"]}')
            for segment in entry["scripted_segments"]:
                self.assertIn(segment, output["segments"], f'{entry["id"]} {entry["field"]}')


if __name__ == "__main__":
    unittest.main()
