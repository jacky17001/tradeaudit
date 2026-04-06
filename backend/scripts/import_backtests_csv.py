import argparse
import json
from pathlib import Path

from services.backtests_import_service import import_backtests_csv


def main() -> None:
    parser = argparse.ArgumentParser(description="Import backtests CSV into SQLite and auto-evaluate")
    parser.add_argument("--file", required=True, help="Path to backtests CSV file")
    parser.add_argument(
        "--mode",
        choices=["replace"],
        default="replace",
        help="Import strategy. v0.2.0 currently supports replace only.",
    )
    args = parser.parse_args()

    result = import_backtests_csv(
        Path(args.file),
        mode=args.mode,
        source_type="import-csv",
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()