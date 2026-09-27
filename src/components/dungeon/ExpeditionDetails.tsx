import React, { useMemo } from "react";
import type { Dungeon, DungeonRunState } from "../../dungeon-core/types";
import { expeditionGuide } from "../../utils/expeditionGuide";

export function ExpeditionTrail({dungeon,runState}:{dungeon:Dungeon;runState:DungeonRunState}) {
  const guide=useMemo(()=>expeditionGuide(dungeon,runState),[dungeon,runState]);
  return <group name="accessible-exploration-trail">{guide.points.slice(1).map((p,index)=><group key={`${p.x}:${p.z}`} position={[p.x,p.y+.022,p.z]}>
    <mesh rotation={[-Math.PI/2,0,Math.PI/4]}><planeGeometry args={[.28,.28]}/><meshBasicMaterial color={guide.requiresAction?"#e8b263":"#54d88b"} transparent opacity={.85}/></mesh>
    {index===guide.points.length-2&&<mesh rotation={[-Math.PI/2,0,0]} position={[0,.015,0]}><torusGeometry args={[.45,.035,6,24]}/><meshStandardMaterial color="#86dfd3" emissive="#54b9a4" emissiveIntensity={.8}/></mesh>}
  </group>)}</group>;
}
