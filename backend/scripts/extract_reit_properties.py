"""
Extract property portfolios from REIT 10-K filings via SEC EDGAR.
Uses edgartools to get Item 2 (Properties) from each REIT's latest 10-K,
then parses the property tables to extract building data.

Usage: python backend/scripts/extract_reit_properties.py
"""

import json
import os
import re
import sys
from pathlib import Path

from edgar import set_identity, Company

set_identity("Laurence Wilse-Samson lw3387@nyu.edu")

OUT_DIR = Path(__file__).parent / "reit_data"
OUT_DIR.mkdir(exist_ok=True)

# Major CRE REITs
REITS = [
    {"ticker": "ESRT", "name": "Empire State Realty Trust", "focus": "NYC", "ownership": 1.0},
    {"ticker": "SLG", "name": "SL Green Realty", "focus": "Manhattan office", "ownership": 1.0},
    {"ticker": "VNO", "name": "Vornado Realty Trust", "focus": "NYC/SF/Chicago", "ownership": 1.0},
    {"ticker": "BXP", "name": "Boston Properties (BXP)", "focus": "NYC/Boston/SF/DC", "ownership": 1.0},
    {"ticker": "PGRE", "name": "Paramount Group", "focus": "NYC/SF", "ownership": 1.0},
    {"ticker": "DEI", "name": "Douglas Emmett", "focus": "LA/Honolulu", "ownership": 1.0},
    {"ticker": "KRC", "name": "Kilroy Realty", "focus": "West Coast", "ownership": 1.0},
]


def get_properties_text(ticker: str) -> str | None:
    """Get Item 2 (Properties) text from the latest 10-K."""
    try:
        company = Company(ticker)
        filings = company.get_filings(form="10-K")
        if not filings:
            print(f"  No 10-K found for {ticker}")
            return None

        latest = filings[0]
        print(f"  Latest 10-K: {latest.filing_date}")

        tenk = latest.obj()
        if tenk is None:
            print(f"  Could not parse 10-K")
            return None

        # Get Item 2 (Properties)
        try:
            item2 = tenk["Item 2"]
            text = str(item2)
            if len(text) > 100:
                return text
        except Exception:
            pass

        # Fallback: try Item 1 (Business) which sometimes has property lists
        try:
            item1 = tenk["Item 1"]
            text = str(item1)
            if len(text) > 100:
                return text
        except Exception:
            pass

        print(f"  Could not extract properties section")
        return None

    except Exception as e:
        print(f"  Error: {e}")
        return None


