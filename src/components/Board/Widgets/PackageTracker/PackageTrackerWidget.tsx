import React, { useCallback, useEffect, useMemo, useState } from "react";
import DeleteWidget from "../DeleteWidget";
import { Widget } from "../../Board";
import { useBoard } from "../../../../hooks/useBoard";
import { useFirestore } from "../../../../hooks/useFirestore";
import { useSelector } from "react-redux";
import { GlobalData } from "../../../../store/global";

interface PackageTrackerWidgetProps {
    id: string;
    theme: string;
    widgetData: Widget;
}

type TrackerConfig = {
    apiKey: string;
    trackingNumber: string;
    courier: string;
};

type TrackingEvent = {
    time: string;
    description: string;
    location?: string;
};

const COMMON_CARRIERS = [
    { code: "fedex", label: "FedEx" },
    { code: "ups", label: "UPS" },
    { code: "usps", label: "USPS" },
    { code: "dhl", label: "DHL" },
    { code: "royal-mail", label: "Royal Mail" },
    { code: "canada-post", label: "Canada Post" },
];

const TRACKINGMORE_ENDPOINT = "https://api.trackingmore.com/v4/trackings/realtime";
const CORS_PROXY = "https://corsproxy.io/?";

export default function PackageTrackerWidget({
    id,
    theme,
    widgetData,
}: PackageTrackerWidgetProps) {
    const { save } = useBoard();
    const { saveToFirestore } = useFirestore();
    const widgets = useSelector((state: GlobalData) => state.widgets);
    const layouts = useSelector((state: GlobalData) => state.layouts);
    const dashboards = useSelector((state: GlobalData) => state.dashboards);
    const activeDashboard = useSelector((state: GlobalData) => state.activeDashboard);

    const [isConfiguring, setIsConfiguring] = useState(
        !widgetData.packageTrackerConfig
    );
    const [apiKeyInput, setApiKeyInput] = useState(
        widgetData.packageTrackerConfig?.apiKey || ""
    );
    const [trackingInput, setTrackingInput] = useState(
        widgetData.packageTrackerConfig?.trackingNumber || ""
    );
    const [courierInput, setCourierInput] = useState(
        widgetData.packageTrackerConfig?.courier || COMMON_CARRIERS[0].code
    );

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [events, setEvents] = useState<TrackingEvent[]>(
        widgetData.packageTrackerData?.events || []
    );
    const [statusText, setStatusText] = useState<string>(
        widgetData.packageTrackerData?.status || "No data"
    );
    const [lastUpdate, setLastUpdate] = useState<string | undefined>(
        widgetData.packageTrackerData?.lastUpdate
    );

    const currentWidgets = useMemo(() => {
        if (activeDashboard === "home") return widgets;
        return (
            dashboards.find((dash) => dash.id === activeDashboard)?.widgets || []
        );
    }, [activeDashboard, dashboards, widgets]);

    const currentLayouts = useMemo(() => {
        if (activeDashboard === "home") return layouts;
        return (
            dashboards.find((dash) => dash.id === activeDashboard)?.layouts || []
        );
    }, [activeDashboard, dashboards, layouts]);

    const persistWidget = useCallback(
        async (partial: Partial<Widget>) => {
            const newWidgets = currentWidgets.map((w) =>
                w.i === id ? { ...w, ...partial } : w
            );
            await save({ layout: currentLayouts, widgets: newWidgets });
            await saveToFirestore({ widgets: newWidgets });
        },
        [currentLayouts, currentWidgets, id, save, saveToFirestore]
    );

    const fetchTracking = useCallback(
        async (config: TrackerConfig) => {
            if (!config.apiKey || !config.trackingNumber || !config.courier) {
                return;
            }
            setLoading(true);
            setError(null);
            try {
                const proxyUrl =
                    CORS_PROXY +
                    encodeURIComponent(TRACKINGMORE_ENDPOINT);
                const response = await fetch(proxyUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Tracking-Api-Key": config.apiKey.trim(),
                    },
                    body: JSON.stringify({
                        tracking_number: config.trackingNumber.trim(),
                        carrier_code: config.courier,
                    }),
                });

                if (!response.ok) {
                    const message = await response.text();
                    throw new Error(message || "Unable to fetch tracking info.");
                }

                const result = await response.json();
                const item = result?.data?.items?.[0];
                const list: TrackingEvent[] =
                    item?.origin_info?.trackinfo?.map((entry: any) => ({
                        time: entry?.Date || entry?.time || "",
                        description: entry?.StatusDescription || entry?.status || "",
                        location: entry?.Details || entry?.location,
                    })) || [];

                setEvents(list);
                setStatusText(item?.status || "Unknown");
                setLastUpdate(item?.lastUpdateTime);

                await persistWidget({
                    packageTrackerData: {
                        status: item?.status,
                        lastUpdate: item?.lastUpdateTime,
                        events: list,
                    },
                });
            } catch (err) {
                console.error(err);
                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to fetch tracking information."
                );
            } finally {
                setLoading(false);
            }
        },
        [persistWidget]
    );

    const handleSave = useCallback(async () => {
        if (!apiKeyInput.trim() || !trackingInput.trim()) {
            setError("API key and tracking number are required.");
            return;
        }

        const nextConfig: TrackerConfig = {
            apiKey: apiKeyInput.trim(),
            trackingNumber: trackingInput.trim(),
            courier: courierInput,
        };

        await persistWidget({
            packageTrackerConfig: nextConfig,
        });

        setIsConfiguring(false);
        fetchTracking(nextConfig);
    }, [apiKeyInput, courierInput, fetchTracking, persistWidget, trackingInput]);

    useEffect(() => {
        if (widgetData.packageTrackerConfig && !isConfiguring) {
            fetchTracking(widgetData.packageTrackerConfig);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [widgetData.packageTrackerConfig?.trackingNumber]);

    return (
        <div className={`widget PackageTrackerWidget ${theme}`}>
            <div className="header">
                <div className="widgetTitle">Package Tracking</div>
                <div
                    className="widgetButtons"
                    style={{ display: "flex", gap: 5 }}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <button
                        className="tracker-icon-button"
                        title="Refresh"
                        onClick={() => {
                            if (widgetData.packageTrackerConfig) {
                                fetchTracking(widgetData.packageTrackerConfig);
                            }
                        }}
                        disabled={!widgetData.packageTrackerConfig || loading}
                    >
                        ↻
                    </button>
                    <button
                        className="tracker-icon-button"
                        title="Settings"
                        onClick={() => setIsConfiguring((prev) => !prev)}
                    >
                        ⚙
                    </button>
                    <DeleteWidget id={id} />
                </div>
            </div>
            <div className="content tracker-content">
                {isConfiguring ? (
                    <TrackerSetup
                        apiKey={apiKeyInput}
                        trackingNumber={trackingInput}
                        courier={courierInput}
                        onApiKeyChange={setApiKeyInput}
                        onTrackingNumberChange={setTrackingInput}
                        onCourierChange={setCourierInput}
                        onSave={handleSave}
                        loading={loading}
                    />
                ) : (
                    <TrackerTimeline
                        loading={loading}
                        error={error}
                        status={statusText}
                        lastUpdate={lastUpdate}
                        events={events}
                    />
                )}
            </div>
        </div>
    );
}

function TrackerSetup(props: {
    apiKey: string;
    trackingNumber: string;
    courier: string;
    onApiKeyChange: (value: string) => void;
    onTrackingNumberChange: (value: string) => void;
    onCourierChange: (value: string) => void;
    onSave: () => void;
    loading: boolean;
}) {
    return (
        <div className="tracker-setup">
            <p className="tracker-helper">
                This widget uses the free{" "}
                <a
                    href="https://www.trackingmore.com/"
                    target="_blank"
                    rel="noreferrer"
                >
                    TrackingMore API
                </a>{" "}
                (proxied via corsproxy.io for browser compatibility) to query
                real-time shipment updates across hundreds of carriers. Sign up
                for a free API key and paste it below.
            </p>
            <label>
                <span>TrackingMore API Key</span>
                <input
                    type="password"
                    value={props.apiKey}
                    onChange={(e) => props.onApiKeyChange(e.target.value)}
                    placeholder="Enter API key"
                />
            </label>
            <label>
                <span>Tracking Number</span>
                <input
                    type="text"
                    value={props.trackingNumber}
                    onChange={(e) => props.onTrackingNumberChange(e.target.value)}
                    placeholder="e.g. 9400100200829952579933"
                />
            </label>
            <label>
                <span>Carrier</span>
                <select
                    value={props.courier}
                    onChange={(e) => props.onCourierChange(e.target.value)}
                >
                    {COMMON_CARRIERS.map((carrier) => (
                        <option key={carrier.code} value={carrier.code}>
                            {carrier.label}
                        </option>
                    ))}
                </select>
            </label>
            <div className="tracker-actions">
                <button
                    className="tracker-button primary"
                    onClick={props.onSave}
                    disabled={props.loading}
                >
                    {props.loading ? "Saving..." : "Save & Track"}
                </button>
            </div>
        </div>
    );
}

function TrackerTimeline(props: {
    loading: boolean;
    error: string | null;
    status: string;
    lastUpdate?: string;
    events: TrackingEvent[];
}) {
    if (props.loading) {
        return <p className="tracker-loading">Loading tracking data…</p>;
    }
    if (props.error) {
        return <p className="tracker-error">{props.error}</p>;
    }
    if (!props.events.length) {
        return (
            <div className="tracker-empty">
                No tracking updates yet. Configure the widget to begin tracking.
            </div>
        );
    }
    return (
        <div className="tracker-feed">
            <div className="tracker-status">
                <strong>Status:</strong> {props.status}
                {props.lastUpdate && (
                    <span className="tracker-updated">
                        Updated{" "}
                        {new Date(props.lastUpdate).toLocaleString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                            month: "short",
                            day: "numeric",
                        })}
                    </span>
                )}
            </div>
            <div className="tracker-events">
                {props.events.map((event, index) => (
                    <div key={`${event.time}-${index}`} className="tracker-event">
                        <div className="event-time">
                            {event.time
                                ? new Date(event.time).toLocaleString()
                                : "—"}
                        </div>
                        <div className="event-details">
                            <div className="event-description">{event.description}</div>
                            {event.location && (
                                <div className="event-location">{event.location}</div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
