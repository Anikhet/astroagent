from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, List, Tuple
import math

from skyfield.api import load, wgs84

_BASE_DIR = Path(__file__).resolve().parent.parent
_DATA_DIR = _BASE_DIR / "data"
_DATA_DIR.mkdir(parents=True, exist_ok=True)

_TS = load.timescale()
_EPH = load("de440s.bsp")

# Map our ids to EPHEMERIS names present in de440s
_TARGETS: List[Tuple[str, str]] = [
	("sun", "sun"),
	("moon", "moon"),
	("mercury", "mercury"),
	("venus", "venus"),
	("mars", "mars barycenter"),
	("jupiter", "jupiter barycenter"),
	("saturn", "saturn barycenter"),
	("uranus", "uranus barycenter"),
	# ("neptune", "neptune barycenter"),
]

_ID_TO_NAME = {i: n for i, n in _TARGETS}


def _topocentric_ra_dec_and_altaz(
	latitude_deg: float,
	longitude_deg: float,
	elevation_m: float,
	when_utc: datetime,
	apply_refraction: bool,
) -> list[dict[str, Any]]:
	"""Compute RA/Dec and Alt/Az for Sun, Moon, and planets from observer location."""
	ts = _TS.from_datetime(when_utc)
	# Pass signed degrees directly (east-positive longitudes)
	observer = wgs84.latlon(latitude_deg, longitude_deg, elevation_m)
	earth_from_surface = _EPH["earth"] + observer

	results: list[dict[str, Any]] = []
	for body_id, eph_name in _TARGETS:
		target = _EPH[eph_name]
		apparent = earth_from_surface.at(ts).observe(target).apparent()
		ra, dec, distance = apparent.radec()
		alt, az, _ = apparent.altaz()
		results.append(
			{
				"id": body_id,
				"name": body_id.capitalize(),
				"ra": ra.hours,
				"dec": dec.degrees,
				"az": az.degrees,
				"alt": alt.degrees,
				"distanceKm": distance.km,
			}
		)
	return results


def compute_sky_snapshot(
	latitude_deg: float,
	longitude_deg: float,
	elevation_m: float,
	when_utc: datetime,
	apply_refraction: bool,
) -> Dict[str, Any]:
	bodies = _topocentric_ra_dec_and_altaz(
		latitude_deg, longitude_deg, elevation_m, when_utc, apply_refraction
	)
	snapshot = {
		"observer": {
			"latitude": latitude_deg,
			"longitude": longitude_deg,
			"elevationM": elevation_m,
			"datetime": when_utc.replace(tzinfo=None).isoformat() + "Z",
		},
		"bodies": bodies,
		"meta": {
			"engine": "skyfield-de440s",
			"refraction": apply_refraction,
		},
	}
	return snapshot


def _clamp01(x: float) -> float:
	return max(0.0, min(1.0, x))


def _angular_separation_deg(ra1_deg: float, dec1_deg: float, ra2_deg: float, dec2_deg: float) -> float:
	ra1 = math.radians(ra1_deg)
	ra2 = math.radians(ra2_deg)
	dec1 = math.radians(dec1_deg)
	dec2 = math.radians(dec2_deg)
	cos_sep = (
		math.sin(dec1) * math.sin(dec2)
		+ math.cos(dec1) * math.cos(dec2) * math.cos(ra1 - ra2)
	)
	cos_sep = max(-1.0, min(1.0, cos_sep))
	return math.degrees(math.acos(cos_sep))


