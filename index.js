var query = require('graphqurl').query;
var equal = require('deep-equal');

var requests = {
  simple: {
    query: `subscription {
      profile (where: {id: {_eq: 1}}) {
        name
      }
    }`,
    responses: [
      { profile: [{ name: 'user1'}]},
      { profile: [{ name: 'user2'}]},
      { profile: [{ name: 'user3'}]},
      { profile: [{ name: 'user4'}]},
      { profile: [{ name: 'user5'}]},
      { profile: [{ name: 'user6'}]},
      { profile: [{ name: 'user7'}]},
      { profile: [{ name: 'user8'}]},
      { profile: [{ name: 'user9'}]},
      { profile: [{ name: 'user10'}]}
    ]
  }
};

var start = process.hrtime();

var elapsed_time = function(note) {
    var precision = 3; // 3 decimal places
    var elapsed = process.hrtime(start)[1] / 1000000; // divide by a million to get nano to milli
    // console.log(process.hrtime(start)[0] + " s, " + elapsed.toFixed(precision) + " ms - " + note); // print message + time
    var elapsedS = (process.hrtime(start)[0] * 1000 + elapsed);

    start = process.hrtime(); // reset the timer

    return elapsedS;
}

const url = 'https://lambda-hge-test.herokuapp.com/v1alpha1/graphql';

exports.startSubscribe = (req, res) => {

  /*
   * Grab URL params
   * Choose from request object
   * Match against request object and note down the time
   * Log results as a mutation in the database
   */
  const queryType = 'simple'
  if (req.query.id) {
    console.log(`L51: Running with ID ${req.query.id}`);
  }

  if (!res) {
    // This means we're running this locally
    // So load all the parameters here
    res = { send: () => { return 0; } };
  }

  let responseNumber = 0;
  const responses = [];
  // Start subscribing
  query({
    query: requests[queryType].query,
    endpoint: url,
  })
  .then(
    (obs) => {
      obs.subscribe(
        (event) => {
          // console.log('EVENT: ', JSON.stringify(event, null, 2));
          if (responseNumber <= (requests[queryType].responses.length - 1)) {
            responses.push({
              expectedResponse: (equal(event.data, requests[queryType].responses[responseNumber])),
              time: elapsed_time(responseNumber.toString())
            });
          }
          if (responseNumber == (requests[queryType].responses.length - 1)) {
            // console.log(responses);
            let id = 'local';
            if (req) {
              id = req.query.id;
            }

            const insertLog = (retry) => {
              if (retry) {
                console.log(`L83: this is a ${retry} retry of the insert...`);
              }
              query({
                query: `mutation ($log: json!) {
                  insert_logs(
                    objects: [{id: "${id}", log: $log }],
                    on_conflict: {
                      action: update,
                      constraint: logs_pkey
                    }) {
                    affected_rows
                  }
              }`,
                variables: {
                  log: responses
                },
                endpoint: url
              }).then(
                () => {
                  if (retry) {
                    console.log(`L98: Retry ${retry} inserted`);
                  } else {
                    console.log(`L98: Inserted`);
                  }
                  res.send(JSON.stringify(responses));
                })
                .catch(
                (error) => {
                  console.error('L102', error);
                  if (error.networkError && (error.networkError.statusCode > 400)) {
                    // Retry till I die
                    console.log('retrying...');
                    if (!retry) {
                      setTimeout(insertLog, 200, 1);
                    } else {
                      setTimeout(insertLog, 200, (retry+1));
                    }
                  } else {
                    console.error('L102: Not inserting log: ', error);
                    res.send(JSON.stringify(responses));
                  }
                });
            };
            insertLog();
          }
          responseNumber += 1;
        },
        (error) => {
          console.error('ERROR: ', error);
          res.send(500, 'ERROR: '+ error.toString());
        }
      );
    })
  .catch(
    (error) => {
      console.error('SUBSCRIBE-ERROR: ', error);
      res.send(500, 'SUBSCRIBE-ERROR: '+ error.toString());
    });
};
