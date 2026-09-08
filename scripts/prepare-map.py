"""Prepare an attributed, local OSM snapshot. Requires Shapely; no browser tiles are used."""
import json, math, re, random, sys
from pathlib import Path
from collections import Counter
from shapely.geometry import Polygon, LineString, Point, box, MultiPolygon
from shapely.ops import unary_union, polygonize, linemerge
from shapely import affinity

raw_path=Path(sys.argv[1]); relations_path=Path(sys.argv[2]); output=Path(sys.argv[3])
raw=json.loads(raw_path.read_text()); rels=json.loads(relations_path.read_text())
elements=[e for e in raw['elements'] if e['type']!='relation']+rels['elements']
LAT,LON=35.681236,139.767125
M_LON=111320*math.cos(math.radians(LAT)); M_LAT=110940

def en(p): return ((p['lon']-LON)*M_LON,(p['lat']-LAT)*M_LAT)
def relation_polygon(e,project):
    groups={}
    for m in e.get('members',[]):
        g=m.get('geometry',[])
        if len(g)<2: continue
        groups.setdefault(m.get('role','outer'),[]).append(LineString([project(p) for p in g if p]))
    def rings(lines):return unary_union(list(polygonize(unary_union(lines)))) if lines else Polygon()
    return rings(groups.get('outer',[])).difference(rings(groups.get('inner',[]))).buffer(0)
station=next(e for e in rels['elements'] if e['id']==4856156)
sp=relation_polygon(station,en)
r=list(sp.minimum_rotated_rectangle.exterior.coords)
edge=max(zip(r,r[1:]),key=lambda pair:Point(pair[0]).distance(Point(pair[1])))
dx,dy=edge[1][0]-edge[0][0],edge[1][1]-edge[0][1]
if dy<0:dx,dy=-dx,-dy
angle=math.atan2(dx,dy); cos=math.cos(angle); sin=math.sin(angle)
cx,cy=sp.centroid.x,sp.centroid.y
# Keep the existing detailed station centered at x=-51 and z=0.
def project(p):
    e,n=en(p);e-=cx;n-=cy
    return (e*cos-n*sin-51,-(e*sin+n*cos))
AREA=box(-740,-850,720,860)
def polys(g):
    if g.is_empty:return []
    if g.geom_type=='Polygon':return [g]
    return [p for p in getattr(g,'geoms',[]) if p.geom_type=='Polygon']
def lines(g):
    if g.is_empty:return []
    if g.geom_type=='LineString':return [g]
    return [p for p in getattr(g,'geoms',[]) if p.geom_type=='LineString']
def geom(e,area=True):
    if e['type']=='relation':return relation_polygon(e,project)
    pts=[project(p) for p in e.get('geometry',[]) if p]
    if len(pts)<(4 if area else 2):return Polygon() if area else LineString()
    return Polygon(pts).buffer(0) if area else LineString(pts)
def arr(ring):return [[round(x,2),round(z,2)] for x,z in ring.coords]
def encode(g):return [{'outer':arr(p.exterior),'holes':[arr(i) for i in p.interiors]} for p in polys(g.simplify(.18,preserve_topology=True)) if p.area>1]
def num(v,default=None):
    m=re.search(r'-?\d+(?:\.\d+)?',str(v or ''));return float(m.group()) if m else default

data={'meta':{'source':'© OpenStreetMap contributors','license':'ODbL 1.0','url':'https://www.openstreetmap.org/copyright','timestamp':raw['osm3s']['timestamp_osm_base'],'frame':{'referenceLat':LAT,'referenceLon':LON,'metresPerLongitudeDegree':M_LON,'metresPerLatitudeDegree':M_LAT,'stationCenterEN':[cx,cy],'axisDegreesFromNorth':math.degrees(angle),'stationCenterX':-51},'bounds':[-740,-850,720,860]},'buildings':[],'roads':[],'surfaces':{},'rails':[],'trees':[],'crossings':[]}
relation_members={m['ref'] for e in rels['elements'] if 'building' in e.get('tags',{}) for m in e.get('members',[]) if m['type']=='way'}
buildings=[]
for e in elements:
    t=e.get('tags',{})
    if not ('building'in t or 'building:part'in t):continue
    if e['type']=='way' and e['id'] in relation_members and not t.get('building:part'):continue
    if t.get('building') in ['roof','train_station'] or t.get('building:part')=='roof':continue
    if t.get('location')=='underground' or num(t.get('layer'),0)<0:continue
    g=geom(e).intersection(AREA)
    if g.is_empty or g.area<12:continue
    center=g.centroid
    # Station concourses are represented separately; retain surrounding real footprints.
    if (-40<center.x<190 and abs(center.y)<205) and ('駅' in t.get('name','') or g.area>15000):continue
    buildings.append({'e':e,'tags':t,'g':g})
