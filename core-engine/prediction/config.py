"""
Lonics Prediction Engine - Configuration

Centralizes all configurable settings for the prediction engine.
All paths are relative to the engine root directory.
"""

from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional


# Engine root directory (where this package lives)
ENGINE_ROOT = Path(__file__).parent.parent.resolve()


@dataclass
class DatabaseConfig:
    """Database connection settings."""
    filename: str = "railway_freight_database.sqlite"
    
    @property
    def path(self) -> Path:
        candidate_paths = [
            ENGINE_ROOT / self.filename,
            Path.cwd() / self.filename,
            Path.cwd() / "core-engine" / self.filename,
            ENGINE_ROOT.parent / "prediction model" / "lonics_prediction_engine" / self.filename,
        ]
        for p in candidate_paths:
            if p.is_file():
                return p
        return ENGINE_ROOT / self.filename


@dataclass
class ModelConfig:
    """Model training and storage settings."""
    model_dir: str = "models"
    
    # Forecast horizon (number of periods ahead)
    default_forecast_horizon: int = 5  # years for annual
    default_monthly_horizon: int = 12  # months
    
    # Models to evaluate
    candidate_models: tuple = (
        "naive",
        "linear_trend",
        "recent_growth",
        "holt_winters",
        "seasonal_naive",
    )
    
    # Backtesting settings
    min_train_years: int = 8  # minimum years of data for training
    backtest_start_offset: int = 5  # number of hold-out periods for backtesting
    
    # Prediction intervals
    confidence_level: float = 0.90  # 90% prediction interval
    
    @property
    def model_path(self) -> Path:
        candidate_paths = [
            ENGINE_ROOT / self.model_dir,
            Path.cwd() / self.model_dir,
            Path.cwd() / "core-engine" / self.model_dir,
            ENGINE_ROOT.parent / "prediction model" / "lonics_prediction_engine" / self.model_dir,
        ]
        for p in candidate_paths:
            if p.is_dir() and (p / "training_report.json").is_file():
                return p
        path = ENGINE_ROOT / self.model_dir
        path.mkdir(parents=True, exist_ok=True)
        return path


@dataclass
class NetworkConfig:
    """Network pressure score settings."""
    # Pressure level thresholds (0-100 score)
    low_threshold: float = 30.0
    moderate_threshold: float = 55.0
    high_threshold: float = 80.0
    # Above high_threshold = CRITICAL
    
    # Component weights for network pressure score
    weights: dict = field(default_factory=lambda: {
        "capacity_utilization": 0.35,
        "freight_growth": 0.25,
        "train_density": 0.25,
        "dfc_load": 0.15,
    })
    
    def get_level(self, score: float) -> str:
        """Get pressure level from score."""
        if score < self.low_threshold:
            return "LOW"
        elif score < self.moderate_threshold:
            return "MODERATE"
        elif score < self.high_threshold:
            return "HIGH"
        else:
            return "CRITICAL"


@dataclass
class ShipmentConfig:
    """Shipment intelligence settings."""
    # Commodity rail suitability base scores (higher = more suitable for rail)
    commodity_suitability: dict = field(default_factory=lambda: {
        "coal": 95,
        "iron_ore": 92,
        "cement": 85,
        "containers": 80,
        "foodgrains": 78,
        "others": 70,
    })
    
    # Weight thresholds for rail suitability
    min_rail_weight_tonnes: float = 5.0  # Below this, rail is less suitable
    optimal_rail_weight_tonnes: float = 20.0  # Full trainload equivalent
    
    # Consolidation thresholds
    consolidation_weight_threshold: float = 15.0  # tonnes


@dataclass
class APIConfig:
    """FastAPI server settings."""
    host: str = "0.0.0.0"
    port: int = 8001
    title: str = "Lonics Prediction Engine"
    description: str = "Railway Freight Forecasting and Intelligence API"
    version: str = "1.0.0"


@dataclass
class EngineConfig:
    """Master configuration for the entire prediction engine."""
    database: DatabaseConfig = field(default_factory=DatabaseConfig)
    model: ModelConfig = field(default_factory=ModelConfig)
    network: NetworkConfig = field(default_factory=NetworkConfig)
    shipment: ShipmentConfig = field(default_factory=ShipmentConfig)
    api: APIConfig = field(default_factory=APIConfig)


# Global configuration instance
config = EngineConfig()