def compute_planner(
	latitude_deg: float,
	longitude_deg: float,
	elevation_m: float,
	when_utc: datetime,
	apply_refraction: bool,
	target_body: str,
	cloud_cover_pct: float | None = None,
) -> Dict[str, Any]:
	"""Return a plan object with target alt/az and observing recommendation expected by frontend."""
	bodies = _topocentric_ra_dec_and_altaz(
		latitude_deg, longitude_deg, elevation_m, when_utc, apply_refraction
	)
	target_id = target_body.lower()
	target = next((b for b in bodies if b["id"] == target_id), None)
	sun = next((b for b in bodies if b["id"] == "sun"), None)
	moon = next((b for b in bodies if b["id"] == "moon"), None)
	if not target or not sun or not moon:
		raise ValueError("Required bodies not available")

	# Metrics
	target_alt = float(target["alt"])  # deg
	sun_alt = float(sun["alt"])  # deg
	# RA hours -> degrees
	target_ra_deg = float(target["ra"]) * 15.0
	target_dec_deg = float(target["dec"])
	moon_ra_deg = float(moon["ra"]) * 15.0
	moon_dec_deg = float(moon["dec"])
	moon_sep = _angular_separation_deg(target_ra_deg, target_dec_deg, moon_ra_deg, moon_dec_deg)

	metrics = {
		"targetAltitudeDeg": target_alt,
		"sunAltitudeDeg": sun_alt,
		"moonTargetSeparationDeg": moon_sep,
		"cloudCoverPct": cloud_cover_pct if cloud_cover_pct is not None else None,
	}

	# Criteria scores 0..1
	alt_score = _clamp01((target_alt - 10.0) / 30.0)  # 0 at 10°, 1 at 40°+
	sun_score = _clamp01((-sun_alt) / 18.0)  # 1 when sun <= -18° (astronomical twilight)
	moon_score = _clamp01(moon_sep / 60.0)  # 1 when >= 60° from Moon
	clouds_score = 0.5 if cloud_cover_pct is None else _clamp01(1.0 - (cloud_cover_pct / 100.0))

	# Base blended score
	score = (alt_score + sun_score + moon_score + clouds_score) / 4.0

	# Hard visibility gate: if target is below horizon or it's brighter than civil twilight,
	# force score to 0. This reflects that the target is not practically observable.
	if (target_alt <= 0.0) or (sun_alt >= -6.0):
		score = 0.0
	ok = (score >= 0.6) and (target_alt > 10.0) and (sun_alt < -6.0)

	return {
		"observer": {
			"latitude": latitude_deg,
			"longitude": longitude_deg,
			"elevationM": elevation_m,
			"datetime": when_utc.replace(tzinfo=None).isoformat() + "Z",
		},
		"target": target_id,
		"metrics": metrics,
		"recommendation": {
			"ok": ok,
			"score": score,
			"criteria": {
				"alt": alt_score,
				"sun": sun_score,
				"moon": moon_score,
				"clouds": clouds_score,
			},
		},
	}


def compute_future_windows(
	latitude_deg: float,
	longitude_deg: float,
	elevation_m: float,
	start_datetime: datetime,
	target_body: str,
	days_ahead: int = 60,
	max_windows: int = 3,
	apply_refraction: bool = True,
	cloud_cover_pct: float | None = None,
) -> Dict[str, Any]:
	"""Find the best future viewing windows for a celestial object.
	
	Args:
		latitude_deg: Observer latitude in degrees
		longitude_deg: Observer longitude in degrees  
		elevation_m: Observer elevation in meters
		start_datetime: Starting datetime to search from
		target_body: Target celestial body (e.g., 'saturn', 'jupiter')
		days_ahead: Number of days to search ahead (default 60)
		max_windows: Maximum number of windows to return (default 3)
		apply_refraction: Whether to apply atmospheric refraction
		cloud_cover_pct: Cloud cover percentage (None for unknown)
		
	Returns:
		Dictionary containing array of best viewing windows
	"""
	windows = []
	
	# Sample daily at local midnight (optimal dark sky time)
	for day_offset in range(1, days_ahead + 1):
		# Calculate local midnight for this day
		sample_datetime = start_datetime + timedelta(days=day_offset)
		# Set to local midnight (00:00 local time)
		sample_datetime = sample_datetime.replace(hour=0, minute=0, second=0, microsecond=0)
		
		try:
			# Get observation plan for this datetime
			plan = compute_planner(
				latitude_deg=latitude_deg,
				longitude_deg=longitude_deg,
				elevation_m=elevation_m,
				when_utc=sample_datetime,
				apply_refraction=apply_refraction,
				target_body=target_body,
				cloud_cover_pct=cloud_cover_pct,
			)
			
			score = plan["recommendation"]["score"]
			metrics = plan["metrics"]
			
			# Only consider windows with reasonable scores (> 0.3)
			if score > 0.3:
				# Create human-readable date range (±2 days around the optimal time)
				date_str = sample_datetime.strftime("%b %d, %Y")
				
				windows.append({
					"datetime": sample_datetime.replace(tzinfo=None).isoformat() + "Z",
					"dateRange": date_str,
					"score": score,
					"metrics": metrics,
					"recommendation": plan["recommendation"]
				})
				
		except Exception:
			# Skip dates that fail (e.g., invalid ephemeris data)
			continue
	
	# Sort by score (highest first) and take top windows
	windows.sort(key=lambda w: w["score"], reverse=True)
	top_windows = windows[:max_windows]
	
	return {
		"target": target_body.lower(),
		"searchPeriod": {
			"startDate": start_datetime.replace(tzinfo=None).isoformat() + "Z",
			"daysAhead": days_ahead
		},
		"windows": top_windows,
		"totalFound": len(windows),
		"returned": len(top_windows)
	}
