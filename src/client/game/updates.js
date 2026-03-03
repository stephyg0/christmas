import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import {
  EDGE_THRESHOLD,
  EDGE_PAN_SPEED,
  EDGE_TILT_SPEED,
  HIGHLIGHT_UPDATE_INTERVAL,
  PICKUP_UPDATE_INTERVAL,
  COLLECTIBLE_UPDATE_INTERVAL,
  HOUSE_GLOW_INTERVAL,
} from '../constants/game.js';
import { playFootstepSound } from '../audio/audio.js';
import { sendAvatarUpdate, updateAvatarWalkPose } from './avatar.js';
import {
  updateLightStrand,
  updateThrowCharge,
  updateThrowEffects,
  updateDropProjectiles,
  updateBulbPickups,
  updateSparkEffects,
  updateStringSegments,
} from './strand.js';
import { updateHouseGlow, sampleTerrainHeight } from './world.js';

export function startAnimationLoop(context) {
  function frame() {
    requestAnimationFrame(frame);
    const delta = context.clock.getDelta();
    context.elapsedTime += delta;
    updateSnow(context, delta);
    updateChimneySmoke(context, delta, context.elapsedTime);
    updateStringSegments(context, delta);
    animateAvatarWalks(context, delta);
    const worldActive =
      context.uiState.storyComplete && Boolean(context.localState.sessionCode);
    if (!worldActive) {
      context.renderer.render(context.scene, context.camera);
      return;
    }
    updatePlayer(context, delta, context.elapsedTime);
    animateAvatarWalks(context, delta);
    updateLightStrand(context, delta, context.elapsedTime);
    updateThrowCharge(context);
    updateThrowEffects(context, delta);
    updateDropProjectiles(context);
    updateSparkEffects(context, delta);

    context.highlightAccumulator += delta;
    if (context.highlightAccumulator >= HIGHLIGHT_UPDATE_INTERVAL) {
      updateDecorZoneHighlights(context, context.highlightAccumulator);
      context.highlightAccumulator = 0;
    }

    context.collectibleAccumulator += delta;
    if (context.collectibleAccumulator >= COLLECTIBLE_UPDATE_INTERVAL) {
      updateCollectibles(context, context.collectibleAccumulator, context.elapsedTime);
      context.collectibleAccumulator = 0;
    }

    context.pickupAccumulator += delta;
    if (context.pickupAccumulator >= PICKUP_UPDATE_INTERVAL) {
      updateBulbPickups(context, context.pickupAccumulator, context.elapsedTime);
      context.pickupAccumulator = 0;
    }

    context.houseGlowAccumulator += delta;
    if (context.houseGlowAccumulator >= HOUSE_GLOW_INTERVAL) {
      updateHouseGlow(context, context.houseGlowAccumulator);
      context.houseGlowAccumulator = 0;
    }

    updateFootprints(context, delta);
    context.renderer.render(context.scene, context.camera);
  }

  frame();
}

