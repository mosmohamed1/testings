import React from "react";
import { Canvas } from "@react-three/fiber";
import Experience from "./Experience";

const Model: React.FC<{ selectedModel: string }> = ({ selectedModel }) => {
    return (
        <Canvas>
            <Experience stlUrl={selectedModel} />
        </Canvas>
    );
};

export default Model;
