import React, { useEffect, useState } from "react";
import styles from "./Dashboard.module.css";
import Model from "../models/Model";
import httpClient from "../../api/httpClient";
import { User } from "./types";
import ModelSelectionPopup from "./ModelSelectionPopup";

const Dashboard = () => {
    const [isPopupOpen, setIsPopupOpen] = useState(false);

    const handleSelectModel = () => {
        setIsPopupOpen(true);
    };

    const handleClosePopup = () => {
        setIsPopupOpen(false);
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
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>(availableModels[0]);

    useEffect(() => {
        (async () => {
            try {
                const resp = await httpClient.get("http://127.0.0.1:5000/models");
                setAvailableModels(resp.data.map((model: string) => `/models/${model}`));
            } catch (error) {
                console.log("Error fetching models:", error);
            }
        })();
    }, []);
    useEffect(() => {
        const storedModel = sessionStorage.getItem("selectedModel");

        if (storedModel) {
            setSelectedModel(storedModel);
        }
    }, []);

    const handleModelSelect = modelPath => {
        setSelectedModel(modelPath);

        sessionStorage.setItem("selectedModel", modelPath);
    };

    const fetchModels = async () => {
        try {
            const resp = await httpClient.get("http://127.0.0.1:5000/models");
            setAvailableModels(resp.data.map((model: string) => `/models/${model}`));
        } catch (error) {
            console.log("Error fetching models:", error);
        }
    };

    useEffect(() => {
        fetchModels();
    }, []);

    return (
        <>
            {user !== null ? (
                <div>
                    <h1>Welcome to SMART Standards</h1>
                    <button className={styles.selectModel} onClick={handleSelectModel}>
                        Select Model
                    </button>
                    {selectedModel ? <Model selectedModel={selectedModel} /> : <div>Hi {user.firstName} You haven't select Model yet</div>}

                    {isPopupOpen && (
                        <ModelSelectionPopup
                            models={availableModels}
                            onSelect={model => {
                                handleModelSelect(model);
                                handleClosePopup();
                            }}
                            onClose={handleClosePopup}
                            onModelUpload={fetchModels}
                        />
                    )}
                </div>
            ) : (
                <h1>You are not logged in</h1>
            )}
        </>
    );
};
export default Dashboard;
