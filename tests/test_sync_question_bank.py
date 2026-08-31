import unittest

from scripts.sync_question_bank import SOURCE, build_question_bank, load_sheets, scripted_text


class QuestionBankImporterTests(unittest.TestCase):
    def test_reads_courses_by_sheet_name_and_skips_blank_rows(self):
        self.assertEqual([name for name, _ in load_sheets(SOURCE)], ["CIE_IGCSE_CHEM", "IB_CHEM_HL"])
        questions = build_question_bank(SOURCE)
        by_course = {
            course_id: [question for question in questions if question["course_id"] == course_id]
            for course_id in {question["course_id"] for question in questions}
        }
        self.assertEqual(len(by_course["CIE_IGCSE_CHEM"]), 231)
        self.assertEqual(len(by_course["IB_CHEM_HL"]), 88)
        self.assertEqual(by_course["CIE_IGCSE_CHEM"][-1]["id"], "CIE231")
        self.assertEqual(by_course["IB_CHEM_HL"][-1]["id"], "IBHL088")
        self.assertEqual({item["paper"] for item in by_course["IB_CHEM_HL"]}, {"1B", "2"})

    def test_converts_only_reliable_unicode_script_characters(self):
        self.assertEqual(scripted_text("a2", "subscript"), "ₐ₂")
        self.assertEqual(scripted_text("fN", "subscript"), "fN")
        self.assertEqual(scripted_text("2+", "superscript"), "²⁺")


if __name__ == "__main__":
    unittest.main()
