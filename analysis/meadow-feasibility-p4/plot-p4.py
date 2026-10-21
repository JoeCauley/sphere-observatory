import json, pathlib, hashlib
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

out=pathlib.Path(r'C:\Users\Joe\Documents\Codex\2026-10-05\he\outputs\meadow-p4')
data=json.loads((out/'evidence.json').read_text(encoding='utf-8'))
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.facecolor':'#172420','figure.facecolor':'#101716','text.color':'#eef1e7','axes.labelcolor':'#cad6cd','xtick.color':'#cad6cd','ytick.color':'#cad6cd','axes.edgecolor':'#496057','grid.color':'#40554b'})
fig,axes=plt.subplots(3,2,figsize=(14,10),sharex=True,sharey=True)
max_ms=max([r['prepare']['max'] for r in data['quiet']]+[8]); upper=max(16,np.ceil(max_ms/4)*4)
for row,budget in enumerate([2,4,6]):
 for col,kind in enumerate(['walk','turn-elevation']):
  ax=axes[row,col];run=next((r for r in data['quiet'] if r['budgetMs']==budget and r['kind']==kind),None)
  ax.axhline(budget,color='#eebc73',linestyle='--',linewidth=1.1,label=f'{budget} ms declared budget')
  if not run:
   ax.text(.5,.5,'No completed quiet window\nSee retained warm-up failure',ha='center',va='center',transform=ax.transAxes,color='#eebc73');ax.set_title(f'{budget} ms · '+('walking' if kind=='walk' else 'turn / elevation'));continue
  samples=run['rows'];x=np.arange(len(samples));y=np.array([r['prepare'] for r in samples]);complete=np.array([r['complete'] for r in samples],dtype=bool)
  ax.plot(x,y,color='#9ed3b5',linewidth=.7,zorder=3);ax.scatter(x[y>budget],y[y>budget],color='#f29b82',s=8,zorder=4)
  ax.fill_between(x,-1.1,-.4,color='#9ed3b5',where=complete,step='mid');ax.fill_between(x,-1.1,-.4,color='#693c2e',where=~complete,step='mid')
  ax.set_title(f"{budget} ms · {'walking' if kind=='walk' else 'turn / elevation'} — {run['completeFrames']}/{run['frames']} complete",loc='left',fontsize=11,pad=12)
  ax.text(.98,.96,f"p95 {run['prepare']['p95']:.2f} ms  |  MAX {run['prepare']['max']:.2f} ms\n{run['drawnFps']:.2f} draws/s  |  {run['gpuMissing']} missing GPU samples",transform=ax.transAxes,ha='right',va='top',fontsize=9,bbox={'facecolor':'#172420','edgecolor':'#40554b','alpha':.92,'pad':5})
  ax.grid(axis='y',alpha=.35);ax.set_ylim(-1.5,upper+1);ax.set_xlim(0,899)
  if col==0:ax.set_ylabel('Complete preparation (ms)')
  if row==2:ax.set_xlabel('Moving draw (all 900 included)')
fig.suptitle('Meadow P4: a larger budget did not establish complete motion',x=.06,ha='left',fontsize=20,y=.97)
fig.text(.06,.922,'Quiet ordinary-app windows · exact native current-cell requirements · fixed 1920 × 1080 · no image/video encoding',fontsize=11,color='#b7c3b9')
fig.text(.06,.035,'Green strip: complete current coverage + valid view. Brown strip: incomplete. Gold line: declared budget. Red points: over budget.\nExperimental 12-stem appearance; no formal H1 or acceptance claim. Fresh one-route scenes; retained 6 ms walk precedes a failed turn-start warm-up.',fontsize=10,color='#b7c3b9')
fig.subplots_adjust(left=.07,right=.98,top=.87,bottom=.12,hspace=.36,wspace=.14)
for ext in ['png','svg']:fig.savefig(out/f'preparation-and-completeness.{ext}',dpi=160)
provenance={'source':'evidence.json','sourceSha256':hashlib.sha256((out/'evidence.json').read_bytes()).hexdigest(),'windows':[{'host':r['host'],'phase':r['phase'],'kind':r['kind'],'budget':r['budgetMs'],'raw':r['raw'],'frames':r['frames']} for r in data['quiet']],'method':'Matplotlib plot of every retained quiet raw preparation sample; no smoothing, spikes and unready frames retained; derived completeness strip.'}
(out/'plot-provenance.json').write_text(json.dumps(provenance,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'plot':str(out/'preparation-and-completeness.png'),'windows':len(data['quiet'])}))
