import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import './Beyblade.css';

const STATUS_TARGETS = {
  idle: { speed: 0.03, camY: 0, camZ: 7, tiltX: 0.2, lean: 0, gap: 1.5 },
  disconnected: { speed: 0, camY: 0, camZ: 7, tiltX: 0.2, lean: 0, gap: 1.5 },
  attached: { speed: 0, camY: 0, camZ: 7, tiltX: 0.2, lean: 0, gap: 0 },
  spin_fast: { speed: 0.3, camY: -2, camZ: 7, tiltX: 0.3, lean: 0.6, gap: 0 },
  spin_slow: { speed: 0.09, camY: 2, camZ: 7, tiltX: 0.2, lean: 0.4, gap: 0 },
  dropped: { speed: 0, camY: -6, camZ: 7, tiltX: 0.2, lean: 0, gap: 0 },
};

export default function Beyblade({ status }) {

  const [speed, setSpeed] = useState(0.03);
  const [camY, setCamY] = useState(0);
  const [camZ, setCamZ] = useState(9);
  const [tiltX, setTiltX] = useState(0.2);
  const [lean, setLean] = useState(0);
  const [gap, setGap] = useState(1.5);

  const containerRef = useRef(null);

  const animValues = useRef({
    speed: 0.03,
    camY: 0,
    camZ: 7,
    tiltX: 0.2,
    lean: 0,
    gap: 1.5,
    dropProgress: 0,
  });

  const isManualMode = useRef(false);

  useEffect(() => {
    if (STATUS_TARGETS[status]) {
      const target = STATUS_TARGETS[status];
      setSpeed(target.speed);
      setCamY(target.camY);
      setCamZ(target.camZ);
      setTiltX(target.tiltX);
      setLean(target.lean);
      setGap(target.gap);
      if (status === 'dropped') animValues.current.dropProgress = 0;
      isManualMode.current = false;
    }
  }, [status]);

  const targetsRef = useRef({ speed, camY, camZ, tiltX, lean, gap });
  useEffect(() => {
    targetsRef.current = { speed, camY, camZ, tiltX, lean, gap };
  }, [speed, camY, camZ, tiltX, lean, gap]);

  useEffect(() => {
    const container = containerRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    container.appendChild(renderer.domElement);

    const beyblade = new THREE.Group();
    const pivot = new THREE.Group();
    scene.add(pivot);
    pivot.add(beyblade);

    const groupTop = new THREE.Group();
    const groupRatchet = new THREE.Group();
    const groupBit = new THREE.Group();

    beyblade.add(groupTop);
    beyblade.add(groupRatchet);
    beyblade.add(groupBit);

    const solidMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const coloredMaterial = (color) =>
      new THREE.MeshBasicMaterial({
        color: status === 'disconnected' ? 0x808080 : color,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      });
    const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });

    function createPart(parentGroup, geometry, yPosition, material = solidMaterial) {
      const mesh = new THREE.Mesh(geometry, material);
      const edges = new THREE.EdgesGeometry(geometry);
      const outline = new THREE.LineSegments(edges, outlineMaterial);
      mesh.add(outline);
      mesh.position.y = yPosition;
      parentGroup.add(mesh);
      return mesh;
    }

    function addTopDisc(parentMesh, radius, color) {
      const halfHeight = parentMesh.geometry.parameters.height / 2;
      const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 32), coloredMaterial(color));
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = halfHeight + 0.001;
      disc.add(new THREE.LineSegments(new THREE.EdgesGeometry(disc.geometry), outlineMaterial));
      parentMesh.add(disc);
      return disc;
    }

    // 1. Lock Chip & Blade (Top Group)
    createPart(groupTop, new THREE.CylinderGeometry(0.4, 0.4, 0.15, 16), 1.35, coloredMaterial(0x124e78));
    const blade = createPart(groupTop, new THREE.CylinderGeometry(1.6, 1.8, 0.4, 8), 1.075, coloredMaterial(0xa7c7e7));
    addTopDisc(blade, 1.2, 0xc9764c);

    // Flared piece: y = 0.7 so its top face (0.7 + 0.35/2 = 0.875) meets the blade's bottom face (1.075 - 0.4/2 = 0.875)
    createPart(groupTop, new THREE.CylinderGeometry(1.8, 1.6, 0.35, 8), 0.7, coloredMaterial(0x6f8faf));

    // 2. Ratchet (Middle Group) - Base Y is 0.1
    createPart(groupRatchet, new THREE.CylinderGeometry(1.4, 1.4, 0.45, 12), 0.1, coloredMaterial(0x8080ff));

    // 3. Bit (Bottom Group) - Base Y starts at -0.325
    createPart(groupBit, new THREE.CylinderGeometry(0.5, 0.5, 0.25, 16), -0.25, coloredMaterial(0x9fe2bf));
    createPart(groupBit, new THREE.CylinderGeometry(0.4, 0.32, 0.5, 16), -0.625, coloredMaterial(0x9fe2bf));
    createPart(groupBit, new THREE.CylinderGeometry(0.25, 0.01, 0.35, 16), -1.05, coloredMaterial(0x9fe2bf));

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    });
    resizeObserver.observe(container);

    let frameId;
    let clock = new THREE.Clock();

    function animate() {
      frameId = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const lerpFactor = THREE.MathUtils.clamp(delta * 5, 0, 1); // Framerate-independent smoothing
      const targets = targetsRef.current;
      const current = animValues.current;

      if (isManualMode.current) {
        // Direct assignment when interacting with UI sliders
        Object.assign(current, targets);
      } else {
        // Smooth transition towards targets
        current.speed = THREE.MathUtils.lerp(current.speed, targets.speed, lerpFactor);
        current.camY = THREE.MathUtils.lerp(current.camY, targets.camY, lerpFactor);
        current.camZ = THREE.MathUtils.lerp(current.camZ, targets.camZ, lerpFactor);
        current.tiltX = THREE.MathUtils.lerp(current.tiltX, targets.tiltX, lerpFactor);
        current.gap = THREE.MathUtils.lerp(current.gap, targets.gap, lerpFactor);

        // Handle lean dynamics for status animations
        if (status === 'dropped') {
          current.dropProgress += delta * 18;
          const totalDuration = Math.PI * 4;
          if (current.dropProgress < totalDuration) {
            const amplitude = 0.5 * (1 - current.dropProgress / totalDuration);
            current.lean = -Math.sin(current.dropProgress) * amplitude;
          } else {
            current.lean = THREE.MathUtils.lerp(current.lean, 0, lerpFactor);
          }
        } else {
          current.lean = THREE.MathUtils.lerp(current.lean, targets.lean, lerpFactor);
        }
      }

      // Apply animated parameters to Three.js scene
      camera.position.y = current.camY;
      camera.position.z = current.camZ;
      camera.lookAt(0, -0.5, 0);

      const TIP_Y = -1.025 - current.gap * 2;
      pivot.position.y = TIP_Y;
      beyblade.position.y = -TIP_Y;

      pivot.rotation.z = current.lean;
      beyblade.rotation.x = current.tiltX;
      beyblade.rotation.y -= current.speed;

      const FLUSH_OFFSET = 0.2;
      groupRatchet.position.y = FLUSH_OFFSET - current.gap;
      groupBit.position.y = FLUSH_OFFSET - current.gap * 2;

      renderer.render(scene, camera);
    }

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [status]);

  const handleSliderChange = (setter, value) => {
    isManualMode.current = true;
    setter(value);
  };

  const renderControls = () => (
    <div className="beyblade-controls">
      <div className="control-group">
        <label>Speed:</label>
        <input
          value={speed}
          onChange={(e) => handleSliderChange(setSpeed, parseFloat(e.target.value))}
          type="range"
          min="0"
          max="0.3"
          step="0.005"
        />
      </div>
      <div className="control-group">
        <label>View (Cam Y):</label>
        <input
          value={camY}
          onChange={(e) => handleSliderChange(setCamY, parseFloat(e.target.value))}
          type="range"
          min="-10"
          max="10"
          step="0.5"
        />
      </div>
      <div className="control-group">
        <label>Zoom (Cam Z):</label>
        <input
          value={camZ}
          onChange={(e) => handleSliderChange(setCamZ, parseFloat(e.target.value))}
          type="range"
          min="5"
          max="20"
          step="0.5"
        />
      </div>
      <div className="control-group">
        <label>Tilt (X-Axis):</label>
        <input
          value={tiltX}
          onChange={(e) => handleSliderChange(setTiltX, parseFloat(e.target.value))}
          type="range"
          min="-1.0"
          max="1.5"
          step="0.1"
        />
      </div>
      <div className="control-group">
        <label>Lean (left):</label>
        <input
          value={lean}
          onChange={(e) => handleSliderChange(setLean, parseFloat(e.target.value))}
          type="range"
          min="-0.6"
          max="0.6"
          step="0.02"
        />
      </div>
      <div className="control-group">
        <label>Spacing Gap:</label>
        <input
          value={gap}
          onChange={(e) => handleSliderChange(setGap, parseFloat(e.target.value))}
          type="range"
          min="0"
          max="1.5"
          step="0.1"
        />
      </div>
    </div>
  );

  return (
    <div className="beyblade-viewer">
      {/* {renderControls()} */}
      <div className="beyblade-canvas-container" ref={containerRef} />
    </div>
  );
}
