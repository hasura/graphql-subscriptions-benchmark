# subscription-benchmark

This is a load generator for GraphQL subscriptions. 


### Build:

- Run `npm install` to install deps
- Run `npm run compile` to compile tsc which will output the files in `dist` directory.


### Configuration:

```yaml
# query to be subscribed
query: |
  subscription ($id: Int!) {
    test(where: {id: {_eq: $id}}) {
      id
      name
    }
  }
# no of connections per seccond
timePeriod: 2
# variables that needs to set while subscribing
variables:
  id: '1'
# headers that needs to be set while creating the connection
headers: []
template:
  range:
    # start vaule of the variables or headers
    start: 1
    # end value of the variables or headers
    end: 10
  # headers that needs to be templated using the range start and end
  headers: []
  # variables that needs to be templated using the range start and end
  variables:
    - id
```

### Setup:

- Create the `events` table using knex migrate. Run `knex migrate:latest`
- Run the benchmark tool

    ```bash
    PG_CONNECTION_STRING=<posgtres_connection_url> ENDPOINT=<graphql_endpoint> LABEL=<unique_label> CONFIG_FILE_PATH=<path_to_config_file> node index.js
    ```

- Create events by making changes in the subscribed table

- To stop the subscription, execute `NOTIFY benchmark` in benchmark postgres instance which will trigger a notification to stop the benchmark script


### Benchmark Table:

```js
exports.up = function(knex, Promise) {
    return knex.schema.createTable('events', (table) => {

        table.string('label').notNullable(); // unqiue label to identify benchmark
        table.integer('connection_id').notNullable(); // connection_id represents the nth connection
        table.integer('operation_id').notNullable();
        table.integer('event_number').notNullable(); // event_number represents the nth event that was receieved by the client
        table.jsonb('event_data').notNullable(); // event_data stores the data that was received this can be used to validate
        table.timestamp('event_time', { useTz: true }).notNullable(); // event_time stores the time at which the event was receieved by the client.
        table.boolean('is_error').notNullable(); // is_error represents whether the event was error or not.
        table.integer('latency'); // latency is not populated by the benchmark tool, but this can be populated by calculating `event_time-event_triggerd_time`

        table.unique(['label','connection_id', 'operation_id', 'event_number'])
    });
}
```
