"""Convert OSM platform relations into curved station geometry using the city's coordinate frame.
Usage: python prepare-platforms.py platform-source.json city-map.json full-osm-source.json output.json
Requires Shapely. Platform/track coordinates remain attributable to OSM under ODbL.
"""
import json,math,sys
from pathlib import Path
from shapely.geometry import LineString, Polygon, box
from shapely.ops import unary_union, polygonize
source,city,full,output=map(Path,sys.argv[1:])
j=json.loads(source.read_text());m=json.loads(city.read_text());raw=json.loads(full.read_text());f=m['meta']['frame']
c=math.cos(math.radians(f['axisDegreesFromNorth']));s=math.sin(math.radians(f['axisDegreesFromNorth']))
def project(p):
 e=(p['lon']-f['referenceLon'])*f['metresPerLongitudeDegree']-f['stationCenterEN'][0];n=(p['lat']-f['referenceLat'])*f['metresPerLatitudeDegree']-f['stationCenterEN'][1]
 return (e*c-n*s+f['stationCenterX'],-(e*s+n*c))
def polygons(g):
 if g.is_empty:return []
 return [g] if g.geom_type=='Polygon' else [p for p in g.geoms if p.geom_type=='Polygon']
def encode(g):
 def ring(r):return [[round(x,3),round(z,3)] for x,z in r.coords]
 return [{'outer':ring(p.exterior),'holes':[ring(r) for r in p.interiors]} for p in polygons(g) if p.area>.01]
def relation(e):
 def area(role):
  ls=[LineString([project(p) for p in v['geometry']]) for v in e.get('members',[]) if v.get('role')==role and v.get('geometry')]
  return unary_union(list(polygonize(unary_union(ls))))
 return area('outer').difference(area('inner')).buffer(0)
by_id={e['id']:e.get('tags',{}) for e in raw['elements'] if e['type']=='way'}
by_id.update({e['id']:e.get('tags',{}) for e in j['elements'] if e['type']=='way'})
tracks={}
for r in m['rails']:
 t=by_id.get(r['id'],{});central='中央' in t.get('name','')
 tracks[str(r['id'])]={'gauge':int(t.get('gauge','1067').split(';')[0])/1000,'central':central,'ref':t.get('railway:track_ref','')}
clearances={flag:unary_union([LineString(r['points']).buffer(2.05,quad_segs=8) for r in m['rails'] if tracks[str(r['id'])]['central']==flag]) for flag in [True,False]}
platforms=[]
for e in j['elements']:
 if e['type']!='relation' or e['tags'].get('railway')!='platform':continue
 p=relation(e)
 if not(-45<p.centroid.x<180 and -240<p.centroid.y<210):continue
 ref=e['tags']['ref'];central=ref=='1;2'
 # OSM platform and rail surveys can differ slightly. Keep rolling-stock clearance explicit.
 shape=p.difference(clearances[central]).buffer(0)
 roof=shape.buffer(-.7,join_style=2).intersection(box(-100,-1000,250,p.bounds[3]-8)).intersection(box(-100,p.bounds[1]+8,250,1000))
 tactile=shape.buffer(-.45,join_style=2).difference(shape.buffer(-.75,join_style=2))
 center=[]
 z0,z1=roof.bounds[1],roof.bounds[3]
 for i in range(math.ceil((z1-z0)/6)+1):
  z=min(z1-.05,z0+.05+i*6)
  cut=roof.intersection(LineString([[-80,z],[250,z]]))
  pieces=[cut] if cut.geom_type=='LineString' else [a for a in getattr(cut,'geoms',[]) if a.geom_type=='LineString']
  if not pieces:continue
  line=max(pieces,key=lambda a:a.length);pt=line.interpolate(.5,normalized=True);center.append([round(pt.x,3),round(z,3)])
 platforms.append({'id':e['id'],'ref':ref,'name':e['tags'].get('name',f'東京駅{ref.replace(";","・")}番線ホーム'),'elevation':6.5 if central else 0,'sourceShape':encode(p),'shape':encode(shape),'roof':encode(roof),'tactile':encode(tactile),'centerline':center,'clearanceCorrectionArea':round(p.area-shape.area,3)})
platforms.sort(key=lambda p:int(p['ref'].split(';')[0]))
assert len(platforms)==10
result={'meta':{'source':'© OpenStreetMap contributors','license':'ODbL 1.0','url':'https://www.openstreetmap.org/copyright','timestamp':j['osm3s']['timestamp_osm_base'],'clearance':2.05,'heightNote':'Chuo line is elevated relative to other platforms; 6.5 m separation and approach gradient are illustrative, not surveyed.','roofNote':'Roof contours and column positions are derived from platform polygons, not surveyed roof outlines.'},'platforms':platforms,'tracks':tracks}
output.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')))
for p in platforms:print(p['ref'], 'points',len(p['sourceShape'][0]['outer']),'clearance correction m2',p['clearanceCorrectionArea'])
