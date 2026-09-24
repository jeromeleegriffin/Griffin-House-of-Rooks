/* House of Rooks loader — splits game.js so GitHub updates stay under API size */
const HOR_GAME_PARTS = ['game-p01.js', 'game-p02.js', 'game-p03.js', 'game-p04.js', 'game-p05.js', 'game-p06.js', 'game-p07.js', 'game-p08.js', 'game-p09.js', 'game-p10.js', 'game-p11.js', 'game-p12.js', 'game-p13.js', 'game-p14.js', 'game-p15.js', 'game-p16.js', 'game-p17.js', 'game-p18.js'];
(function loadHorParts() {
  var v = '430';
  for (var i = 0; i < HOR_GAME_PARTS.length; i++) {
    document.write('<script src="' + HOR_GAME_PARTS[i] + '?v=' + v + '"><\/script>');
  }
})();
