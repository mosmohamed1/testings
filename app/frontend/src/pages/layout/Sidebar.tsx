import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import styles from "./Sidebar.module.css";
import logo from "/Logo/blueSmart.png";
import { Chat24Filled, PersonSquareFilled, Grid24Regular, Dock24Filled, Book24Regular } from "@fluentui/react-icons";
import httpClient from "../../api/httpClient";
import { useLocation } from 'react-router-dom';
  


const Sidebar: React.FC = () => {
    const location = useLocation();
    const isActive = (path: string) => location.pathname === path;

    const [activeLink, setActiveLink] = useState("");

    const handleLinkClick = (path: string) => {
        setActiveLink(path);
    };
    const logoutUser = async () => {
        await httpClient.post("http://127.0.0.1:5000/logout");
        window.location.href = "/#/login";
    };

    return (
        <aside className={styles.sidebar}>
            <div className={styles.logo}>
                <img src={logo} alt="Logo" />
            </div>
            <nav className={styles.nav}>
                <ul>
                    <li>
                    <NavLink to="/dashboard" className={isActive('/dashboard') ? styles.active : ""}>
                            <Grid24Regular className={styles.icon} />
                            <span>Dashboard</span>
                        </NavLink>
                    </li>
                    <li>
                    <NavLink to="/profile" className={isActive('/profile') ? styles.active : ""}>
                            <PersonSquareFilled className={styles.icon} />
                            <span>Profile</span>
                        </NavLink>
                    </li>
                    <li>
                    <NavLink to="/" className={isActive('/') ? styles.active : ""}>
                            <Chat24Filled className={styles.icon} />
                            <span>Chat</span>
                        </NavLink>
                    </li>
                    <li>
                    <NavLink to="/table" className={isActive('/table') ? styles.active : ""}>
                            <Book24Regular className={styles.icon} />
                            <span>Standards Files</span>
                        </NavLink>
                    </li>
                    <li>
            <a className={activeLink === "/logout" ? styles.active : ""} onClick={logoutUser}>
              <Dock24Filled className={styles.icon} />
              <span className={styles.logoutText}>Logout</span> 
            </a>
          </li>
        </ul>
      </nav>
    </aside>
    );
};

export default Sidebar;
