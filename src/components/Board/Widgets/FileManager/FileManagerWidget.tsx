import React from 'react';
import DeleteWidget from "../DeleteWidget";
import { Widget } from "../../Board";

interface FileManagerWidgetProps {
    id: string;
    theme: string;
    widgetData: Widget;
}

export default function FileManagerWidget({ id, theme, widgetData }: FileManagerWidgetProps) {
    return (
        <div className="widget FileManagerWidget">
            <div className="header">
                <div className="widgetTitle">File Manager (Placeholder)</div>
                <DeleteWidget id={id} />
            </div>
            <div className="content">
                <p>File Manager Widget content goes here.</p>
            </div>
        </div>
    );
}
