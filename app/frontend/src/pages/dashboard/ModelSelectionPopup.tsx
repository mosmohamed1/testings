import React, { useEffect, useRef, useState } from "react";
import styles from "./Dashboard.module.css";
import { Delete24Regular, AddSquare24Regular } from "@fluentui/react-icons";
import { AppFolder24Regular } from "@fluentui/react-icons";

interface ModelSelectionPopupProps {
    models: string[];
    onSelect: (model: string) => void;
    onClose: () => void;
    onModelUpload: () => void;
}
interface ModelInfo {
    model_name: string;
    image_name: string;
}

const ModelSelectionPopup: React.FC<ModelSelectionPopupProps> = ({ models, onSelect, onClose, onModelUpload }) => {
    const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
    const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
    const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
    const [isDeleteModalOpen, setDeleteModalOpen] = React.useState<boolean>(false);
    const [modelToDelete, setModelToDelete] = React.useState<string | null>(null);
    const [isUploadModalOpen, setIsUploadModalOpen] = React.useState<boolean>(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [focusWords, setFocusWords] = useState<string[]>([]);
    const [pdfFiles, setPdfFiles] = useState<string[]>([]);
    const [selectedPdfFiles, setSelectedPdfFiles] = useState<string[]>([]);

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        const acceptedExtensions = [".jpg", ".jpeg", ".png"];
        if (file && acceptedExtensions.includes(file.name.slice(-4).toLowerCase())) {
            setSelectedImage(file);
        } else {
            setErrorMsg("Invalid image type. Only .jpg, .jpeg, or .png allowed.");
        }
    };
    useEffect(() => {
        fetch("/list_pdf_files")
            .then(response => response.json())
            .then(data => setPdfFiles(data))
            .catch(error => console.error("Error fetching PDF files:", error));
    }, []);
    const handleFileChange = event => {
        const file = event.target.files[0];

        const acceptedExtensions = [".stl", ".STL"];
        if (file && acceptedExtensions.includes(file.name.slice(-4).toLowerCase())) {
            setSelectedFile(file);
        } else {
            console.warn("Invalid file type or no file chosen.");
            setErrorMsg("Wrong extension. Only .stl or .STL allowed.");
        }
    };

    const confirmFileUpload = async () => {
        if (selectedFile && selectedImage) {
            let formData = new FormData();
            formData.append("model", selectedFile);

            try {
                let response = await fetch("/upload?type=model", {
                    method: "POST",
                    body: formData
                });
                let data = await response.json();

                if (data.success) {
                    console.log("STL file uploaded successfully");
                    formData.append("image", selectedImage);

                    formData = new FormData();
                    formData.append("image", selectedImage);

                    response = await fetch("/upload?type=image", {
                        method: "POST",
                        body: formData
                    });
                    data = await response.json();

                    if (data.success) {
                        console.log("Image uploaded successfully");
                        setSelectedFile(null);
                        setSelectedImage(null);
                        setSuccessMsg("Model and Image uploaded successfully");
                        if (onModelUpload) onModelUpload();

                        const modelInfo = {
                            model_name: selectedFile.name,
                            image_name: selectedImage.name,
                            focus_keywords: focusWords,
                            pdf_file_names: selectedPdfFiles
                        };

                        console.log("Selected PDF file:", selectedPdfFiles);

                        response = await fetch("http://localhost:5000/add_model_info", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify(modelInfo)
                        });

                        data = await response.json();

                        if (response.status === 201) {
                            console.log("Model info added successfully:", data.message);
                            setSuccessMsg("Model info added successfully");
                            setIsUploadModalOpen(false);
                        } else {
                            console.error("Error adding model info:", data.error || "Unknown error");
                            setErrorMsg(data.error || "There was an error adding model info.");
                        }
                    } else {
                        console.error("Image upload error:", data.error);
                        setErrorMsg(data.error);
                    }
                } else {
                    console.error("STL file upload error:", data.error);
                    setErrorMsg(data.error);
                }
            } catch (error) {
                console.error("There was an error processing the request:", error);
                setErrorMsg("There was an error processing the request.");
            }
        } else {
            setErrorMsg("Please select both a model and an image.");
        }
    };

    const handleDeleteModel = async (modelToDelete: string) => {
        console.log(modelToDelete);

        const modelName = modelToDelete.split("/").pop();
        const modelImageName = modelInfos.find(info => info.model_name === modelName)?.image_name;
        console.log(modelName);
        if (!modelName || !modelImageName) {
            setErrorMsg("Invalid model or image name.");
            return;
        }

        try {
            let response = await fetch(`/delete?type=model&filename=${modelName}`, {
                method: "DELETE"
            });

            let data = await response.json();

            if (data.success) {
                console.log("STL file deleted successfully");

                response = await fetch(`/delete?type=image&filename=${modelImageName}`, {
                    method: "DELETE"
                });
                data = await response.json();

                if (data.success) {
                    console.log("Image deleted successfully");

                    if (selectedFile?.name === modelName) {
                        setSelectedFile(null);
                    }
                    if (selectedImage?.name === modelImageName) {
                        setSelectedImage(null);
                    }

                    // setSuccessMsg("Model and Image deleted successfully");

                    response = await fetch(`http://localhost:5000/delete_model_info?model_name=${modelName}`, {
                        method: "DELETE"
                    });

                    data = await response.json();

                    if (data.success) {
                        console.log("Model info deleted successfully:", data.message);
                    } else {
                        console.error("Error deleting model info:", data.error || "Unknown error");
                        setErrorMsg(data.error || "There was an error deleting model info.");
                    }
                } else {
                    console.error("Image deletion error:", data.error);
                    setErrorMsg(data.error);
                }
            } else {
                console.error("STL file deletion error:", data.error);
                setErrorMsg(data.error);
            }
        } catch (error) {
            console.error("There was an error processing the request:", error);
            setErrorMsg("There was an error processing the request.");
        }
    };

    const openDeleteModal = (modelPath: string) => {
        setModelToDelete(modelPath);
        setDeleteModalOpen(true);
    };

    const closeDeleteModal = () => {
        setModelToDelete(null);
        setDeleteModalOpen(false);
    };

    const confirmFileDelete = async () => {
        if (modelToDelete) {
            await handleDeleteModel(modelToDelete);
        }
        closeDeleteModal();
    };

    const [modelInfos, setModelInfos] = useState<ModelInfo[]>([]);

    useEffect(() => {
        fetch("/get_model_infos")
            .then(response => response.json())
            .then(data => setModelInfos(data));
    }, []);

    return (
        <div className={styles.popup}>
            <div className={styles["popup-content"]}>
                <button className={styles.addModelButton} onClick={() => setIsUploadModalOpen(true)}>
                    <AddSquare24Regular />
                    Add Model
                </button>
                <h2>Select Model</h2>

                {models.map((modelPath, index) => {
                    const modelImageName = modelInfos.find(info => info.model_name === modelPath.split("/").pop())?.image_name;
                    return (
                        <div className={styles.card} key={modelPath}>
                            <img
                                src={modelImageName ? `/modelicon/${modelImageName}` : `/modelicon/default.png`}
                                alt={`Model ${modelPath.split("/").pop()}`}
                                className={styles.modelIcon}
                            />
                            <p className={styles.modelName}>{modelPath.split("/").pop()}</p>
                            <button className={styles.selectmodelpop} onClick={() => onSelect(modelPath)}>
                                <AppFolder24Regular />
                            </button>
                            <button
                                className={styles.deletemodelpop}
                                onClick={event => {
                                    event.stopPropagation();
                                    openDeleteModal(modelPath);
                                }}
                            >
                                <Delete24Regular />
                            </button>
                        </div>
                    );
                })}
                {isDeleteModalOpen && (
                    <div className={styles.modalOverlay}>
                        <div className={styles.modal}>
                            <h2 className={styles.modalHeader}>Delete Confirmation</h2>
                            <p>Are you sure you want to delete this model?</p>
                            <button className={styles.modalSubmitButton} onClick={() => confirmFileDelete()}>
                                Yes, Delete
                            </button>
                            <button className={styles.modalCancelButton} onClick={closeDeleteModal}>
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
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

                {isUploadModalOpen && (
                    <div className={styles.modalOverlay}>
                        <div className={styles.modal}>
                            <h2 className={styles.modalHeader}>Upload Model</h2>

                            <div className={styles.modalInputGroup}>
                                <label className={styles.modalLabel}>Select Model Image</label>
                                <input type="file" accept=".jpg,.jpeg,.png" className={styles.modalFileInput} onChange={handleImageChange} />
                            </div>

                            <div className={styles.modalInputGroup}>
                                <label className={styles.modalLabel}>Select Model</label>
                                <input
                                    type="file"
                                    accept=".stl,.STL"
                                    className={`${styles.modalFileInput} ${styles.fileInputpop}`}
                                    ref={inputRef}
                                    onChange={handleFileChange}
                                />
                            </div>

                            <div className={styles.modalInputGroup}>
                                <label className={styles.modalLabel}>Focus Words</label>
                                <input
                                    type="text"
                                    className={styles.modalTextInput}
                                    onChange={e => setFocusWords(e.target.value.split(",").map(word => word.trim()))}
                                    placeholder="Enter words separated by commas"
                                />
                            </div>
                            <div className={styles.modalInputGroup}>
                                <label className={styles.modalLabel}>Select PDF</label>
                                <select className={styles.modalSelect} onChange={e => setSelectedPdfFiles([e.target.value])}>
                                    {pdfFiles.map(file => (
                                        <option key={file} value={file}>
                                            {file}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button className={styles.modalSubmitButton} onClick={confirmFileUpload}>
                                Upload
                            </button>
                            <button
                                className={styles.modalCancelButton}
                                onClick={() => {
                                    setIsUploadModalOpen(false);
                                    setSelectedFile(null);
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                <div className={styles.closeIcon} onClick={onClose}>
                    &times;
                </div>
            </div>
        </div>
    );
};

export default ModelSelectionPopup;
