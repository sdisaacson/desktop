import React, { useCallback, useEffect, useState } from "react";
import { RefreshCcw, Settings } from "react-feather";
import { useSelector } from "react-redux";
import DeleteWidget from "../DeleteWidget";
import { Widget, WeatherSnapshot } from "../../Board";
import { useBoard } from "../../../../hooks/useBoard";
import { useFirestore } from "../../../../hooks/useFirestore";
import { GlobalData } from "../../../../store/global";

type WeatherUnits = "metric" | "imperial";
type WeatherConfig = { apiKey: string; city: string; units: WeatherUnits };

const UNIT_LABEL: Record<WeatherUnits, string> = {
    metric: "°C",
    imperial: "°F",
};

const buildForecast = (list: any[]): WeatherSnapshot["forecast"] => {
    if (!Array.isArray(list)) return [];
    const today = new Date().toISOString().split("T")[0];
    const byDate = new Map<string, any>();

    list.forEach((entry) => {
        if (!entry?.dt_txt || !entry?.main) return;
        const date = entry.dt_txt.split(" ")[0];
        if (date <= today) return;
        const isNoon = entry.dt_txt.includes("12:00:00");
        if (!byDate.has(date) || isNoon) {
            byDate.set(date, entry);
        }
    });

    return Array.from(byDate.entries())
        .slice(0, 5)
        .map(([date, entry]) => ({
            date,
            temp: entry.main?.temp,
            description: entry.weather?.[0]?.description ?? "",
            icon: entry.weather?.[0]?.icon,
        }));
};

