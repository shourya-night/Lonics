#!/usr/bin/env python3
"""
Database Inspection Script for Lonics Prediction Engine

Inspects the railway_freight_database.sqlite and prints a comprehensive
summary of all tables, columns, data types, date ranges, and data statistics.
"""

import sqlite3
import os
import json
from pathlib import Path


def get_db_path():
    """Get the database path relative to this script's location."""
    script_dir = Path(__file__).parent
    return script_dir / "railway_freight_database.sqlite"


def inspect_database(db_path=None):
    """Inspect the SQLite database and return a comprehensive summary."""
    if db_path is None:
        db_path = get_db_path()

    if not os.path.exists(db_path):
        print(f"ERROR: Database not found at {db_path}")
        return None

    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    summary = {
        "database_file": str(db_path),
        "file_size_mb": round(os.path.getsize(db_path) / (1024 * 1024), 2),
        "tables": {}
    }

    # Get all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = [row[0] for row in cursor.fetchall()]
    summary["table_count"] = len(tables)
    summary["table_names"] = tables

    print("=" * 80)
    print("LONICS PREDICTION ENGINE - DATABASE INSPECTION")
    print("=" * 80)
    print(f"\nDatabase: {db_path}")
    print(f"File Size: {summary['file_size_mb']} MB")
    print(f"Total Tables: {len(tables)}")
    print(f"Tables: {', '.join(tables)}")

    for table in tables:
        print(f"\n{'-' * 80}")
        print(f"TABLE: {table}")
        print(f"{'-' * 80}")

        table_info = {"columns": [], "row_count": 0}

        # Get column info
        cursor.execute(f"PRAGMA table_info('{table}')")
        columns = cursor.fetchall()

        # Get row count
        cursor.execute(f"SELECT COUNT(*) FROM '{table}'")
        row_count = cursor.fetchone()[0]
        table_info["row_count"] = row_count
        print(f"Rows: {row_count}")

        print(f"\n{'Column':<40} {'Type':<15} {'Nullable':<10} {'PK':<5}")
        print(f"{'-'*40} {'-'*15} {'-'*10} {'-'*5}")

        col_names = []
        for col in columns:
            cid, name, dtype, notnull, default_val, pk = col
            col_info = {
                "name": name,
                "type": dtype,
                "notnull": bool(notnull),
                "primary_key": bool(pk)
            }
            table_info["columns"].append(col_info)
            col_names.append(name)
            nullable = "NO" if notnull else "YES"
            print(f"{name:<40} {dtype:<15} {nullable:<10} {'YES' if pk else '':<5}")

        # Sample data
        cursor.execute(f"SELECT * FROM '{table}' LIMIT 5")
        sample_rows = cursor.fetchall()

        if sample_rows:
            print(f"\nSample Data (first 5 rows):")
            # Print header
            header = " | ".join(f"{c:<20}" for c in col_names[:8])
            if len(col_names) > 8:
                header += " | ..."
            print(f"  {header}")
            print(f"  {'-' * len(header)}")

            for row in sample_rows:
                row_str = " | ".join(f"{str(v):<20}" for v in row[:8])
                if len(row) > 8:
                    row_str += " | ..."
                print(f"  {row_str}")

        # Analyze columns for date/time patterns and numeric ranges
        print(f"\nColumn Statistics:")
        for col_name in col_names:
            try:
                # Check for distinct values (useful for categorical columns)
                cursor.execute(f"SELECT COUNT(DISTINCT \"{col_name}\") FROM '{table}'")
                distinct_count = cursor.fetchone()[0]

                # Check for NULLs
                cursor.execute(f"SELECT COUNT(*) FROM '{table}' WHERE \"{col_name}\" IS NULL")
                null_count = cursor.fetchone()[0]

                # Try to get min/max for numeric/date columns
                cursor.execute(f"SELECT MIN(\"{col_name}\"), MAX(\"{col_name}\") FROM '{table}'")
                min_val, max_val = cursor.fetchone()

                stats = f"  {col_name}: distinct={distinct_count}, nulls={null_count}"
                if min_val is not None:
                    stats += f", min={min_val}, max={max_val}"

                # If few distinct values, show them all
                if distinct_count <= 20 and distinct_count > 0:
                    cursor.execute(f"SELECT DISTINCT \"{col_name}\" FROM '{table}' ORDER BY \"{col_name}\"")
                    distinct_vals = [str(r[0]) for r in cursor.fetchall()]
                    stats += f"\n    Values: {distinct_vals}"

                print(stats)
            except Exception as e:
                print(f"  {col_name}: Error analyzing - {e}")

        summary["tables"][table] = table_info

    # Classification summary
    print(f"\n{'=' * 80}")
    print("DATA CLASSIFICATION SUMMARY")
    print(f"{'=' * 80}")

    classifications = {
        "annual_freight": [],
        "monthly_freight": [],
        "commodity_data": [],
        "freight_earnings": [],
        "train_activity": [],
        "capacity_utilization": [],
        "dfc_activity": [],
        "other": []
    }

    keywords = {
        "annual_freight": ["annual", "yearly", "freight", "tonnage", "total"],
        "monthly_freight": ["monthly", "month"],
        "commodity_data": ["commodity", "coal", "iron", "cement", "goods", "loading", "container"],
        "freight_earnings": ["earning", "revenue", "income", "fare"],
        "train_activity": ["train", "locomotive", "wagon", "running"],
        "capacity_utilization": ["capacity", "utilization", "utilisation"],
        "dfc_activity": ["dfc", "dedicated", "corridor", "freight corridor"],
    }

    for table in tables:
        table_lower = table.lower()
        # Also check column names
        col_names_lower = [c["name"].lower() for c in summary["tables"][table]["columns"]]
        all_text = table_lower + " " + " ".join(col_names_lower)

        classified = False
        for category, kws in keywords.items():
            if any(kw in all_text for kw in kws):
                classifications[category].append(table)
                classified = True

        if not classified:
            classifications["other"].append(table)

    for category, category_tables in classifications.items():
        if category_tables:
            print(f"\n{category.upper().replace('_', ' ')}:")
            for t in category_tables:
                row_count = summary["tables"][t]["row_count"]
                cols = [c["name"] for c in summary["tables"][t]["columns"]]
                print(f"  - {t} ({row_count} rows): {', '.join(cols)}")

    conn.close()
    return summary


if __name__ == "__main__":
    summary = inspect_database()
    if summary:
        # Save as JSON for programmatic use
        output_path = Path(__file__).parent / "db_inspection_report.json"
        with open(output_path, "w") as f:
            json.dump(summary, f, indent=2, default=str)
        print(f"\n\nFull report saved to: {output_path}")