export function updatePlayer(context, delta, elapsed) {
  const {
    dragState,
    pointerState,
    cameraBase,
    cameraOrbit,
    movementState,
    zoomState,
    inputState,
    localPlayer,
    jumpState,
    cameraTarget,
    camera,
  } = context;

  if (!dragState.active && !context.autoFollowPaused) {
    const yawEdgeDirection =
      pointerState.x < EDGE_THRESHOLD ? 1 : pointerState.x > 1 - EDGE_THRESHOLD ? -1 : 0;
    const pitchEdgeDirection =
      pointerState.y < EDGE_THRESHOLD ? -1 : pointerState.y > 1 - EDGE_THRESHOLD ? 1 : 0;
    if (yawEdgeDirection !== 0) {
      cameraBase.yaw += yawEdgeDirection * EDGE_PAN_SPEED * delta;
    }
    if (pitchEdgeDirection !== 0) {
      cameraBase.pitch = THREE.MathUtils.clamp(
        cameraBase.pitch + pitchEdgeDirection * EDGE_TILT_SPEED * delta,
        0.15,
        1.1,
      );
    }
    const pointerYawOffset = (0.5 - pointerState.x) * 1.6;
    const pointerPitchOffset = (pointerState.y - 0.5) * 0.7;
    const yawTarget = cameraBase.yaw + pointerYawOffset;
    const pitchTarget = THREE.MathUtils.clamp(
      cameraBase.pitch + pointerPitchOffset,
      0.15,
      1.1,
    );
    cameraOrbit.yaw = THREE.MathUtils.lerp(cameraOrbit.yaw, yawTarget, 0.45);
    cameraOrbit.pitch = THREE.MathUtils.lerp(cameraOrbit.pitch, pitchTarget, 0.45);
  }

  if (movementState.boostTimer > 0) {
    movementState.boostTimer = Math.max(0, movementState.boostTimer - delta);
    if (movementState.boostTimer <= 0) {
      zoomState.target = 0;
    }
  }
  zoomState.offset = THREE.MathUtils.lerp(zoomState.offset, zoomState.target, 0.4);

  const forwardInput = (inputState.forward ? 1 : 0) - (inputState.backward ? 1 : 0);
  const strafeInput = (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0);
  const forwardDir = new THREE.Vector3(
    -Math.sin(cameraOrbit.yaw),
    0,
    -Math.cos(cameraOrbit.yaw),
  ).normalize();
  const rightDir = new THREE.Vector3()
    .crossVectors(forwardDir, new THREE.Vector3(0, 1, 0))
    .normalize();

  const moveVector = new THREE.Vector3();
  if (forwardInput !== 0) moveVector.add(forwardDir.clone().multiplyScalar(forwardInput));
  if (strafeInput !== 0) moveVector.add(rightDir.clone().multiplyScalar(strafeInput));

  const speedMultiplier = movementState.boostTimer > 0 ? movementState.boostMultiplier : 1;
  const moveSpeed = movementState.baseSpeed * speedMultiplier;
  const rinkArea = context.rinkArea;
  const onRink =
    rinkArea &&
    rinkArea.radius > 0 &&
    localPlayer.group.position.distanceTo(rinkArea.center) <= rinkArea.radius + 0.4;
  const iceVelocity = movementState.slideVelocity;
  const playerRadius = 0.8;

  function blocked(nextPosition) {
    const colliders = context.treeColliders || [];
    for (let i = 0; i < colliders.length; i += 1) {
      const collider = colliders[i];
      const dx = nextPosition.x - collider.position.x;
      const dz = nextPosition.z - collider.position.z;
      const combined = playerRadius + (collider.radius || 1.5);
      if (dx * dx + dz * dz < combined * combined) {
        return true;
      }
    }
    return false;
  }

  if (onRink) {
    const hasInput = moveVector.lengthSq() > 0;
    if (hasInput) {
      const accelDir = moveVector.clone().normalize();
      iceVelocity.addScaledVector(accelDir, moveSpeed * 1.8 * delta);
    }
    iceVelocity.multiplyScalar(0.985);
    const iceStep = iceVelocity.clone().multiplyScalar(delta);
    const nextPos = localPlayer.group.position.clone().add(iceStep);
    if (!blocked(nextPos)) {
      localPlayer.group.position.copy(nextPos);
    } else {
      iceVelocity.set(0, 0, 0);
    }
    const sliding = iceVelocity.lengthSq() > 0.002;
    context.playerIsMoving = sliding;
    if (sliding) {
      const angle = Math.atan2(iceVelocity.x, iceVelocity.z);
      localPlayer.group.rotation.y = angle;
      const nowSync = performance.now();
      if (!context.lastAvatarSync || nowSync - context.lastAvatarSync > 180) {
        sendAvatarUpdate(context);
        context.lastAvatarSync = nowSync;
      }
    }
    // Soften footstep effects on ice.
    context.footstepCooldown = Math.max(0, context.footstepCooldown - delta * 0.5);
  } else {
    if (iceVelocity.lengthSq() > 0) {
      iceVelocity.set(0, 0, 0);
    }
    const isMoving = moveVector.lengthSq() > 0;
    context.playerIsMoving = isMoving;
    if (isMoving) {
      const facing = moveVector.clone().normalize();
      const step = facing.multiplyScalar(delta * moveSpeed);
      const nextPos = localPlayer.group.position.clone().add(step);
      if (!blocked(nextPos)) {
        localPlayer.group.position.copy(nextPos);
      }
      const angle = Math.atan2(moveVector.x, moveVector.z);
      localPlayer.group.rotation.y = angle;
      const nowSync = performance.now();
      if (!context.lastAvatarSync || nowSync - context.lastAvatarSync > 180) {
        sendAvatarUpdate(context);
        context.lastAvatarSync = nowSync;
      }
      context.footstepCooldown -= delta;
      if (jumpState.grounded && context.footstepCooldown <= 0) {
        context.footstepCooldown = 0.35;
        spawnFootprint(context, localPlayer.group.position, angle);
        playFootstepSound();
      }
    } else {
      context.footstepCooldown = Math.max(0, context.footstepCooldown - delta * 0.5);
    }
  }

  if (!jumpState.grounded) {
    jumpState.velocity -= 9.5 * delta;
    jumpState.offset += jumpState.velocity * delta;
    if (jumpState.offset <= 0) {
      jumpState.offset = 0;
      jumpState.velocity = 0;
      jumpState.grounded = true;
    }
  }

  const baseHeight = -0.35;
  const isMovingNow = context.playerIsMoving;
  const bob = isMovingNow ? Math.max(0, Math.sin(elapsed * 6) * 0.08) : 0;
  const targetBob = baseHeight + bob + jumpState.offset;
  const lerpFactor = jumpState.grounded ? (isMovingNow ? 0.35 : 0.2) : 1;
  localPlayer.group.position.y = THREE.MathUtils.lerp(
    localPlayer.group.position.y,
    targetBob,
    lerpFactor,
  );

  cameraTarget.lerp(localPlayer.group.position, 0.35);
  const offset = new THREE.Vector3(
    Math.sin(cameraOrbit.yaw) * Math.cos(cameraOrbit.pitch),
    Math.sin(cameraOrbit.pitch),
    Math.cos(cameraOrbit.yaw) * Math.cos(cameraOrbit.pitch),
  ).multiplyScalar(Math.max(6, cameraOrbit.distance + zoomState.offset));

  const desiredPosition = localPlayer.group.position.clone().add(offset);
  camera.position.lerp(desiredPosition, 0.35);
  camera.lookAt(cameraTarget);
}

