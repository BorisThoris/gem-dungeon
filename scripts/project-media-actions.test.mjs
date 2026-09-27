import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runActions} from './project-media-lib.mjs';
function stub(width=1000, fail=false){
 const calls=[];
 return {calls,page:{viewportSize:()=>({width,height:500}),evaluate:async()=>{},waitForTimeout:async ms=>calls.push(['wait',ms]),mouse:{move:async(x,y,options)=>{calls.push(['move',x,y,options]);if(fail&&options)throw Error('lost surface');},down:async options=>calls.push(['down',options]),up:async options=>calls.push(['up',options])}}};
}
test('legacy drag still uses left mouse and viewport coordinates',async()=>{
 const {page,calls}=stub();await runActions(page,[{type:'drag',from:[.2,.3],to:[.7,.5],steps:8}]);
 assert.deepEqual(calls,[['move',200,150,undefined],['down',{button:'left'}],['move',700,250,{steps:8}],['up',{button:'left'}]]);
});
test('right mouse pixel turn has the same delta at every viewport size',async()=>{
 for(const width of [430,1280,1600]){const {page,calls}=stub(width);await runActions(page,[{type:'drag',button:'right',from:[.5,.5],deltaPixels:[-1571,0],lockWaitMs:100,steps:1}]);
 const moves=calls.filter(c=>c[0]==='move');assert.equal(moves[1][1]-moves[0][1],-1571);assert.deepEqual(calls[2],['down',{button:'right'}]);assert.deepEqual(calls[3],['wait',100]);assert.deepEqual(calls.at(-2),['up',{button:'right'}]);}
});
test('a failed move always releases the held mouse button',async()=>{
 const {page,calls}=stub(1000,true);await assert.rejects(runActions(page,[{type:'drag',button:'right'}]),/lost surface/);assert.deepEqual(calls.at(-2),['up',{button:'right'}]);
});
test('held movement stops when real UI progress appears',async()=>{
 const calls=[];
 const page={viewportSize:()=>({width:430,height:932}),keyboard:{down:async key=>calls.push(['down',key]),up:async key=>calls.push(['up',key])},locator:()=>({first:()=>({waitFor:async options=>calls.push(['visible',options.timeout])})})};
 await runActions(page,[{type:'key',key:'w',until:{selector:'[data-testid="rooms-visited"]'},timeoutMs:5000}]);
 assert.deepEqual(calls,[['down','w'],['visible',5000],['up','w']]);
});
test('an unmet movement goal releases the key and fails strictly',async()=>{
 const calls=[];
 const page={viewportSize:()=>({width:430,height:932}),keyboard:{down:async key=>calls.push(['down',key]),up:async key=>calls.push(['up',key])},locator:()=>({first:()=>({waitFor:async()=>{throw Error('not reached')}})})};
 await assert.rejects(runActions(page,[{type:'key',key:'w',until:{selector:'.goal'}}]),/not reached/);assert.deepEqual(calls.at(-1),['up','w']);
});
