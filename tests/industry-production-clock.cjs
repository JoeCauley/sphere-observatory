const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let earned=0,running;
const host={SphereProduction:{advance(s,playing){earned+=s;running=playing;}},
 SphereMath:{clamp:(n,a,b)=>Math.min(b,Math.max(a,n))},SphereInspection:{setTime:(s,t)=>s.time=t}};
vm.runInNewContext(fs.readFileSync(require.resolve('../simulation-timing.js'),'utf8'),host);
const state={time:0,playing:true,timeRate:1},tick=s=>host.SphereTiming.advance(state,s,()=>{});
tick(22.5);assert.equal(earned,22.5);
state.playing=false;state.time=30000;tick(125);assert.equal(earned,22.5);assert.equal(running,false);
state.playing=true;state.timeRate=2;tick(11.25);assert(Math.abs(earned-45)<.000001);
state.timeRate=-1;tick(4);assert(Math.abs(earned-45)<.000001);assert.equal(running,false);
state.time=1e9-.125;state.timeRate=1;tick(1);assert(Math.abs(earned-45.125)<.000001);
console.log('PASS production follows integrated host time across rate changes, pauses, sky edits, hitches and clock limits');
