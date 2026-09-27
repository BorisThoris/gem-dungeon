import React from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Environment } from "@react-three/drei";
import { useCameraController } from "../hooks/useCameraController";
import { useSaveSystem } from "../hooks/useSaveSystem";
import { Player } from "./Player";
import UnifiedRoomManager from "./UnifiedRoomManager";
import Minimap from "./Minimap";
import Cursor from "./Cursor";
import EventDrivenActionCards from "./EventDrivenActionCards";
import SharedNavigation from "./SharedNavigation";
import useGameStore from "../store/gameStore";
import useMapStore from "../store/mapStore";
import { domUIManager } from "../utils/domUIManager";
import { uiEvents, UI_EVENTS } from "../utils/uiEvents";
import { expeditionGuide } from "../utils/expeditionGuide";
import GameInitializer from "./GameInitializer";
import "./dungeon/expedition.css";

function ExpeditionScene({paused,showHand,spawnVersion}:{paused:boolean;showHand:boolean;spawnVersion:number}) {
  const dungeon=useMapStore(state=>state.currentDungeon);
  const spawn=React.useMemo(()=>{
    const run=useMapStore.getState().dungeonRunState;
    if(!dungeon||!run)return {position:[0,1.5,0] as [number,number,number],yaw:0};
    const guide=expeditionGuide(dungeon,run);const p=guide.landing.position;
    return {position:[p.x,p.y+1.5,p.z] as [number,number,number],yaw:guide.yaw};
    // A restored checkpoint can share the same dungeon object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[dungeon,spawnVersion]);
  useCameraController();
  return <>
    <Environment files="./night.hdr" ground={{scale:100}}/>
    <ambientLight intensity={.35}/>
    <directionalLight position={[-20,20,20]} intensity={.85}/>
    <Physics paused={paused} timeStep={1/60} gravity={[0,-9.81,0]}>
      <Player initialSpawnPosition={spawn.position} initialYaw={spawn.yaw} fallResetY={-20}
        key={`${dungeon?.replay.spatialHash}:${spawnVersion}`} showHand={showHand} paused={paused}/>
      <UnifiedRoomManager mode="canonical"/>
    </Physics>
  </>;
}

function StartScreenContent({restoreNotice}:{restoreNotice:string}) {
  const dungeon=useMapStore(state=>state.currentDungeon),run=useMapStore(state=>state.dungeonRunState);
  const error=useMapStore(state=>state.error);
  const [sheet,setSheet]=React.useState<"briefing"|"pause"|"workshop"|null>("briefing");
  const [mapVisible,setMapVisible]=React.useState(false),[details,setDetails]=React.useState(false),[showHand,setShowHand]=React.useState(false);
  const [notice,setNotice]=React.useState(restoreNotice),[spawnVersion,setSpawnVersion]=React.useState(0);
  const {saveGame,loadGame,hasSaveData}=useSaveSystem();
  const [saved,setSaved]=React.useState(()=>hasSaveData());
  const paused=sheet!==null;
  const pause=React.useCallback(()=>{document.exitPointerLock?.();window.dispatchEvent(new Event("game-pause"));setSheet("pause");},[]);
  const resume=React.useCallback(()=>{window.dispatchEvent(new Event("game-pause"));setSheet(null);},[]);
  const guide=React.useMemo(()=>dungeon&&run?expeditionGuide(dungeon,run):null,[dungeon,run]);
  const current=dungeon?.rooms.find(room=>room.id===run?.currentRoomId);
  const target=dungeon?.rooms.find(room=>room.id===guide?.targetRoomId);
  React.useEffect(()=>{
    document.body.classList.add("expedition-active");return()=>document.body.classList.remove("expedition-active");
  },[]);
  React.useEffect(()=>{
    if(!details)return;
    domUIManager.init();
    const consume=(event:Event)=>useGameStore.getState().useItem((event as CustomEvent).detail.id);
    window.addEventListener("itemUse",consume);
    uiEvents.emit(UI_EVENTS.INVENTORY_UPDATE,useGameStore.getState().inventory);
    return()=>{window.removeEventListener("itemUse",consume);domUIManager.destroy();};
  },[details]);
  React.useEffect(()=>{if(current)uiEvents.emit(UI_EVENTS.ROOM_CHANGE,current.archetype);},[current]);
  React.useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      if(event.repeat||(event.target instanceof HTMLElement&&event.target.closest("input,textarea,select,[contenteditable=true]")))return;
      if(["Escape","x","X"].includes(event.key)){event.preventDefault();if(sheet)resume();else pause();}
    };
    const hidden=()=>{if(document.hidden)pause();};
    window.addEventListener("keydown",key);window.addEventListener("blur",pause);document.addEventListener("visibilitychange",hidden);
    return()=>{window.removeEventListener("keydown",key);window.removeEventListener("blur",pause);document.removeEventListener("visibilitychange",hidden);};
  },[pause,resume,sheet]);
  const save=()=>{const ok=saveGame();setSaved(ok||saved);setNotice(ok?"Checkpoint saved — this chamber and all exploration progress.":"Could not save. Browser storage may be unavailable.");};
  const load=()=>{if(loadGame()){setSpawnVersion(v=>v+1);setNotice("Checkpoint restored. Continue from the saved chamber.");setSheet(null);}else setNotice("This checkpoint could not be restored. Your current expedition is unchanged.");};
  if(!dungeon||!run)return <div className="expedition-empty"><h1>Could not open the dungeon</h1><p>{error??"The world is unavailable."}</p><button onClick={()=>location.reload()}>Try again</button></div>;
  const roomName=(value:string)=>value.replaceAll("-"," ");
  return <main className={`expedition${mapVisible ? " expedition-map-open" : ""}`} data-paused={paused} aria-label="Gem Dungeon expedition">
    <Canvas shadows dpr={[1,1.5]} camera={{fov:75,position:[0,3,0]}} gl={{antialias:true,powerPreference:"high-performance"}}>
      <ExpeditionScene paused={paused} showHand={showHand} spawnVersion={spawnVersion}/>
    </Canvas>
    <div className="expedition-vignette"/>
    <header className="expedition-header"><div className="expedition-brand"><span>◇</span><div>GEM DUNGEON<small>EXPLORE / BUILD / PLAY</small></div></div>
      <div className="expedition-actions"><button onClick={()=>setMapVisible(v=>!v)}>Map <kbd>M</kbd></button><button onClick={()=>{pause();setSheet("workshop");}}>Workshop</button><button onClick={pause}>Pause <kbd>Esc</kbd></button></div>
    </header>
    <section className="expedition-objective" aria-label="Exploration objective"><p>EXPLORATION</p><h2>{guide?.complete?"Exit chamber reached.":"Explore the dungeon."}</h2>
      <span>{guide?.complete?"Keep exploring the undiscovered chambers, or save your journey.":guide?.requiresAction?"Follow the amber trail and click the sealed doorway.":`Follow the green markers toward ${target?.role==="end"?"the exit chamber":roomName(target?.archetype??"the next chamber")}.`}</span>
      <div><b data-testid="rooms-visited">{run.visitedRoomIds.size}</b> / {dungeon.rooms.length} chambers charted <i>·</i> {run.inventory.size} {run.inventory.size===1?"key":"keys"}</div>
    </section>
    <div className="expedition-location"><span>FLOOR {run.currentFloor+1}</span><strong>{roomName(current?.role==="start"?"Arrival chamber":current?.role==="end"?"Exit chamber":current?.archetype??"Passage")}</strong></div>
    <Minimap isVisible={mapVisible} onToggle={setMapVisible} showToggle={false}/>
    {!paused&&<><Cursor/><EventDrivenActionCards/></>}
    <footer className="expedition-controls"><span><kbd>WASD</kbd> Walk</span><span><kbd>Right mouse</kbd> Hold to look</span><span><kbd>Click</kbd> Interact with seals</span><span><kbd>Shift</kbd> Run</span></footer>
    {(notice||error)&&<div className="expedition-notice" role="status">{notice||error}<button onClick={()=>{setNotice("");useMapStore.setState({error:null});}} aria-label="Dismiss message">×</button></div>}
    {sheet&&<div className="expedition-sheet"><section aria-labelledby="expedition-title">
      <p className="expedition-eyebrow">{sheet==="briefing"?"GEM DUNGEON":sheet==="workshop"?"CREATION TOOLS":"GAME PAUSED"}</p>
      <h1 id="expedition-title">{sheet==="briefing"?<>Explore. Build. Play.</>:sheet==="workshop"?<>Dungeon workshop</>:<>Game paused</>}</h1>
      <p className="expedition-intro">{sheet==="briefing"?"Explore connected rooms and find the exit chamber. Green floor markers lead toward unexplored rooms. Entering a key room collects its key; matching seals then open the way.":sheet==="workshop"?"Save your expedition before entering a creation tool. Build rooms, tune objects, paint materials, and test them in first person. Return here to continue from your saved chamber.":"Your world stays exactly where you left it. Save a checkpoint to return to this chamber after a reload or a visit to the workshop."}</p>
      {sheet==="workshop"?<SharedNavigation currentPage="game"/>:<><div className="expedition-brief-controls"><span><b>WASD</b> Walk through the doorway</span><span><b>HOLD RIGHT MOUSE</b> Look around freely</span><span><b>CLICK A SEAL</b> Use a collected rune</span></div><button className="expedition-primary" onClick={resume}>{sheet==="briefing"?"Begin exploring":"Continue exploring"}<span>→</span></button></>}
      <div className="expedition-secondary"><button onClick={save}>Save checkpoint</button>{saved&&<button onClick={load}>Load checkpoint</button>}{sheet!=="briefing"&&<button onClick={resume}>Return to expedition</button>}</div>
      {sheet!=="briefing"&&<div className="expedition-options"><label><input type="checkbox" checked={showHand} onChange={e=>setShowHand(e.target.checked)}/> Interaction hand</label><label><input type="checkbox" checked={details} onChange={e=>setDetails(e.target.checked)}/> Character details</label><span>Seed {dungeon.replay.seed}</span></div>}
      <small className="expedition-footnote">Desktop exploration · progress saves on this device · {dungeon.rooms.length} connected chambers</small>
    </section></div>}
  </main>;
}

export default function StartScreen() {
  const {loadGame}=useSaveSystem();const [prepared,setPrepared]=React.useState(false);const [notice,setNotice]=React.useState("");
  React.useEffect(()=>{
    if(new URLSearchParams(location.search).get("resume")==="true")setNotice(loadGame()?"Saved expedition restored at its last chamber.":"No compatible checkpoint was found. A fresh expedition is ready.");
    setPrepared(true);
  },[loadGame]);
  return prepared?<GameInitializer><StartScreenContent restoreNotice={notice}/></GameInitializer>:<div className="expedition-empty">Opening your expedition…</div>;
}
