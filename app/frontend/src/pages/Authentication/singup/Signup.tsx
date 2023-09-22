import React, { useState, useEffect } from "react";
import styles from "./Signup.module.css";
import logo from "/Logo/blueSmart.png";
import httpClient from "../../../api/httpClient";

const Signup = () => {
    const [email, setEmail] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [firstName, setFirstName] = useState<string>("");
    const [lastName, setLastName] = useState<string>("");
    const [companyName, setCompanyName] = useState<string>("");
    const [title, setTitle] = useState<string>("");
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const registerUser = async () => {
        try {
            const resp = await httpClient.post("http://127.0.0.1:5000/register", {
                email,
                password,
                firstName,
                lastName,
                companyName,
                title
            });
            console.log("User registered successfully");
            setIsLoggedIn(true);
        } catch (error: any) {
            if (error.response && error.response.data.error) {
                setErrorMessage(error.response.data.error);
            }
        }
    };

    useEffect(() => {
        const checkLoggedIn = async () => {
            try {
                const resp = await httpClient.get("http://127.0.0.1:5000/@me");
                if (resp.data.id) {
                    setIsLoggedIn(true);
                }
            } catch (error) {}
        };
        checkLoggedIn();
    }, []);

    useEffect(() => {
        if (isLoggedIn) {
            window.location.href = "/#/Dashboard";
        }
    }, [isLoggedIn]);

    return (
        <div className={styles.containerUp}>
            {errorMessage && (
                <div className={`${styles.toast} ${styles.errorpro} ${styles.fadeInOut}`} onAnimationEnd={() => setErrorMessage(null)}>
                    {errorMessage}
                </div>
            )}

            <form className={styles.formUp}>
                <img src={logo} alt="Logo" className={styles.logoUp} />
                <h1 className={styles.formTitleUp}>Sign up for SMART Standards</h1>
                <div className={styles.formFieldUp}>
                    <input type="text" id="firstName" placeholder="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} />
                    <input type="text" id="lastName" placeholder="Last Name" value={lastName} onChange={e => setLastName(e.target.value)} />
                </div>
                <div className={styles.formFieldUp}>
                    <input type="text" id="title" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
                    <input type="text" id="companyName" placeholder="Company Name" value={companyName} onChange={e => setCompanyName(e.target.value)} />
                </div>
                <div className={styles.formFieldUp}>
                    <input type="email" id="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
                    <input type="password" id="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
                </div>

                <button type="button" className={styles.signupButtonUp} onClick={() => registerUser()}>
                    Sign up
                </button>
            </form>
        </div>
    );
};

export default Signup;