export default function WeatherWidget({ id, theme, widgetData }: WeatherWidgetProps) {
    const { save } = useBoard();
    const { saveToFirestore } = useFirestore();
    const widgets = useSelector((state: GlobalData) => state.widgets);
    const layouts = useSelector((state: GlobalData) => state.layouts);
    const dashboards = useSelector((state: GlobalData) => state.dashboards);
    const activeDashboard = useSelector((state: GlobalData) => state.activeDashboard);

    const [apiKeyInput, setApiKeyInput] = useState(widgetData.weatherConfig?.apiKey ?? "");
    const [cityInput, setCityInput] = useState(widgetData.weatherConfig?.city ?? "");
    const [unitsInput, setUnitsInput] = useState<WeatherUnits>(widgetData.weatherConfig?.units ?? "metric");
    const [isConfiguring, setIsConfiguring] = useState(!widgetData.weatherConfig);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const formatTemperature = (value?: number) =>
        value === undefined || value === null
            ? "--"
            : Math.round(value).toString();

    const fetchWeatherData = useCallback(
        async (config: WeatherConfig): Promise<{ snapshot: WeatherSnapshot }> => {
            const trimmedCity = config.city.trim();
            const query = encodeURIComponent(trimmedCity);

            const currentRes = await fetch(
                `https://api.openweathermap.org/data/2.5/weather?q=${query}&units=${config.units}&appid=${config.apiKey}`
            );
            const currentJson = await currentRes.json();
            if (!currentRes.ok) {
                throw new Error(currentJson?.message ?? "Unable to fetch current weather.");
            }

            const forecastRes = await fetch(
                `https://api.openweathermap.org/data/2.5/forecast?q=${query}&units=${config.units}&appid=${config.apiKey}`
            );
            const forecastJson = await forecastRes.json();
            if (!forecastRes.ok) {
                throw new Error(forecastJson?.message ?? "Unable to fetch forecast.");
            }

            const snapshot: WeatherSnapshot = {
                cachedAt: Date.now(),
                location: {
                    city: currentJson?.name ?? trimmedCity,
                    country: currentJson?.sys?.country,
                },
                current: {
                    temp: currentJson?.main?.temp,
                    feelsLike: currentJson?.main?.feels_like,
                    description: currentJson?.weather?.[0]?.description ?? "",
                    icon: currentJson?.weather?.[0]?.icon,
                    humidity: currentJson?.main?.humidity,
                },
                forecast: buildForecast(forecastJson?.list),
            };

            if (snapshot.forecast.length === 0) {
                throw new Error("Unable to build a 5 day forecast for that location.");
            }

            return { snapshot };
        },
        []
    );

    const persistWidget = useCallback(
        async (partial: Partial<Widget>) => {
            const updatedWidget = { ...widgetData, ...partial };
            let targetWidgets = widgets;
            let targetLayouts = layouts;

            if (activeDashboard !== "home") {
                const dashboard = dashboards.find((dashB) => dashB.id === activeDashboard);
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
        [activeDashboard, dashboards, id, layouts, save, saveToFirestore, widgetData, widgets]
    );

    const handleSave = useCallback(async () => {
        if (!apiKeyInput.trim() || !cityInput.trim()) {
            setError("Both API key and city are required.");
            return;
        }
        const nextConfig: WeatherConfig = {
            apiKey: apiKeyInput.trim(),
            city: cityInput.trim(),
            units: unitsInput,
        };

        try {
            setLoading(true);
            const { snapshot } = await fetchWeatherData(nextConfig);
            await persistWidget({
                weatherConfig: nextConfig,
                weatherSnapshot: snapshot,
            });
            setError(null);
            setIsConfiguring(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to save weather settings.");
        } finally {
            setLoading(false);
        }
    }, [apiKeyInput, cityInput, fetchWeatherData, persistWidget, unitsInput]);

    const handleRefresh = useCallback(async () => {
        if (!widgetData.weatherConfig) {
            setIsConfiguring(true);
            return;
        }

        try {
            setLoading(true);
            const { snapshot } = await fetchWeatherData(widgetData.weatherConfig);
            await persistWidget({
                weatherSnapshot: snapshot,
            });
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to refresh weather.");
        } finally {
            setLoading(false);
        }
    }, [fetchWeatherData, persistWidget, widgetData.weatherConfig]);

    useEffect(() => {
        const config = widgetData.weatherConfig;
        if (config) {
            setApiKeyInput(config.apiKey);
            setCityInput(config.city);
            setUnitsInput(config.units);
        } else {
            setApiKeyInput("");
            setCityInput("");
            setUnitsInput("metric");
        }
    }, [widgetData.weatherConfig]);

    useEffect(() => {
        if (widgetData.weatherConfig && !widgetData.weatherSnapshot) {
            handleRefresh();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [handleRefresh, widgetData.weatherConfig, widgetData.weatherSnapshot]);

    const snapshot = widgetData.weatherSnapshot;
    const resolvedUnits: WeatherUnits =
        widgetData.weatherConfig?.units ?? unitsInput;
    const unitLabel = UNIT_LABEL[resolvedUnits];
    const lastUpdated = snapshot?.cachedAt
        ? new Date(snapshot.cachedAt).toLocaleString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
              month: "short",
              day: "numeric",
          })
        : null;

    const renderSetup = () => (
        <div className="weather-setup">
            <p className="weather-helper">
                Enter your <a href="https://openweathermap.org/api" target="_blank" rel="noreferrer">OpenWeatherMap</a>{" "}
                API key, preferred city (e.g. <code>Paris,FR</code>), and temperature unit.
            </p>
            <label className="weather-field">
                <span>API Key</span>
                <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="OpenWeatherMap API key"
                />
            </label>
            <label className="weather-field">
                <span>City</span>
                <input
                    type="text"
                    value={cityInput}
                    onChange={(e) => setCityInput(e.target.value)}
                    placeholder="City or City,CountryCode"
                />
            </label>
            <label className="weather-field">
                <span>Units</span>
                <select value={unitsInput} onChange={(e) => setUnitsInput(e.target.value as WeatherUnits)}>
                    <option value="metric">Celsius</option>
                    <option value="imperial">Fahrenheit</option>
                </select>
            </label>
            <div className="weather-actions">
                {widgetData.weatherConfig && (
                    <button
                        type="button"
                        className="weather-button secondary"
                        onClick={() => {
                            setIsConfiguring(false);
                            setApiKeyInput(widgetData.weatherConfig?.apiKey ?? "");
                            setCityInput(widgetData.weatherConfig?.city ?? "");
                            setUnitsInput(widgetData.weatherConfig?.units ?? "metric");
                        }}
                        disabled={loading}
                    >
                        Cancel
                    </button>
                )}
                <button
                    type="button"
                    className="weather-button primary"
                    onClick={handleSave}
                    disabled={loading}
                >
                    {loading ? "Saving..." : "Save"}
                </button>
            </div>
            {error && <p className="weather-error">{error}</p>}
        </div>
    );

    const renderForecast = () => {
        if (!snapshot) {
            return (
                <div className="weather-empty">
                    <p>No weather data yet. Configure the widget to load a forecast.</p>
                    {error && <p className="weather-error">{error}</p>}
                </div>
            );
        }

        return (
            <div className="weather-data">
                <div className="current-weather">
                    <div className="temp">
                        {formatTemperature(snapshot.current.temp)}
                        <span>{unitLabel}</span>
                    </div>
                    <div className="current-meta">
                        <strong>
                            {snapshot.location.city}
                            {snapshot.location.country ? `, ${snapshot.location.country}` : ""}
                        </strong>
                        <span className="description">{snapshot.current.description}</span>
                        <small>
                            Feels like {formatTemperature(snapshot.current.feelsLike)}
                            {unitLabel}
                        </small>
                        {snapshot.current.humidity != null && (
                            <small>Humidity {snapshot.current.humidity}%</small>
                        )}
                        {lastUpdated && <small>Updated {lastUpdated}</small>}
                    </div>
                    {snapshot.current.icon && (
                        <img
                            src={`https://openweathermap.org/img/wn/${snapshot.current.icon}@2x.png`}
                            alt={snapshot.current.description}
                            className="weather-icon"
                        />
                    )}
                </div>
                <div className="forecast-grid">
                    {snapshot.forecast.map((day: WeatherSnapshot["forecast"][number]) => {
                        const date = new Date(day.date);
                        return (
                            <div key={day.date} className="forecast-day">
                                <span className="day">
                                    {date.toLocaleDateString(undefined, { weekday: "short" })}
                                </span>
                                {day.icon && (
                                    <img
                                        src={`https://openweathermap.org/img/wn/${day.icon}.png`}
                                        alt={day.description}
                                    />
                                )}
                                <span className="temp">
                                    {formatTemperature(day.temp)}
                                    {unitLabel}
                                </span>
                                <small>{day.description}</small>
                            </div>
                        );
                    })}
                </div>
                {error && <p className="weather-error">{error}</p>}
            </div>
        );
    };

    return (
        <div className={`widget WeatherWidget ${theme}`}>
            <div className="header">
                <div className="widgetTitle">Weather</div>
                <div className="widgetButtons" onMouseDown={(e) => e.stopPropagation()}>
                    <button
                        className="weather-icon-button"
                        type="button"
                        title="Refresh"
                        onClick={handleRefresh}
                        disabled={loading || !widgetData.weatherConfig}
                    >
                        <RefreshCcw size={12} />
                    </button>
                    <button
                        className="weather-icon-button"
                        type="button"
                        title="Settings"
                        onClick={() => {
                            if (widgetData.weatherConfig) {
                                setApiKeyInput(widgetData.weatherConfig.apiKey);
                                setCityInput(widgetData.weatherConfig.city);
                                setUnitsInput(widgetData.weatherConfig.units);
                            }
                            setIsConfiguring(true);
                        }}
                    >
                        <Settings size={12} />
                    </button>
                    <DeleteWidget id={id} />
                </div>
            </div>
            <div className="content">
                {loading && !isConfiguring && (
                    <p className="weather-loading">Updating weather…</p>
                )}
                {isConfiguring || !widgetData.weatherConfig ? renderSetup() : renderForecast()}
            </div>
        </div>
    );
}
