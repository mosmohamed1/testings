import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "./Profile.module.css";
import Avatar from "/Avatar/1.png";

const Profile = () => {
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [companyName, setCompanyName] = useState("");
    const [title, setTitle] = useState("");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    useEffect(() => {
        const fetchUserProfile = async () => {
            try {
                const response = await axios.get("/@me");
                const userData = response.data;

                setFirstName(userData.firstName);
                setLastName(userData.lastName);
                setEmail(userData.email);
                setCompanyName(userData.companyName);
                setTitle(userData.title);
            } catch (error) {}
        };

        fetchUserProfile();
    }, []);

    const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        try {
            const response = await axios.post("/update_profile", {
                firstName,
                lastName,
                email,
                password,
                companyName,
                title
            });
            setSuccessMsg("Your information has been updated!");
            setErrorMsg(null);
        } catch (error: any) {
            if (error.response && error.response.data && error.response.data.error) {
                setErrorMsg(error.response.data.error);
            } else {
                setErrorMsg("Email is Already Exist");
            }
            setSuccessMsg(null);
        }
    };

    return (
        <div>
            {errorMsg && (
                <div key={errorMsg} className={`${styles.toast} ${styles.errorpro} ${styles.fadeInOut}`} onAnimationEnd={() => setErrorMsg(null)}>
                    {errorMsg}
                </div>
            )}
            {successMsg && (
                <div key={successMsg} className={`${styles.toast} ${styles.successpro} ${styles.fadeInOut}`} onAnimationEnd={() => setSuccessMsg(null)}>
                    {successMsg}
                </div>
            )}

            <div className={styles.profileContainer}>
                <div className={styles.profileInfo}>
                    <img className={styles.profileImage} src={Avatar} alt="Profile" />
                    <h2>
                        {firstName} {lastName}
                    </h2>
                    <p>Title: {title}</p>
                    <p>Company: {companyName}</p>
                </div>
                <div className={styles.updateInfo}>
                    <h1>Update Profile Information</h1>
                    <form onSubmit={handleUpdateProfile}>
                        <div>
                            <input
                                type="text"
                                id="firstName"
                                name="firstName"
                                value={firstName}
                                placeholder="First Name"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFirstName(e.target.value)}
                            />
                        </div>
                        <div>
                            <input
                                type="text"
                                id="lastName"
                                name="lastName"
                                value={lastName}
                                placeholder="Last Name"
                                onChange={e => setLastName(e.target.value)}
                            />
                        </div>
                        <div>
                            <input type="email" id="email" name="email" value={email} placeholder="Email" onChange={e => setEmail(e.target.value)} />
                        </div>
                        <div>
                            <input
                                type="password"
                                id="password"
                                name="password"
                                placeholder="Password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                        </div>
                        <div>
                            <input
                                type="text"
                                id="companyName"
                                name="companyName"
                                value={companyName}
                                placeholder="Company Name"
                                onChange={e => setCompanyName(e.target.value)}
                            />
                        </div>
                        <div>
                            <input type="text" id="title" name="title" value={title} placeholder="Title" onChange={e => setTitle(e.target.value)} />
                        </div>
                        <button className={styles.updateButton} type="submit">
                            Update Profile
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Profile;
