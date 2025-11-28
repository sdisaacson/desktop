import React, { useMemo } from "react";
import DeleteWidget from "../DeleteWidget";

interface CalendarWidgetProps {
    id: string;
}

type DayCell = {
    date: Date;
    label: number;
    isCurrentMonth: boolean;
    isToday: boolean;
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarWidget({ id }: CalendarWidgetProps) {
    const today = useMemo(() => {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        return date;
    }, []);

    const startOfMonth = useMemo(() => {
        const date = new Date(today.getFullYear(), today.getMonth(), 1);
        date.setHours(0, 0, 0, 0);
        return date;
    }, [today]);

    const days = useMemo(() => buildCalendarCells(startOfMonth, today), [
        startOfMonth,
        today,
    ]);

    return (
        <div className="widget CalendarWidget">
            <div className="header">
                <div className="widgetTitle">
                    {today.toLocaleString(undefined, {
                        month: "long",
                        year: "numeric",
                    })}
                </div>
                <DeleteWidget id={id} />
            </div>
            <div className="content calendar-content">
                <div className="calendar-weekdays">
                    {WEEKDAY_LABELS.map((label) => (
                        <div key={label} className="calendar-weekday">
                            {label}
                        </div>
                    ))}
                </div>
                <div className="calendar-grid">
                    {days.map((cell, index) => (
                        <div
                            key={`${cell.date.toISOString()}-${index}`}
                            className={`calendar-day ${
                                cell.isCurrentMonth ? "current" : "fade"
                            } ${cell.isToday ? "today" : ""}`}
                        >
                            {cell.label}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function buildCalendarCells(startOfMonth: Date, today: Date): DayCell[] {
    const firstWeekdayIndex = startOfMonth.getDay();
    const daysInMonth = new Date(
        startOfMonth.getFullYear(),
        startOfMonth.getMonth() + 1,
        0
    ).getDate();
    const prevMonthDays = new Date(
        startOfMonth.getFullYear(),
        startOfMonth.getMonth(),
        0
    ).getDate();

    const cells: DayCell[] = [];

    for (let i = firstWeekdayIndex - 1; i >= 0; i--) {
        const date = new Date(
            startOfMonth.getFullYear(),
            startOfMonth.getMonth() - 1,
            prevMonthDays - i
        );
        date.setHours(0, 0, 0, 0);
        cells.push({
            date,
            label: date.getDate(),
            isCurrentMonth: false,
            isToday: isSameDay(date, today),
        });
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(
            startOfMonth.getFullYear(),
            startOfMonth.getMonth(),
            day
        );
        date.setHours(0, 0, 0, 0);
        cells.push({
            date,
            label: day,
            isCurrentMonth: true,
            isToday: isSameDay(date, today),
        });
    }

    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
        const date = new Date(
            startOfMonth.getFullYear(),
            startOfMonth.getMonth() + 1,
            i
        );
        date.setHours(0, 0, 0, 0);
        cells.push({
            date,
            label: date.getDate(),
            isCurrentMonth: false,
            isToday: isSameDay(date, today),
        });
    }

    return cells;
}

function isSameDay(a: Date, b: Date) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}
