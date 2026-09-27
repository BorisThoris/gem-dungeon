import { beforeAll, describe, expect, test } from "vitest";
import { generateDungeon } from "../../dungeon-core/generator";
import { createDungeonRunState, canTraverseDungeonConnection, enterDungeonRoom } from "../../dungeon-core/model";
import { createDungeonSpatialIndex, detectDungeonRoom, worldToGridCell } from "../../dungeon-core/spatial";
import { canonicalDungeonToGeometry } from "../../adapters/canonicalGeometryAdapter";
import { expeditionGuide, roomLanding } from "../expeditionGuide";
import type { Dungeon } from "../../dungeon-core/types";

describe("expedition landing and truthful guidance",()=>{
  let dungeon:Dungeon;
  beforeAll(()=>{const result=generateDungeon({seed:"expedition-entry"});if(!result.ok)throw new Error(result.error.message);dungeon=result.dungeon;},30000);
  test("every landing and visual anchor belongs to its exact room footprint",()=>{
    const index=createDungeonSpatialIndex(dungeon),geometry=canonicalDungeonToGeometry(dungeon);
    for(const room of dungeon.rooms)expect(detectDungeonRoom(dungeon,index,roomLanding(dungeon,room.id).position)).toBe(room.id);
    for(const anchor of geometry.assetAnchors)expect(detectDungeonRoom(dungeon,index,anchor.position)).toBe(anchor.roomId);
    expect(detectDungeonRoom(dungeon,index,geometry.spawn)).toBe(dungeon.startRoomId);
  });
  test("faces a walkable interior route toward a real accessible socket",()=>{
    const state=createDungeonRunState(dungeon),guide=expeditionGuide(dungeon,state);
    expect(guide.connection).toBeDefined();expect(Number.isFinite(guide.yaw)).toBe(true);expect(guide.points.length).toBeGreaterThan(1);
    const walkable=new Set(canonicalDungeonToGeometry(dungeon).floorTiles.map(t=>`${t.cell.x}:${t.cell.z}`));
    for(const p of guide.points){const cell=worldToGridCell(p,dungeon.config)!;expect(walkable.has(`${cell.x}:${cell.z}`)).toBe(true);}
    const opened={...state,openedConnectionIds:new Set([guide.connection!.id])};
    expect(canTraverseDungeonConnection(dungeon,opened,guide.connection!.id,state.currentRoomId)).toBe(true);
    for(let i=1;i<guide.points.length;i++)expect(Math.abs(guide.points[i].x-guide.points[i-1].x)+Math.abs(guide.points[i].z-guide.points[i-1].z)).toBe(dungeon.config.world.cellSize);
  });
  test("only reports the exit reached after the actual end room is entered",()=>{
    const state=createDungeonRunState(dungeon);expect(expeditionGuide(dungeon,state).complete).toBe(false);
    expect(expeditionGuide(dungeon,enterDungeonRoom(dungeon,state,dungeon.endRoomId)).complete).toBe(true);
  });
});
