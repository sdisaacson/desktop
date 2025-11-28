import { useState, useCallback } from "react";
import { db, auth } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useDispatch, useSelector } from "react-redux";
import { GlobalData, setBoard, setWidgets, setLayouts, setDashboards } from "../store/global";
import { onAuthStateChanged } from "firebase/auth";
import { INITIAL_LAYOUT, INITIAL_WIDGETS } from "../constants/initials";

export const useFirestore = () => {
    const dispatch = useDispatch();
    // Removed unused global selector
    const [loading, setLoading] = useState(false);

    // Helper to get the current user ID
    const getUid = () => {
        return auth.currentUser?.uid;
    };

    // Save current dashboard state to Firestore
    const saveToFirestore = useCallback(async (data: Partial<GlobalData>) => {
        const uid = getUid();
        if (!uid) return;

        try {
            const userDocRef = doc(db, "users", uid);
            // We save widgets, layouts, and dashboards.
            // We construct the payload based on what's passed or current state if needed,
            // but usually we pass the specific updated parts.
            await setDoc(userDocRef, data, { merge: true });
        } catch (error) {
            console.error("Error saving to Firestore:", error);
        }
    }, []);

    // Load dashboard state from Firestore
    const loadFromFirestore = useCallback(async () => {
        const uid = getUid();
        if (!uid) return;

        setLoading(true);
        try {
            const userDocRef = doc(db, "users", uid);
            const docSnap = await getDoc(userDocRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.widgets) dispatch(setWidgets(data.widgets));
                if (data.layouts) dispatch(setLayouts(data.layouts));
                if (data.dashboards) dispatch(setDashboards(data.dashboards));
                // Recalculate board from widgets+layouts if needed, or if saved directly
                // (Logic similar to useBoard's generateLayoutArray would be needed here or triggered)
            } else {
                // Initialize new user with defaults (Blank Dashboard)
                await setDoc(userDocRef, {
                    widgets: [],
                    layouts: [],
                    dashboards: []
                });
                dispatch(setWidgets([]));
                dispatch(setLayouts([]));
                dispatch(setBoard([]));
            }
        } catch (error) {
            console.error("Error loading from Firestore:", error);
        } finally {
            setLoading(false);
        }
    }, [dispatch]);

    return { saveToFirestore, loadFromFirestore, loading };
};
