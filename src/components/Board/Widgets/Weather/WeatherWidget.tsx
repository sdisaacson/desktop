import React from 'react';
import DeleteWidget from "../DeleteWidget";
import { Widget } from "../../Board";

interface WeatherWidgetProps {
    id: string;
    theme: string;
    widgetData: Widget;
}

export default function WeatherWidget({ id, theme, widgetData }: WeatherWidgetProps) {
    return (
        <div className="widget WeatherWidget">
            <div className="header">
                <div className="widgetTitle">Weather (Placeholder)</div>
                <DeleteWidget id={id} />
            </div>
            <div className="content">
                <p>Weather Widget content goes here.</p>
            </div>
        </div>
    );
}
