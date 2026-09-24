function setLandscapeTab(showLast5) {
  ltShowLast5 = !!showLast5;
  const tabTrick = $('ltTabTrick');
  const tabLast = $('ltTabLast5');
  const viewTrick = $('ltViewTrick');
  const viewLast = $('ltViewLast5');
  if (tabTrick) tabTrick.classList.toggle('active', !ltShowLast5);
  if (tabLast) tabLast.classList.toggle('active', !!ltShowLast5);
  if (viewTrick) viewTrick.classList.toggle('hidden', !!ltShowLast5);
  if (viewLast) viewLast.classList.toggle('hidden', !ltShowLast5);
  if (ltShowLast5) {
    try { renderLandscapeLast5(); } catch (e) { console.error(e); }
  }
}