def parse_properties_from_text(text: str, reit_name: str) -> list[dict]:
    """
    Parse property listings from 10-K Item 2 text.
    REIT 10-Ks typically have tables with:
    - Property name
    - Location/address
    - Square footage
    - Occupancy %
    - Annualized rent
    """
    properties = []
    seen_names = set()

    # Strategy 1: Look for named properties with locations
    # Pattern: "Property Name" followed by location info
    lines = text.split("\n")

    for i, line in enumerate(lines):
        line = line.strip()
        if not line or len(line) < 10:
            continue

        # Look for lines that look like property entries
        # Common formats in REIT tables:
        # "One Penn Plaza    Penn Station    2,561,461    95.0%"
        # "250 West 57th Street   Columbus Circle    476,847"

        # NYC addresses
        nyc_match = re.match(
            r'^((?:\d+\s+)?[A-Z][A-Za-z\s\-\']+(?:Street|Avenue|Boulevard|Drive|Place|Plaza|Way|Road|Lane|Broadway|Park))\s*'
            r'(?:\([\d\w\s,]*\))?\s*'  # optional parenthetical
            r'([\w\s\-\.]+?)\s+'  # location/submarket
            r'([\d,]+)\s',  # square footage
            line,
            re.IGNORECASE,
        )

        # Named buildings (e.g. "The Empire State Building", "One Penn Plaza")
        named_match = re.match(
            r'^((?:The\s+)?(?:One|Two|Three|Four|Five|[0-9]+\s+)?[A-Z][A-Za-z\s\-\']+(?:Building|Tower|Center|Centre|Plaza|Place|Park|Square|Point))\s*'
            r'(?:\([\d\w\s,]*\))?\s*'
            r'([\w\s\-\.]+?)\s+'
            r'([\d,]+)\s',
            line,
            re.IGNORECASE,
        )

        match = nyc_match or named_match
        if not match:
            continue

        name = match.group(1).strip()
        submarket = match.group(2).strip()
        sqft_str = match.group(3).strip()

        # Skip headers and non-property lines
        if any(skip in name.lower() for skip in ["total", "property name", "square", "percent", "annualized", "number of"]):
            continue

        if name in seen_names:
            continue
        seen_names.add(name)

        sqft = int(sqft_str.replace(",", "")) if sqft_str else None

        # Extract occupancy if present
        occ_match = re.search(r'(\d{2,3}\.\d)\s*%', line)
        occupancy = float(occ_match.group(1)) / 100 if occ_match else None

        # Extract annualized rent if present
        rent_match = re.search(r'\$\s*([\d,]+(?:\.\d+)?)', line)
        annual_rent = float(rent_match.group(1).replace(",", "")) if rent_match else None

        # Determine city from submarket
        city = "New York"
        state = "NY"
        submarket_lower = submarket.lower()
        if any(w in submarket_lower for w in ["san francisco", "sf", "silicon"]):
            city, state = "San Francisco", "CA"
        elif any(w in submarket_lower for w in ["boston", "cambridge"]):
            city, state = "Boston", "MA"
        elif any(w in submarket_lower for w in ["washington", "dc", "reston", "tysons"]):
            city, state = "Washington", "DC"
        elif any(w in submarket_lower for w in ["los angeles", "la", "westwood", "brentwood", "century city"]):
            city, state = "Los Angeles", "CA"
        elif any(w in submarket_lower for w in ["seattle"]):
            city, state = "Seattle", "WA"
        elif any(w in submarket_lower for w in ["chicago"]):
            city, state = "Chicago", "IL"

        properties.append({
            "name": name,
            "submarket": submarket,
            "city": city,
            "state": state,
            "owner": reit_name,
            "sqft": sqft,
            "occupancy": occupancy,
            "annual_rent": annual_rent,
        })

    return properties


def main():
    all_results = {}

    for reit in REITS:
        ticker = reit["ticker"]
        name = reit["name"]
        print(f"\n{'='*60}")
        print(f"{name} ({ticker}) — {reit['focus']}")
        print(f"{'='*60}")

        text = get_properties_text(ticker)
        if not text:
            continue

        # Save raw text
        text_file = OUT_DIR / f"{ticker}_item2.txt"
        text_file.write_text(text, encoding="utf-8")
        print(f"  Saved Item 2 text ({len(text):,} chars)")

        # Parse properties
        properties = parse_properties_from_text(text, name)
        print(f"  Extracted {len(properties)} properties:")
        for p in properties[:10]:
            occ = f" {p['occupancy']*100:.0f}%" if p.get("occupancy") else ""
            sf = f" {p['sqft']:,} SF" if p.get("sqft") else ""
            print(f"    {p['name']} — {p['city']}, {p['state']}{sf}{occ}")
        if len(properties) > 10:
            print(f"    ... and {len(properties) - 10} more")

        all_results[ticker] = {
            "reit": name,
            "focus": reit["focus"],
            "filing_date": None,
            "properties": properties,
        }

        # Save per-REIT
        out_file = OUT_DIR / f"{ticker}_properties.json"
        out_file.write_text(json.dumps(all_results[ticker], indent=2), encoding="utf-8")

    # Save combined
    combined_file = OUT_DIR / "all_reit_properties.json"
    combined_file.write_text(json.dumps(all_results, indent=2), encoding="utf-8")

    print(f"\n{'='*60}")
    total = sum(len(v["properties"]) for v in all_results.values())
    print(f"Total: {total} properties across {len(all_results)} REITs")
    print(f"Output: {combined_file}")


if __name__ == "__main__":
    main()
