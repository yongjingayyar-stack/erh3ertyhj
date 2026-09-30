// ============ core/mathx.js — tiny math helpers ============
export const clamp=(v,a,b)=>v<a?a:v>b?b:v;
export const lerp=(a,b,t)=>a+(b-a)*t;
export const smoothstep=t=>t*t*(3-2*t);
export const easeOutCubic=t=>1-Math.pow(1-t,3);
export const easeInQuad=t=>t*t;
export const easeOutBack=t=>{const c=1.70158;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2)};
export const rand=(a=1,b)=>b===undefined?Math.random()*a:a+Math.random()*(b-a);
export const randi=(a,b)=>Math.floor(rand(a,b+1));
export const pick=arr=>arr[Math.floor(Math.random()*arr.length)];
export const angleWrap=a=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a};
export function approachAngle(cur,target,maxStep){
  const d=angleWrap(target-cur);
  return cur+clamp(d,-maxStep,maxStep);
}
export const dist2=(ax,az,bx,bz)=>{const dx=ax-bx,dz=az-bz;return Math.sqrt(dx*dx+dz*dz)};

// keyframed curve evaluator: frames=[{t,v}] with per-frame easing
export function sampleFrames(frames, t){
  if(t<=frames[0].t) return frames[0];
  for(let i=1;i<frames.length;i++){
    if(t<=frames[i].t){
      const a=frames[i-1], b=frames[i];
      const u=(t-a.t)/(b.t-a.t);
      return {a, b, u, raw:u};
    }
  }
  return {a:frames[frames.length-1], b:frames[frames.length-1], u:1, raw:1};
}
