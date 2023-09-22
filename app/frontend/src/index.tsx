import React from "react";
import ReactDOM from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { initializeIcons } from "@fluentui/react";

import "./index.css";

import Layout from "./pages/layout/Layout";
import Chat from "./pages/chat/Chat";
import Dashboard from "./pages/dashboard/Dashboard";
import Profile from "./pages/profile/Profile";
import Signin from "./pages/Authentication/signin/Signin";
import Signup from "./pages/Authentication/singup/Signup";
import Table from "./pages/table/Table";

initializeIcons();

const router = createHashRouter([
    {
        path: "/",
        element: <Layout />,
        children: [
            {
                index: true,
                element: <Chat />
            },
            {
                path: "dashboard",
                element: <Dashboard />
            },
            {
                path: "profile",
                element: <Profile />
            },
            {
                path: "table",
                element: <Table />
            },
            {
                path: "qa",
                lazy: () => import("./pages/oneshot/OneShot")
            },
            {
                path: "*",
                lazy: () => import("./pages/NoPage")
            }
        ]
    },
    {
        path: "login",
        element: <Signin />
    },
    {
        path: "register",
        element: <Signup />
    }
]);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <RouterProvider router={router} />
    </React.StrictMode>
);
