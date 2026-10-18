/* 841: row-aligned chooser navigation; free finger scrolling is unchanged. */
window.HORChoiceRows841={status(grid){const box=grid.getBoundingClientRect(),items=[...grid.children].filter(e=>e.getBoundingClientRect().height&&!e.hasAttribute('data-search-hidden')&&!e.hasAttribute('data-house-legacy-hidden'));const rows=[...new Set(items.map(e=>Math.round(e.getBoundingClientRect().top-box.top+grid.scrollTop)))].sort((a,b)=>a-b),step=rows.length>1?rows[1]-rows[0]:items[0]?.getBoundingClientRect().height||1,count=Math.max(1,Math.floor(grid.clientHeight/step)),total=Math.max(1,Math.ceil(rows.length/count));return{previous:grid.scrollTop>1,next:items.length>0&&items.at(-1).getBoundingClientRect().bottom>box.bottom+1,current:Math.min(total,1+Math.floor(grid.scrollTop/step/count)),total};},move(grid,direction){
 const box=grid.getBoundingClientRect(),items=[...grid.children].filter(e=>e.getBoundingClientRect().height&&!e.hasAttribute('data-search-hidden')&&!e.hasAttribute('data-house-legacy-hidden'));
 const rows=[...new Set(items.map(e=>Math.round(e.getBoundingClientRect().top-box.top+grid.scrollTop)))].sort((a,b)=>a-b);if(!rows.length)return;
 const step=rows.length>1?rows[1]-rows[0]:items[0].getBoundingClientRect().height;
 const count=Math.max(1,Math.floor(grid.clientHeight/step)),current=Math.max(0,rows.findLastIndex(y=>y<=grid.scrollTop+1));
 if(!grid.dataset.rowBasePadding841)grid.dataset.rowBasePadding841=String(parseFloat(getComputedStyle(grid).paddingBottom)||0);
 const oldExtra=Number(grid.dataset.rowExtraPadding841)||0,baseMax=Math.max(0,grid.scrollHeight-grid.clientHeight-oldExtra),extra=Math.ceil(baseMax/step)*step-baseMax;
 grid.dataset.rowExtraPadding841=String(extra);grid.style.paddingBottom=(Number(grid.dataset.rowBasePadding841)+extra)+'px';
 const next=Math.max(0,Math.min(rows.length-1,current+direction*count));
 grid.scrollTo({top:rows[next],behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}};

document.getElementById('hor-room-code')?.addEventListener('input',e=>{e.target.removeAttribute('aria-invalid');document.getElementById('joinFeedback841').hidden=true;});
