import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCcw, Settings } from "react-feather";
import { useSelector } from "react-redux";
import { getBlob, ref, uploadBytes } from "firebase/storage";
import DeleteWidget from "../DeleteWidget";
import { MeetingScheduleSnapshot, Widget } from "../../Board";
import { useBoard } from "../../../../hooks/useBoard";
import { useFirestore } from "../../../../hooks/useFirestore";
import { GlobalData } from "../../../../store/global";
import { useAuth } from "../../../../contexts/AuthContext";
import { storage } from "../../../../firebase";
import "./MeetingScheduleWidget.css";

interface MeetingScheduleWidgetProps {
    id: string;
    theme: string;
    widgetData: Widget;
}

type MeetingScheduleConfig = {
    icsUrl: string;
    days: number;
    refreshInterval: number;
};

type MeetingEvent = MeetingScheduleSnapshot["events"][number];

const DEFAULT_DAYS = 7;
const DEFAULT_REFRESH_MINUTES = 30;

const CORS_PROXY = "https://corsproxy.io/?";
const ICS_FETCH_TIMEOUT_MS = 60000;

const unfoldICS = (ics: string) => ics.replace(/\r?\n[ \t]/g, "");

const extractValue = (line: string) => {
    const idx = line.indexOf(":");
    if (idx === -1) return "";
    return line.slice(idx + 1).trim();
};

const parseICSDate = (value: string): string | null => {
    if (!value) return null;
    const trimmed = value.trim();
    const isUTC = trimmed.endsWith("Z");
    const sanitized = trimmed.replace(/Z$/, "");
    const [datePart, timePart] = sanitized.split("T");
    if (!datePart || datePart.length !== 8) return null;

    const year = parseInt(datePart.slice(0, 4), 10);
    const month = parseInt(datePart.slice(4, 6), 10) - 1;
    const day = parseInt(datePart.slice(6, 8), 10);

    const hours = timePart?.slice(0, 2) ? parseInt(timePart.slice(0, 2), 10) : 0;
    const minutes = timePart?.slice(2, 4) ? parseInt(timePart.slice(2, 4), 10) : 0;
    const seconds = timePart?.slice(4, 6) ? parseInt(timePart.slice(4, 6), 10) : 0;

    if ([year, month, day].some((n) => Number.isNaN(n))) return null;
    if ([hours, minutes, seconds].some((n) => Number.isNaN(n))) return null;

    const date = isUTC
        ? new Date(Date.UTC(year, month, day, hours, minutes, seconds))
        : new Date(year, month, day, hours, minutes, seconds);

    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
};

const parseICSEvents = (ics: string): MeetingEvent[] => {
    const lines = unfoldICS(ics).split(/\r?\n/);
    const events: MeetingEvent[] = [];
    let draft: Partial<MeetingEvent> = {};

    lines.forEach((line) => {
        if (line.startsWith("BEGIN:VEVENT")) {
            draft = {};
            return;
        }
        if (line.startsWith("END:VEVENT")) {
            if (draft.start && draft.title) {
                const event: MeetingEvent = {
                    id:
                        draft.id ??
                        `${draft.start}-${draft.title}`.replace(/\s+/g, "-"),
                    title: draft.title,
                    start: draft.start,
                };
                if (draft.end) event.end = draft.end;
                if (draft.location) event.location = draft.location;
                events.push(event);
            }
            draft = {};
            return;
        }
        if (line.startsWith("UID")) {
            draft.id = extractValue(line);
        } else if (line.startsWith("SUMMARY")) {
            draft.title = extractValue(line);
        } else if (line.startsWith("DTSTART")) {
            draft.start = parseICSDate(extractValue(line)) ?? undefined;
        } else if (line.startsWith("DTEND")) {
            draft.end = parseICSDate(extractValue(line)) ?? undefined;
        } else if (line.startsWith("LOCATION")) {
            draft.location = extractValue(line);
        }
    });

    return events
        .filter((event) => Boolean(event.start))
        .sort(
            (a, b) =>
                new Date(a.start).getTime() - new Date(b.start).getTime()
        );
};

