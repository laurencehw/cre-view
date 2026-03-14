"""
Step 1: Download Item 2 text from REIT 10-Ks (already done by extract script)
Step 2: Use Gemini to parse each Item 2 into structured property data
Step 3: Output combined JSON for database seeding

Usage: python backend/scripts/parse_reit_with_gemini.py
"""

import json
import subprocess
import sys
from pathlib import Path

REIT_DATA_DIR = Path(__file__).parent / "reit_data"
GEMINI_HELPER = r"C:\Users\lwils\scripts\gemini_helper.py"

REITS = {
    "ESRT": "Empire State Realty Trust",
    "SLG": "SL Green Realty",
    "VNO": "Vornado Realty Trust",
    "BXP": "Boston Properties (BXP)",
    "PGRE": "Paramount Group",
    "DEI": "Douglas Emmett",
    "KRC": "Kilroy Realty",
}

PROMPT = """Parse this REIT 10-K properties section. Extract ALL properties listed.
Return a JSON array where each entry has:
- name: building/property name (clean it up, remove "(Office)" etc suffixes)
- address: street address if mentioned, otherwise the submarket/location
- city: the city (New York, San Francisco, Boston, Washington DC, Los Angeles, etc.)
- state: state abbreviation (NY, CA, MA, DC, etc.)
- sqft: total rentable square feet as integer
- occupancy: as decimal 0-1 (e.g. 0.95 for 95%)
- annual_rent: total annualized rent in dollars as integer
- ownership_pct: the REIT's ownership percentage as decimal (1.0 if wholly owned, 0.5 for 50%, etc.)
- property_type: Office, Retail, Residential, Mixed-Use, Life Science, etc.

Only include actual properties, not section headers, totals, or summary rows.
If a property appears twice (e.g. office and retail portions), combine them into one entry with total sqft and rent.
Return ONLY valid JSON array, no other text or markdown."""


def parse_reit(ticker: str, reit_name: str) -> list[dict]:
    """Use Gemini to parse a REIT's Item 2 text."""
    item2_file = REIT_DATA_DIR / f"{ticker}_item2.txt"
    if not item2_file.exists():
        print(f"  No Item 2 file for {ticker}")
        return []

    print(f"  Sending to Gemini ({item2_file.stat().st_size:,} bytes)...")

    result = subprocess.run(
        ["python", GEMINI_HELPER, PROMPT, "--file", str(item2_file), "--timeout", "120"],
        capture_output=True,
        text=True,
        timeout=180,
    )

    output = result.stdout.strip()
    if not output:
        print(f"  Gemini returned empty output")
        if result.stderr:
            print(f"  stderr: {result.stderr[:200]}")
        return []

    # Extract JSON from output (Gemini might wrap it in markdown)
    if "```json" in output:
        output = output.split("```json")[1].split("```")[0].strip()
    elif "```" in output:
        output = output.split("```")[1].split("```")[0].strip()

    try:
        properties = json.loads(output)
        if isinstance(properties, list):
            # Tag each property with the REIT
            for p in properties:
                p["reit"] = reit_name
                p["ticker"] = ticker
            return properties
        else:
            print(f"  Unexpected JSON structure")
            return []
    except json.JSONDecodeError as e:
        print(f"  JSON parse error: {e}")
        # Save raw output for debugging
        debug_file = REIT_DATA_DIR / f"{ticker}_gemini_raw.txt"
        debug_file.write_text(output, encoding="utf-8")
        print(f"  Saved raw output to {debug_file.name}")
        return []


def main():
    all_properties = []

    for ticker, name in REITS.items():
        print(f"\n{'='*50}")
        print(f"{name} ({ticker})")
        print(f"{'='*50}")

        properties = parse_reit(ticker, name)
        print(f"  Extracted {len(properties)} properties:")
        for p in properties[:5]:
            sf = f"{p.get('sqft', 0):,} SF" if p.get("sqft") else "? SF"
            city = p.get("city", "?")
            print(f"    {p['name']} — {city} — {sf}")
        if len(properties) > 5:
            print(f"    ... and {len(properties) - 5} more")

        all_properties.extend(properties)

    # Save combined output
    output_file = REIT_DATA_DIR / "parsed_reit_properties.json"
    output_file.write_text(json.dumps(all_properties, indent=2), encoding="utf-8")

    print(f"\n{'='*50}")
    print(f"Total: {len(all_properties)} properties from {len(REITS)} REITs")
    print(f"Output: {output_file}")

    # Summary by city
    cities = {}
    for p in all_properties:
        city = p.get("city", "Unknown")
        cities[city] = cities.get(city, 0) + 1
    print("\nBy city:")
    for city, count in sorted(cities.items(), key=lambda x: -x[1]):
        print(f"  {city}: {count}")


if __name__ == "__main__":
    main()
