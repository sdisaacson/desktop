import { useEffect, useState } from "react";
import {
    GitHub,
    Plus,
    Maximize,
    Minimize,
    Trash2,
    RefreshCcw,
    LogOut,
} from "react-feather";
import { APP_NAME, APP_TITLE } from "../../constants/config";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../../store";
import {
    GlobalData,
    setBoard,
    setLayouts,
    setWidgets,
    toggleModalOpen,
    toggleTheme,
} from "../../store/global";
import { Sun, Moon } from "react-feather";
import Clock from "./Clock";
import { INITIAL_LAYOUT, INITIAL_WIDGETS } from "../../constants/initials";
import { useAuth } from "../../contexts/AuthContext";

export default function Header() {
    const [fullScreen, setFullScreen] = useState(false);
    const dispatch = useDispatch();
    const modalOpen = useSelector((state: RootState) => state.modalOpen);
    const { logout, currentUser } = useAuth();

    function toggleFullscreen() {
        const elem: HTMLElement = document.documentElement;
        if (!fullScreen) {
            elem.requestFullscreen && elem.requestFullscreen();
            setFullScreen(true);
        } else {
            document.exitFullscreen && document.exitFullscreen();
            setFullScreen(false);
        }
    }

    function handleModal() {
        dispatch(toggleModalOpen(!modalOpen));
    }

    function handleClearDashboard() {
        if (
            window.confirm(
                "Are you sure? All the widgets and their contents will be resetted. You will loose your notes etc."
            )
        ) {
            dispatch(setWidgets([]));
            dispatch(setLayouts([]));
            dispatch(setBoard([]));
        }
    }

    function handleResetDashboard() {
        if (
            window.confirm(
                "Are you sure? All the widgets and their contents will be resetted. You will loose your notes etc."
            )
        ) {
            dispatch(setWidgets(INITIAL_WIDGETS));
            dispatch(setLayouts(INITIAL_LAYOUT));
            window.location.reload();
        }
    }

    async function handleLogout() {
        try {
            await logout();
        } catch (error) {
            console.error("Failed to log out", error);
        }
    }

    return (
        <div id="Header" data-testid="Header">
            <div className="Col">
                <span id="AppLogo">{APP_NAME}</span>
            </div>

            <div className="Col"></div>

            <div className="Col">
                <ThemeSwitcherWithAnimation />
                <button
                    className="add-button"
                    onClick={handleModal}
                    data-testid="addWidgetButton"
                >
                    <Plus size={14} style={{ marginRight: 8 }} /> Add Widget
                </button>
                <button
                    onClick={handleResetDashboard}
                    data-testid="resetDashboard"
                >
                    <RefreshCcw size={14} style={{ marginRight: 8 }} /> Reset
                </button>
                <button
                    className="danger"
                    onClick={handleClearDashboard}
                    data-testid="clearDashboard"
                >
                    <Trash2 size={14} style={{ marginRight: 8 }} /> Clear
                </button>
                <button
                    onClick={handleLogout}
                    title="Log Out"
                >
                    <LogOut size={14} style={{ marginRight: 8 }} /> Logout
                </button>
                <button
                    data-testid="sourceCodeButton"
                    onClick={() => {
                        window.location.href =
                            "https://github.com/onur-celik/invester";
                    }}
                >
                    <GitHub size={14} />
                </button>
                <button
                    onClick={toggleFullscreen}
                    data-testid="fullScreenButton"
                >
                    {fullScreen ? (
                        <Minimize size={14} />
                    ) : (
                        <Maximize size={14} />
                    )}
                </button>
                <button>
                    <Clock />
                </button>
            </div>
        </div>
    );
}

function ThemeSwitcherWithAnimation() {
    const [themeClass, setThemeClass] = useState("night");
    const theme = useSelector((state: GlobalData) => state.theme);
    const dispatch = useDispatch();

    useEffect(() => {
        if (theme === "dark") {
            setThemeClass("day");
        } else {
            setThemeClass("night");
        }
    }, [theme]);

    return (
        <div
            id="ThemeSwitcherWithAnimation"
            onClick={() => {
                setThemeClass((before) => (before === "day" ? "night" : "day"));
                dispatch(
                    toggleTheme(theme === "dark" ? "light" : "dark")
                );
            }}
        >
            <div id="ThemeSwitcherWithAnimationInner" className={themeClass}>
                <div className="themeIcon day">
                    <Sun size={16} color={"black"} />
                </div>
                <div className="themeIcon night">
                    <Moon size={16} color="#fec33b" />
                </div>
            </div>
        </div>
    );
}