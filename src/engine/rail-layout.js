// Georeferenced tracks share one vertical profile with their trains and platforms.
export function railElevation(profile,z) {
  if(!profile?.central)return 0;
  const t=Math.max(0,Math.min(1,(z+600)/380));
  return 6.5*t*t*(3-2*t);
}
export function railPoints(points,profile) {
  const result=[];
  for(let i=1;i<points.length;i++){
    const p=points[i-1],q=points[i],steps=Math.max(1,Math.ceil(Math.hypot(q[0]-p[0],q[1]-p[1])/6));
    for(let j=i===1?0:1;j<=steps;j++){
      const t=j/steps,x=p[0]+(q[0]-p[0])*t,z=p[1]+(q[1]-p[1])*t;
      result.push([x,4.45+railElevation(profile,z),z]);
    }
  }
  return result;
}
