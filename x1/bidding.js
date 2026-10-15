/* X1 partner bidding experiment PF-20261012. Own/public input only. */
(function(root){'use strict';
const C=typeof module!=='undefined'?require('./core.js'):root.X1Core;
const ALL=Array.from({length:46},(_,i)=>i),R=ALL.map(C.rank),P=ALL.map(C.point),COL=ALL.map(C.col);
const cat=(c,t)=>c>=44?t:COL[c];
const beat=(a,b,l,t)=>cat(a,t)!==cat(b,t)?cat(a,t)===t||(cat(b,t)!==t&&cat(a,t)===l):R[a]>R[b];
// Independent numeric implementation of the unchanged Sol7 continuation.
// It is used only to evaluate hypothetical contracts, never to play real cards.
function move(h,tc,ts,tr,seen,nest,seat){
 const led=tc.length?cat(tc[0],tr):-1,follow=h.filter(c=>cat(c,tr)===led),L=follow.length?follow:h;
 const unknown=ALL.filter(c=>!h.includes(c)&&!seen[c]&&!nest.includes(c)&&!tc.includes(c));
 const low=a=>a.reduce((a,b)=>((cat(b,tr)===tr?1000000:0)+P[b]*2000+R[b])<((cat(a,tr)===tr?1000000:0)+P[a]*2000+R[a])?b:a);
 const np=a=>{const b=a.filter(c=>c<44);return b.length?b:a;};
 if(!tc.length){const trump=L.filter(c=>cat(c,tr)===tr),plain=trump.filter(c=>c<44),side=L.filter(c=>cat(c,tr)!==tr);
  if(trump.length>=4&&unknown.filter(c=>cat(c,tr)===tr).length>=2&&plain.length)return low(plain);
  if(side.length){let best=[],br=-1;for(let color=0;color<4;color++){const g=side.filter(c=>COL[c]===color),r=Math.max(...g.map(c=>R[c]));if(g.length>best.length||(g.length===best.length&&r>br)){best=g;br=r;}}
   const top=best.filter(c=>!unknown.some(x=>beat(x,c,COL[c],tr))),zero=best.filter(c=>!P[c]);return low(top.length?top:zero.length?zero:best);}
  return low(np(L));
 }
 let wi=0;for(let i=1;i<tc.length;i++)if(beat(tc[i],tc[wi],led,tr))wi=i;
 const val=tc.reduce((a,c)=>a+P[c],0),wins=L.filter(c=>beat(c,tc[wi],led,tr)),zero=L.filter(c=>!P[c]);
 if(ts[wi]===(seat+2)%4){if(tc.length===3){const f=L.filter(c=>P[c]&&c<44&&!beat(c,tc[wi],led,tr));if(f.length)return f.reduce((a,b)=>P[b]>P[a]||(P[b]===P[a]&&R[b]<R[a])?b:a);}return low(np(zero.length?zero:L));}
 if(wins.length){if(tc.length===3||val>=10)return low(np(wins));const cheap=wins.filter(c=>cat(c,tr)!==tr&&!P[c]);if(cheap.length)return cheap.reduce((a,b)=>R[b]<R[a]?b:a);}
 return low(np(zero.length?zero:L));
}
function contract(hands,nest,bidder){
 const hs=hands.map(h=>h.slice()),all=hs[bidder].concat(nest),tr=C.trump(all);hs[bidder]=C.discard(all,6,tr);
 const buried=all.filter(c=>!hs[bidder].includes(c)),seen=Array(46).fill(false),points=[0,0];let lead=bidder;
 for(let k=0;k<10;k++){const tc=[],ts=[];for(let j=0;j<4;j++){const s=(lead+j)%4,c=move(hs[s],tc,ts,tr,seen,s===bidder?buried:[],s);hs[s].splice(hs[s].indexOf(c),1);tc.push(c);ts.push(s);seen[c]=true;}
  let wi=0;for(let j=1;j<4;j++)if(beat(tc[j],tc[wi],cat(tc[0],tr),tr))wi=j;lead=ts[wi];points[lead%2]+=tc.reduce((a,c)=>a+P[c],0);}
 points[lead%2]+=buried.reduce((a,c)=>a+P[c],0);return points;
}
function validate(v){
 const keys=['h','seat','dealer','high','bidder','history','scores','passed','limit','target','revealed','moon'];
 if(Object.keys(v).some(k=>!keys.includes(k)))throw Error('unauthorized bidding input');
 if(v.h.length!==10||new Set(v.h).size!==10||v.h.some(c=>!Number.isInteger(c)||c<0||c>45))throw Error('invalid own hand');
 if(![v.seat,v.dealer].every(s=>Number.isInteger(s)&&s>=0&&s<4)||!Number.isInteger(v.bidder)||v.bidder< -1||v.bidder>3)throw Error('invalid seats');
 if(!Array.isArray(v.passed)||v.passed.length!==4||v.passed.some(p=>typeof p!=='boolean')||v.scores.length!==2||v.scores.some(x=>!Number.isFinite(x)))throw Error('invalid public state');
 if(!Number.isFinite(v.high)||v.high%5||v.high<65||v.high>200||!Number.isFinite(v.limit)||v.limit>200||!Number.isFinite(v.target)||v.target<=0)throw Error('invalid contract');
 if(v.revealed!==null&&(!Number.isInteger(v.revealed)||v.revealed<0||v.revealed>45||v.h.includes(v.revealed)))throw Error('invalid public reveal');
 if(typeof v.moon!=='boolean')throw Error('invalid moon setting');
 if(!Array.isArray(v.history)||v.history.some(x=>!Array.isArray(x)||x.length!==2||!Number.isInteger(x[0])||x[0]<0||x[0]>3||!Number.isFinite(x[1])||x[1]<0||x[1]>200))throw Error('invalid public history');
}
function rngFor(v){let x=2166136261;for(const c of JSON.stringify([v.h,v.seat,v.dealer,v.high,v.bidder,v.history,v.scores,v.passed,v.limit,v.target,v.revealed,v.moon]))x=Math.imul(x^c.charCodeAt(0),16777619)>>>0;return n=>{x=(x+0x6D2B79F5)>>>0;let t=x;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)%n;};}
function auction(hands,v,raise,shifts){
 const active=v.passed.map(x=>!x),hist=v.history.filter(x=>x[1]>0).map(x=>x.slice());let high=v.high,bidder=v.bidder;
 if(raise){high=typeof raise==='number'?raise:high+5;bidder=v.seat;hist.push([v.seat,high]);if(v.moon&&high===200)return {bidder,bid:high};}else active[v.seat]=false;
 for(let cur=(v.seat+1)%4,guard=0;guard<160;guard++,cur=(cur+1)%4){
  if(bidder>=0&&active.filter(Boolean).length<=1)return {bidder,bid:high};
  if(!active[cur])continue;
  const cap=Math.min(v.moon&&v.scores[cur%2]<0?195:v.limit,C.ceiling(hands[cur],{seat:cur,high,history:hist,scores:v.scores})+shifts[cur]);
  if(cap>=high+5&&high+5<=v.limit){high+=5;bidder=cur;hist.push([cur,high]);if(v.moon&&high===200)return {bidder,bid:high};}else active[cur]=false;
 }
 throw Error('hypothetical auction did not terminate');
}
function utility(points,a,v){const delta=points.slice();if(points[a.bidder%2]<a.bid)delta[a.bidder%2]=-a.bid;
 const team=v.seat%2,s=v.scores.map((n,i)=>n+delta[i]);if(v.moon&&a.bid===200&&points[a.bidder%2]===200)s[a.bidder%2]=Math.max(s[a.bidder%2],v.target);const terminal=Math.max(...s)>=v.target||Math.min(...s)<=-v.target;
 // Match result dominates a one-hand margin; otherwise use score difference.
 if(terminal)return s[team]===s[1-team]?0:s[team]>s[1-team]?400:-400;
 return Math.max(-399,Math.min(399,s[team]-s[1-team]));
}
// Compare modest legal jumps with the minimum raise on the same sampled deals.
// Opponent cards are sampled from unseen cards, never read from the live game.
function decideJump(v){
 validate(v);
 const cap=C.ceiling(v.h,{seat:v.seat,high:v.high,history:v.history,scores:v.scores}),ask=v.high+5;
 if(cap<ask||ask>v.limit)return {bid:0,cap,reason:'original ceiling',samples:0};
 if(v.bidder<0||v.bidder%2===v.seat%2)return {bid:ask,cap,reason:'minimum raise',samples:0};
 const candidates=[ask,...[10,15,20,25].map(n=>v.high+n).filter(n=>n<=Math.min(cap-10,v.limit,195))];
 if(candidates.length===1)return {bid:ask,cap,reason:'minimum raise; insufficient jump reserve',samples:0};
 const rng=rngFor(v),unknown=ALL.filter(c=>!v.h.includes(c)&&c!==v.revealed),maxima=Array(4).fill(0),rows=[];
 for(const [seat,bid]of v.history)maxima[seat]=Math.max(maxima[seat],bid);
 for(let i=0;i<128;i++){
  const cards=unknown.slice();for(let j=cards.length-1;j>0;j--){const k=rng(j+1);[cards[j],cards[k]]=[cards[k],cards[j]];}
  const n=v.revealed===null?6:5,nest=cards.slice(0,n);if(v.revealed!==null)nest.unshift(v.revealed);
  const hs=[];let offset=n;for(let seat=0;seat<4;seat++){hs[seat]=seat===v.seat?v.h.slice():cards.slice(offset,offset+10);if(seat!==v.seat)offset+=10;}
  const shifts=Array.from({length:4},(_,seat)=>seat===v.seat?0:[-20,0,20][rng(3)]);let w=1;
  for(let seat=0;seat<4;seat++)if(seat!==v.seat&&maxima[seat]){const c=C.ceiling(hs[seat],{seat,high:maxima[seat]-5,history:[],scores:v.scores})+shifts[seat];w*=Math.max(.02,1/(1+Math.exp(Math.max(-40,Math.min(40,(maxima[seat]-c)/10)))));}
  const cache={},values=candidates.map(bid=>{const a=auction(hs,v,bid,shifts),pts=cache[a.bidder]||(cache[a.bidder]=contract(hs,nest,a.bidder));return utility(pts,a,v);});
  rows.push({w,values});
 }
 const sw=rows.reduce((n,r)=>n+r.w,0),neff=sw*sw/rows.reduce((n,r)=>n+r.w*r.w,0);
 const evaluations=candidates.map((bid,j)=>{const gain=rows.reduce((n,r)=>n+r.w*(r.values[j]-r.values[0]),0)/sw,variance=rows.reduce((n,r)=>n+r.w*(r.values[j]-r.values[0]-gain)**2,0)/sw,se=Math.sqrt(variance/Math.max(1,neff-1));return {bid,gain,se};});
 let best=evaluations[0];for(const e of evaluations.slice(1))if(e.gain>2+.5*e.se&&e.gain-.5*e.se>best.gain-.5*best.se)best=e;
 return {bid:best.bid,cap,reason:best.bid===ask?'minimum raise preferred':'evaluated pressure jump',samples:128,evaluations,effectiveSamples:neff};
}
function decide(v){validate(v);const cap=C.ceiling(v.h,{seat:v.seat,high:v.high,history:v.history,scores:v.scores}),ask=v.high+5;
 const baseline=cap>=ask&&ask<=v.limit;if(v.bidder!==(v.seat+2)%4||!baseline)return {bid:baseline?ask:0,cap,reason:'original ceiling',samples:0};
 const rng=rngFor(v),unknown=ALL.filter(c=>!v.h.includes(c)&&c!==v.revealed),maxima=Array(4).fill(0);for(const [s,b]of v.history)maxima[s]=Math.max(maxima[s],b);
 const rows=[];for(let i=0;i<256;i++){const cards=unknown.slice();for(let j=cards.length-1;j>0;j--){const k=rng(j+1);[cards[j],cards[k]]=[cards[k],cards[j]];}const n=v.revealed===null?6:5,nest=cards.slice(0,n);if(v.revealed!==null)nest.unshift(v.revealed);const hs=[];let offset=n;for(let s=0;s<4;s++){hs[s]=s===v.seat?v.h.slice():cards.slice(offset,offset+10);if(s!==v.seat)offset+=10;}
  const shifts=Array.from({length:4},(_,s)=>s===v.seat?0:[-20,0,20][rng(3)]);let w=1;
  for(let s=0;s<4;s++)if(s!==v.seat&&maxima[s]){const c=C.ceiling(hs[s],{seat:s,high:maxima[s]-5,history:[],scores:v.scores})+shifts[s];w*=Math.max(.02,1/(1+Math.exp(Math.max(-40,Math.min(40,(maxima[s]-c)/10)))));}
  const pass=auction(hs,v,false,shifts),raise=auction(hs,v,true,shifts),cache={};const pts=a=>cache[a.bidder]||(cache[a.bidder]=contract(hs,nest,a.bidder));
  const p0=pts(pass),p1=pts(raise);rows.push({w,d:utility(p1,raise,v)-utility(p0,pass,v),made:p1[raise.bidder%2]>=raise.bid,own:raise.bidder===v.seat});
 }
 const sw=rows.reduce((a,r)=>a+r.w,0),avg=f=>rows.reduce((a,r)=>a+r.w*f(r),0)/sw,gain=avg(r=>r.d),neff=sw*sw/rows.reduce((a,r)=>a+r.w*r.w,0),se=Math.sqrt(avg(r=>(r.d-gain)**2)/Math.max(1,neff-1));
 // Risk is included in set penalties and continued bidding; require a modest
 // paired uncertainty margin, without an unconditional 75% success veto.
 const take=gain>2+.5*se;return {bid:take?ask:0,cap,reason:take?'team-value takeover':'support partner',samples:256,gain,se,effectiveSamples:neff,pMake:avg(r=>r.made?1:0),pControl:avg(r=>r.own?1:0)};
}
const api={decide,decideJump,contract,move,validate};if(typeof module!=='undefined')module.exports=api;root.X1Bidding=api;
})(globalThis);
