import React from "react";
import { Canvas } from "@react-three/fiber";
import { PresentationControls, Stage } from "@react-three/drei";
import STLModel from "./STLModel";

const Experience = ({ stlUrl }: { stlUrl: string }) => {
    return (
        <PresentationControls speed={1.5} global polar={[-0.1, Math.PI / 4]} rotation={[Math.PI / 8, Math.PI / 4, 0]}>
            <Stage environment="city" intensity={0.6} castShadow={false}>
                <STLModel url={stlUrl} scale={[4, 4, 4]} />
            </Stage>
        </PresentationControls>
    );
};

export default Experience;