export function updateChimneySmoke(context, delta, elapsed) {
  const entries = context.smokePuffs || [];
  if (!entries.length) return;
  const sway = elapsed * 0.6;
  entries.forEach((entry) => {
    entry.puffs.forEach((puff, idx) => {
      const rise = ((elapsed * 0.25 + puff.offset + idx * 0.2) % 3) + puff.baseY;
      const swayX = Math.sin(sway + puff.offset + idx) * 0.15;
      const swayZ = Math.cos(sway * 0.8 + puff.offset * 1.2) * 0.12;
      puff.mesh.position.x = swayX;
      puff.mesh.position.z = swayZ;
      puff.mesh.position.y = rise;
      const opacity = 0.25 + ((3 - (rise - puff.baseY)) / 3) * 0.2;
      if (puff.mesh.material) {
        puff.mesh.material.opacity = Math.max(0.1, Math.min(0.4, opacity));
      }
      puff.mesh.scale.setScalar(0.9 + (rise - puff.baseY) * 0.08);
    });
  });
}

function animateAvatarWalks(context, delta) {
  const { localPlayer, movementState, remotePlayers } = context;
  if (localPlayer) {
    updateAvatarWalkPose(
      localPlayer,
      {
        isMoving: context.playerIsMoving,
        speedFactor: movementState.boostTimer > 0 ? 1.2 : 1,
      },
      delta,
    );
  }
  remotePlayers.forEach((avatar) => {
    updateAvatarWalkPose(avatar, { isMoving: Boolean(avatar.isMoving) }, delta);
  });
}

export function updateSnow(context, delta) {
  const { snowSystem, localState } = context;
  if (!snowSystem) return;
  const { points } = snowSystem;
  const positions = points.geometry.attributes.position;
  for (let i = 0; i < positions.count; i += 1) {
    let y = positions.getY(i);
    y -= snowSystem.speeds[i] * delta * 25 * localState.snowMultiplier;
    if (y < 0) {
      y = Math.random() * 40 + 10;
    }
    positions.setY(i, y);
  }
  positions.needsUpdate = true;
}

export function updateDecorZoneHighlights(context, delta) {
  const { decorZones, localPlayer } = context;
  const playerPos = localPlayer.group.position;
  decorZones.forEach((zone) => {
    const distance = zone.anchor.distanceTo(playerPos);
    const targetGlow = distance < zone.activationRadius ? 0.6 : 0;
    zone.glow = THREE.MathUtils.lerp(zone.glow, targetGlow, delta * 5);
    const core = zone.mesh;
    const halo = core.userData?.halo;
    const shouldShow = zone.glow > 0.02 || targetGlow > 0;
    core.visible = shouldShow;
    if (!shouldShow) return;
    if (core.material) {
      core.material.emissiveIntensity = 0.18 + zone.glow * 1.0;
      core.material.opacity = zone.glow * 0.45;
    }
    if (halo?.material) {
      halo.material.opacity = 0.1 + zone.glow * 0.45;
      const haloScale = 0.9 + zone.glow * 0.6;
      halo.scale.set(haloScale, haloScale, haloScale);
    }
    core.scale.setScalar(0.95 + zone.glow * 0.15);
  });
}

export function updateCollectibles(context, delta, elapsed) {
  const { collectibles, localPlayer, scene } = context;
  collectibles.forEach((collectible) => {
    if (collectible.collected) return;
    collectible.mesh.rotation.y += delta * 0.8;
    collectible.mesh.position.y =
      collectible.baseY + Math.sin(elapsed * 2 + collectible.wobbleOffset) * 0.15;
    const distance = collectible.mesh.position.distanceTo(localPlayer.group.position);
    if (distance < 2.2) {
      collectible.collected = true;
      scene.remove(collectible.mesh);
      if (context.unlockDecorType) {
        context.unlockDecorType(collectible.type, collectible.label);
      }
    }
  });
}

function spawnFootprint(context, position, rotation) {
  // Footprints disabled.
  return;
}

export function updateFootprints(context, delta) {
  const { footprints, footstepGroup } = context;
  for (let i = footprints.length - 1; i >= 0; i -= 1) {
    const entry = footprints[i];
    entry.life -= delta;
    entry.mesh.material.opacity = Math.max(0, entry.life / 4);
    if (entry.life <= 0) {
      footstepGroup.remove(entry.mesh);
      footprints.splice(i, 1);
    }
  }
}
