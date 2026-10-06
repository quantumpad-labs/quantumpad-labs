/** Project NASA's equirectangular image into an orthographic globe or flat map. */
export function earthSurface(source: ImageData, lon0: number, lat0: number, map: boolean, size = 720) {
  const surface=document.createElement("canvas");surface.width=size;surface.height=map?size/2:size;
  const ctx=surface.getContext("2d")!, image=ctx.createImageData(surface.width,surface.height);
  const p=lat0*Math.PI/180, sin=Math.sin(p),cos=Math.cos(p),rad=180/Math.PI;
  for(let y=0;y<surface.height;y++)for(let x=0;x<size;x++){
    const nx=(x/(size-1)-.5)*2,ny=(.5-y/(surface.height-1))*2,rho=nx*nx+ny*ny;
    if(!map&&rho>1)continue;
    const z=Math.sqrt(Math.max(0,1-rho));
    const lat=map?ny*90:Math.asin(z*sin+ny*cos)*rad;
    const lon=map?lon0+nx*180:lon0+Math.atan2(nx,z*cos-ny*sin)*rad;
    const sx=((lon+180)%360+360)%360/360*(source.width-1),sy=(90-lat)/180*(source.height-1);
    const x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(source.width-1,x0+1),y1=Math.min(source.height-1,y0+1),fx=sx-x0,fy=sy-y0;
    const indices=[(y0*source.width+x0)*4,(y0*source.width+x1)*4,(y1*source.width+x0)*4,(y1*source.width+x1)*4];
    const weights=[(1-fx)*(1-fy),fx*(1-fy),(1-fx)*fy,fx*fy];
    const at=(y*size+x)*4,light=map?1:.42+.58*Math.max(0,z*.85-nx*.3+ny*.15);
    const rim=map?0:Math.pow(1-z,4)*.34;
    for(let c=0;c<3;c++){
      let value=0;for(let i=0;i<4;i++)value+=source.data[indices[i]+c]*weights[i];
      image.data[at+c]=value*light*(1-rim)+[46,134,226][c]*rim;
    }
    image.data[at+3]=255;
  }
  ctx.putImageData(image,0,0);return surface;
}
