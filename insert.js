var query = require('graphqurl').query;
var url = 'https://lambda-hge-test.herokuapp.com/v1alpha1/graphql';

var mutation = `
  mutation($name: String!) {
    update_profile(_set: {name: $name}, where: {id: {_eq: 1}}) {
      affected_rows
    }
  }`;

let i=2;
function mutate() {
  // run 9 queries
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
    // Reset user - run 1 query
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
