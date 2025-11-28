export const APP_NAME = "kanso";
export const APP_VERSION = "1.0.0";
export const APP_TITLE = `version ${APP_VERSION} March 3rd, 2023`;
export const AVAILABLE_WIDGETS = [
    {
        name: "Weather",
        type_id: "WeatherWidget",
        requirements: [],
    },
    {
        name: "Technical Analysis",
        type_id: "TechnicalAnalysisWidget",
        requirements: ["symbol"],
    },
    {
        name: "Note",
        type_id: "NoteWidget",
        requirements: [],
    },
    {
        name: "Bookmarks",
        type_id: "BookmarksWidget",
        bookmarks: [{ title: "InvesterAPP", link: "https://in.vester.app" }],
        requirements: [],
    },
    {
        name: "RSS Feed",
        type_id: "RSSWidget",
        requirements: [],
    },
    {
        name: "YouTube",
        type_id: "YouTubeWidget",
        requirements: [],
    },
    {
        name: "Calendar",
        type_id: "CalendarWidget",
        requirements: [],
    },
    {
        name: "Meeting Schedule",
        type_id: "MeetingScheduleWidget",
        requirements: [],
    },
    {
        name: "Package Tracking",
        type_id: "PackageTrackerWidget",
        requirements: [],
    },
    {
        name: "File Manager",
        type_id: "FileManagerWidget",
        requirements: [],
    },
    {
        name: "Email Reader",
        type_id: "EmailWidget",
        requirements: [],
    },
];
