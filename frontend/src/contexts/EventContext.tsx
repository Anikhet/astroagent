"use client";

import React, {
  createContext,
  useContext,
  useState,
  FC,
  PropsWithChildren,
} from "react";
import { LoggedEvent } from "@/types/chat";

type EventContextValue = {
  loggedEvents: LoggedEvent[];
  logClientEvent: (eventData: Record<string, any>, eventNameSuffix?: string) => void;
  logServerEvent: (eventData: Record<string, any>, eventNameSuffix?: string) => void;
};

const EventContext = createContext<EventContextValue | undefined>(undefined);

export const EventProvider: FC<PropsWithChildren> = ({ children }) => {
  const [loggedEvents, setLoggedEvents] = useState<LoggedEvent[]>([]);

  function newTimestampPretty(): string {
    const now = new Date();
    const time = now.toLocaleTimeString([], {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const ms = now.getMilliseconds().toString().padStart(3, "0");
    return `${time}.${ms}`;
  }

  const logClientEvent = (eventData: Record<string, any>, eventNameSuffix = "") => {
    const eventName = `client${eventNameSuffix ? `_${eventNameSuffix}` : ""}`;
    const newEvent: LoggedEvent = {
      id: Date.now(),
      direction: "client",
      expanded: false,
      timestamp: newTimestampPretty(),
      eventName,
      eventData,
    };
    setLoggedEvents((prev) => [...prev, newEvent]);
  };

  const logServerEvent = (eventData: Record<string, any>, eventNameSuffix = "") => {
    const eventName = `server${eventNameSuffix ? `_${eventNameSuffix}` : ""}`;
    const newEvent: LoggedEvent = {
      id: Date.now(),
      direction: "server",
      expanded: false,
      timestamp: newTimestampPretty(),
      eventName,
      eventData,
    };
    setLoggedEvents((prev) => [...prev, newEvent]);
  };

  return (
    <EventContext.Provider
      value={{
        loggedEvents,
        logClientEvent,
        logServerEvent,
      }}
    >
      {children}
    </EventContext.Provider>
  );
};

export function useEvent() {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error("useEvent must be used within an EventProvider");
  }
  return context;
}



