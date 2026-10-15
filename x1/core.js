/* Faithful scalar port of frozen rollout.cpp. Card IDs and sampling budget unchanged. */
(function(root){'use strict';
const colors=['green','red','yellow','black'], FULL=(1n<<46n)-1n, U=(1n<<64n)-1n;
const col=c=>c<40?Math.floor(c/10):c<44?c-40:c===44?1:4;
const rank=c=>c<40?c%10+5:c<44?15:c===44?999:1000;
const point=c=>c>=44?20:c>=40?15:c%10+5===5?5:[10,14].includes(c%10+5)?10:0;
const cat=(c,tr)=>c>=44?tr:col(c);
const mask=a=>a.reduce((m,c)=>m|(1n<<BigInt(c)),0n);
const bits=m=>{let a=[];for(let c=0;c<46;c++)if(m&(1n<<BigInt(c)))a.push(c);return a;};
const pop=x=>{let n=0;while(x){x&=x-1;n++;}return n;};
const beat=(a,b,led,tr)=>cat(a,tr)!==cat(b,tr)?cat(a,tr)===tr||(cat(b,tr)!==tr&&cat(a,tr)===led):rank(a)>rank(b);
const legal=(h,t,tr)=>{if(!t.c.length)return h.slice();let q=h.filter(c=>cat(c,tr)===cat(t.c[0],tr));return q.length?q:h.slice();};
const win=(t,tr)=>{let w=0;for(let i=1;i<t.c.length;i++)if(beat(t.c[i],t.c[w],cat(t.c[0],tr),tr))w=i;return w;};
const low=(a,tr)=>a.reduce((a,b)=>((cat(b,tr)===tr?1000000:0)+point(b)*2000+rank(b))<((cat(a,tr)===tr?1000000:0)+point(a)*2000+rank(a))?b:a);
const nonperm=a=>{let q=a.filter(c=>c<44);return q.length?q:a;};
function solmove(h,t,tr,played,nest,seat){
 const L=legal(h,t,tr),partner=(seat+2)%4,unseen=bits(FULL&~(mask(h)|played|nest|mask(t.c)));
 const top=(c,led)=>!unseen.some(x=>beat(x,c,led,tr));
 if(!t.c.length){const ts=L.filter(c=>cat(c,tr)===tr),plain=ts.filter(c=>c<44),side=L.filter(c=>cat(c,tr)!==tr);
  if(ts.length>=4&&unseen.filter(c=>cat(c,tr)===tr).length>=2&&plain.length)return low(plain,tr);
  if(side.length){let best=-1,bn=-1,br=-1,groups=colors.map((_,i)=>side.filter(c=>col(c)===i));for(let c=0;c<4;c++){let g=groups[c];if(c===tr||!g.length)continue;let r=Math.max(...g.map(rank));if(g.length>bn||(g.length===bn&&r>br)){best=c;bn=g.length;br=r;}}
   if(best>=0){let g=groups[best],tops=g.filter(c=>top(c,best)),zeros=g.filter(c=>!point(c));return low(tops.length?tops:zeros.length?zeros:g,tr);}}
  return low(nonperm(L),tr);
 }
 const wi=win(t,tr),w=t.s[wi],val=t.c.reduce((a,c)=>a+point(c),0),led=cat(t.c[0],tr),winners=L.filter(c=>beat(c,t.c[wi],led,tr)),zeros=L.filter(c=>!point(c));
 if(w===partner){if(t.c.length===3){let f=L.filter(c=>point(c)&&c<44&&!beat(c,t.c[wi],led,tr));if(f.length)return f.reduce((a,b)=>point(b)>point(a)||(point(b)===point(a)&&rank(b)<rank(a))?b:a);}return low(nonperm(zeros.length?zeros:L),tr);}
 if(winners.length){if(t.c.length===3||val>=10)return low(nonperm(winners),tr);let cheap=winners.filter(c=>cat(c,tr)!==tr&&!point(c));if(cheap.length)return cheap.reduce((a,b)=>rank(b)<rank(a)?b:a);}
 return low(nonperm(zeros.length?zeros:L),tr);
}
class RNG{constructor(x){this.x=x;}next(){this.x=(this.x+0x9e3779b97f4a7c15n)&U;let z=this.x;z=((z^(z>>30n))*0xbf58476d1ce4e5b9n)&U;z=((z^(z>>27n))*0x94d049bb133111ebn)&U;return(z^(z>>31n))&U;}n(k){return Number(this.next()%BigInt(k));}}
class Sampler{
 constructor(seed){this.rng=new RNG(seed);this.seats=[];this.sizes=[];this.slots=[];this.groups=[];this.allow=Array(46).fill(0);this.accepted=0;this.proposed=0;}
 feasible(remain,counts){let G=this.seats.length;for(let m=1;m<(1<<G);m++){let need=0,cap=0;for(let x=1;x<(1<<G);x++)if((x&m)===x)need+=counts[x];for(let g=0;g<G;g++)if(m&(1<<g))cap+=remain[g];if(need>cap)return false;}return true;}
 init(unseen,seat,lengths,voids,tr,hidden,partnerMask=null){for(let s=0;s<4;s++)if(s!==seat){this.seats.push(s);this.sizes.push(lengths[s]);}if(hidden){this.seats.push(4);this.sizes.push(6);}let cards=bits(unseen),counts=Array(16).fill(0),remain=this.sizes.slice();
  for(let c of cards){let m=0;for(let g=0;g<this.seats.length;g++)if((partnerMask===null
    ? this.seats[g]===4||!(voids[this.seats[g]]&(1<<cat(c,tr)))
    : this.seats[g]===4 ? !(partnerMask&(1n<<BigInt(c)))
    : ((this.seats[g]===(seat+2)%4)===!!(partnerMask&(1n<<BigInt(c))))&&!(voids[this.seats[g]]&(1<<cat(c,tr)))))m|=1<<g;this.allow[c]=m;if(!m)return false;counts[m]++;}if(!this.feasible(remain,counts))return false;
  for(let i=cards.length-1;i>0;i--){let j=this.rng.n(i+1);[cards[i],cards[j]]=[cards[j],cards[i]];}cards.sort((a,b)=>pop(this.allow[a])-pop(this.allow[b]));let grouped=this.seats.map(()=>[]);
  for(let c of cards){let m=this.allow[c];counts[m]--;let opts=[],weights=[],total=0;for(let g=0;g<this.seats.length;g++)if(remain[g]&&(m&(1<<g))){remain[g]--;let ok=this.feasible(remain,counts);remain[g]++;if(ok){opts.push(g);weights.push(remain[g]);total+=remain[g];}}if(!opts.length)return false;let q=this.rng.n(total),j=0;while(q>=weights[j])q-=weights[j++];let g=opts[j];remain[g]--;grouped[g].push(c);}
  grouped.forEach((a,g)=>a.forEach(c=>{this.slots.push(c);this.groups.push(g);}));this.mix(512);return this.slots.length===cards.length;
 }
 mix(steps){let N=this.slots.length;if(N<2)return;for(let z=0;z<steps;z++){this.proposed++;let k=2;if(N>=3&&this.rng.n(4)===0)k=Math.min(N,3+this.rng.n(2));let ix=[];for(let j=0;j<k;j++){let q;do{q=this.rng.n(N);}while(ix.includes(q));ix.push(q);}let ok=ix.every((i,j)=>!!(this.allow[this.slots[i]]&(1<<this.groups[ix[(j+1)%k]])));if(!ok)continue;let last=this.slots[ix[k-1]];for(let j=k-1;j>0;j--)this.slots[ix[j]]=this.slots[ix[j-1]];this.slots[ix[0]]=last;this.accepted++;}}
 fill(s){this.seats.forEach(g=>{if(g<4)s.h[g]=[];});if(this.seats.length===4){s.nest=0n;s.nestpts=0;}this.slots.forEach((c,i)=>{let seat=this.seats[this.groups[i]];if(seat===4){s.nest|=1n<<BigInt(c);s.nestpts+=point(c);}else s.h[seat].push(c);});for(let seat of this.seats){if(seat===4)continue;let h=s.h[seat];for(let i=h.length-1;i>0;i--){let j=this.rng.n(i+1);[h[i],h[j]]=[h[j],h[i]];}}}
}
function copy(s){return {...s,h:s.h.map(a=>a.slice()),t:{c:s.t.c.slice(),s:s.t.s.slice()},points:s.points.slice()};}
function complete(world,seat,first){let s=copy(world),rootteam=seat%2,c=first;while(true){let at=s.h[seat].indexOf(c);if(at<0)throw Error('simulation card absent');s.h[seat].splice(at,1);s.t.c.push(c);s.t.s.push(seat);s.played|=1n<<BigInt(c);if(s.t.c.length===4){let w=s.t.s[win(s.t,s.tr)];s.points[w%2]+=s.t.c.reduce((a,c)=>a+point(c),0);s.t={c:[],s:[]};seat=w;if(s.h.every(h=>!h.length)){s.points[w%2]+=s.nestpts;break;}}else seat=(seat+1)%4;c=solmove(s.h[seat],s.t,s.tr,s.played,seat===s.bidder?s.nest:0n,seat);}let b=s.bidder%2;if(s.points[b]<s.bid)s.points[b]=-s.bid;return s.points[rootteam]-s.points[1-rootteam];}
function choose(v){let {h,tc,ts,tr,seat,bidder,bid,points,voids}=v,played=BigInt(v.played),nest=BigInt(v.nest),seed=BigInt(v.seed),samples=h.length<=3?256:128;
 let partnerMask=Object.prototype.hasOwnProperty.call(v,'partnerMask')?BigInt(v.partnerMask):null;
 // null means unauthorized/absent; 0n means an eligible partner has no cards.
 if(partnerMask!==null){let n=(bits(played).length-tc.length)/4,expected=10-n-(ts.includes((seat+2)%4)?1:0);if(partnerMask<0n||(partnerMask&~FULL)||(partnerMask&(played|nest|mask(h)))||bits(partnerMask).length!==expected||bits(partnerMask).some(c=>voids[(seat+2)%4]&(1<<cat(c,tr))))return{card:-8,out:Array(12).fill(0)};}
 let base={h:[[],[],[],[]],t:{c:tc.slice(),s:ts.slice()},tr,bidder,bid,points:points.slice(),played,nest,nestpts:bits(nest).reduce((a,c)=>a+point(c),0)};base.h[seat]=h.slice();let L=legal(h,base.t,tr),reference=solmove(h,base.t,tr,played,nest,seat),out=Array(12).fill(0);if(L.length===1)return{card:L[0],out};let completed=(bits(played).length-tc.length)/4,lengths=Array(4).fill(10-completed);ts.forEach(s=>lengths[s]--);if(lengths[seat]!==h.length)return{card:-2,out};let sampler=new Sampler(seed);if(!sampler.init(FULL&~(played|nest|mask(h)),seat,lengths,voids,tr,seat!==bidder,partnerMask))return{card:-3,out};let sum=L.map(()=>0),dsq=L.map(()=>0),ri=L.indexOf(reference);
 for(let i=0;i<samples;i++){sampler.mix(64);let world=copy(base);sampler.fill(world);let all=played;if(bits(world.nest).length!==6||(all&world.nest))return{card:-4,out};all|=world.nest;for(let s=0;s<4;s++){let hm=mask(world.h[s]);if(world.h[s].length!==lengths[s]||bits(hm).length!==lengths[s]||(all&hm))return{card:-5,out};all|=hm;if(world.h[s].some(c=>voids[s]&(1<<cat(c,tr))))return{card:-6,out};}if(all!==FULL)return{card:-7,out};let vals=L.map((c,j)=>{let n=complete(world,seat,c);sum[j]+=n;return n;});vals.forEach((n,j)=>{let d=n-vals[ri];dsq[j]+=d*d;});}
 let best=ri,bestadv=0;L.forEach((c,j)=>{let d=(sum[j]-sum[ri])/samples,se=Math.sqrt(Math.max(0,dsq[j]/samples-d*d)/Math.max(1,samples-1)),adjusted=d-.5-.5*se;if(adjusted>bestadv){bestadv=adjusted;best=j;}});out.splice(0,8,samples,L.length,reference,sum[ri]/samples,sum[best]/samples,sampler.accepted,sampler.proposed,Number(L[best]!==reference));return{card:L[best],out};
}
function trump(h){let scores=colors.map((_,c)=>{let suited=h.filter(x=>col(x)===c&&x!==44),n=suited.length,ranks=new Set(suited.map(rank));let controls=(ranks.has(15)?5:0)+(ranks.has(14)?4:0)+(ranks.has(13)?2.5:0)+(ranks.has(12)?1.5:0);return n*10+Math.max(0,n-4)*4+controls*4+suited.reduce((a,x)=>a+point(x),0)*.55;});let best=0;for(let c=1;c<4;c++)if(scores[c]>scores[best]||(scores[c]===scores[best]&&h.filter(x=>col(x)===c).length>h.filter(x=>col(x)===best).length))best=c;return best;}
function ceiling(h,ctx){let lens=colors.map((_,c)=>h.filter(x=>col(x)===c).length),honors=colors.map((_,c)=>h.filter(x=>col(x)===c&&[15,14,13,12,10].includes(rank(x))).length),t=trump(h),v=h.reduce((a,c)=>a+point(c),0)*.62+lens[t]*8+honors[t]*7+lens.filter(n=>!n).length*10+lens.filter(n=>n<=1).length*3+(h.includes(45)?20:0)+(h.includes(44)?10:0);if(v<62)return 0;let cap=70+Math.floor(Math.max(0,v-62)*1.35/5)*5,high=ctx.high??65,partner=(ctx.seat+2)%4;if(high<=90&&v>=68)cap=Math.max(cap,high+5);if(high<=110&&v>=76)cap=Math.max(cap,high+5);if(ctx.history.some(([s,b])=>s===partner&&b>0))cap+=5;let mine=ctx.scores[ctx.seat%2],theirs=ctx.scores[1-ctx.seat%2];if(theirs-mine>=100)cap+=5;if(mine>=425&&mine>theirs)cap-=5;return Math.max(0,Math.min(200,Math.floor(cap/5)*5));}
function discard(h,n,tr){let lens=colors.map((_,c)=>h.filter(x=>col(x)===c&&x!==44).length),strong=h.filter(x=>cat(x,tr)===tr).length>=6||h.includes(45)||h.includes(44);let keep=x=>{if(x===45)return 20000;if(x===44)return 18000;if(cat(x,tr)===tr)return 5000+rank(x)*8+point(x)*20;let ln=lens[col(x)]||0,r=rank(x),p=point(x),control=r===15?1800:r===14?1150:r===13?550:r===12?260:0,counter=p*28;if(p&&ln<=2&&![15,14].includes(r))counter-=strong?260:120;let vp=p===0?(ln===1?900:ln===2?520:ln===3?140:0):0;return control+counter+r*2+ln*45-vp;};return h.slice().sort((a,b)=>keep(b)-keep(a)).slice(0,h.length-n);}
const api={choose,solmove,legal,mask,colors,point,rank,col,cat,trump,ceiling,discard,RNG};if(typeof module!=='undefined')module.exports=api;root.X1Core=api;
})(globalThis);
