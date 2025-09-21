import MiniChartWidget from "../components/Board/Widgets/MiniChart/MiniChartWidget";
import "../styling/App.css";
import "../styling/Widgets.css";
import { StoryObj, Meta } from "@storybook/react-webpack5";

const mockData = {
    w: 9,
    h: 9,
    x: 6,
    y: 8,
    i: "initial_1",
    moved: false,
    static: false,
    type: "ChartBoxWidget",
    symbol: "BTCUSDT",
};

export default {
    title: "Widgets",
    component: MiniChartWidget,
    argTypes: {
        widgetData: {
            options: { ...mockData },
        },
    },
} as Meta<typeof MiniChartWidget>;

const Template: StoryObj<typeof MiniChartWidget> = () => {
    return (
        <div style={{ width: 600, height: 400 }}>
            <MiniChartWidget
                id={mockData.i}
                theme="dark"
                symbol={mockData.symbol}
            />
        </div>
    );
};

export const MiniChart = Template.bind({});
MiniChart.args = {
    symbol: mockData.symbol,
};
