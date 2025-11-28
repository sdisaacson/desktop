import "./styling/App.css";
import Layout from "./components/Layout";
import { GlobalData, toggleTheme } from "./store/global";
import { useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import LoginScreen from "./components/Auth/LoginScreen";

function AppContent() {
    const global = useSelector((state: GlobalData) => state);
    const { currentUser } = useAuth();
    const dispatch = useDispatch();

    useEffect(() => {
        let selectedTheme = localStorage.getItem("theme");
        if (selectedTheme && selectedTheme !== global.theme) {
            dispatch(toggleTheme(selectedTheme));
        }
        // eslint-disable-next-line
    }, []);

    if (!currentUser) {
        return <LoginScreen theme={global.theme} />;
    }

    return (
        <div id="App" className={global.theme} data-theme={global.theme}>
            <Layout />
        </div>
    );
}

function App() {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
}

export default App;
