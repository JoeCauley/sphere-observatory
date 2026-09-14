// Sequential decoding avoids stale browser seek/canvas frames.
const {spawnSync}=require('node:child_process'),path=require('node:path');
const source=process.env.SPHERE_MOTION_VIDEO||'/work/screenshots/watershed-continuity/after/ascent-descent.webm',file=path.resolve(source.replace(/^\/+/ ,'')),label=source.includes('watershed-continuity')?'saved-motion':'verified-motion';
const result=spawnSync(process.env.SPHERE_PYTHON||'python',[path.resolve('tools/review-continuity-motion.py'),file,path.resolve('work/screenshots/continuity-03'),label],{stdio:'inherit'});process.exitCode=result.status??1;
