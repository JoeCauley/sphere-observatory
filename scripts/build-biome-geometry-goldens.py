"""Independent Decimal reference values; never writes sealed design/evidence."""
from pathlib import Path
from decimal import Decimal, localcontext
import json, hashlib, sys
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'tests/fixtures/biome-service/geometry/decimal-goldens.json'
def atan(x):
    if x<0:return -atan(-x)
    if x>1:return PI/2-atan(1/x)
    if x>Decimal('.5'):return atan(Decimal('.5'))+atan((x-Decimal('.5'))/(1+x/2))
    power=x; total=Decimal(0); square=x*x
    for k in range(1000):
        term=power/(2*k+1);total=total+term if k%2==0 else total-term;power*=square
        if abs(power)<Decimal('1e-185'):return total
    raise RuntimeError('Oracle work cap')
def trig(x,cosine=False):
    term=Decimal(1) if cosine else x;total=term;degree=0 if cosine else 1
    for k in range(500):
        term=-term*x*x/((degree+1)*(degree+2));total+=term;degree+=2
        if abs(term)<Decimal('1e-185'):return total
    raise RuntimeError('Oracle work cap')
def dot(a,b):return sum(x*y for x,y in zip(a,b))
def det(a,b,c):return a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0])
def angle(a,b,c):
    aa,bb,cc=map(lambda v:Decimal(dot(v,v)).sqrt(),[a,b,c])
    denominator=aa*bb*cc+dot(a,b)*cc+dot(b,c)*aa+dot(c,a)*bb
    return 2*atan(Decimal(abs(det(a,b,c)))/denominator)
FACES=[([1,0,0],[0,0,-1],[0,1,0]),([-1,0,0],[0,0,1],[0,1,0]),([0,1,0],[1,0,0],[0,0,-1]),([0,-1,0],[1,0,0],[0,0,1]),([0,0,1],[1,0,0],[0,1,0]),([0,0,-1],[-1,0,0],[0,1,0])]
with localcontext() as ctx:
    ctx.prec=200
    PI=16*atan(Decimal(1)/5)-4*atan(Decimal(1)/239)
    cases=[]
    for face in range(6):
        for level in [0,1,7,14,24,30]:
            size=2**level
            for x,y in sorted(set([(0,0),(size//2,size//2),(size-1,size-1),(0,size-1)])):
                normal,uaxis,vaxis=FACES[face];corners=[]
                for dx,dy in [(0,0),(1,0),(1,1),(0,1)]:
                    u=-size+2*(x+dx);v=-size+2*(y+dy)
                    corners.append([normal[k]*size+uaxis[k]*u+vaxis[k]*v for k in range(3)])
                a,b,c,d=corners;radius=149597870700
                cases.append({'cell':{'face':face,'level':level,'x':x,'y':y},'radiusM':radius,'areaM2':str((angle(a,b,c)+angle(a,c,d))*radius**2)})
    trig_cases=[]
    for value in [-16,-3.141592653589793,-1,-.5,0,.5,1,1.31,16]:
        x=Decimal.from_float(value)
        row={'input':value,'atan':str(atan(x)),'sin':str(trig(x)),'cos':str(trig(x,True))}
        if abs(x)<=1:
            row['asin']=str((PI/2 if x==1 else -PI/2 if x==-1 else 2*atan(x/(1+(1-x*x).sqrt()))))
        trig_cases.append(row)
    report={'format':'sphere-biome-decimal-goldens/1','scope':'Independent 200-digit Decimal regression oracle, not runtime certificate proof','python':sys.version,'precision':200,'referenceTolerance':'1e-140','pi':str(PI),'areaCases':cases,'trigCases':trig_cases}
OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'path':str(OUT),'cases':len(cases),'sha256':hashlib.sha256(OUT.read_bytes()).hexdigest()}))
