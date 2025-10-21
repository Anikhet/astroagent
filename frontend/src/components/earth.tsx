import { Canvas } from '@react-three/fiber'
import React from 'react'
import { OrbitControls } from '@react-three/drei'
import { Sky } from '@react-three/drei'

const Earth = () => {
  return (
    <div className="w-screen h-screen">
      <Canvas className="w-full h-full" camera={{ position: [90, 50, 0]}}>
        <ambientLight intensity={0.6} />
        <mesh scale={40} position={[0, -1, 0]} rotation-x={[-Math.PI * 0.5]} >
          <planeGeometry  />
          <meshStandardMaterial color="greenyellow" />
        </mesh>
        <OrbitControls  enableRotate={true} />
        <Sky sunPosition={[200, 70, 0]}/>
      </Canvas>
    </div>
  )
}

export default Earth