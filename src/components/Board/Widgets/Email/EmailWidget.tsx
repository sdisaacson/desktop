import React from 'react';
import DeleteWidget from "../DeleteWidget";
import { Widget } from "../../Board";

interface EmailWidgetProps {
    id: string;
    theme: string;
    widgetData: Widget;
}

export default function EmailWidget({ id, theme, widgetData }: EmailWidgetProps) {
    return (
        <div className="widget EmailWidget">
            <div className="header">
                <div className="widgetTitle">Email Reader (Placeholder)</div>
                <DeleteWidget id={id} />
            </div>
            <div className="content">
                <p>Email Widget content goes here.</p>
            </div>
        </div>
    );
}
