// An illustrative vector field, not weather or compute telemetry.
export function field(lon: number, lat: number): [number, number, number] {
  let u = 1.7 * Math.cos(lat * .065), v = .6 * Math.sin(lon * .05 + lat * .07);
  for (const [x, y, strength] of [[85,-32,23],[135,22,-18],[25,48,17],[-55,30,-22],[-120,-40,21]]) {
    const dx = ((lon-x+540)%360-180), dy = lat-y, d = dx*dx+dy*dy+45;
    u += -dy*strength/d*4; v += dx*strength/d*4;
  }
  return [u,v,Math.min(1,Math.hypot(u,v)/7)];
}

export function fieldTexture(lon0: number, lat0: number, map: boolean) {
  const size=360, surface=document.createElement('canvas');
  surface.width=size;surface.height=size;
  const ctx=surface.getContext('2d')!;
  const image=ctx.createImageData(size,size), rad=Math.PI/180, p=lat0*rad;
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const nx=(x/(size-1)-.5)*2,ny=(.5-y/(size-1))*2,rho=Math.hypot(nx,ny);
    if(!map&&rho>1)continue;
    const z=Math.sqrt(Math.max(0,1-rho*rho));
    const lat=map?ny*90:Math.asin(z*Math.sin(p)+ny*Math.cos(p))/rad;
    const lon=map?lon0+nx*180:lon0+Math.atan2(nx,z*Math.cos(p)-ny*Math.sin(p))/rad;
    const speed=field(lon,lat)[2];
    const noise=(Math.sin(lon*.53+Math.sin(lat*.4)*3)*Math.sin(lat*.73+lon*.27)+1)*.035;
    const t=Math.min(1,speed+noise);
    const stops=[[10,8,78],[18,38,123],[12,99,132],[12,155,100],[95,193,53],[220,213,83]];
    const f=t*(stops.length-1),i=Math.min(stops.length-2,Math.floor(f)),k=f-i;
    const shade=map?1:.72+.28*z, at=(y*size+x)*4;
    for(let c=0;c<3;c++)image.data[at+c]=(stops[i][c]*(1-k)+stops[i+1][c]*k)*shade;
    image.data[at+3]=255;
  }
  ctx.putImageData(image,0,0);return surface;
}
