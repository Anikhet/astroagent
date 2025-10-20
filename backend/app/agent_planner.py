from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict

import requests
from agents import Agent, Runner


def fetch_plan(lat: float, lon: float, elev: float, datetime: str, target: str) -> Dict[str, Any]:
    """Fetch observing plan metrics and recommendation for a given time/location/target.
    
    Args:
        lat: Latitude in degrees (-90 to 90)
        lon: Longitude in degrees (-180 to 180)
        elev: Elevation in meters
        datetime: ISO 8601 datetime in UTC
        target: Target celestial body (e.g., 'saturn', 'jupiter', 'mars')
    
    Returns:
        Dictionary containing observation plan with metrics and recommendations
    """
    params = {
        "lat": lat,
        "lon": lon,
        "elev": elev,
        "datetime": datetime,
        "target": target,
    }
    r = requests.get("http://127.0.0.1:8001/api/plan", params=params, timeout=15)
    r.raise_for_status()
    return r.json()


def build_agent_response(
    *,
    lat: float,
    lon: float,
    elev: float,
    dt: datetime,
    target: str,
) -> str:
    """Build agent response using OpenAI Agents SDK."""
    # Create agent with instructions and tools
    agent = Agent(
        name="AstroPlanner",
        instructions=(
            "You are an astronomical observing planner. Provide concise recommendations "
            "for celestial observations. Use the fetch_plan tool to get deterministic metrics. "
            "If the score >= 0.75 say 'Good window', otherwise 'Poor window'. "
            "Include key metrics like altitude, sun position, moon separation, and cloud cover."
        ),
        tools=[fetch_plan]
    )
    
    user_dt_iso = dt.astimezone(timezone.utc).replace(tzinfo=None).isoformat() + "Z"
    
    # Create user message
    user_message = (
        f"Plan observation for target={target}, lat={lat}, lon={lon}, elev={elev}, datetime={user_dt_iso}."
    )
    
    # Run the agent
    result = Runner.run_sync(agent, user_message)
    
    return result.final_output


def main(argv: list[str]) -> int:
    if not os.getenv("OPENAI_API_KEY"):
        print("OPENAI_API_KEY is not set", file=sys.stderr)
        return 2

    parser = argparse.ArgumentParser(description="AstroAgent Planner via OpenAI Agent")
    parser.add_argument("--lat", type=float, required=True)
    parser.add_argument("--lon", type=float, required=True)
    parser.add_argument("--elev", type=float, default=0.0)
    parser.add_argument("--datetime", type=str, help="ISO datetime (UTC)")
    parser.add_argument("--target", type=str, default="saturn")
    args = parser.parse_args(argv)

    dt = (
        datetime.fromisoformat(args.datetime.replace("Z", "+00:00")).astimezone(timezone.utc)
        if args.datetime
        else datetime.now(timezone.utc)
    )

    text = build_agent_response(
        lat=args.lat,
        lon=args.lon,
        elev=args.elev,
        dt=dt,
        target=args.target,
    )
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))