import TickerTapeWidget from "../components/Board/Widgets/TickerTape/TickerTape";
import "../styling/App.css";
import "../styling/Widgets.css";
import { StoryObj, Meta } from "@storybook/react-webpack5";

export default {
    title: "Widgets",
    component: TickerTapeWidget,
} as Meta<typeof TickerTapeWidget>;

const Template: StoryObj TickerTapeWidget> = () => {
    return (
        <div style={{ width: "100%", height: 65 }}>
            <TickerTapeWidget theme="dark" id={"testId"} />
        </div>
    );
};

export const TickerTape = Template.bind({});
