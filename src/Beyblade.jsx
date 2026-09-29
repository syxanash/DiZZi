import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import './Beyblade.css';

const STATUS_TARGETS = {
  idle: { speed: 0.03, camY: 0.5, camZ: 5.5, tiltX: 0.2, lean: 0, gap: 1.5, lookY: -0.5 },
  disconnected: { speed: 0, camY: 0.5, camZ: 5.5, tiltX: 0.2, lean: 0, gap: 1.5, lookY: -0.5 },
  attached: { speed: 0, camY: 0.5, camZ: 5.5, tiltX: 0.2, lean: 0, gap: 0, lookY: 0.2 },
  spin_fast: { speed: 0.3, camY: -2, camZ: 5.5, tiltX: 0.3, lean: 0.6, gap: 0, lookY: 0.0 },
  spin_slow: { speed: 0.09, camY: 0.7, camZ: 5.5, tiltX: 0.2, lean: 0.4, gap: 0, lookY: 0.2 },
  dropped: { speed: 0, camY: -6, camZ: 5.5, tiltX: 0.2, lean: 0, gap: 0, lookY: -0.5 },
};

// Spacing multipliers applied to `gap`
const RATCHET_GAP_SCALE = 0.67; // blade -> ratchet
const BIT_GAP_SCALE = 1; // ratchet -> bit

export default function Beyblade({ status }) {

  const [speed, setSpeed] = useState(0.03);
  const [camY, setCamY] = useState(0);
  const [camZ, setCamZ] = useState(9);
  const [tiltX, setTiltX] = useState(0.2);
  const [lean, setLean] = useState(0);
  const [gap, setGap] = useState(1.5);
  const [lookY, setLookY] = useState(-0.5);

  const containerRef = useRef(null);

  const animValues = useRef({
    speed: 0.03,
    camY: 0,
    camZ: 5.5,
    tiltX: 0.2,
    lean: 0,
    gap: 1.5,
    lookY: -0.5,
    dropProgress: 0,
  });

  const isManualMode = useRef(false);
  const coloredMaterials = useRef([]);
  const statusRef = useRef(status);

  useEffect(() => {
    if (STATUS_TARGETS[status]) {
      const target = STATUS_TARGETS[status];
      setSpeed(target.speed);
      setCamY(target.camY);
      setCamZ(target.camZ);
      setTiltX(target.tiltX);
      setLean(target.lean);
      setGap(target.gap);
      setLookY(target.lookY);
      if (status === 'dropped') animValues.current.dropProgress = 0;
      isManualMode.current = false;
    }
  }, [status]);

  const targetsRef = useRef({ speed, camY, camZ, tiltX, lean, gap, lookY });
  useEffect(() => {
    targetsRef.current = { speed, camY, camZ, tiltX, lean, gap, lookY };
  }, [speed, camY, camZ, tiltX, lean, gap, lookY]);

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

    coloredMaterials.current = [];

    const solidMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const coloredMaterial = (color) => {
      const material = new THREE.MeshBasicMaterial({
        color,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      });
      coloredMaterials.current.push({ material, baseColor: color });
      return material;
    };
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

    createPart(groupTop, new THREE.CylinderGeometry(1.8, 1.6, 0.35, 8), 0.7, coloredMaterial(0x6f8faf));

    // 2. Ratchet (Middle Group)
    // Polygon path whose vertices match CylinderGeometry's radialSegments after rotateX(-PI/2)
    function polyPath(radius, sides, path) {
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2;
        const x = Math.sin(a) * radius;
        const y = -Math.cos(a) * radius;
        if (i === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      }
      path.closePath();
    }

    const ratchetShape = new THREE.Shape();
    polyPath(1.4, 15, ratchetShape);
    const bitHole = new THREE.Path();
    polyPath(0.5, 6, bitHole);
    ratchetShape.holes.push(bitHole);

    const ratchetGeo = new THREE.ExtrudeGeometry(ratchetShape, { depth: 0.35, bevelEnabled: false });
    ratchetGeo.rotateX(-Math.PI / 2); // extrude axis z -> y
    ratchetGeo.translate(0, -0.175, 0); // center vertically like CylinderGeometry
    createPart(groupRatchet, ratchetGeo, 0.1, coloredMaterial(0x8080ff));

    // 3. Bit (Bottom Group)
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
        current.lookY = THREE.MathUtils.lerp(current.lookY, targets.lookY, lerpFactor);

        // Handle lean dynamics for status animations
        if (statusRef.current === 'dropped') {
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
      camera.lookAt(0, current.lookY, 0);

      const ratchetDrop = current.gap * RATCHET_GAP_SCALE;
      const bitDrop = ratchetDrop + current.gap * BIT_GAP_SCALE;
      const TIP_Y = -1.025 - bitDrop;
      pivot.position.y = TIP_Y;
      beyblade.position.y = -TIP_Y;

      // Shift the pivot opposite to the lean so the bey's middle stays centered
      const CENTER_HEIGHT = 2; // distance from tip to bey's middle
      pivot.position.x = Math.sin(current.lean) * CENTER_HEIGHT;
      pivot.rotation.z = current.lean;
      beyblade.rotation.x = current.tiltX;
      beyblade.rotation.y -= current.speed;

      const RATCHET_OFFSET = 0.25;
      const BIT_OFFSET = 0.3;
      groupRatchet.position.y = RATCHET_OFFSET - ratchetDrop;
      groupBit.position.y = BIT_OFFSET - bitDrop;

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
  }, []);

  useEffect(() => {
    statusRef.current = status;
    const gray = status === 'disconnected';
    coloredMaterials.current.forEach(({ material, baseColor }) => {
      material.color.set(gray ? 0x808080 : baseColor);
    });
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
      <div className="control-group">
        <label>Aim (Look Y):</label>
        <input
          value={lookY}
          onChange={(e) => handleSliderChange(setLookY, parseFloat(e.target.value))}
          type="range"
          min="-3"
          max="3"
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
