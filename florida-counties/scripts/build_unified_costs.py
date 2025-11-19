import json
import math
import re
from pathlib import Path
from typing import Any, Dict, List, Tuple

import pandas as pd

COMPETITORS_PATH = Path("competitor_schools_fl_with_costs.json")
CIE_PATH = Path("local_data/cie_institutions.xlsx")
FCS_PATH = Path("local_data/fcs_tuition.xlsx")
ANNUAL_CREDIT_LOAD = 30
CIE_COLUMNS = {
    "name": "Institution Name",
    "tuition": "Tuition",
    "fees": "Fees",
    "books": "Books",
}
FCS_COLUMNS = {
    "name": "Institution",
    "tuition_in_state": "Tuition In-State Per Credit",
    "tuition_out_of_state": "Tuition Out-of-State Per Credit",
    "fees": "Fees Per Credit",
}


def normalize_name(value: str) -> str:
    if not isinstance(value, str):
        return ""
    cleaned = value.lower().strip()
    cleaned = re.sub(r"[.,;:'\"-]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


def read_table(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Missing file: {path}")
    ext = path.suffix.lower()
    if ext in (".xlsx", ".xls"):
        return pd.read_excel(path)
    if ext == ".csv":
        return pd.read_csv(path)
    raise ValueError(f"Unsupported file type: {path}")


def clean_numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(
        series.astype(str)
        .str.replace(r"[\$,]", "", regex=True)
        .str.strip()
        .replace({"": None, "nan": None}),
        errors="coerce",
    )


def load_competitors(path: Path) -> List[Dict[str, Any]]:
    with path.open("r", encoding="utf-8") as handle:
        competitors = json.load(handle)
    for competitor in competitors:
        competitor["normalized_name"] = normalize_name(competitor.get("school_name", ""))
    return competitors


def load_cie_costs(path: Path) -> Dict[str, Dict[str, float]]:
    df = read_table(path)
    required = [CIE_COLUMNS["name"]]
    for col in required:
        if col not in df.columns:
            raise KeyError(f"CIE data missing column: {col}")
    df = df.copy()
    df["normalized_name"] = df[CIE_COLUMNS["name"]].apply(normalize_name)
    df = df[df["normalized_name"] != ""]
    for key in ("tuition", "fees", "books"):
        col = CIE_COLUMNS.get(key)
        if col and col in df.columns:
            df[f"{key}_value"] = clean_numeric(df[col])
        else:
            df[f"{key}_value"] = math.nan
    grouped = (
        df.groupby("normalized_name")[["tuition_value", "fees_value", "books_value"]]
        .mean()
        .reset_index()
    )
    result = {}
    for _, row in grouped.iterrows():
        result[row["normalized_name"]] = {
            "cie_tuition_estimate": row["tuition_value"]
            if not math.isnan(row["tuition_value"])
            else None,
            "cie_fees_estimate": row["fees_value"]
            if not math.isnan(row["fees_value"])
            else None,
            "cie_books_estimate": row["books_value"]
            if not math.isnan(row["books_value"])
            else None,
        }
    return result


def load_fcs_costs(path: Path) -> Dict[str, Dict[str, float]]:
    if not path.exists():
        return {}
    df = read_table(path)
    required = [FCS_COLUMNS["name"], FCS_COLUMNS["tuition_in_state"]]
    for col in required:
        if col not in df.columns:
            raise KeyError(f"FCS data missing column: {col}")
    df = df.copy()
    df["normalized_name"] = df[FCS_COLUMNS["name"]].apply(normalize_name)
    df = df[df["normalized_name"] != ""]
    df["in_state_value"] = clean_numeric(df[FCS_COLUMNS["tuition_in_state"]])
    out_col = FCS_COLUMNS.get("tuition_out_of_state")
    df["out_state_value"] = clean_numeric(df[out_col]) if out_col in df.columns else math.nan
    fees_col = FCS_COLUMNS.get("fees")
    df["fees_value"] = clean_numeric(df[fees_col]) if fees_col in df.columns else math.nan
    grouped = (
        df.groupby("normalized_name")[["in_state_value", "out_state_value", "fees_value"]]
        .mean()
        .reset_index()
    )
    result = {}
    for _, row in grouped.iterrows():
        in_state = row["in_state_value"]
        out_state = row["out_state_value"]
        fees = row["fees_value"]
        result[row["normalized_name"]] = {
            "fcs_tuition_per_credit_in_state": in_state if not math.isnan(in_state) else None,
            "fcs_tuition_per_credit_out_of_state": out_state
            if not math.isnan(out_state)
            else None,
            "fcs_fees_per_credit": fees if not math.isnan(fees) else None,
            "fcs_annual_tuition_in_state": in_state * ANNUAL_CREDIT_LOAD
            if not math.isnan(in_state)
            else None,
            "fcs_annual_tuition_out_of_state": out_state * ANNUAL_CREDIT_LOAD
            if not math.isnan(out_state)
            else None,
            "fcs_annual_fees": fees * ANNUAL_CREDIT_LOAD if not math.isnan(fees) else None,
        }
    return result


def is_valid_cost(value: Any) -> bool:
    if value is None:
        return False
    try:
        num = float(value)
    except (TypeError, ValueError):
        return False
    return num > 0 and not math.isnan(num)


def pick_value(candidates: List[Tuple[Any, str]]) -> Tuple[Any, str]:
    for value, source in candidates:
        if is_valid_cost(value):
            return float(value), source
    return None, "none"


def choose_best_costs(
    competitor: Dict[str, Any], cie_costs: Dict[str, Dict[str, float]], fcs_costs: Dict[str, Dict[str, float]]
) -> Dict[str, Any]:
    name = competitor.get("normalized_name", "")
    cie_entry = cie_costs.get(name, {})
    fcs_entry = fcs_costs.get(name, {})
    tuition_in_state, source_tuition = pick_value(
        [
            (competitor.get("tuition_in_state"), "scorecard"),
            (cie_entry.get("cie_tuition_estimate"), "cie"),
            (fcs_entry.get("fcs_annual_tuition_in_state"), "fcs"),
        ]
    )
    tuition_out_of_state, source_tuition_out = pick_value(
        [
            (competitor.get("tuition_out_of_state"), "scorecard"),
            (cie_entry.get("cie_tuition_estimate"), "cie"),
            (fcs_entry.get("fcs_annual_tuition_out_of_state"), "fcs"),
        ]
    )
    fees, source_fees = pick_value(
        [
            (competitor.get("fees"), "scorecard"),
            (cie_entry.get("cie_fees_estimate"), "cie"),
            (fcs_entry.get("fcs_annual_fees"), "fcs"),
        ]
    )
    books, source_books = pick_value(
        [
            (competitor.get("books"), "scorecard"),
            (cie_entry.get("cie_books_estimate"), "cie"),
        ]
    )
    return {
        "tuition_in_state": tuition_in_state,
        "tuition_out_of_state": tuition_out_of_state,
        "fees": fees,
        "books": books,
        "source_tuition_priority": source_tuition,
        "source_tuition_out_priority": source_tuition_out,
        "source_fees_priority": source_fees,
        "source_books_priority": source_books,
    }


def build_unified_cost_dataset(
    competitors: List[Dict[str, Any]],
    cie_costs: Dict[str, Dict[str, float]],
    fcs_costs: Dict[str, Dict[str, float]],
) -> List[Dict[str, Any]]:
    unified = []
    for competitor in competitors:
        best = choose_best_costs(competitor, cie_costs, fcs_costs)
        unified.append(
            {
                "school_id": competitor.get("school_id"),
                "school_name": competitor.get("school_name"),
                "city": competitor.get("city"),
                "state": competitor.get("state"),
                "lat": competitor.get("lat"),
                "lon": competitor.get("lon"),
                "matching_cips": competitor.get("matching_cips", []),
                "tuition_in_state": best["tuition_in_state"],
                "tuition_out_of_state": best["tuition_out_of_state"],
                "fees": best["fees"],
                "books": best["books"],
                "source_tuition_priority": best["source_tuition_priority"],
                "source_tuition_out_priority": best["source_tuition_out_priority"],
                "source_fees_priority": best["source_fees_priority"],
                "source_books_priority": best["source_books_priority"],
            }
        )
    return unified


def main() -> None:
    competitors = load_competitors(COMPETITORS_PATH)
    cie_costs = load_cie_costs(CIE_PATH)
    fcs_costs = load_fcs_costs(FCS_PATH)
    unified = build_unified_cost_dataset(competitors, cie_costs, fcs_costs)
    output_path = COMPETITORS_PATH.with_name("competitor_schools_fl_unified_costs.json")
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(unified, handle, indent=2)


if __name__ == "__main__":
    main()
