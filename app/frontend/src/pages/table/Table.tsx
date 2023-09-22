import React, { useEffect, useState } from "react";
import axios from "axios";
import styles from "./Table.module.css";
import EditPopup from "./EditPopup";

import { Delete24Regular, AddSquare24Regular, Edit24Regular } from "@fluentui/react-icons";
const Table: React.FC = () => {
    const [files, setFiles] = useState<string[]>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
    const [fileToDelete, setFileToDelete] = useState<string | null>(null);
    const [isEditPopupVisible, setIsEditPopupVisible] = useState<boolean>(false);
    const [editingFile, setEditingFile] = useState<string | null>(null);
    const [newFileNameWithoutExtension, setNewFileNameWithoutExtension] = useState<string>("");

    useEffect(() => {
        fetchFiles();
    }, []);

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleChooseFileClick = () => {
        fileInputRef.current?.click();
    };
    const fetchFiles = async () => {
        try {
            const response = await axios.get("http://localhost:5000/list_pdf_files");
            setFiles(response.data);
        } catch (error) {
            console.error("An error occurred while fetching files:", error);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const formData = new FormData();
            formData.append("file", file);
            try {
                await axios.post("http://localhost:5000/add_pdf_file", formData);
                fetchFiles();
                setSuccessMessage("File uploaded successfully");
            } catch (error) {
                console.error("An error occurred while uploading file:", error);
                setErrorMessage("Failed to upload file");
            }
        }
    };
    const handleFileDeleteClick = (fileName: string) => {
        setFileToDelete(fileName);
        setIsDeleteModalOpen(true);
    };

    const handleFileNameSubmit = async (oldName: string, newName: string) => {
        try {
            const response = await axios.put(`http://localhost:5000/rename_pdf_file`, {
                original_name: oldName,
                new_name: newName
            });
            if (response.data && response.data.message) {
                setSuccessMessage(response.data.message);
            } else {
                throw new Error("No success message received from server");
            }
            fetchFiles();
            setIsEditPopupVisible(false);
            setNewFileNameWithoutExtension("");
        } catch (error) {
            console.error("An error occurred while renaming the file:", error);
            setErrorMessage("Failed to rename the file");
        }
    };

    const confirmFileDelete = async () => {
        if (fileToDelete) {
            try {
                await axios.delete(`http://localhost:5000/remove_pdf_file`, { data: { file_name: fileToDelete } });
                fetchFiles();
                setSuccessMessage("File deleted successfully");
            } catch (error) {
                console.error("An error occurred while deleting file:", error);
                setErrorMessage("Failed to delete file");
            }
        }
        closeDeleteModal();
    };
    const closeDeleteModal = () => {
        setIsDeleteModalOpen(false);
        setFileToDelete(null);
    };

    return (
        <div>
            <h1>Standards Files</h1>
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
            {isDeleteModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <p>Are you sure you want to delete this file?</p>
                        <button onClick={confirmFileDelete} className={`${styles.modalButton} ${styles.modalButtonConfirm}`}>
                            Confirm
                        </button>
                        <button onClick={closeDeleteModal} className={`${styles.modalButton} ${styles.modalButtonCancel}`}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}
            <EditPopup
                isVisible={isEditPopupVisible}
                onClose={() => {
                    setIsEditPopupVisible(false);
                    setEditingFile(null);
                }}
                onRename={newName => {
                    if (editingFile) {
                        handleFileNameSubmit(editingFile, newName);
                    }
                }}
                initialFileName={editingFile ? editingFile.replace(".pdf", "") : ""}
            />

            <label className={styles.fileInputWrapper}>
                <button type="button" className={styles.uploadButton} onClick={handleChooseFileClick}>
                    <AddSquare24Regular /> Add File
                </button>
                <input type="file" accept=".pdf" onChange={handleFileUpload} className={styles.fileInputT} ref={fileInputRef} />
            </label>
            <table className={styles.table}>
                <thead>
                    <tr className={styles.header}>
                        <th className={styles.cell}>File Name</th>
                        <th className={styles.cell}>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {files.map(file => (
                        <tr key={file} className={styles.row}>
                            <td className={styles.cell}>{file}</td>

                            <td className={styles.cell}>
                                <button onClick={() => handleFileDeleteClick(file)} className={styles.button}>
                                    <Delete24Regular />
                                </button>
                                <button
                                    onClick={() => {
                                        setEditingFile(file);
                                        setNewFileNameWithoutExtension(file.replace(".pdf", ""));
                                        setIsEditPopupVisible(true);
                                    }}
                                    className={styles.button}
                                >
                                    <Edit24Regular />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default Table;
