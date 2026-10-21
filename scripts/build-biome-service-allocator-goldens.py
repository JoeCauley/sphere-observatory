"""Independent SHA/uint64 corpus for the frozen sampler/frontier protocol. No design writes."""
import argparse, hashlib, json, math, pathlib, struct

FACES = [([1,0,0],[0,0,-1],[0,1,0]),([-1,0,0],[0,0,1],[0,1,0]),([0,1,0],[1,0,0],[0,0,-1]),([0,-1,0],[1,0,0],[0,0,1]),([0,0,1],[1,0,0],[0,1,0]),([0,0,-1],[-1,0,0],[0,1,0])]
def dot(a,b): return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
def address(q,level):
    face = max(range(6), key=lambda j: dot(q,FACES[j][0]))
    n,u,v = FACES[face];den=dot(q,n);span=2**level
    x=math.floor((dot(q,u)/den+1)*.5*span);y=math.floor((dot(q,v)/den+1)*.5*span)
    return dict(face=face,level=level,x=min(x,span-1),y=min(y,span-1))
def centre(cell):
    n,u,v=FACES[cell['face']];span=2**cell['level'];x=-1+2*(cell['x']+.5)/span;y=-1+2*(cell['y']+.5)/span
    q=[n[k]+u[k]*x+v[k]*y for k in range(3)];length=math.hypot(*q)
    return [v/length for v in q]
def positive_zero(value):
    if isinstance(value, dict): return {key: positive_zero(item) for key,item in value.items()}
    if isinstance(value, list): return [positive_zero(item) for item in value]
    if isinstance(value, float) and value == 0: return 0.0
    return value

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('output', type=pathlib.Path)
    args = parser.parse_args()
    digest = '0123456789abcdef' * 4
    anchors = []
    for level in (0, 1, 14, 30):
        for counter in (0, 1, 4095):
            raw = hashlib.sha256(b'sphere-biome-anchor/1\n' + bytes.fromhex(digest) + struct.pack('>II', level, counter)).digest()
            anchors.append(dict(level=level, counter=counter, hash=raw.hex(), fractions=[(int.from_bytes(raw[k:k+8], 'big') >> 11) / 2**53 for k in (0, 8, 16)]))
    frontiers = []
    for cell in ({'face':0,'level':0,'x':0,'y':0}, {'face':0,'level':14,'x':8192,'y':8191}, {'face':5,'level':30,'x':1073741823,'y':0}, {'face':3,'level':1,'x':1,'y':1}):
        canonical = json.dumps(cell, sort_keys=True, separators=(',', ':')).encode('utf8')
        raw = hashlib.sha256(b'sphere-biome-frontier/1\n' + bytes.fromhex(digest) + canonical).digest()
        frontiers.append(dict(cell=cell, canonical=canonical.decode('utf8'), hash=raw.hex()))
    frames=[dict(axis=[0,1,0],right=[1,0,0],up=[0,0,-1]),dict(axis=[1,0,0],right=[0,0,1],up=[0,-1,0])]
    rectangles=[dict(latitudeMin=-.9,latitudeMax=-.5,longitudeMin=-2.1,longitudeMax=.1),dict(latitudeMin=-.2,latitudeMax=.4,longitudeMin=-1.2,longitudeMax=.8),dict(latitudeMin=.7,latitudeMax=1.1,longitudeMin=.2,longitudeMax=2.5)]
    numeric=[]
    for vector in anchors:
        for frame_index,frame in enumerate(frames):
            weights=[(math.sin(r['latitudeMax'])-math.sin(r['latitudeMin']))*(r['longitudeMax']-r['longitudeMin']) for r in rectangles]
            selected=vector['fractions'][0]*sum(weights);cumulative=0
            for ordinal,weight in enumerate(weights):
                cumulative+=weight
                if selected<cumulative: break
            r=rectangles[ordinal];latitude=math.asin(math.sin(r['latitudeMin'])+vector['fractions'][1]*(math.sin(r['latitudeMax'])-math.sin(r['latitudeMin'])));longitude=r['longitudeMin']+vector['fractions'][2]*(r['longitudeMax']-r['longitudeMin']);x=math.cos(latitude)*math.cos(longitude);y=math.sin(latitude);z=math.cos(latitude)*math.sin(longitude)
            direction=[frame['right'][k]*x+frame['axis'][k]*y+frame['up'][k]*z for k in range(3)]
            numeric.append(dict(level=vector['level'],counter=vector['counter'],frame=frame_index,rectangle=ordinal,latitudeRad=latitude,longitudeRad=longitude,direction=direction,cell=address(direction,vector['level'])))
    orders=[]
    for anchor in ({'face':0,'level':0,'x':0,'y':0},{'face':4,'level':1,'x':1,'y':0},{'face':0,'level':14,'x':8192,'y':8192}):
        direction=centre(anchor)
        if anchor['level']==0: cells=[dict(face=f,level=0,x=0,y=0) for f in range(6)]
        else: cells=[dict(face=anchor['face'],level=anchor['level'],x=x,y=y) for x,y in ((anchor['x'],anchor['y']),(anchor['x']-1,anchor['y']),(anchor['x'],anchor['y']+1))]
        rows=[]
        for cell in cells:
            canonical=json.dumps(cell,sort_keys=True,separators=(',',':')).encode('utf8');hashed=hashlib.sha256(b'sphere-biome-frontier/1\n'+bytes.fromhex(digest)+canonical).hexdigest()
            rows.append(dict(cell=cell,score=-dot(centre(cell),direction),digest=hashed))
        rows.sort(key=lambda row:(row['score'],row['digest'],row['cell']['face'],row['cell']['level'],row['cell']['x'],row['cell']['y']))
        orders.append(dict(anchor=anchor,anchorDirection=direction,ordered=rows))
    corpus = dict(format='sphere-biome-allocator-golden/1', inputDigest=digest, source='Independent Python hashlib/struct, exact integer fractions, math libm and independently coded six-face projection. Numeric angles/directions/scores tolerate 2e-15 binary64 host/libm difference; all discrete address/rectangle/frontier identities match exactly.', anchors=anchors, frontiers=frontiers,frames=frames,rectangles=rectangles,numericAnchors=numeric,frontierOrders=orders)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('x', encoding='utf8', newline='\n') as stream:
        json.dump(positive_zero(corpus), stream, indent=2)
        stream.write('\n')
if __name__ == '__main__':
    main()
