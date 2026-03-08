import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

interface CyberGlobeProps {
  width?: number;
  height?: number;
  data?: Array<{
    lat: number;
    lng: number;
    size: number;
    color: string;
    intensity: number;
  }>;
  interactive?: boolean;
  onPointClick?: (point: any) => void;
}

export const CyberGlobe: React.FC<CyberGlobeProps> = ({
  width = 800,
  height = 600,
  data = [],
  interactive = true,
  onPointClick
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const controlsRef = useRef<OrbitControls>();
  const composerRef = useRef<EffectComposer>();
  const pointsRef = useRef<THREE.Points>();

  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 5;
    cameraRef.current = camera;

    // Renderer with advanced settings
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    mountRef.current.appendChild(renderer.domElement);

    // Advanced lighting setup
    const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Cyberpunk-style globe
    const globeGeometry = new THREE.SphereGeometry(2, 64, 64);
    const globeMaterial = new THREE.MeshPhongMaterial({
      color: 0x1a1a2e,
      transparent: true,
      opacity: 0.8,
      shininess: 100,
      specular: 0x00ffff
    });

    const globe = new THREE.Mesh(globeGeometry, globeMaterial);
    scene.add(globe);

    // Wireframe overlay for cyber aesthetic
    const wireframeGeometry = new THREE.SphereGeometry(2.01, 32, 32);
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      wireframe: true,
      transparent: true,
      opacity: 0.1
    });

    const wireframe = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
    scene.add(wireframe);

    // Create cyberpunk grid
    const gridGeometry = new THREE.SphereGeometry(2.02, 64, 32);
    const gridMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      wireframe: true,
      transparent: true,
      opacity: 0.05
    });

    const grid = new THREE.Mesh(gridGeometry, gridMaterial);
    scene.add(grid);

    // Interactive points for threat data
    if (data.length > 0) {
      const pointsGeometry = new THREE.BufferGeometry();
      const positions = [];
      const colors = [];
      const sizes = [];

      data.forEach(point => {
        // Convert lat/lng to 3D position
        const phi = (90 - point.lat) * (Math.PI / 180);
        const theta = (point.lng + 180) * (Math.PI / 180);

        const x = -(2.1 * Math.sin(phi) * Math.cos(theta));
        const z = 2.1 * Math.sin(phi) * Math.sin(theta);
        const y = 2.1 * Math.cos(phi);

        positions.push(x, y, z);
        sizes.push(point.size * 5);

        // Parse color
        const color = new THREE.Color(point.color);
        colors.push(color.r, color.g, color.b);
      });

      pointsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      pointsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      pointsGeometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

      const pointsMaterial = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 }
        },
        vertexShader: `
          attribute float size;
          varying vec3 vColor;
          varying float vSize;

          void main() {
            vColor = color;
            vSize = size;

            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * (300.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          varying vec3 vColor;
          varying float vSize;

          void main() {
            float r = distance(gl_PointCoord, vec2(0.5, 0.5));
            if (r > 0.5) discard;

            float alpha = 1.0 - smoothstep(0.0, 0.5, r);
            gl_FragColor = vec4(vColor, alpha);
          }
        `,
        transparent: true,
        vertexColors: true,
        blending: THREE.AdditiveBlending
      });

      const points = new THREE.Points(pointsGeometry, pointsMaterial);
      scene.add(points);
      pointsRef.current = points;
    }

    // Controls
    if (interactive) {
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.enableZoom = true;
      controls.enablePan = false;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.5;
      controlsRef.current = controls;
    }

    // Post-processing for cyberpunk effect
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      1.5, // strength
      0.4, // radius
      0.85 // threshold
    );
    composer.addPass(bloomPass);
    composerRef.current = composer;

    setIsInitialized(true);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);

      if (controlsRef.current) {
        controlsRef.current.update();
      }

      // Animate points
      if (pointsRef.current && pointsRef.current.material instanceof THREE.ShaderMaterial) {
        pointsRef.current.material.uniforms.time.value += 0.01;
        pointsRef.current.rotation.y += 0.002;
      }

      // Animate wireframe
      wireframe.rotation.y += 0.005;
      wireframe.rotation.x += 0.002;

      // Animate grid
      grid.rotation.y -= 0.003;
      grid.rotation.x += 0.001;

      composer.render();
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!camera || !renderer || !composer) return;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      composer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [width, height, data, interactive]);

  return (
    <div
      ref={mountRef}
      className="cyber-globe-container relative overflow-hidden rounded-xl"
      style={{ width, height }}
    >
      {!isInitialized && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm rounded-xl">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-blue-400">Initializing Neural Network...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CyberGlobe;
