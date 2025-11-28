import { useEffect } from "react";
import GridLayout, { Layout } from "react-grid-layout";
import "../../styling/Widgets.css";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import DynamicWidget from "./components/DynamicWidget";
import { useSelector } from "react-redux";
import { useBoard } from "../../hooks/useBoard";
import { useFirestore } from "../../hooks/useFirestore";
import { GlobalData } from "../../store/global";

export type WeatherSnapshot = {
    cachedAt: number;
    location: { city: string; country?: string };
    current: {
        temp: number;
        feelsLike: number;
        description: string;
        icon?: string;
        humidity?: number;
    };
    forecast: Array<{
        date: string;
        temp: number;
        description: string;
        icon?: string;
    }>;
};

export type RSSArticle = {
    id: string;
    title: string;
    link: string;
    description: string;
    thumbnail?: string;
    pubDate?: string;
};

export type RSSFeedSnapshot = {
    cachedAt: number;
    feeds: Array<{
        url: string;
        title?: string;
        articleCount: number;
        items: RSSArticle[];
    }>;
};

export type Widget = {
    i: string;
    type: string;
    symbol?: string;
    title?: string;
    content?: string;
    bookmarks?: Bookmark[];
    videoId?: string;
    channelIds?: string[];
    videoCount?: number;
    orientation?: "vertical" | "horizontal" | "grid";
    emailConfig?: {
        user: string;
        password: string;
        host: string;
        port?: number;
        tls?: boolean;
    };
    weatherConfig?: {
        apiKey: string;
        city: string;
        units: "metric" | "imperial";
    };
    weatherSnapshot?: WeatherSnapshot;
    rssConfig?: {
        feedUrls: string[];
        articleCount: number;
        refreshInterval: number;
        scroll?: boolean;
    };
    rssSnapshot?: RSSFeedSnapshot;
};
export type WidgetInfo = Widget & Layout;

export default function Board() {
    const { save } = useBoard();
    const { loadFromFirestore } = useFirestore();
    
    // Select specific fields to avoid root state selector warning
    const board = useSelector((state: GlobalData) => state.board);
    const activeDashboard = useSelector((state: GlobalData) => state.activeDashboard);
    const widgets = useSelector((state: GlobalData) => state.widgets);
    const dashboards = useSelector((state: GlobalData) => state.dashboards);

    useEffect(() => {
        loadFromFirestore();
        // eslint-disable-next-line
    }, []);

    if (!board) return null;

    return (
        <div id="Board" data-testid="Board">
            {board.length > 0 && (
                <GridLayout
                    resizeHandles={["s", "se", "e"]}
                    autoSize={true}
                    draggableHandle={".header"}
                    isBounded={false}
                    useCSSTransforms={true}
                    preventCollision={false}
                    verticalCompact={true}
                    className="layout"
                    containerPadding={[10, 10]}
                    layout={board}
                    cols={24}
                    rowHeight={35}
                    width={window.innerWidth - 40}
                    onDragStop={async (layout) => {
                        if (activeDashboard === "home") {
                            save({ layout, widgets: widgets });
                        } else {
                            const thisDashboard: Dashboard =
                                dashboards.find(
                                    (dashB) =>
                                        dashB.id === activeDashboard
                                ) as Dashboard;
                            save({ layout, widgets: thisDashboard.widgets });
                        }
                    }}
                    onResizeStop={async (layout) => {
                        if (activeDashboard === "home") {
                            save({ layout, widgets: widgets });
                        } else {
                            const thisDashboard: Dashboard =
                                dashboards.find(
                                    (dashB) =>
                                        dashB.id === activeDashboard
                                ) as Dashboard;
                            save({ layout, widgets: thisDashboard.widgets });
                        }
                    }}
                >
                    {board.map((widget: WidgetInfo) => {
                        return (
                            <div key={widget.i} data-testid="Widget">
                                <DynamicWidget widget={widget} />
                            </div>
                        );
                    })}
                </GridLayout>
            )}
        </div>
    );
}
