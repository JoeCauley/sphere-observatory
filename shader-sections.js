/* Checked integration slots for classic-script shader sections. */
(function(root){
'use strict';const sections=new Map(),changes=[];
function section(name){return (source,slot,replacement,expected=1)=>{
 const count=typeof slot==='string'?source.split(slot).length-1:[...source.matchAll(new RegExp(slot.source,slot.flags.includes('g')?slot.flags:slot.flags+'g'))].length;
 if(count!==expected)throw Error('Shader section '+name+': expected '+expected+' integration slot(s), found '+count+' for '+String(slot).slice(0,100));
 changes.push({section:name,slot:String(slot).slice(0,100),count});return source.replace(slot,replacement);
};}
function register(name,source){if(sections.has(name))throw Error('Duplicate shader section: '+name);sections.set(name,source);return source;}
root.SphereShaderSections={section,register,get inventory(){return [...sections].map(([name,source])=>({name,characters:source.length}));},get changes(){return changes.slice();}};
})(typeof window==='undefined'?globalThis:window);
