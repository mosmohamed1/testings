import React, { useState, useEffect } from "react";
import styles from "./Signin.module.css";
import logo from "/Logo/blueSmart.png";
import logo2 from "/Logo/IPE.png";
import httpClient from "../../../api/httpClient";

const Signin = () => {
    const [email, setEmail] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const [rememberMe, setRememberMe] = useState<boolean>(false);

    const logInUser = async () => {
        setErrorMessage(null);

        try {
            const resp = await httpClient.post("http://127.0.0.1:5000/login", {
                email,
                password
            });
            setIsLoggedIn(true);
            setErrorMessage(null);
            if (rememberMe) {
                localStorage.setItem("userId", resp.data.id);
            }
        } catch (error: any) {
            if (error.response && error.response.data && error.response.data.error) {
                setErrorMessage("Email or password is wrong");
            } else {
                setErrorMessage("An unknown error occurred.");
            }
        }
    };

    useEffect(() => {
        const checkLoggedIn = async () => {
            const userId = localStorage.getItem("userId");
            if (userId) {
                setIsLoggedIn(true);
            } else {
                try {
                    const resp = await httpClient.get("http://127.0.0.1:5000/@me");
                    if (resp.data.id) {
                        setIsLoggedIn(true);
                        setSuccessMessage("Logged in successfully!");
                    }
                } catch (error: any) {
                    if (error.response && error.response.status === 401) {
                        localStorage.removeItem("userId");
                    }
                }
            }
        };
        checkLoggedIn();
    }, []);

    if (isLoggedIn) {
        window.location.href = "/#/dashboard";
        return null;
    }

    return (
        <div className={styles.container}>
            {errorMessage && (
                <div className={`${styles.toast} ${styles.errorpro} ${styles.fadeInOut}`} onAnimationEnd={() => setErrorMessage(null)}>
                    {errorMessage}
                </div>
            )}
            {successMessage && (
                <div className={`${styles.toast} ${styles.successpro} ${styles.fadeInOut}`} onAnimationEnd={() => setSuccessMessage(null)}>
                    {successMessage}
                </div>
            )}
            <form className={styles.form}>
                <img src={logo} alt="Logo" className={styles.logo} />
                <h1 className={styles.formTitle}>Login to SMART Standards</h1>

                <div className={styles.formField}>
                    <label htmlFor="email"></label>
                    <input type="email" id="email" value={email} placeholder="Email" onChange={e => setEmail(e.target.value)} />
                </div>
                <div className={styles.formField}>
                    <label htmlFor="password"></label>
                    <input type="password" id="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
                </div>
                <div className={styles.formField}>
                    <input type="checkbox" id="rememberMe" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
                    <label htmlFor="rememberMe">Remember me</label>
                </div>

                <div className={styles.registerNow}>
                    Can't login?{" "}
                    <a href="/#/register" className={styles.registerLink}>
                        Register Now
                    </a>
                    .
                </div>

                <button type="button" className={styles.loginButton} onClick={() => logInUser()}>
                    Login
                </button>
                <div className={styles.poweredByContainer}>
                    <label htmlFor="poweredBy">Powered by</label>
                    <img src={logo2} alt="Powered by Logo" className={styles.logo2} />
                </div>
            </form>
        </div>
    );
};

export default Signin;
