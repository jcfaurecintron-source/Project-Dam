import json
import os
from pathlib import Path

import requests

STC_CIPS = {
    "51.0910",
    "51.0801",
    "51.1004",
    "51.0909",
    "47.0201",
    "15.0303",
    "48.0508",
    "51.3801",
    "01.8301",
}

PROGRAMS_ENDPOINT = "https://api.data.gov/ed/collegescorecard/v1/schools.json"
FIELDS = ",".join(
    [
        "id",
        "school.name",
        "school.city",
        "school.state",
        "location.lat",
        "location.lon",
        "latest.programs.cip_4_digit",
        "latest.cost.tuition.in_state",
        "latest.cost.tuition.out_of_state",
        "latest.cost.tuition.program_year",
        "latest.cost.attendance.program_year",
        "latest.cost.booksupply",
    ]
)


def normalize_cip_prefix(code: str | None) -> str:
    if not code:
        return ""
    digits = "".join(ch for ch in str(code) if ch.isdigit())
    return digits[:4]


def build_cip_prefix_lookup(cips: set[str]) -> dict[str, set[str]]:
    lookup: dict[str, set[str]] = {}
    for cip in cips:
        prefix = normalize_cip_prefix(cip)
        if not prefix:
            continue
        lookup.setdefault(prefix, set()).add(cip)
    return lookup


CIP_PREFIX_LOOKUP = build_cip_prefix_lookup(STC_CIPS)


def load_env_file():
    env_path = Path(__file__).resolve().parents[1] / ".env.local"
    if not env_path.is_file():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and value and key not in os.environ:
            os.environ[key] = value


def get_api_key():
    api_key = os.environ.get("COLLEGE_SCORECARD_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("COLLEGE_SCORECARD_API_KEY is missing or empty")
    return api_key


def _to_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def extract_costs(entry: dict) -> dict:
    return {
        "tuition_and_fees_in_state": _to_float(entry.get("latest.cost.tuition.in_state")),
        "tuition_and_fees_out_of_state": _to_float(entry.get("latest.cost.tuition.out_of_state")),
        "tuition_and_fees_program_year": _to_float(entry.get("latest.cost.tuition.program_year")),
        "attendance_cost_program_year": _to_float(entry.get("latest.cost.attendance.program_year")),
        "books_and_supplies": _to_float(entry.get("latest.cost.booksupply")),
    }


def format_costs(costs: dict | None) -> dict:
    if not costs:
        return {
            "tuition_and_fees_in_state": None,
            "tuition_and_fees_out_of_state": None,
            "tuition_and_fees_program_year": None,
            "attendance_cost_program_year": None,
            "books_and_supplies": None,
        }
    return {
        "tuition_and_fees_in_state": costs.get("tuition_and_fees_in_state"),
        "tuition_and_fees_out_of_state": costs.get("tuition_and_fees_out_of_state"),
        "tuition_and_fees_program_year": costs.get("tuition_and_fees_program_year"),
        "attendance_cost_program_year": costs.get("attendance_cost_program_year"),
        "books_and_supplies": costs.get("books_and_supplies"),
    }


def fetch_fl_programs(api_key):
    per_page = 100
    page = 0
    programs = []
    session = requests.Session()
    while True:
        params = {
            "api_key": api_key,
            "school.state": "FL",
            "per_page": per_page,
            "page": page,
            "fields": FIELDS,
        }
        response = session.get(PROGRAMS_ENDPOINT, params=params, timeout=30)
        if response.status_code != 200:
            raise RuntimeError(f"College Scorecard API request failed with status {response.status_code}")
        payload = response.json()
        results = payload.get("results") or []
        for entry in results:
            school_id = entry.get("id")
            record_base = {
                "school.id": school_id,
                "school.name": entry.get("school.name"),
                "school.city": entry.get("school.city"),
                "school.state": entry.get("school.state"),
                "location.lat": _to_float(entry.get("location.lat")),
                "location.lon": _to_float(entry.get("location.lon")),
                "costs": extract_costs(entry),
            }
            cip_entries = entry.get("latest.programs.cip_4_digit") or []
            for program in cip_entries:
                cip_code = str(program.get("code") or "").strip()
                if not cip_code:
                    continue
                record = record_base.copy()
                record["program.cipcode"] = cip_code
                programs.append(record)
        metadata = payload.get("metadata") or {}
        total = metadata.get("total")
        per_page_meta = metadata.get("per_page") or per_page
        page += 1
        if total is not None and per_page_meta:
            total_pages = (int(total) + int(per_page_meta) - 1) // int(per_page_meta)
            if page >= total_pages:
                break
        if not results:
            break
    return programs


def build_competitor_schools(programs):
    schools = {}
    for record in programs:
        school_id = record.get("school.id")
        if school_id is None:
            continue
        school_key = str(school_id)
        school = schools.get(school_key)
        if not school:
            school = {
                "school_id": school_key,
                "school_name": record.get("school.name"),
                "city": record.get("school.city"),
                "state": record.get("school.state"),
                "lat": record.get("location.lat"),
                "lon": record.get("location.lon"),
                "all_cips": set(),
                "matching_cips": set(),
                "costs": record.get("costs"),
            }
            schools[school_key] = school
        cip_code = record.get("program.cipcode")
        if not cip_code:
            continue
        school["all_cips"].add(cip_code)
        prefix = normalize_cip_prefix(cip_code)
        if prefix and prefix in CIP_PREFIX_LOOKUP:
            for stc_code in CIP_PREFIX_LOOKUP[prefix]:
                school["matching_cips"].add(stc_code)
    competitors = []
    for school in schools.values():
        if not school["matching_cips"]:
            continue
        competitors.append(
            {
                "school_id": school["school_id"],
                "school_name": school["school_name"],
                "city": school["city"],
                "state": school["state"],
                "lat": school["lat"],
                "lon": school["lon"],
                "matching_cips": sorted(school["matching_cips"]),
                "costs": format_costs(school.get("costs")),
            }
        )
    competitors.sort(key=lambda x: x["school_name"] or "")
    return competitors


def main():
    load_env_file()
    api_key = get_api_key()
    programs = fetch_fl_programs(api_key)
    competitors = build_competitor_schools(programs)
    output_path = Path.cwd() / "competitor_schools_fl_live.json"
    with output_path.open("w", encoding="utf-8") as fh:
        json.dump(competitors, fh, indent=2)


if __name__ == "__main__":
    main()
