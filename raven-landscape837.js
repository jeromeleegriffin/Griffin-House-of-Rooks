/* 837: approved landscape artwork; no game rules or portrait sprite changes. */
(function(){'use strict';
let images=null;
const ready=Promise.all(['black','red'].map(side=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src='assets/raven-landscape837/'+side+'-atlas.png';}))).then(x=>{images=x;return true}).catch(()=>false);
function available(){return !!images&&matchMedia('(orientation: landscape)').matches&&!!window.HORAngleC?.active();}
function timing(pace,reduced){return {duration:reduced?700:pace===99?2100:pace===3?2800:5100,settle:pace===99?90:pace===3?120:180};}
function geometry(black,red){
 const b=black.getBoundingClientRect(),r=red.getBoundingClientRect(),frame=HORAngleC.frame(),hand=window.HORLowerLayout?.handY??innerHeight*.72;
 // A reference scene anchored to the actual far rail and hand, never an 88px strip.
 const far=frame.top+292*frame.scale,unit=Math.max(.15,Math.min(innerWidth/1280,(hand-far)/250));
 const u=Math.min(unit,innerWidth/1280),origin={x:innerWidth/2-640*u,y:hand-504*u};
 const point=box=>({x:(box.left+box.width/2-origin.x)/u,y:(box.top+box.height/2-origin.y)/u});
 return {left:0,top:0,w:innerWidth,h:innerHeight,unit:u,origin,starts:{black:point(b),red:point(r)},card:{x:b.left,y:b.top,w:b.width,h:b.height},compact:u<.4};
}
const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x)},mix=(a,b,t)=>a+(b-a)*t;
function key(t,keys){if(t<=keys[0][0])return keys[0].slice(1);for(let i=1;i<keys.length;i++)if(t<keys[i][0]){const p=ease((t-keys[i-1][0])/(keys[i][0]-keys[i-1][0]));return keys[i].slice(1).map((v,j)=>mix(keys[i-1][j+1],v,p))}return keys.at(-1).slice(1)}
function pose(t,side){const black=side===0;let f=(t*9+(black?0:.7))%4,a=Math.floor(f),b=(a+1)%4,m=clamp((f-a-.78)/.22);if(t>=2.15&&t<3.55){return{a:4,b:4,m:0}}if(t>=3.55&&t<4.6){return{a:5,b:5,m:0}}return{a,b,m};}
const bk=[[0,644,417,.01,0,0],[.7,644,417,.05,0,0],[1.4,435,330,.93,-.08,1],[2.15,520,322,1,-.04,1],[2.4,565,318,1,.025,1],[2.7,535,319,1,.025,1],[3.3,535,307,1,-.06,1],[3.7,550,295,1,-.07,1],[4.25,553,301,.98,-.02,1],[4.7,579,335,.8,.08,1],[5.3,644,417,.10,.03,0],[7,644,417,.01,0,0]];
const rd=[[0,520,357,.01,0,0],[.7,520,357,.05,0,0],[1.4,890,347,.93,.08,1],[2.15,800,350,1,.03,1],[2.4,794,352,1,-.07,1],[2.7,806,356,1,-.07,1],[3.3,827,372,1,.08,1],[3.7,850,390,.96,.14,1],[4.3,970,430,.65,.26,.65],[4.75,1010,450,.25,.40,0],[7,1080,421,.01,0,0]];
function sprite(ctx,im,side,state,p,t){let[x,y,scale,angle,alpha]=state;if(alpha<.002)return;const size=(side===0?460:368)*scale;const pivot=side===0?[320,300]:[193,297];const flap=Math.sin(t*19+(side?1:0));if(t>1.4&&t<2.15)y+=flap*3;if(t>2.2&&t<3.5){const q=Math.sin((t-2.2)*19)*(side?1:-1);x+=q*4;y+=Math.cos((t-2.2)*16)*2;angle+=q*.016;}
 // Soft separation shadow; the bird itself is the finished generated artwork.
 ctx.save();ctx.globalAlpha=alpha*.20;ctx.filter='blur(8px)';ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(x+(side?45:-35),Math.min(488,y+113),size*.22,size*.035,0,0,Math.PI*2);ctx.fill();ctx.restore();
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';const draw=(frame,opacity)=>{if(opacity<.001)return;ctx.globalAlpha=alpha*opacity;ctx.drawImage(im,frame%3*512,Math.floor(frame/3)*512,512,512,-pivot[0]/512*size,-pivot[1]/512*size,size,size)};draw(p.a,1-p.m);draw(p.b,p.m);ctx.restore();}
function feather(ctx,x,y,angle,size,alpha,red){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha=alpha;ctx.fillStyle=red?'#6f151a':'#15191d';ctx.beginPath();ctx.moveTo(0,-size);ctx.bezierCurveTo(size*.45,-size*.5,size*.25,size*.5,0,size);ctx.bezierCurveTo(-size*.28,size*.35,-size*.35,-size*.4,0,-size);ctx.fill();ctx.restore();}

function draw(ctx,g,ms,reduced){
 const t=.7+Math.max(0,Math.min(1,ms/5100))*5.1;
 ctx.clearRect(0,0,g.w,g.h);ctx.save();ctx.translate(g.origin.x,g.origin.y);ctx.scale(g.unit,g.unit);
 const keys=(base,side)=>base.map((k,i)=>{const a=k.slice();if(i<2||(side===0&&i>=10)){a[1]=g.starts[side===0?'black':'red'].x;a[2]=g.starts[side===0?'black':'red'].y;}return a;});
 if(!reduced){
  sprite(ctx,images[1],1,key(t,keys(rd,1)),pose(t,1),t);sprite(ctx,images[0],0,key(t,keys(bk,0)),pose(t,0),t);
  if(t>=2.6&&t<4.7){const p=(t-2.6)/2.1;for(let i=0;i<7;i++){const k=i*2.399;feather(ctx,704+Math.cos(k)*(20+p*130),365+Math.sin(k)*p*34+p*p*65,k+p*2,4+i%3,Math.sin(Math.PI*p)*.68,i%3===0)}}
 }else{
  // Stationary, small paired artwork and a soft winning-card emphasis, no flight.
  const alpha=Math.sin(Math.PI*Math.min(1,ms/5100));
  sprite(ctx,images[1],1,[760,365,.36,0,alpha],{a:4,b:4,m:0},0);
  sprite(ctx,images[0],0,[560,345,.36,0,alpha],{a:4,b:4,m:0},0);
 }
 ctx.restore();
 const q=reduced?Math.sin(Math.PI*ms/5100):t>=5.05&&t<5.8?Math.sin((t-5.05)/.75*Math.PI):0;
 if(q>0){ctx.save();ctx.globalAlpha=q*.42;ctx.strokeStyle='#efca6c';ctx.lineWidth=3*g.unit;ctx.shadowColor='#efca6c';ctx.shadowBlur=9*g.unit;ctx.strokeRect(g.card.x,g.card.y,g.card.w,g.card.h);ctx.restore();}
 return {time:ms,phase:reduced?'reduced':t<2.15?'approach':t<3.55?'clash':t<4.6?'black wins':'return',geometry:g};
}
window.HORRavenLandscape837={ready,available,timing,geometry,draw};
})();
