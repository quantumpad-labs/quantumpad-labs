/** Frozen orbital-v1 renderer. Only the committed digest influences the artwork. */
export function genesisArt(digest:string) {
  const hex=digest.replace(/^0x/,"");
  if(!/^[a-f0-9]{64}$/i.test(hex))throw new Error("Expected a SHA-256 digest");
  const bytes=Array.from({length:32},(_,i)=>parseInt(hex.slice(i*2,i*2+2),16));
  const hue=bytes[0]%360;
  const rings=Array.from({length:7},(_,i)=>`<ellipse cx="200" cy="200" rx="${60+i*17}" ry="${22+bytes[i+1]%80}" transform="rotate(${bytes[i+8]%180} 200 200)" stroke="hsl(${(hue+i*9)%360} 50% ${58+i*3}%)" stroke-opacity="${.35+i*.08}"/>`).join("");
  const dots=Array.from({length:12},(_,i)=>{const a=bytes[i+16]/255*Math.PI*2,r=80+bytes[i+3]%90;return `<circle cx="${(200+Math.cos(a)*r).toFixed(3)}" cy="${(200+Math.sin(a)*r).toFixed(3)}" r="${2+bytes[i+4]%4}" fill="#f0d991"/>`;}).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" rx="24" fill="#09121e"/><g fill="none" stroke-width="1.4">${rings}</g>${dots}<circle cx="200" cy="200" r="9" fill="#f0d991"/></svg>`;
}
