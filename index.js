const query = require('graphqurl').query;
// var equal = require('deep-equal');

const requests = {
  simple: {
    query: `subscription {
      profile (where: {id: {_eq: 1}}) {
        name
        last_update_time
      }
    }`,
    responses: [
      { profile: [{ name: 'user1' }] },
      { profile: [{ name: 'user2' }] },
      { profile: [{ name: 'user3' }] },
      { profile: [{ name: 'user4' }] },
      { profile: [{ name: 'user5' }] },
      { profile: [{ name: 'user6' }] },
      { profile: [{ name: 'user7' }] },
      { profile: [{ name: 'user8' }] },
      { profile: [{ name: 'user9' }] },
      { profile: [{ name: 'user10' }] },
    ],
  },
};

const url = 'https://lambda-hge-test.herokuapp.com/v1alpha1/graphql';

exports.startSubscribe = (req, res) => {
  /*
   * Grab URL params
   * Choose from request object
   * Match against request object and note down the time
   * Log results as a mutation in the database
   */
  const queryType = 'simple';
  if (req.query.id) {
    console.log(`L51: Running with ID ${req.query.id}`);
  }

  if (!res) {
    // This means we're running this locally
    // So load all the parameters here
    res = { send: () => 0 };
  }

  let responseNumber = 1;
  const responses = [];
  query({
    query: requests[queryType].query,
    endpoint: url,
  })
    .then(
      (obs) => {
        obs.subscribe(
          (event) => {
            const name = event.data.profile[0].name;
            // console.log('EVENT: ', JSON.stringify(event, null, 2));
            // responseNumber = 1 may have stale info from prev run
            if (responseNumber > 1) {
              const curr = new Date(Date.now());
              const updateTimeStr = event.data.profile[0].last_update_time;
              const updateTime = Date.parse(updateTimeStr);
              const diff = (curr - updateTime) / 1000;
              responses.push({
                value: name,
                recvd_time: curr.toUTCString(),
                diff,
              });
            }
            if ((responseNumber > 1) && (name === 'user1')) {
              let id = 'local';
              if (req) {
                id = req.query.id;
              }

              const insertLog = (retry) => {
                if (retry) {
                  console.log(`L83: this is a ${retry} retry of the insert...`);
                } else {
                    console.log('L85: inserting log...');
                    console.log(responses);
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
                    log: responses,
                  },
                  endpoint: url,
                }).then(
                  () => {
                    if (retry) {
                      console.log(`L98: Retry ${retry} inserted`);
                    } else {
                      console.log('L98: Inserted');
                    }
                    res.send(JSON.stringify(responses));
                  },
                )
                  .catch(
                    (error) => {
                      console.error('L102', error);
                      if (error.networkError && (error.networkError.statusCode > 400)) {
                        // Retry till I die
                        console.log('retrying...');
                        if (!retry) {
                          setTimeout(insertLog, 200, 1);
                        } else {
                          setTimeout(insertLog, 200, (retry + 1));
                        }
                      } else {
                        console.error('L102: Not inserting log: ', error);
                        res.send(JSON.stringify(responses));
                      }
                    },
                  );
              };
              insertLog();
            }
            responseNumber += 1;
          },
          (error) => {
            console.error('ERROR: ', error);
            res.send(500, `ERROR: ${error.toString()}`);
          },
        );
      },
    )
    .catch(
      (error) => {
        console.error('SUBSCRIBE-ERROR: ', error);
        res.send(500, `SUBSCRIBE-ERROR: ${error.toString()}`);
      },
    );
};
