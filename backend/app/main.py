from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse
from typing import Optional
import requests
from datetime import datetime, timezone
from fastapi.middleware.cors import CORSMiddleware

from .services.ephemeris import compute_sky_snapshot, compute_planner

app = FastAPI(title="AstroAgent Ephemeris API", version="0.1.0")

# Allow local Next.js dev servers
app.add_middleware(
	CORSMiddleware,
	allow_origins=[
		"http://localhost:3000",
		"http://127.0.0.1:3000",
		"http://localhost:3005",
		"http://127.0.0.1:3005",
		"http://localhost:5173",
		"http://127.0.0.1:5173",
	],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)


@app.get("/api/sky")
async def get_sky(
	lat: float = Query(..., ge=-90.0, le=90.0),
	lon: float = Query(..., ge=-180.0, le=180.0),
	elev: float = Query(0.0, ge=-500.0, le=9000.0),
	dt: Optional[str] = Query(None, alias="datetime"),
	refraction: bool = Query(True),
):
	try:
		obs_dt = (
			datetime.fromisoformat(dt.replace("Z", "+00:00")).astimezone(timezone.utc)
			if dt
			else datetime.now(timezone.utc)
		)
		snapshot = compute_sky_snapshot(
			latitude_deg=lat,
			longitude_deg=lon,
			elevation_m=elev,
			when_utc=obs_dt,
			apply_refraction=refraction,
		)
		return JSONResponse(content=snapshot)
	except ValueError as e:
		return JSONResponse(status_code=400, content={"code": "BadRequest", "message": str(e)})
	except Exception as e:  # pragma: no cover - fallback
		return JSONResponse(status_code=500, content={"code": "InternalError", "message": str(e)})


@app.get("/api/plan")
async def get_plan(
	lat: float = Query(..., ge=-90.0, le=90.0),
	lon: float = Query(..., ge=-180.0, le=180.0),
	elev: float = Query(0.0, ge=-500.0, le=9000.0),
	dt: Optional[str] = Query(None, alias="datetime"),
	refraction: bool = Query(True),
	target: str = Query("saturn"),
	clouds: Optional[float] = Query(None, ge=0.0, le=100.0, alias="cloudCoverPct"),
):
	try:
		obs_dt = (
			datetime.fromisoformat(dt.replace("Z", "+00:00")).astimezone(timezone.utc)
			if dt
			else datetime.now(timezone.utc)
		)
		# Fetch cloud cover from Open-Meteo hourly forecast
		clouds_pct = None
		try:
			om = requests.get(
				"https://api.open-meteo.com/v1/forecast",
				params={
					"latitude": lat,
					"longitude": lon,
					"hourly": "cloud_cover",
					"timezone": "UTC",
				},
				timeout=6,
			)
			if om.ok:
				data = om.json()
				hours = data.get("hourly", {}).get("time", [])
				vals = data.get("hourly", {}).get("cloud_cover", [])
				if hours and vals:
					# naive: pick current nearest hour
					clouds_pct = float(vals[0])
		except Exception:
			pass

		plan = compute_planner(
			latitude_deg=lat,
			longitude_deg=lon,
			elevation_m=elev,
			when_utc=obs_dt,
			apply_refraction=refraction,
			target_body=target,
			cloud_cover_pct=clouds if clouds is not None else clouds_pct,
		)
		return JSONResponse(content=plan)
	except ValueError as e:
		return JSONResponse(status_code=400, content={"code": "BadRequest", "message": str(e)})
	except Exception as e:
		return JSONResponse(status_code=500, content={"code": "InternalError", "message": str(e)})
