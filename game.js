/* House of Rooks loader (GitHub). Pulls the last complete game.js blob, then applies 430 patch. */
(function () {
  var PINNED = 'https://cdn.jsdelivr.net/gh/jeromeleegriffin/Griffin-House-of-Rooks@d7c5e7645176ff114f3f11db5e1d7df9ac25bdf8/game.js';
  document.write('<script src="' + PINNED + '"><\/script>');
  document.write('<script src="hor-430-patch.js?v=430"><\/script>');
})();
