import os
import json
import bisect

def verify():
    canonical_json = "canonical-sources/shadow-hearts-guide.canonical.json"
    assert os.path.exists(canonical_json), "Master canonical JSON not found!"
    size = os.path.getsize(canonical_json)
    print(f"[CHECK 1] Master canonical JSON size: {size:,} bytes")
    assert size < 30000, f"Master canonical JSON size {size} exceeds 30,000 bytes!"

    with open(canonical_json, "r", encoding="utf-8") as f:
        master = json.load(f)

    assert "source" in master, "Missing 'source' in master JSON"
    assert "sections_index" in master, "Missing 'sections_index' in master JSON"
    assert "sections" not in master, "'sections' should NOT be embedded in lightweight mode"
    print(f"[CHECK 2] Lightweight master index structure verified. Sections in index: {len(master['sections_index'])}")

    total_inline_items = 0
    total_notes = 0
    total_text_len = 0

    for se in master["sections_index"]:
        sec_file = os.path.join("canonical-sources", se["file"])
        assert os.path.exists(sec_file), f"Referenced section file does not exist: {sec_file}"

        with open(sec_file, "r", encoding="utf-8") as sf:
            sec_data = json.load(sf)

        assert "markers" in sec_data, f"Missing 'markers' in {sec_file}"
        assert "items" in sec_data["markers"], f"Missing 'items' in markers of {sec_file}"
        assert "notes" in sec_data["markers"], f"Missing 'notes' in markers of {sec_file}"

        text = sec_data["text"]
        total_text_len += len(text)
        lines = text.splitlines(keepends=True)
        line_offsets = []
        curr = 0
        for l in lines:
            line_offsets.append(curr)
            curr += len(l)

        # Verify inline item markers
        for item in sec_data["markers"]["items"]:
            total_inline_items += 1
            start, end = item["char_offset"]
            assert text[start:end] == item["raw_tag"], (
                f"Offset mismatch in {se['id']}: expected {item['raw_tag']}, got {repr(text[start:end])}"
            )
            expected_line = bisect.bisect_right(line_offsets, start)
            assert item["line"] == expected_line, (
                f"Line mismatch in {se['id']}: recorded {item['line']}, expected {expected_line}"
            )

        # Verify notes
        for note in sec_data["markers"]["notes"]:
            total_notes += 1
            start, end = note["char_offset"]
            assert text[start:start+4].upper() == "NOTE" or "NOTE" in text[start:end], (
                f"Note block start mismatch in {se['id']}"
            )
            expected_line = bisect.bisect_right(line_offsets, start)
            assert note["line"] == expected_line, (
                f"Note line mismatch in {se['id']}: recorded {note['line']}, expected {expected_line}"
            )

    print(f"[CHECK 3] Verified all section files exist and markers align with exact text offsets.")
    print(f"          Total inline item tags verified: {total_inline_items}")
    print(f"          Total structured notes verified: {total_notes}")
    print(f"          Total section characters: {total_text_len:,}")

    print("\nALL VERIFICATION CHECKS PASSED SUCCESSFULLY! :)")

if __name__ == "__main__":
    verify()