parts=[f for f in buildings if 'building:part' in f['tags']]
# A handful of major towers lack heights/parts in OSM. Their upper volumes are approximate.
verified_overrides={1116244124:(240,'https://www.yaesu.tokyo-midtown.com/about/facilities')}
for f in buildings:
    e,t,g=f['e'],f['tags'],f['g'];ispart='building:part'in t
    h=num(t.get('height')); hs='osm:height' if h is not None else 'estimated'
    levels=num(t.get('building:levels'))
    if h is None:h=levels*3.6 if levels else (32 if g.area>1600 else 22 if g.area>500 else 15 if g.area>160 else 9);hs='osm:levels' if levels else 'estimated'
    contained=[p for p in parts if p is not f and g.intersection(p['g']).area>min(p['g'].area,g.area)*.7] if not ispart else []
    if contained:
        # Parent outline is a podium, not a solid volume filling the taller tower's setbacks.
        ph=[num(p['tags'].get('height'),num(p['tags'].get('building:levels'),10)*3.6) for p in contained]
        if h>=max(ph)-1:h=min(28,min(ph));hs='podium-estimate' if hs=='estimated' else hs+';podium'
    if e['id'] in verified_overrides:
        height,src=verified_overrides[e['id']];h=height;hs=src
    name=t.get('name:ja',t.get('name',''))
    if hs=='estimated' and -200<g.centroid.x<-65 and abs(g.centroid.y)<180 and not ispart:h=3.5;hs='visual-estimate:station-entrance'
    if 'グラントウキョウノース' in name and not contained:h=200;hs='estimated'
    if t.get('building')=='construction':h=min(h,12)
    h=max(3,min(h,300));base=max(0,num(t.get('min_height'),0))
    style='stone' if g.centroid.x < -140 else 'concrete'
    if h>85 or t.get('building:material')=='glass':style='glass'
    if any(n in name for n in ['丸の内ビルディング','新東京ビル','三菱一号館']):style='warm'
    if any(n in name for n in ['JPタワー']):style='glass' if ispart or h>50 else 'white'
    if t.get('building:colour')=='white':style='white'
    if e['id'] in [287724936,287724937]:style='warm'
    record={'id':f"{e['type']}/{e['id']}",'name':name,'height':round(h,1),'base':base,'heightSource':hs,'part':ispart,'style':style,'shape':encode(g),'center':[round(g.centroid.x,2),round(g.centroid.y,2)]}
    # Approximate inset upper masses only for towers whose actual upper parts are missing.
    if h>110 and not ispart and not contained:
        inset=g.buffer(-5 if h<180 else -8,join_style=2)
        if not inset.is_empty and inset.area>g.area*.35:
            record['podium']=24 if h<180 else 31
            record['upper']=encode(inset)
            record['upperSource']='approximate-inset; footprint from OSM'
    data['buildings'].append(record)

