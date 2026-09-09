import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import './Beyblade.css';

export default function Beyblade() {

  const [speed, setSpeed] = useState(0.03);
  const [camY, setCamY] = useState(0);
  const [camZ, setCamZ] = useState(9);
  const [tiltX, setTiltX] = useState(0.2);
  const [gap, setGap] = useState(0.3);

  const paramsRef = useRef({ speed, camY, camZ, tiltX, gap });

  useEffect(() => {
    paramsRef.current = { speed, camY, camZ, tiltX, gap };
  }, [speed, camY, camZ, tiltX, gap]);

  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const scene = new THREE.Scene();

    // Initialize camera with dummy aspect ratio (updated by ResizeObserver)
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    container.appendChild(renderer.domElement);

    // Main parent group
    const beyblade = new THREE.Group();
    scene.add(beyblade);

    // Sub-groups so we can space them out easily
    const groupTop = new THREE.Group();
    const groupRatchet = new THREE.Group();
    const groupBit = new THREE.Group();

    beyblade.add(groupTop);
    beyblade.add(groupRatchet);
    beyblade.add(groupBit);

    // Materials
    const solidMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const coloredMaterial = (color) =>
      new THREE.MeshBasicMaterial({
        color,
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

    // Adds a flat disc onto the top face of a part, as a child so it follows the part's transform
    function addTopDisc(parentMesh, radius, color) {
      const halfHeight = parentMesh.geometry.parameters.height / 2;
      const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 32), coloredMaterial(color));
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = halfHeight + 0.001; // just above the parent's top face, in local coords
      disc.add(new THREE.LineSegments(new THREE.EdgesGeometry(disc.geometry), outlineMaterial));
      parentMesh.add(disc);
      return disc;
    }

    // 1. Lock Chip & Blade (Top Group)
    createPart(groupTop, new THREE.CylinderGeometry(0.6, 0.6, 0.15, 16), 1.35, coloredMaterial(0x124e78));
    const blade = createPart(
      groupTop,
      new THREE.CylinderGeometry(2.2, 2.4, 0.4, 8),
      1.075,
      coloredMaterial(0xa7c7e7),
    );

    // White inset circle on the blade's top face (a bit bigger than the lock chip's 0.6 radius)
    addTopDisc(blade, 1.5, 0xc9764c);

    // Flared piece: y = 0.7 so its top face (0.7 + 0.35/2 = 0.875) meets the blade's bottom face (1.075 - 0.4/2 = 0.875)
    createPart(groupTop, new THREE.CylinderGeometry(2.4, 2.1, 0.35, 8), 0.7, coloredMaterial(0x6f8faf));

    // 2. Ratchet (Middle Group) - Base Y is 0.1
    createPart(groupRatchet, new THREE.CylinderGeometry(1.8, 1.8, 0.45, 12), 0.1, coloredMaterial(0xccccff));

    // 3. Bit (Bottom Group) - Base Y starts at -0.325
    createPart(groupBit, new THREE.CylinderGeometry(1.1, 1.1, 0.25, 16), -0.25, coloredMaterial(0x9fe2bf));
    createPart(groupBit, new THREE.CylinderGeometry(1.1, 0.35, 0.5, 16), -0.625, coloredMaterial(0x9fe2bf));
    createPart(groupBit, new THREE.CylinderGeometry(0.25, 0.1, 0.35, 16), -1.05);

    // Resize Observer makes it scale perfectly inside any div you drop it in
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        const height = entry.contentRect.height;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    });
    resizeObserver.observe(container);

    // Animation Loop
    let frameId;
    function animate() {
      frameId = requestAnimationFrame(animate);

      // Apply state values (kept live via paramsRef mirror)
      const { speed, camY, camZ, tiltX, gap } = paramsRef.current;

      camera.position.y = camY;
      camera.position.z = camZ;
      camera.lookAt(0, -0.5, 0);

      beyblade.rotation.x = tiltX;
      beyblade.rotation.y -= speed;

      // FLUSH_OFFSET makes the groups sit flush when gap = 0:
      // flared piece bottom (0.7 - 0.35/2 = 0.525) meets ratchet top (0.1 + 0.45/2 = 0.325)
      const FLUSH_OFFSET = 0.2;
      groupRatchet.position.y = FLUSH_OFFSET - gap;
      groupBit.position.y = FLUSH_OFFSET - gap * 2;

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

  useEffect(
    () => {
      const t = setTimeout(() => setSpeed(0.10), 3000);

      return () => {
        clearTimeout(t);
      };
    },
    []
  );

  return (
    <div className="beyblade-viewer">
      <div className="beyblade-controls">
        <div className="control-group">
          <label>Speed:</label>
          <input value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            type="range"
            min="0"
            max="0.3" step="0.005" defaultValue="0.03" />
        </div>
        <div className="control-group">
          <label>View (Cam Y):</label>
          <input value={camY}
            onChange={(e) => setCamY(parseFloat(e.target.value))}
            type="range"
            min="-10"
            max="10" step="0.5" defaultValue="0" />
        </div>
        <div className="control-group">
          <label>Zoom (Cam Z):</label>
          <input value={camZ}
            onChange={(e) => setCamZ(parseFloat(e.target.value))}
            type="range"
            min="5"
            max="20" step="0.5" defaultValue="9" />
        </div>
        <div className="control-group">
          <label>Tilt (X-Axis):</label>
          <input value={tiltX}
            onChange={(e) => setTiltX(parseFloat(e.target.value))}
            type="range"
            min="-1." max="1.5" step="0.1" defaultValue="0.2" />
        </div>
        <div className="control-group">
          <label>Spacing Gap:</label>
          <input value={gap}
            onChange={(e) => setGap(parseFloat(e.target.value))}
            type="range"
            min="0"
            max="1.5" step="0.1" defaultValue="0.3" />
        </div>
      </div>

      <div className="beyblade-canvas-container" ref={containerRef} />
    </div>
  );
}
