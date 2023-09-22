import React, { useState } from "react";
import styles from "./Table.module.css";

interface EditPopupProps {
    isVisible: boolean;
    onClose: () => void;
    onRename: (newName: string) => void;
    initialFileName: string;
}

const EditPopup: React.FC<EditPopupProps> = ({ isVisible, onClose, onRename, initialFileName }) => {
    const [newFileNameWithoutExtension, setNewFileNameWithoutExtension] = useState(initialFileName);

    const handleFileNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewFileNameWithoutExtension(e.target.value);
    };

    if (!isVisible) return null;

    const handleRename = () => {
        console.log("Confirm clicked in EditPopup");
        onRename(newFileNameWithoutExtension + ".pdf");
    };
    console.log("New file name:", newFileNameWithoutExtension + ".pdf");

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modal}>
                <p>Edit File Name</p>
                <input type="text" value={newFileNameWithoutExtension} onChange={handleFileNameChange} placeholder="Enter new file name" />
                <button className={`${styles.modalButton} ${styles.modalButtonConfirm}`} onClick={() => onRename(newFileNameWithoutExtension + ".pdf")}>
                    Confirm
                </button>
                <button className={`${styles.modalButton} ${styles.modalButtonCancel}`} onClick={onClose}>
                    Cancel
                </button>
            </div>
        </div>
    );
};

export default EditPopup;
