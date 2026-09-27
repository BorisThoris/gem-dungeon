import { canTraverseDungeonConnection } from "../dungeon-core/model";
import { cellKey } from "../dungeon-core/identity";
import { gridCellToWorld } from "../dungeon-core/spatial";
import type { Dungeon, DungeonRunState, GridCell } from "../dungeon-core/types";

export function roomLanding(dungeon: Dungeon, roomId: string) {
  const room = dungeon.rooms.find(room => room.id === roomId) ?? dungeon.rooms[0];
  const cells = room.footprint.cells;
  const cx = cells.reduce((sum, cell) => sum + cell.x, 0) / cells.length;
  const cz = cells.reduce((sum, cell) => sum + cell.z, 0) / cells.length;
  // A mathematical centroid can be in the empty middle of a U/C/H room.
  const cell = [...cells].sort((a,b) => ((a.x-cx)**2+(a.z-cz)**2)-((b.x-cx)**2+(b.z-cz)**2)
    || a.z-b.z || a.x-b.x)[0];
  return { cell, position: gridCellToWorld(cell, dungeon.config) };
}

export function expeditionGuide(dungeon: Dungeon, state: DungeonRunState) {
  const current = state.currentRoomId;
  const queue = [{roomId: current, path: [] as string[]}], seen = new Set([current]);
  let route = queue[0];
  for(let i=0;i<queue.length;i++) {
    const next=queue[i];
    if(next.roomId!==current && !state.visitedRoomIds.has(next.roomId)){route=next;break;}
    for(const connection of dungeon.connections) {
      if(connection.from.roomId!==next.roomId && connection.to.roomId!==next.roomId)continue;
      const target=connection.from.roomId===next.roomId?connection.to.roomId:connection.from.roomId;
      if(seen.has(target))continue;
      const available=canTraverseDungeonConnection(dungeon,state,connection.id,next.roomId);
      // Explicit-action doors remain interactable once their real keys/flags
      // are owned; the guide never bypasses a lock or a one-way connection.
      const afterOpen={...state,openedConnectionIds:new Set([...state.openedConnectionIds,connection.id])};
      if(!available && !canTraverseDungeonConnection(dungeon,afterOpen,connection.id,next.roomId))continue;
      seen.add(target);queue.push({roomId:target,path:[...next.path,connection.id]});
    }
  }
  const connection=dungeon.connections.find(c=>c.id===route.path[0]);
  const room=dungeon.rooms.find(r=>r.id===current)!;
  const landing=roomLanding(dungeon,current);
  const endpoint=connection?.from.roomId===current?connection.from:connection?.to;
  const socket=room.sockets.find(s=>s.id===endpoint?.socketId);
  const path: GridCell[]=[];
  if(socket) {
    const valid=new Set(room.footprint.cells.map(cellKey));
    const frontier=[landing.cell],parents=new Map<string,GridCell|null>([[cellKey(landing.cell),null]]);
    for(let i=0;i<frontier.length;i++) {
      const cell=frontier[i];if(cellKey(cell)===cellKey(socket.cell))break;
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const next={...cell,x:cell.x+dx,z:cell.z+dz},key=cellKey(next);
        if(valid.has(key)&&!parents.has(key)){parents.set(key,cell);frontier.push(next);}
      }
    }
    let cursor:GridCell|null=socket.cell;
    if(parents.has(cellKey(cursor)))while(cursor){path.unshift(cursor);cursor=parents.get(cellKey(cursor))??null;}
  }
  const points=path.map(cell=>gridCellToWorld(cell,dungeon.config));
  if(socket)points.push(gridCellToWorld(socket.exteriorCell,dungeon.config));
  if (socket && connection?.corridor) {
    const other=connection.from.roomId===current?connection.to:connection.from;
    const destination=dungeon.rooms.find(r=>r.id===other.roomId)?.sockets.find(s=>s.id===other.socketId)?.cell;
    if(destination){
      const valid=new Set([...connection.corridor.cells,destination].map(cellKey));
      const frontier=[socket.exteriorCell],parents=new Map<string,GridCell|null>([[cellKey(socket.exteriorCell),null]]);
      for(let i=0;i<frontier.length;i++){
        const cell=frontier[i];if(cellKey(cell)===cellKey(destination))break;
        for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
          const next={...cell,x:cell.x+dx,z:cell.z+dz},key=cellKey(next);
          if(valid.has(key)&&!parents.has(key)){parents.set(key,cell);frontier.push(next);}
        }
      }
      const corridor:GridCell[]=[];let cursor:GridCell|null=destination;
      if(parents.has(cellKey(cursor)))while(cursor){corridor.unshift(cursor);cursor=parents.get(cellKey(cursor))??null;}
      points.push(...corridor.slice(1).map(cell=>gridCellToWorld(cell,dungeon.config)));
    }
  }
  const aim=points[1]??points[0];
  const yaw=aim?Math.atan2(-(aim.x-landing.position.x),-(aim.z-landing.position.z)):0;
  return {connection,points,yaw,landing,targetRoomId:route.roomId,
    requiresAction:connection?!canTraverseDungeonConnection(dungeon,state,connection.id,current):false,
    complete:state.visitedRoomIds.has(dungeon.endRoomId)};
}