road_shapes=[];sidewalk_shapes=[];foot_shapes=[];water=[];green=[];cross=[];rail_shapes=[]
widths={'motorway':9,'motorway_link':6,'trunk':14,'trunk_link':6,'primary':15,'primary_link':6,'secondary':13,'secondary_link':5,'tertiary':10,'tertiary_link':5,'residential':6,'unclassified':7,'service':4.5,'living_street':5,'pedestrian':9,'footway':2.4,'path':2,'cycleway':2,'steps':2}
for e in elements:
    t=e.get('tags',{});g=geom(e,False) if e['type']=='way' else Polygon()
    if t.get('natural')=='water':water.append(geom(e).intersection(AREA));continue
    if t.get('landuse') in ['grass','forest'] or t.get('leisure') in ['park','garden']:
        green.append(geom(e).intersection(AREA));continue
    if t.get('railway')=='rail' and not t.get('tunnel') and num(t.get('layer'),0)>=0:
        for l in lines(g.intersection(AREA)):
            if l.length>3:data['rails'].append({'id':e['id'],'points':arr(l),'layer':num(t.get('layer'),1)})
        continue
    kind=t.get('highway')
    if kind not in widths or g.is_empty:continue
    if t.get('indoor')=='yes' or num(t.get('level'),0)<0 or t.get('tunnel') in ['yes','building_passage'] or num(t.get('layer'),0)<0:continue
    if t.get('access')=='private':continue
    width=num(t.get('width'))
    if width is None:
        lanes=num(t.get('lanes'))
        width=max(4,lanes*3.1+1) if lanes and kind not in ['footway','pedestrian','steps','path'] else widths[kind]
    width=min(width,35);layer=num(t.get('layer'),0);elevation=11 if t.get('bridge')=='yes' and layer>0 else 0
    if t.get('area')=='yes':
        foot_shapes.append(geom(e).intersection(AREA));continue
    isfoot=kind in ['pedestrian','footway','path','cycleway','steps']
    if t.get('footway')=='crossing':
        for l in lines(g.intersection(AREA)):
            if l.length>3:cross.append(arr(l))
    for l in lines(g.intersection(AREA)):
        if l.length<1:continue
        shape=l.buffer(width/2,cap_style=1,join_style=1)
        if isfoot:foot_shapes.append(shape);continue
        if elevation==0:
            road_shapes.append(shape);sidewalk_shapes.append(l.buffer(width/2+2,cap_style=1,join_style=1))
        data['roads'].append({'id':e['id'],'name':t.get('name',''),'kind':kind,'width':round(width,1),'widthSource':'osm:width' if 'width'in t else 'lanes' if 'lanes'in t else 'estimated','elevation':elevation,'oneway':t.get('oneway')=='yes','points':arr(l)})

roads=unary_union(road_shapes).intersection(AREA)
water=unary_union(water).intersection(AREA)
built=unary_union([f['g'] for f in buildings])
sidewalks=unary_union(sidewalk_shapes).difference(roads).difference(built).difference(water).intersection(AREA)
foot=unary_union(foot_shapes).difference(roads).difference(built).difference(water).intersection(AREA)
green=unary_union(green).difference(roads.buffer(1)).difference(foot).difference(built).difference(water).intersection(AREA)
data['surfaces']={'roads':encode(roads),'sidewalks':encode(sidewalks),'pedestrian':encode(foot),'water':encode(water),'green':encode(green)}
data['crossings']=cross
# Deterministic trees placed only in mapped green polygons; never on roads or buildings.
rng=random.Random(20260905)
for p in polys(green):
    minx,minz,maxx,maxz=p.bounds
    for _ in range(min(5000,int(p.area/42))):
        x,z=rng.uniform(minx,maxx),rng.uniform(minz,maxz)
        if p.contains(Point(x,z)):data['trees'].append([round(x,2),round(z,2),round(rng.uniform(.8,1.35),2)])
# Street trees on broad road verges. Test against water, buildings and actual roadway.
built_clearance=built.buffer(.8)
for r in data['roads']:
    if r['width']<10 or r['elevation']:continue
    l=LineString(r['points'])
    if l.length<35:continue
    for dist in range(12,int(l.length)-8,22):
        p=l.interpolate(dist);q=l.interpolate(dist+.5);dx,dz=q.x-p.x,q.y-p.y;norm=math.hypot(dx,dz)
        if norm<.001:continue
        for side in [-1,1]:
            x,z=p.x-side*dz/norm*(r['width']/2+1.25),p.y+side*dx/norm*(r['width']/2+1.25)
            point=Point(x,z)
            if AREA.contains(point) and not built_clearance.contains(point) and not roads.contains(point) and not water.contains(point):data['trees'].append([round(x,2),round(z,2),.76])
# Occupancy signatures retain source IDs and sources for review.
data['meta']['counts']={'buildingVolumes':len(data['buildings']),'roadSegments':len(data['roads']),'railSegments':len(data['rails']),'trees':len(data['trees']),'heightSources':dict(Counter(b['heightSource'].split(';')[0] for b in data['buildings']))}
output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
print(json.dumps(data['meta'],ensure_ascii=False,indent=2))
print('output bytes',output.stat().st_size)
