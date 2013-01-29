var
  _ = require('underscore'),
  adjacent = require('../lib/adjacent'),
  memoize = require('lru-memoize'),
  set = require('../lib/set'),
  words = require('../data/words'); // not a library - this is the dictionary

/**
 * Words is an array of arrays, such like:
 * [
 *   string (actual word),
 *   array (canonical array of letters in that word)
 *   frequency (Number, integer between 0 and MAX_FREQUENCY)
 * ]
 */

var getMinFrequencyWords = memoize(
  /**
   * Get dictionary filtered for how common the words are
   * @param {Number} minFrequency positive integer <= MAX_FREQUENCY
   * @return {Array} word structure
   */
  function(minFrequency) {
    return _.filter(words, function(w){ return w[2] >= minFrequency; })
  }
);

/**
 * Comparator for length of strings
 * @param {String}
 * @param {String}
 * @return {Number}
 */
function byLengthDescending(a, b) {
  return b.length - a.length;
}

/**
 * Determine possible words on this board, filtered by how
 * common those words are
 *
 * @param {Array} board string representing board
 * @param {Number} minFrequency how common the words should be, positive integer <= MAX_FREQUENCY
 * @return {Array} word structures
 */
var getWordStructsForBoard = memoize(function(board, minFrequency) {
  var boardSet = set.getCanonical(board);
  var words = getMinFrequencyWords(minFrequency);
  return _.filter(words, function(struct) {
    return set.isSubset(boardSet, struct[1]);
  });
});

/**
 * Given a string representing a board, return a map of
 * where each letter is used on the board
 * e.g. given "aba", return { "a": [0, 2], "b": [1] }
 * @param {String} board
 * @return {Array} as described above
 */
var getBoardPositionMap = memoize(function(board) {
  var boardMap = {};
  for (var i = 0; i < board.length; i += 1) {
    var c = board[i];
    if (!(c in boardMap)) {
      boardMap[c] = [];
    }
    boardMap[c].push(i);
  }
  return boardMap;
});

/**
 * Main work of this service. Find moves on this board, using words
 * that are at least as frequent as minimum specified frequency,
 * ordered by score
 * @param {String} board
 * @param {Number} minFrequency
 * @return {Array} of [bitMask, "word"] sorted by score
 */
var getMovesForBoard = memoize(function(board, minFrequency) {
  var wordStructs = getWordStructsForBoard(board, minFrequency);
  var boardPositionMap = getBoardPositionMap(board);
  var moves = [];
  wordStructs.forEach(function(w) {
    var letterCounts = _.countBy(w[1], _.identity);
    var posCombos = [];
    // given a letter, get all combinations of positions on that board, filtered by the combinations
    // that have the number of letters we need
    // for instance, if we want two "a", and "a" appears twice on the board, we'll get one combo
    // if we want two "a", and "a" appears four times on the board, we'll get six combos
    for (c in letterCounts) {
      var neededCount = letterCounts[c];
      var combos = kCombinations(boardPositionMap[c], neededCount);
      posCombos.push(combos);
    }
    // flatten combos out into possible board positions for this word
    var flatCombos = flattenCombos(posCombos);
    flatCombos.forEach(function(positions) {
      var bitMask = getBitMaskForPositions(positions);
      var capturedBitMask = getCapturedBitMask(bitMask);
      moves.push([bitMask, w[0], capturedBitMask]);
    });
  });
  return moves.sort(byScore);
});

/**
 * Given a sorted list of board positions like
 *   [ 10, 11, 15 ]
 * Produce a number, whose on bits in binary correspond to these positions
 * @param {Array} positions simple array of positive integers <= 24
 * @return {Number}
 */
function getBitMaskForPositions(positions) {
  var bitMask = 0;
  positions.forEach(function(p) {
    bitMask |= (1 << p);
  });
  return bitMask;
}

/**
 * Comparator for moves
 * A move is an array of [ bitMask, "string" ]
 * The bitmask represents the positions used, by turning on those bits 0-24
 * @param {Array} a move
 * @param {Array} b move
 * @return {Number}
 */
function byScore(a, b) {
  return (b[2] - a[2]) || (b[1].length - a[1].length);
}

/**
 * Figure out how many squares are captured
 * For now, we do not consider other moves on the board, only this one in isolation.
 *
 * We calculate it simply. the 'adjacent' library has a bitmask of all adjacent positions
 * for every position. For each position, we check if this position was taken in this move.
 * If so we then check if enough adjacent positions were taken in this move.
 * @param {Array} move
 * @return {Number} number of captured squares
 */
function getCapturedBitMask(moveBitMask) {
  var capturedBitMask = 0;
  adjacent.forEach(function(a) {
    if ((a[0] & moveBitMask) && ((a[1] & moveBitMask) == a[1])) {
      capturedBitMask |= a[0];
    }
  });
  return capturedBitMask;
}

/**
 * Count the number of 'on' bits for a number in binary
 * @param {Number} x
 * @return {Number}
 */
function countBits(x) {
  var result = 0;
  // strip one set bit per iteration
  while (x != 0) {
    x &= x-1;
    result++;
  }
  return result;
}

/**
 * Given the possible combinations of board positions, produce a flattened list.
 * i.e. if the board is "abcb" and the word is "cab", the position combos should be:
 *    [ [ 2 ], [ 0 ], [ 1, 3 ] ]
 * and the flattened combos should be:
 *    [ [ 1, 2, 3 ], [ 1, 3, 4 ] ]
 * @param {Array} posCombos as described above
 * @return {Array} flattened combinations as described above
 */
function flattenCombos(posCombos) {
  var results = [];
  function pc(i, curr) {
    var opts = posCombos[i];
    for (var j = 0; j < opts.length; j++) {
      var myCurr = Array.prototype.slice.call(curr);
      myCurr = myCurr.concat(opts[j]);
      if (i + 1 == posCombos.length) {
        results.push(myCurr.sort());
      } else {
        pc(i + 1, myCurr);
      }
    }
  }
  if (posCombos.length > 0) {
    pc(0, []);
  }
  return results;
}


/**
 * Given a set of items, obtain all combinations of a certain length
 * @param {Array} set
 * @param {Number} count
 */
function kCombinations(set, count) {
  var results = [];
  function kc(count, start, curr) {
    for (var i = start; i < set.length; i++) {
      var myCurr = Array.prototype.slice.call(curr);
      myCurr.push(set[i]);
      if (count === 1) {
        results.push(myCurr.sort());
      } else {
        kc(count - 1, i + 1, myCurr)
      }
    }
  }
  if (count !== 0) {
    kc(count, 0, []);
  }
  return results;
}

exports.getMovesForBoard = getMovesForBoard;
exports.getBitMaskForPositions = getBitMaskForPositions;

exports.MAX_FREQUENCY = 24;
exports.DEFAULT_FREQUENCY = 15;

exports.BOARD_SIZE = 25;