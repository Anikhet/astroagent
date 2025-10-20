#!/usr/bin/env python3
"""Test script for the new OpenAI Agents SDK implementation."""

import os
import sys
from datetime import datetime, timezone

# Add the app directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from agent_planner import build_agent_response


def test_agent():
    """Test the agent with sample data."""
    print("Testing OpenAI Agents SDK implementation...")
    
    # Test parameters
    lat = 37.7749  # San Francisco
    lon = -122.4194
    elev = 0.0
    dt = datetime.now(timezone.utc)
    target = "saturn"
    
    try:
        result = build_agent_response(
            lat=lat,
            lon=lon,
            elev=elev,
            dt=dt,
            target=target
        )
        print(f"✅ Agent response: {result}")
        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


if __name__ == "__main__":
    if not os.getenv("OPENAI_API_KEY"):
        print("❌ OPENAI_API_KEY environment variable not set")
        sys.exit(1)
    
    success = test_agent()
    sys.exit(0 if success else 1)


