type DeleteWidgetProps = {
    id: string;
};

type ChartBoxProps = {
    theme: "dark" | "light";
    symbol: string;
    id: string;
};

type TechnicalAnalysisProps = {
    theme: "dark" | "light";
    symbol: string;
    id: string;
};

type TickerWidgetProps = {
    theme: "dark" | "light";
    symbol: string;
    id: string;
};

type DynamicWidgetProps = {
    widget: Widget;
};

type NewsProps = {
    theme: "dark" | "light";
    widgetData: Widget;
    id: string;
};

type MiniChartProps = {
    theme: "dark" | "light";
    symbol: string;
    id: string;
};

type WeatherWidgetProps = {
    theme: "dark" | "light";
    id: string;
    widgetData: Widget;
};

type RSSWidgetProps = {
    theme: "dark" | "light";
    id: string;
    widgetData: Widget;
};

type PackageTrackerWidgetProps = {
    theme: "dark" | "light";
    id: string;
    widgetData: Widget;
};

type UseBoardProps = {
    layout: Layout[];
    widgets: Widget[];
};
type UseBoardMethods = {
    save: (props: UseBoardProps) => Promise<void>;
    init: () => void;
    createLayout: () => void;
    generateLayoutArray: (_l: Layout[], _w: Widget[]) => Promise<WidgetInfo[]>;
    getBoard: () => void;
    deleteWidget: (widgetId: string) => void;
};

type Bookmark = {
    title: string;
    link: string;
};

type Dashboard = {
    id: string;
    widgets: Widget[];
    layouts: Layout[];
};
