import React from 'react';
import DeleteWidget from "../DeleteWidget";
import { Widget } from "../../Board";

interface MeetingScheduleWidgetProps {
    id: string;
    theme: string;
    widgetData: Widget;
}

export default function MeetingScheduleWidget({ id, theme, widgetData }: MeetingScheduleWidgetProps) {
    return (
        <div className="widget MeetingScheduleWidget">
            <div className="header">
                <div className="widgetTitle">Meeting Schedule (Placeholder)</div>
                <DeleteWidget id={id} />
            </div>
            <div className="content">
                <p>Meeting Schedule Widget content goes here.</p>
            </div>
        </div>
    );
}
