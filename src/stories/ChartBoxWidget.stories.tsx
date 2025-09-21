import ChartBoxWidget from "../components/Board/Widgets/ChartBox/ChartBoxWidget";
import "../styling/App.css";
import "../styling/Widgets.css";

// ✅ Use Storybook v6 types from @storybook/react (do NOT use composeStory as a type)
import type { Meta, StoryObj } from "@storybook/react-webpack5";

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
  title: "Widgets/ChartBoxWidget",
  component: ChartBoxWidget,
  argTypes: {
    symbol: { control: "text" },
    theme: { control: { type: "inline-radio" }, options: ["light", "dark"] },
  },
} as Meta<typeof ChartBoxWidget>;

const Template: StoryObj ChartBoxWidget,> = (args) => (
  <div style={{ width: 600, height: 400 }}>
    <ChartBoxWidget {...args} />
  </div>
);

export const ChartBox = Template.bind({});
ChartBox.args = {
  symbol: mockData.symbol,
  id: "testId",
  theme: "dark",
};
