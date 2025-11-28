import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCcw, Settings, X } from "react-feather";
import { useSelector } from "react-redux";
import DeleteWidget from "../DeleteWidget";
import { RSSFeedSnapshot, Widget } from "../../Board";
import { useBoard } from "../../../../hooks/useBoard";
import { useFirestore } from "../../../../hooks/useFirestore";
import { GlobalData } from "../../../../store/global";

type RSSWidgetConfig = {
    feedUrls: string[];
    articleCount: number;
    refreshInterval: number;
    scroll?: boolean;
};

const stripHtml = (value: string) => value.replace(/<[^>]+>/g, "").trim();

const DEFAULT_REFRESH_MIN = 15;
const DEFAULT_ARTICLE_COUNT = 5;

export default function RSSWidget({ id, theme, widgetData }: RSSWidgetProps) {
    const { save } = useBoard();
    const { saveToFirestore } = useFirestore();
    const widgets = useSelector((state: GlobalData) => state.widgets);
    const layouts = useSelector((state: GlobalData) => state.layouts);
    const dashboards = useSelector((state: GlobalData) => state.dashboards);
    const activeDashboard = useSelector((state: GlobalData) => state.activeDashboard);

    const [feedInputs, setFeedInputs] = useState<string[]>(
        widgetData.rssConfig?.feedUrls?.length
            ? widgetData.rssConfig.feedUrls
            : [""]
    );
    const [articleCountInput, setArticleCountInput] = useState<string>(
        widgetData.rssConfig?.articleCount
            ? widgetData.rssConfig.articleCount.toString()
            : DEFAULT_ARTICLE_COUNT.toString()
    );
    const [refreshIntervalInput, setRefreshIntervalInput] = useState<string>(
        widgetData.rssConfig?.refreshInterval
            ? widgetData.rssConfig.refreshInterval.toString()
            : DEFAULT_REFRESH_MIN.toString()
    );
    const [scrollInput, setScrollInput] = useState<boolean>(
        widgetData.rssConfig?.scroll ?? false
    );
    const [isConfiguring, setIsConfiguring] = useState(!widgetData.rssConfig);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const snapshot = widgetData.rssSnapshot;
    const lastUpdated = snapshot?.cachedAt
        ? new Date(snapshot.cachedAt).toLocaleString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
              month: "short",
              day: "numeric",
          })
        : null;

    const validFeedCount = useMemo(
        () => feedInputs.filter((url) => url.trim().length > 0).length,
        [feedInputs]
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

    const fetchFeeds = useCallback(
        async (config: RSSWidgetConfig): Promise<RSSFeedSnapshot> => {
            const feeds = await Promise.all(
                config.feedUrls.map(async (url) => {
                    const trimmed = url.trim();
                    if (!trimmed) return null;

                    const endpoint = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(
                        trimmed
                    )}`;
                    const response = await fetch(endpoint);
                    const json = await response.json();

                    if (!response.ok || json.status !== "ok") {
                        throw new Error(json?.message || `Unable to fetch feed: ${trimmed}`);
                    }

                    const items = (json.items || [])
                        .slice(0, config.articleCount)
                        .map((item: any) => ({
                            id: item.guid || item.link || `${trimmed}-${item.title}`,
                            title: item.title,
                            link: item.link,
                            description: stripHtml(item.description || item.content || ""),
                            thumbnail: item.thumbnail || item.enclosure?.link,
                            pubDate: item.pubDate,
                        }));

                    return {
                        url: trimmed,
                        title: json.feed?.title || trimmed,
                        articleCount: items.length,
                        items,
                    };
                })
            );

            const validFeeds = feeds.filter(Boolean) as RSSFeedSnapshot["feeds"];
            if (validFeeds.length === 0) {
                throw new Error("No valid RSS feeds could be loaded.");
            }

            return {
                cachedAt: Date.now(),
                feeds: validFeeds,
            };
        },
        []
    );

    const handleSave = useCallback(async () => {
        const trimmedFeeds = feedInputs.map((feed) => feed.trim()).filter(Boolean);
        if (trimmedFeeds.length === 0) {
            setError("Please add at least one RSS feed URL.");
            return;
        }

        const articleCount = parseInt(articleCountInput, 10);
        if (!Number.isInteger(articleCount) || articleCount <= 0) {
            setError("Articles per feed must be a positive integer.");
            return;
        }

        const refreshInterval = parseInt(refreshIntervalInput, 10);
        if (!Number.isInteger(refreshInterval) || refreshInterval <= 0) {
            setError("Refresh interval must be a positive integer (minutes).");
            return;
        }

        const nextConfig: RSSWidgetConfig = {
            feedUrls: trimmedFeeds,
            articleCount,
            refreshInterval,
            scroll: scrollInput,
        };

        try {
            setLoading(true);
            const snapshotData = await fetchFeeds(nextConfig);
            await persistWidget({
                rssConfig: nextConfig,
                rssSnapshot: snapshotData,
            });
            setError(null);
            setIsConfiguring(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to save RSS settings.");
        } finally {
            setLoading(false);
        }
    }, [
        articleCountInput,
        fetchFeeds,
        feedInputs,
        persistWidget,
        refreshIntervalInput,
        scrollInput,
    ]);

    const handleRefresh = useCallback(async () => {
        if (!widgetData.rssConfig) {
            setIsConfiguring(true);
            return;
        }

        try {
            setLoading(true);
            const snapshotData = await fetchFeeds(widgetData.rssConfig);
            await persistWidget({
                rssSnapshot: snapshotData,
            });
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to refresh feeds.");
        } finally {
            setLoading(false);
        }
    }, [fetchFeeds, persistWidget, widgetData.rssConfig]);

    useEffect(() => {
        if (widgetData.rssConfig) {
            setFeedInputs(widgetData.rssConfig.feedUrls);
            setArticleCountInput(widgetData.rssConfig.articleCount.toString());
            setRefreshIntervalInput(widgetData.rssConfig.refreshInterval.toString());
            setScrollInput(widgetData.rssConfig.scroll ?? false);
            setIsConfiguring(false);
        }
    }, [widgetData.rssConfig]);

    useEffect(() => {
        if (!widgetData.rssConfig || !widgetData.rssSnapshot) return;
        const intervalMs =
            (widgetData.rssConfig.refreshInterval || DEFAULT_REFRESH_MIN) * 60 * 1000;
        const timer = setInterval(() => {
            handleRefresh();
        }, intervalMs);
        return () => clearInterval(timer);
    }, [
        handleRefresh,
        widgetData.rssConfig?.refreshInterval,
        widgetData.rssSnapshot,
        widgetData.rssConfig,
    ]);

    useEffect(() => {
        if (widgetData.rssConfig && !widgetData.rssSnapshot) {
            handleRefresh();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const addFeedInput = () => {
        setFeedInputs((prev) => [...prev, ""]);
    };

    const updateFeedInput = (index: number, value: string) => {
        setFeedInputs((prev) => prev.map((feed, idx) => (idx === index ? value : feed)));
    };

    const removeFeedInput = (index: number) => {
        setFeedInputs((prev) => prev.filter((_, idx) => idx !== index));
    };

    const renderSetup = () => (
        <div className="rss-setup">
            <p className="rss-helper">
                Add one or more RSS feed URLs. We'll fetch the number of articles you specify for
                each feed and refresh them on the schedule you choose.
            </p>
            <div className="rss-feed-inputs">
                {feedInputs.map((feed, index) => (
                    <div key={index} className="rss-feed-input-row">
                        <input
                            type="url"
                            value={feed}
                            placeholder="https://example.com/feed"
                            onChange={(e) => updateFeedInput(index, e.target.value)}
                        />
                        {feedInputs.length > 1 && (
                            <button
                                type="button"
                                className="rss-icon-button danger"
                                onClick={() => removeFeedInput(index)}
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                ))}
                <button type="button" className="rss-add-feed" onClick={addFeedInput}>
                    <Plus size={12} /> Add Feed
                </button>
                <p className="rss-feed-count">
                    {validFeedCount} feed{validFeedCount === 1 ? "" : "s"} configured
                </p>
            </div>
            <label className="rss-field">
                <span>Articles per feed</span>
                <input
                    type="number"
                    min={1}
                    value={articleCountInput}
                    onChange={(e) => setArticleCountInput(e.target.value)}
                />
            </label>
            <label className="rss-field">
                <span>Refresh interval (minutes)</span>
                <input
                    type="number"
                    min={1}
                    value={refreshIntervalInput}
                    onChange={(e) => setRefreshIntervalInput(e.target.value)}
                />
            </label>
            <label className="rss-checkbox">
                <input
                    type="checkbox"
                    checked={scrollInput}
                    onChange={(e) => setScrollInput(e.target.checked)}
                />
                <span>Scroll articles automatically</span>
            </label>
            <div className="rss-actions">
                {widgetData.rssConfig && (
                    <button
                        type="button"
                        className="rss-button secondary"
                        onClick={() => {
                            setIsConfiguring(false);
                            setFeedInputs(widgetData.rssConfig?.feedUrls || [""]);
                            setArticleCountInput(
                                widgetData.rssConfig?.articleCount?.toString() ||
                                    DEFAULT_ARTICLE_COUNT.toString()
                            );
                            setRefreshIntervalInput(
                                widgetData.rssConfig?.refreshInterval?.toString() ||
                                    DEFAULT_REFRESH_MIN.toString()
                            );
                            setScrollInput(widgetData.rssConfig?.scroll ?? false);
                            setError(null);
                        }}
                        disabled={loading}
                    >
                        Cancel
                    </button>
                )}
                <button
                    type="button"
                    className="rss-button primary"
                    onClick={handleSave}
                    disabled={loading}
                >
                    {loading ? "Saving..." : "Save"}
                </button>
            </div>
            {error && <p className="rss-error">{error}</p>}
        </div>
    );

    const renderArticles = () => {
        if (!snapshot) {
            return (
                <div className="rss-empty">
                    <p>No RSS data yet. Configure the widget to load articles.</p>
                    {error && <p className="rss-error">{error}</p>}
                </div>
            );
        }

        return (
            <div className="rss-feeds">
                {snapshot.feeds.map((feed: RSSFeedSnapshot["feeds"][number]) => {
                    const scrollEnabled = widgetData.rssConfig?.scroll ?? false;
                    const baseItems = feed.items;
                    const itemsForDisplay =
                        scrollEnabled && baseItems.length > 0
                            ? [...baseItems, ...baseItems]
                            : baseItems;
                    const scrollStyle =
                        scrollEnabled && baseItems.length > 0
                            ? ({
                                  "--rss-scroll-duration": `${Math.max(
                                      15,
                                      baseItems.length * 5
                                  )}s`,
                              } as React.CSSProperties)
                            : undefined;

                    return (
                        <div key={feed.url} className="rss-feed-block">
                            <div className="rss-feed-header">
                                <div>
                                    <strong>{feed.title || feed.url}</strong>
                                    <small>{feed.url}</small>
                                </div>
                                <span className="rss-article-count">
                                    {feed.articleCount} article{feed.articleCount === 1 ? "" : "s"}
                                </span>
                            </div>
                            <div
                                className={`rss-articles${scrollEnabled ? " scrolling" : ""}`}
                                style={scrollStyle}
                            >
                                {itemsForDisplay.map(
                                    (
                                        article: RSSFeedSnapshot["feeds"][number]["items"][number],
                                        index
                                    ) => (
                                        <a
                                            key={
                                                scrollEnabled && index >= baseItems.length
                                                    ? `${article.id}-dup-${index}`
                                                    : article.id
                                            }
                                            href={article.link}
                                            className="rss-article"
                                            target="_blank"
                                            rel="noreferrer noopener"
                                        >
                                            {article.thumbnail ? (
                                                <img
                                                    src={article.thumbnail}
                                                    alt={article.title}
                                                    className="rss-thumb"
                                                />
                                            ) : (
                                                <div className="rss-thumb placeholder" />
                                            )}
                                            <div className="rss-article-body">
                                                <strong>{article.title}</strong>
                                                <p>{article.description}</p>
                                            </div>
                                        </a>
                                    )
                                )}
                            </div>
                        </div>
                    );
                })}
                {lastUpdated && <p className="rss-updated">Updated {lastUpdated}</p>}
                {error && <p className="rss-error">{error}</p>}
            </div>
        );
    };

    return (
        <div className={`widget RSSWidget ${theme}`}>
            <div className="header">
                <div className="widgetTitle">RSS Feed</div>
                <div className="widgetButtons" onMouseDown={(e) => e.stopPropagation()}>
                    <button
                        className="rss-icon-button"
                        type="button"
                        title="Refresh"
                        onClick={handleRefresh}
                        disabled={loading || !widgetData.rssConfig}
                    >
                        <RefreshCcw size={12} />
                    </button>
                    <button
                        className="rss-icon-button"
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
                {loading && !isConfiguring && <p className="rss-loading">Loading feeds…</p>}
                {isConfiguring || !widgetData.rssConfig ? renderSetup() : renderArticles()}
            </div>
        </div>
    );
}
