var start = process.hrtime();

var elapsed_time = function(note) {
    var precision = 3; // 3 decimal places
    var elapsed = process.hrtime(start)[1] / 1000000; // divide by a million to get nano to milli
    console.log(process.hrtime(start)[0] + " s, " + elapsed.toFixed(precision) + " ms - " + note); // print message + time
    var elapsedS = (process.hrtime(start)[0] * 1000 + elapsed);

    start = process.hrtime(); // reset the timer

    return elapsedS;
}

var query = require('graphqurl').query;
var url = 'https://lambda-hge-test.herokuapp.com/v1alpha1/graphql';

var mutation = `
  mutation($name: String!) {
    update_profile(_set: {name: $name}, where: {id: {_eq: 1}}) {
      affected_rows
    }
  }`;

var sleep = require('sleep');
let i=2;
function mutate() {
  if (i < 11) {
    query({ query: mutation, endpoint: url, variables: {name: 'user'+i.toString()} })
      .then(
        (data) => {
          console.log(data);
          i = i + 1;
          setTimeout(mutate, 1000);
        }
      )
      .catch(error => {console.error(error); console.log(error.networkError.statusCode);});
  }
  else {
    console.log('we\'re done here.');
    // Reset user
    query({ query: mutation, endpoint: url, variables: {name: 'user1'} })
      .then(
        (data) => {
          console.log(data);
        }
      )
      .catch(
        (error) => {
          console.error(error);
        });
  }
}

mutate();
