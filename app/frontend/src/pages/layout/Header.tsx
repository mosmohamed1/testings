import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import styles from "./Header.module.css";
import { PersonFilled } from "@fluentui/react-icons";
import httpClient from "../../api/httpClient";
import { User } from "../dashboard/types";

const Header: React.FC = () => {
    const [showDropdown, setShowDropdown] = useState(false);

    const handleDropdownToggle = () => {
        setShowDropdown(prevState => !prevState);
    };

    const [user, setUser] = useState<User | null>(null);
    useEffect(() => {
        (async () => {
            try {
                const resp = await httpClient.get("http://127.0.0.1:5000/@me");
                setUser(resp.data);
            } catch (error) {
                console.log("not authenticated");
            }
        })();
    }, []);
    const logoutUser = async () => {
        await httpClient.post("http://127.0.0.1:5000/logout");
        window.location.href = "/#/login";
        // localStorage.removeItem(chat_data);
    };

    return (
        <>
            {user !== null ? (
                <>
                    <header className={styles.header}>
                        <div className={styles.userContainer}>
                            <div className={styles.userName}>
                                <span>{user.firstName}</span> <span>{user.lastName}</span>
                            </div>
                            <div className={styles.userIcon} onClick={handleDropdownToggle}>
                                <PersonFilled />
                            </div>
                            {showDropdown && (
                                <div className={styles.dropdownMenu}>
                                    <ul className={styles.dropdownList}>
                                        <li>
                                            <NavLink to="/profile" className={styles.dropdownItem} onClick={handleDropdownToggle}>
                                                Profile
                                            </NavLink>
                                        </li>
                                        <li>
                                            <button className={styles.dropdownItem} onClick={logoutUser}>
                                                Logout
                                            </button>
                                        </li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    </header>
                </>
            ) : (
                <header className={styles.header}>
                    <div className={styles.userContainer}>
                        <div className={styles.userName}>
                            <span>User Email</span>
                        </div>
                        <div className={styles.userIcon} onClick={handleDropdownToggle}>
                            <PersonFilled />
                        </div>
                        {showDropdown && (
                            <div className={styles.dropdownMenu}>
                                <ul className={styles.dropdownList}>
                                    <li>
                                        <NavLink to="/profile" className={styles.dropdownItem} onClick={handleDropdownToggle}>
                                            Profile
                                        </NavLink>
                                    </li>
                                    <li>
                                        <button className={styles.dropdownItem} onClick={logoutUser}>
                                            Logout
                                        </button>
                                    </li>
                                </ul>
                            </div>
                        )}
                    </div>
                </header>
            )}
        </>
    );
};

export default Header;
