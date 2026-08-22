"""
Lonics Prediction Engine - Database Access Layer

Handles all SQLite database operations. Dynamically discovers the schema
and provides clean DataFrames for the prediction modules.
"""

import sqlite3
import pandas as pd
from pathlib import Path
from typing import Optional

from .config import config


class FreightDatabase:
    """
    Database access layer for the railway freight database.
    
    Dynamically discovers tables and columns from the SQLite schema.
    All queries return pandas DataFrames.
    """
    
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or config.database.path
        if not self.db_path.exists():
            raise FileNotFoundError(
                f"Database not found at {self.db_path}. "
                f"Expected location: {config.database.path}"
            )
        self._schema_cache = None
    
    def _get_connection(self) -> sqlite3.Connection:
        """Create a new database connection."""
        return sqlite3.connect(str(self.db_path))
    
    def get_schema(self) -> dict:
        """
        Discover and return the full database schema.
        
        Returns:
            dict mapping table names to lists of column info dicts.
        """
        if self._schema_cache is not None:
            return self._schema_cache
        
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' "
            "AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
        tables = [row[0] for row in cursor.fetchall()]
        
        schema = {}
        for table in tables:
            cursor.execute(f"PRAGMA table_info('{table}')")
            columns = []
            for col in cursor.fetchall():
                columns.append({
                    "name": col[1],
                    "type": col[2],
                    "notnull": bool(col[3]),
                    "primary_key": bool(col[5])
                })
            schema[table] = columns
        
        conn.close()
        self._schema_cache = schema
        return schema
    
    def query(self, sql: str, params: tuple = ()) -> pd.DataFrame:
        """Execute a SQL query and return results as a DataFrame."""
        conn = self._get_connection()
        df = pd.read_sql_query(sql, conn, params=params)
        conn.close()
        return df
    
    def get_table(self, table_name: str) -> pd.DataFrame:
        """Load an entire table as a DataFrame."""
        conn = self._get_connection()
        df = pd.read_sql_query(f"SELECT * FROM '{table_name}'", conn)
        conn.close()
        return df
    
    # ─── Convenience Methods ────────────────────────────────────────────
    
    def get_annual_overview(self) -> pd.DataFrame:
        """
        Load annual freight overview data.
        
        Returns DataFrame with columns:
            fiscal_year, total_freight_originating_million_tonnes,
            total_freight_earnings_inr_crore
        """
        df = self.get_table("annual_overview")
        df = df.sort_values("fiscal_year").reset_index(drop=True)
        return df
    
    def get_commodity_loading(self) -> pd.DataFrame:
        """
        Load commodity-wise freight loading data.
        
        Returns DataFrame with columns:
            fiscal_year, coal_mt, iron_ore_mt, cement_mt,
            containers_mt, foodgrains_mt, others_mt
        """
        df = self.get_table("commodity_loading")
        df = df.sort_values("fiscal_year").reset_index(drop=True)
        return df
    
    def get_golden_quadrilateral(self) -> pd.DataFrame:
        """
        Load Golden Quadrilateral traffic data.
        
        Includes capacity utilization, train density, and DFC interchanges.
        """
        df = self.get_table("golden_quadrilateral_traffic")
        df = df.sort_values("fiscal_year").reset_index(drop=True)
        return df
    
    def get_monthly_trends(self) -> pd.DataFrame:
        """
        Load monthly freight trend data.
        
        Returns DataFrame with columns:
            id, fiscal_year, month_number, month_name,
            monthly_originating_freight_mt
        """
        df = self.get_table("monthly_trends")
        df = df.sort_values(["fiscal_year", "month_number"]).reset_index(drop=True)
        return df
    
    def get_information_sources(self) -> pd.DataFrame:
        """Load information sources metadata."""
        return self.get_table("information_sources")
    
    def get_commodity_columns(self) -> list[str]:
        """
        Dynamically discover commodity column names from the commodity_loading table.
        
        Returns list of column names that represent commodities
        (excludes fiscal_year).
        """
        schema = self.get_schema()
        if "commodity_loading" not in schema:
            return []
        
        return [
            col["name"] for col in schema["commodity_loading"]
            if col["name"] != "fiscal_year"
        ]
    
    def has_dfc_data(self) -> bool:
        """Check if DFC (Dedicated Freight Corridor) data exists with non-zero values."""
        schema = self.get_schema()
        if "golden_quadrilateral_traffic" not in schema:
            return False
        
        col_names = [c["name"] for c in schema["golden_quadrilateral_traffic"]]
        dfc_cols = [c for c in col_names if "dfc" in c.lower()]
        
        if not dfc_cols:
            return False
        
        df = self.get_golden_quadrilateral()
        for col in dfc_cols:
            if (df[col] > 0).any():
                return True
        
        return False
    
    def get_fiscal_year_numeric(self, fy_string: str) -> int:
        """
        Extract the starting year from a fiscal year string.
        
        Example: 'FY 2023-2024' -> 2023
        """
        # Handle formats like 'FY 2023-2024' or 'FY 2023-24'
        parts = fy_string.replace("FY ", "").split("-")
        return int(parts[0])
    
    def get_latest_fiscal_year(self) -> str:
        """Get the most recent fiscal year in the annual overview."""
        df = self.get_annual_overview()
        return df["fiscal_year"].iloc[-1]
    
    def get_next_fiscal_year(self, current_fy: str) -> str:
        """
        Generate the next fiscal year string.
        
        Example: 'FY 2025-2026' -> 'FY 2026-2027'
        """
        start_year = self.get_fiscal_year_numeric(current_fy)
        next_start = start_year + 1
        next_end = next_start + 1
        return f"FY {next_start}-{next_end}"


# Singleton database instance
_db_instance: Optional[FreightDatabase] = None


def get_database(db_path: Optional[Path] = None) -> FreightDatabase:
    """Get or create the singleton database instance."""
    global _db_instance
    if _db_instance is None or (db_path is not None and _db_instance.db_path != db_path):
        _db_instance = FreightDatabase(db_path)
    return _db_instance
