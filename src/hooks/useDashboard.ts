import { useCallback } from "react";
import { useDispatch } from "react-redux";
import { setDashboards, setActiveDashboard } from "../store/global";
import { v4 as uuidv4 } from "uuid";

export const useDashboard = () => {
    const dispatch = useDispatch();

    const getLocalDashboards = useCallback(async (): Promise<Dashboard[]> => {
        const dashboards = localStorage.getItem("dashboards");
        if (dashboards) {
            return JSON.parse(dashboards);
        }
        return [];
    }, []);

    const getLocalActiveDashboard = useCallback(async (): Promise<string> => {
        const localActiveDashboardId = localStorage.getItem("activeDashboard");
        if (localActiveDashboardId) {
            return localActiveDashboardId;
        }
        return "home";
    }, []);

    const saveDashboards = useCallback((dashboardsArr: Dashboard[]) => {
        try {
            localStorage.setItem("dashboards", JSON.stringify(dashboardsArr));
            return true;
        } catch (err: any) {
            throw new Error(err.message);
        }
    }, []);

    const createNewDashboard = useCallback(async () => {
        const newId = uuidv4();
        const existingDashboards = await getLocalDashboards();

        if (existingDashboards.length > 0) {
            const nextDashboards = [
                ...existingDashboards,
                { id: newId, widgets: [], layouts: [] },
            ];
            localStorage.setItem("dashboards", JSON.stringify(nextDashboards));
            dispatch(setDashboards(nextDashboards));
        } else {
            const dashboardsTemp = [{ id: newId, widgets: [], layouts: [] }];
            dispatch(setDashboards(dashboardsTemp));
            localStorage.setItem("dashboards", JSON.stringify(dashboardsTemp));
        }

        dispatch(setActiveDashboard(newId));
        localStorage.setItem("activeDashboard", newId);
    }, [dispatch, getLocalDashboards]);

    return {
        createNewDashboard,
        saveDashboards,
        getLocalDashboards,
        getLocalActiveDashboard,
    };
};
