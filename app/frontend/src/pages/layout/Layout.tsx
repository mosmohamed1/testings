import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import styles from "./Layout.module.css";
import Sidebar from "./Sidebar";
import Header from "./Header";
import httpClient from "../../api/httpClient";
import { User } from "../dashboard/types";

const Layout = () => {
    const [user, setUser] = useState<User | null>(null);
    useEffect(() => {
        (async () => {
            try {
                const resp = await httpClient.get("http://127.0.0.1:5000/@me");
                setUser(resp.data);
            } catch (error: any) {
                if (error.response && error.response.status === 401) {
                    console.log("User is not authenticated.");
                    window.location.href = "/#/login";
                    localStorage.removeItem("userId");
                } else {
                    console.error("Error fetching user:", error);
                }
            }
        })();
    }, []);

    return (
        <>
            {user !== null ? (
                <>
                    <div className={styles.layout}>
                        <Header />
                        <div className={styles.layoutContent}>
                            <Sidebar />
                            <div className={styles.contentContainer}>
                                <Outlet />
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <h1>You are not logged in</h1>
            )}
        </>
    );
};

export default Layout;
