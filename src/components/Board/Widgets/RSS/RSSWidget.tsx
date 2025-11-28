import React from 'react';
import DeleteWidget from "../DeleteWidget";
import { Widget } from "../../Board";

interface RSSWidgetProps {
    id: string;
    theme: string;
    widgetData: Widget;
}

export default function RSSWidget({ id, theme, widgetData }: RSSWidgetProps) {
    return (
        <div className={`widget RSSWidget`}>
            <div className="header">
                <div className="widgetTitle">RSS Feed (Placeholder)</div>
                <DeleteWidget id={id} />
            </div>
            <div className="content">
                <p>RSS Widget content goes here.</p>
            </div>
        </div>
    );
}
