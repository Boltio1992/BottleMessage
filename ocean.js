// Ocean Scene with Three.js
let scene, camera, renderer, ocean, bottles = [], controls;
let clickableBottles = false;
let bottleClickCallback = null;
let animationFrameId = null;

function initOceanScene(canvasId, messages, isClickable = false, onBottleClick = null) {
  // Clean up existing scene
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  bottles = [];
  
  clickableBottles = isClickable;
  bottleClickCallback = onBottleClick;
  
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  
  const container = canvas.parentElement;
  const width = container.clientWidth;
  const height = container.clientHeight;
  
  // Scene setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB);
  scene.fog = new THREE.Fog(0x87CEEB, 50, 200);
  
  // Camera
  camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
  camera.position.set(0, 30, 50);
  camera.lookAt(0, 0, 0);
  
  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  
  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(50, 50, 50);
  scene.add(directionalLight);
  
  // Ocean
  createOcean();
  
  // Bottles
  messages.forEach((message, index) => {
    if (!message.isRead || !isClickable) {
      createBottle(message, index);
    }
  });
  
  // Controls (only for teacher)
  if (isClickable && typeof THREE.OrbitControls !== 'undefined') {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.2;
    controls.minDistance = 20;
    controls.maxDistance = 100;
  }
  
  // Click handling
  if (isClickable) {
    canvas.addEventListener('click', onCanvasClick);
  }
  
  // Handle resize
  window.addEventListener('resize', () => onWindowResize(container));
  
  // Start animation
  animate();
}

function createOcean() {
  const geometry = new THREE.PlaneGeometry(200, 200, 64, 64);
  const material = new THREE.MeshStandardMaterial({
    color: 0x1E90FF,
    roughness: 0.3,
    metalness: 0.1,
    flatShading: false
  });
  
  ocean = new THREE.Mesh(geometry, material);
  ocean.rotation.x = -Math.PI / 2;
  ocean.receiveShadow = true;
  
  // Store original positions for wave animation
  ocean.geometry.userData = {
    originalPositions: ocean.geometry.attributes.position.array.slice()
  };
  
  scene.add(ocean);
}

function createBottle(message, index) {
  const group = new THREE.Group();
  
  // Bottle body (glass)
  const bodyGeometry = new THREE.CylinderGeometry(0.5, 0.6, 2, 8);
  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xCCFFFF,
    transparent: true,
    opacity: 0.6,
    roughness: 0.1,
    metalness: 0.1,
    transmission: 0.9,
    thickness: 0.5
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  group.add(body);
  
  // Cork
  const corkGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.4, 8);
  const corkColor = new THREE.Color(message.bottleColor || '#8B4513');
  const corkMaterial = new THREE.MeshStandardMaterial({
    color: corkColor,
    roughness: 0.8
  });
  const cork = new THREE.Mesh(corkGeometry, corkMaterial);
  cork.position.y = 1.2;
  group.add(cork);
  
  // Position
  const pos = message.bottlePosition;
  group.position.set(pos.x, pos.y + 1, pos.z);
  
  // Store message reference
  group.userData = {
    message,
    initialY: pos.y + 1,
    phaseOffset: Math.random() * Math.PI * 2
  };
  
  bottles.push(group);
  scene.add(group);
  
  return group;
}

function updateOceanBottles(messages) {
  // Add new bottles that don't exist yet
  messages.forEach((message, index) => {
    const exists = bottles.some(b => b.userData.message.id === message.id);
    if (!exists && (!message.isRead || !clickableBottles)) {
      createBottle(message, index);
    }
  });
}

function removeBottle(messageId) {
  const bottleIndex = bottles.findIndex(b => b.userData.message.id === messageId);
  if (bottleIndex !== -1) {
    const bottle = bottles[bottleIndex];
    
    // Animate removal (sink and fade)
    const startY = bottle.position.y;
    const duration = 1000;
    const startTime = Date.now();
    
    function animateRemoval() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      bottle.position.y = startY - progress * 5;
      bottle.traverse(child => {
        if (child.material) {
          child.material.opacity = 1 - progress;
          child.material.transparent = true;
        }
      });
      
      if (progress < 1) {
        requestAnimationFrame(animateRemoval);
      } else {
        scene.remove(bottle);
        bottles.splice(bottleIndex, 1);
      }
    }
    
    animateRemoval();
  }
}

function animate() {
  animationFrameId = requestAnimationFrame(animate);
  
  const time = Date.now() * 0.001;
  
  // Animate ocean waves
  if (ocean && ocean.geometry.userData.originalPositions) {
    const positions = ocean.geometry.attributes.position.array;
    const original = ocean.geometry.userData.originalPositions;
    
    for (let i = 0; i < positions.length; i += 3) {
      const x = original[i];
      const z = original[i + 2];
      
      // Create wave effect
      positions[i + 1] = original[i + 1] + 
        Math.sin(x * 0.1 + time) * 0.5 + 
        Math.cos(z * 0.1 + time * 1.3) * 0.3;
    }
    
    ocean.geometry.attributes.position.needsUpdate = true;
    ocean.geometry.computeVertexNormals();
  }
  
  // Animate bottles (bobbing)
  bottles.forEach(bottle => {
    const phase = bottle.userData.phaseOffset;
    bottle.position.y = bottle.userData.initialY + Math.sin(time * 2 + phase) * 0.3;
    bottle.rotation.z = Math.sin(time + phase) * 0.1;
  });
  
  // Update controls
  if (controls) {
    controls.update();
  }
  
  renderer.render(scene, camera);
}

function onWindowResize(container) {
  if (!camera || !renderer || !container) return;
  
  const width = container.clientWidth;
  const height = container.clientHeight;
  
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function onCanvasClick(event) {
  if (!clickableBottles || !bottleClickCallback) return;
  
  const canvas = event.target;
  const rect = canvas.getBoundingClientRect();
  
  // Calculate mouse position in normalized device coordinates
  const mouse = new THREE.Vector2();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  // Raycasting
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  
  // Check for intersections with bottles
  const bottleMeshes = [];
  bottles.forEach(bottle => {
    bottle.traverse(child => {
      if (child.isMesh) {
        child.userData.parentBottle = bottle;
        bottleMeshes.push(child);
      }
    });
  });
  
  const intersects = raycaster.intersectObjects(bottleMeshes);
  
  if (intersects.length > 0) {
    const bottle = intersects[0].object.userData.parentBottle;
    if (bottle && bottle.userData.message) {
      bottleClickCallback(bottle.userData.message);
    }
  }
}