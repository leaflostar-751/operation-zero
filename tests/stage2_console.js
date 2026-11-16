// Operation Zero - Stage 2 console test. Run the game (npm run dev), open DevTools console, paste this file.
// With REAL Rapier this is the "real Rapier collision test" for zombie wall-blocking, melee LOS, cleanup, respawn.
// Everything is reported as plain JSON; nothing is hidden. Expected values are in STAGE2_REPORT.md.
(async () => {
  const a = window.__opzero, H = a.hero, Z = a.zombies, C = a.combat, P = a.physics, out = {};
  const clean = () => { Z.zombies.forEach(z => { z.state = 'dead'; z.remove = true; }); Z.updateFrame(0.016); Z.update(1/60); Z.civilians.length = 0; };
  H.health = H.maxHealth; clean();
  // T1 spawn far from origin
  H.teleportTo(-300,0.2,0,0); Z.spawnWave(3,12,0);
  out.T1_farSpawnDist=Z.zombies.map(z=>+Math.hypot(z.pos.x-H.position.x,z.pos.z-H.position.z).toFixed(1));
  clean();
  // T2 corpse leak
  H.teleportTo(20,0.2,0,0);
  const c0=P.world.colliders.length, t0=C.targetList.length;
  for(let i=0;i<8;i++) Z.spawnZombie(20+i*1.5,10,{seed:i});
  const cSpawn=P.world.colliders.length, tSpawn=C.targetList.length;
  Z.zombies.forEach(z=>z.onHit(999,{x:0,y:0,z:1},{x:z.pos.x,y:1.7,z:z.pos.z},'bullet'));
  Z.zombies.forEach(z=>{z.deadT=14;}); Z.updateFrame(0.016); Z.update(1/60); Z.update(1/60);
  out.T2_leak={zombiesLeft:Z.zombies.length,collidersDelta:P.world.colliders.length-c0,targetListDelta:C.targetList.length-t0,targetsMapSize:C.targets.size,spawnColliders:cSpawn-c0,spawnTargets:tSpawn-t0,kills:Z.kills};
  // T3 melee on corpse
  clean(); const zc=Z.spawnZombie(20,1.2,{seed:3}); zc.onHit(999,{x:0,y:0,z:1},{x:20,y:1.7,z:1.2},'bullet');
  H.teleportTo(20,0.2,0,0); H.yaw=0; C.hitMarkerTimer=0; C.meleeStrike({type:'punch'});
  out.T3_meleeHitsCorpse=C.hitMarkerTimer>0; clean();
  // T4 wall penetration (stub rays vs cuboids = SIMULATED)
  H.teleportTo(20,0.2,-6,0);
  const wall=P.createFixedBox? P.createFixedBox(20,1.5,-1,12,1.5,0.25):null;
  const zw=Z.spawnZombie(20,6,{seed:5}); zw.noticed=true; zw.state='chase'; zw.speedMul=1.5;
  let minZ=99; for(let i=0;i<900;i++){ Z.update(1/60); P.world.step(); minZ=Math.min(minZ,zw.pos.z); }
  out.T4_wall={wallZ:-1,zombieMinZ:+minZ.toFixed(2),crossedWall:minZ<-1.3,hasWall:!!wall};
  clean(); if(wall) P.removeEntry(wall);
  // R1 building-spawn prevention: first-try ring points vs actual spawned positions, dense colony
  const city=a.world.city; let firstTryBlocked=0, spawnedBlocked=0, spawned=0;
  for(const [cx,cz] of [[-300,0],[-600,150],[-250,-120],[-560,60]]){
   for(let k=0;k<6;k++){ clean(); H.teleportTo(cx+k*3,0.2,cz+k*2,0); H.yaw=0;
     // naive ring (old behaviour) for comparison
     for(let i=0;i<5;i++){const ang=k+i*0.28; if(city.hitsBuilding(H.position.x+Math.sin(ang)*12,H.position.z+Math.cos(ang)*12)) firstTryBlocked++;}
     Z.spawnWave(5,12,0); Z.zombies.forEach(z=>{spawned++; if(city.hitsBuilding(z.pos.x,z.pos.z)) spawnedBlocked++;}); }}
  out.R1_buildingSpawn={naiveBlocked:firstTryBlocked,naiveTotal:120,spawned,spawnedInsideBuilding:spawnedBlocked};
  clean();
  // R2 respawn state reset
  H.teleportTo(20,0.2,0,0); C.equipped=true; C.ammo=3; C.reserve=50; C.reloadT=0.5; C.melee={type:'punch',t:0.1,dur:0.42,hand:0,hit:false};
  Z.hurtHero(999,null); const diedHp=H.health; for(let i=0;i<240;i++) Z.update(1/60);
  out.R2_respawn={diedHp,hpAfter:H.health,max:H.maxHealth,ammo:C.ammo,reserve:C.reserve,reloadT:C.reloadT,meleeNull:C.melee===null};
  // R3 melee line of sight
  clean(); H.teleportTo(20,0.2,0,0); H.yaw=0;
  const zt=Z.spawnZombie(20,1.5,{seed:2,hp:1000}); P.world.step();
  const strike=()=>{zt.hp=1000; C.hitMarkerTimer=0; C.meleeStrike({type:'punch'}); return zt.hp<1000;};
  const open=strike();
  const wall2=P.createFixedBox(20,1.5,0.9,3,1.5,0.15); const blocked=strike();
  P.removeEntry(wall2); const reopen=strike(); clean();
  out.R3_meleeLOS={noWall_hits:open,wall_hits:blocked,wallRemoved_hits:reopen};
  // R4 30 zombies (maxZombies raised for the test)
  Z.maxZombies=30; H.teleportTo(20,0.2,0,0); Z.spawnWave(30,10,0.2); const cnt30=Z.zombies.length; const tq0=performance.now(); for(let i=0;i<300;i++){Z.update(1/60);P.world.step();} const ms=(performance.now()-tq0)/300;
  const t1=performance.now(); for(let i=0;i<60;i++) Z.updateFrame(0.016); const poseMs=(performance.now()-t1)/60;
  out.R4_30zombies={spawned:cnt30,simMsPerStep:+ms.toFixed(2),poseMsPerFrame:+poseMs.toFixed(2)}; clean(); Z.maxZombies=14;
  console.log(JSON.stringify(out, null, 1)); return out;
})();
