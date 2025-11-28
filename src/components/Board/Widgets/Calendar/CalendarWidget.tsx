import React from 'react';
import DeleteWidget from "../DeleteWidget";

interface CalendarWidgetProps {
    id: string;
}

export default function CalendarWidget({ id }: CalendarWidgetProps) {
    return (
        <div className="widget CalendarWidget">
            <div className="header">
                <div className="widgetTitle">Calendar (Placeholder)</div>
                <DeleteWidget id={id} />
            </div>
            <div className="content">
                <p>Calendar Widget content goes here.</p>
            </div>
        </div>
    );
}