const fetchWithTimeout = async (
    target: string,
    timeoutMs: number = ICS_FETCH_TIMEOUT_MS
) => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(target, { signal: controller.signal });
        return response;
    } finally {
        window.clearTimeout(timer);
    }
};

const fetchIcsText = async (url: string) => {
    const attempt = async (target: string) => {
        const response = await fetchWithTimeout(target);
        if (!response.ok) {
            throw new Error("Unable to fetch the provided calendar.");
        }
        return response.text();
    };

    try {
        return await attempt(url);
    } catch (error) {
        // Commonly TypeError for CORS issues; retry using a proxy.
        if (error instanceof TypeError || (error as any)?.name === "AbortError") {
            const proxied = `${CORS_PROXY}${encodeURIComponent(url)}`;
            return attempt(proxied);
        }
        throw error;
    }
};

export default function MeetingScheduleWidget({
    id,
    theme,
    widgetData,
}: MeetingScheduleWidgetProps) {
    const { save } = useBoard();
    const { saveToFirestore } = useFirestore();
    const widgets = useSelector((state: GlobalData) => state.widgets);
    const layouts = useSelector((state: GlobalData) => state.layouts);
    const dashboards = useSelector((state: GlobalData) => state.dashboards);
    const activeDashboard = useSelector(
        (state: GlobalData) => state.activeDashboard
    );
    const { currentUser } = useAuth();

    const storagePath = useMemo(() => {
        if (!currentUser) return null;
        return `users/${currentUser.uid}/meetingSchedules/${id}.ics`;
    }, [currentUser, id]);

    const [urlInput, setUrlInput] = useState(
        widgetData.meetingScheduleConfig?.icsUrl ?? ""
    );
    const [daysInput, setDaysInput] = useState(
        widgetData.meetingScheduleConfig?.days?.toString() ??
            DEFAULT_DAYS.toString()
    );
    const [refreshInput, setRefreshInput] = useState(
        widgetData.meetingScheduleConfig?.refreshInterval?.toString() ??
            DEFAULT_REFRESH_MINUTES.toString()
    );
    const [isConfiguring, setIsConfiguring] = useState(
        !widgetData.meetingScheduleConfig
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const persistWidget = useCallback(
        async (partial: Partial<Widget>) => {
            const updatedWidget = { ...widgetData, ...partial };
            let targetWidgets = widgets;
            let targetLayouts = layouts;

            if (activeDashboard !== "home") {
                const dashboard = dashboards.find(
                    (dashB) => dashB.id === activeDashboard
                );
                if (dashboard) {
                    targetWidgets = dashboard.widgets;
                    targetLayouts = dashboard.layouts;
                }
            }

            const hasWidget = targetWidgets.some((w) => w.i === id);
            const newWidgets = hasWidget
                ? targetWidgets.map((w) => (w.i === id ? updatedWidget : w))
                : [...targetWidgets, updatedWidget];

            await save({ layout: targetLayouts, widgets: newWidgets });
            await saveToFirestore({ widgets: newWidgets });
        },
        [
            activeDashboard,
            dashboards,
            id,
            layouts,
            save,
            saveToFirestore,
            widgetData,
            widgets,
        ]
    );

    const storeAndReadIcs = useCallback(
        async (icsText: string) => {
            if (!storagePath) {
                throw new Error("Please sign in to cache calendar data.");
            }
            const fileRef = ref(storage, storagePath);
            const blob = new Blob([icsText], { type: "text/calendar" });
            await uploadBytes(fileRef, blob);
            const storedBlob = await getBlob(fileRef);
            return storedBlob.text();
        },
        [storagePath]
    );

    const buildSnapshot = useCallback(
        async (
            config: MeetingScheduleConfig
        ): Promise<MeetingScheduleSnapshot> => {
            if (!storagePath) {
                throw new Error("Please sign in to cache calendar data.");
            }
            const text = await fetchIcsText(config.icsUrl);
            const storedText = await storeAndReadIcs(text);
            const events = parseICSEvents(storedText);
            const now = Date.now();
            const cutoff = now + config.days * 24 * 60 * 60 * 1000;
            const upcoming = events.filter((event) => {
                const start = new Date(event.start).getTime();
                return start >= now && start <= cutoff;
            });

            if (upcoming.length === 0) {
                throw new Error("No upcoming meetings found in that range.");
            }

            return {
                cachedAt: Date.now(),
                events: upcoming,
            };
        },
        [storagePath, storeAndReadIcs]
    );

    const handleSave = useCallback(async () => {
        const url = urlInput.trim();
        if (!url) {
            setError("Please provide the direct URL to a .ics calendar file.");
            return;
        }

        const days = parseInt(daysInput, 10);
        if (!Number.isInteger(days) || days <= 0) {
            setError("Days to display must be a positive integer.");
            return;
        }

        const refreshInterval = parseInt(refreshInput, 10);
        if (!Number.isInteger(refreshInterval) || refreshInterval <= 0) {
            setError("Refresh interval must be a positive number of minutes.");
            return;
        }

        const config: MeetingScheduleConfig = {
            icsUrl: url,
            days,
            refreshInterval,
        };

        try {
            setLoading(true);
            const snapshot = await buildSnapshot(config);
            await persistWidget({
                meetingScheduleConfig: config,
                meetingScheduleSnapshot: snapshot,
            });
            setError(null);
            setIsConfiguring(false);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to save meeting schedule."
            );
        } finally {
            setLoading(false);
        }
    }, [buildSnapshot, daysInput, persistWidget, refreshInput, urlInput]);

    const handleRefresh = useCallback(async () => {
        if (!widgetData.meetingScheduleConfig) {
            setIsConfiguring(true);
            return;
        }

        try {
            setLoading(true);
            const snapshot = await buildSnapshot(
                widgetData.meetingScheduleConfig
            );
            await persistWidget({
                meetingScheduleSnapshot: snapshot,
            });
            setError(null);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to refresh meetings."
            );
        } finally {
            setLoading(false);
        }
    }, [buildSnapshot, persistWidget, widgetData.meetingScheduleConfig]);

    useEffect(() => {
        if (!widgetData.meetingScheduleConfig) return;
        setUrlInput(widgetData.meetingScheduleConfig.icsUrl);
        setDaysInput(widgetData.meetingScheduleConfig.days.toString());
        setRefreshInput(
            widgetData.meetingScheduleConfig.refreshInterval.toString()
        );
    }, [widgetData.meetingScheduleConfig]);

    useEffect(() => {
        const config = widgetData.meetingScheduleConfig;
        if (!config) return;

        let cancelled = false;
        const intervalMs = Math.max(config.refreshInterval, 1) * 60 * 1000;
        const shouldFetch = !widgetData.meetingScheduleSnapshot;

        const refreshData = async () => {
            try {
                const snapshot = await buildSnapshot(config);
                if (!cancelled) {
                    await persistWidget({
                        meetingScheduleSnapshot: snapshot,
                    });
                    setError(null);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Unable to refresh meetings."
                    );
                }
            }
        };

        if (shouldFetch) {
            refreshData();
        }

        const timer = window.setInterval(refreshData, intervalMs);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [
        buildSnapshot,
        persistWidget,
        widgetData.meetingScheduleConfig,
        widgetData.meetingScheduleSnapshot,
    ]);

    const snapshot = widgetData.meetingScheduleSnapshot;
    const upcomingEvents = useMemo(() => {
        if (!snapshot?.events) return [];
        const now = Date.now();
        return snapshot.events.filter(
            (event) => new Date(event.start).getTime() >= now
        );
    }, [snapshot?.events]);

    const nextMeetingId = upcomingEvents[0]?.id;
    const lastUpdated = snapshot?.cachedAt
        ? new Date(snapshot.cachedAt).toLocaleString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
              month: "short",
              day: "numeric",
          })
        : null;

    const renderSetup = () => (
        <div className="meeting-setup">
            <p className="meeting-helper">
                Provide a calendar feed (.ics), choose how many future days to
                display, and how often the widget should refresh.
            </p>
            <label className="meeting-field">
                <span>ICS URL</span>
                <input
                    type="url"
                    placeholder="https://example.com/calendar.ics"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                />
            </label>
            <label className="meeting-field">
                <span>Days to display</span>
                <input
                    type="number"
                    min={1}
                    value={daysInput}
                    onChange={(e) => setDaysInput(e.target.value)}
                />
            </label>
            <label className="meeting-field">
                <span>Refresh interval (minutes)</span>
                <input
                    type="number"
                    min={1}
                    value={refreshInput}
                    onChange={(e) => setRefreshInput(e.target.value)}
                />
            </label>
            {error && <p className="meeting-error">{error}</p>}
            <button
                type="button"
                className="meeting-save-button"
                onClick={handleSave}
                disabled={loading}
            >
                {loading ? "Saving…" : "Save Settings"}
            </button>
        </div>
    );

    const renderSchedule = () => (
        <div className="meeting-body">
            <div className="meeting-meta">
                <div>
                    {widgetData.meetingScheduleConfig && (
                        <small>
                            Showing next {widgetData.meetingScheduleConfig.days}{" "}
                            day
                            {widgetData.meetingScheduleConfig.days > 1
                                ? "s"
                                : ""}
                        </small>
                    )}
                    {lastUpdated && <small>Updated {lastUpdated}</small>}
                </div>
                {error && <small className="meeting-error-inline">{error}</small>}
            </div>
            <div className="meeting-list">
                {upcomingEvents.length === 0 && (
                    <p className="meeting-empty">
                        No upcoming meetings found in that window.
                    </p>
                )}
                {upcomingEvents.map((event) => {
                    const startDate = new Date(event.start);
                    const endDate = event.end ? new Date(event.end) : null;
                    const timeLabel = endDate
                        ? `${startDate.toLocaleTimeString(undefined, {
                              hour: "numeric",
                              minute: "2-digit",
                          })} – ${endDate.toLocaleTimeString(undefined, {
                              hour: "numeric",
                              minute: "2-digit",
                          })}`
                        : startDate.toLocaleTimeString(undefined, {
                              hour: "numeric",
                              minute: "2-digit",
                          });

                    return (
                        <div
                            key={event.id}
                            className={`meeting-item ${
                                event.id === nextMeetingId ? "next-meeting" : ""
                            }`}
                        >
                            <div className="meeting-time">
                                <span className="meeting-day">
                                    {startDate.toLocaleDateString(undefined, {
                                        weekday: "short",
                                        month: "short",
                                        day: "numeric",
                                    })}
                                </span>
                                <span className="meeting-hours">{timeLabel}</span>
                            </div>
                            <div className="meeting-details">
                                <strong>{event.title}</strong>
                                {event.location && (
                                    <small className="meeting-location">
                                        {event.location}
                                    </small>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    if (!currentUser) {
        return (
            <div className={`widget MeetingScheduleWidget ${theme}`}>
                <div className="header">
                    <div className="widgetTitle">Meeting Schedule</div>
                    <DeleteWidget id={id} />
                </div>
                <div className="content">
                    <p className="meeting-empty">
                        Please sign in to configure your meeting schedule.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={`widget MeetingScheduleWidget ${theme}`}>
            <div className="header">
                <div className="widgetTitle">Meeting Schedule</div>
                <div
                    className="widgetButtons"
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <button
                        className="meeting-icon-button"
                        type="button"
                        title="Refresh"
                        onClick={handleRefresh}
                        disabled={loading || !widgetData.meetingScheduleConfig}
                    >
                        <RefreshCcw size={12} />
                    </button>
                    <button
                        className="meeting-icon-button"
                        type="button"
                        title="Settings"
                        onClick={() => setIsConfiguring(true)}
                    >
                        <Settings size={12} />
                    </button>
                    <DeleteWidget id={id} />
                </div>
            </div>
            <div className="content">
                {loading && !isConfiguring && (
                    <p className="meeting-loading">Loading meetings…</p>
                )}
                {isConfiguring || !widgetData.meetingScheduleConfig
                    ? renderSetup()
                    : renderSchedule()}
            </div>
        </div>
    );
}
