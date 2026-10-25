import unittest
from datetime import date, time

from app.analysis import build_analysis, expected_intervals


class AsOfAnalysisTests(unittest.TestCase):
    def test_january_day_has_24_hourly_comparison_slots(self):
        self.assertEqual(expected_intervals(date(2026, 1, 12)), 24)
        self.assertEqual(expected_intervals(date(2026, 1, 12), 30), 48)

    def test_selects_latest_forecast_available_at_cutoff_and_ignores_later_runs(self):
        target = "2026-01-12T10:00:00Z"
        actuals = [
            {"fuelType": "WIND", "startTime": target, "publishTime": "2026-01-13T00:00:00Z", "generation": 100},
            {"fuelType": "WIND", "startTime": "2026-01-12T10:30:00Z", "publishTime": "2026-01-13T00:00:00Z", "generation": 100},
            {"fuelType": "GAS", "startTime": target, "publishTime": "2026-01-13T00:00:00Z", "generation": 999},
        ]
        forecasts = [
            {"startTime": target, "publishTime": "2026-01-11T08:30:00Z", "generation": 90},
            {"startTime": target, "publishTime": "2026-01-11T09:30:00Z", "generation": 95},
            {"startTime": target, "publishTime": "2026-01-11T10:00:00Z", "generation": 1000},
        ]
        result = build_analysis(date(2026, 1, 12), date(2026, 1, 12), time(9, 50), actuals, forecasts)
        row = next(row for row in result["intervals"] if row["startTime"] == target)
        self.assertEqual(row["actualMW"], 100)
        self.assertEqual(row["forecastMW"], 95)
        self.assertEqual(row["forecastPublishTime"], "2026-01-11T09:30:00Z")
        self.assertEqual(row["errorMW"], -5)
        self.assertEqual(result["metrics"]["matchedIntervals"], 1)
        self.assertEqual(result["comparisonResolutionMinutes"], 60)

    def test_hourly_outturn_uses_mean_of_two_half_hour_actuals(self):
        result = build_analysis(
            date(2026, 1, 12),
            date(2026, 1, 12),
            time(9, 50),
            [
                {"fuelType": "WIND", "startTime": "2026-01-12T10:00:00Z", "publishTime": "2026-01-12T11:00:00Z", "generation": 100},
                {"fuelType": "WIND", "startTime": "2026-01-12T10:30:00Z", "publishTime": "2026-01-12T11:00:00Z", "generation": 120},
            ],
            [{"startTime": "2026-01-12T10:00:00Z", "publishTime": "2026-01-11T09:30:00Z", "generation": 110}],
        )
        row = next(row for row in result["intervals"] if row["startTime"] == "2026-01-12T10:00:00Z")
        self.assertEqual(row["actualMW"], 110)
        self.assertEqual(row["errorMW"], 0)
        self.assertEqual(result["daily"][0]["matchedIntervals"], 1)

    def test_missing_values_are_not_counted_as_zero(self):
        result = build_analysis(date(2026, 1, 1), date(2026, 1, 1), time(9, 50), [], [])
        self.assertEqual(result["metrics"]["matchedIntervals"], 0)
        self.assertIsNone(result["metrics"]["maeMW"])
        self.assertEqual(result["metrics"]["coveragePercent"], 0.0)


if __name__ == "__main__":
    unittest.main()
