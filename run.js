var request = require('request');

// Make a 100 requests
for (i=0; i < 1000; i++) {
  request(`https://us-central1-tanmai-test.cloudfunctions.net/startSubscribe?id=${i.toString()}`);
}

// Run the insert function
const shell = require('shelljs');
shell.exec('node insert.js')
