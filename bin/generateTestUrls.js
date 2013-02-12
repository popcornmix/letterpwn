// generate urls for testing (for instance, with siege)
var _ = require('underscore'),
    lp = require('../lib/letterpress.js');


var frequencyNames = [
  { minFrequency:18, label:'basic'},
  { minFrequency:15, label:'common' },
  { minFrequency:12, label:'highbrow'},
  { minFrequency:9, label:'obscure'},
  { minFrequency:0, label:'sesquipedalian'}
];

var protoHostPort = process.argv[2] ? process.argv[2] : 'http://localhost:3000';

for (var i = 0; i <= 1000; i++) {
  params = {};
  params.board = '';
  for (var c = 0; c <= 24; c++) {
    params.board += String.fromCharCode(Math.floor(Math.random()*26+97));
  }
  params.minFrequency = frequencyNames[parseInt(Math.random()*frequencyNames.length, 10)].minFrequency;
  params.oursBitMask = parseInt(Math.random()*lp.MAX_BITMASK, 10);
  params.theirsBitMask = parseInt(Math.random()*lp.MAX_BITMASK, 10);
  var query = _.pairs(params).map(function(pair) { return pair.join('=')}).join('&');

  var url = protoHostPort + '/api?' + query;
  console.log(url);
}
