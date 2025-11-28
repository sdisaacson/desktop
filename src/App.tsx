import "./styling/App.css";
import Layout from "./components/Layout";
import { GlobalData, toggleTheme } from "./store/global";
import { useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import LoginScreen from "./components/Auth/LoginScreen";

function AppContent() {
    const theme = useSelector((state: GlobalData) => state.theme);
    const { currentUser } = useAuth();
    const dispatch = useDispatch();

    useEffect(() => {
        let selectedTheme = localStorage.getItem("theme");
        if (selectedTheme && selectedTheme !== theme) {
            dispatch(toggleTheme(selectedTheme));
        }
        // eslint-disable-next-line
    }, []);

    if (!currentUser) {
        return <LoginScreen theme={theme} />;
    }

    return (
        <div id="App" className={theme} data-theme={theme}>
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
