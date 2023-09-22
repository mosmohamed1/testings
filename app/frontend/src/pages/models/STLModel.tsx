import React, { useRef } from "react";
import { useLoader } from "@react-three/fiber";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import { Mesh, BufferGeometry } from "three";

interface STLModelProps {
    url: string;
    scale?: [number, number, number];
}

const STLModel: React.FC<STLModelProps> = ({ url, scale = [1, 1, 1] }) => {
    const meshRef = useRef<Mesh | null>(null);
    const geometry = useLoader(STLLoader, url) as BufferGeometry;

    return (
        <mesh ref={meshRef} geometry={geometry} scale={scale}>
            <meshStandardMaterial color="gray" />
        </mesh>
    );
};

export default STLModel;
