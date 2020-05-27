import { Client } from './subscriptions';
import { Config } from './config';
import { OperationOptions } from './subscriptions';
import { Events, knexConnection } from './schema';

let client : { [key:string]:Client; } = {};

let connections: any[] = [];

let timeoutObject: any;

let timeoutAttempt: number = 0;

let label: string = undefined;

let endpoint: string = undefined;

let configFilePath: string = undefined;

interface eventData {
    connection_id: number;
    operation_id: number;
    event_number: number;
    event_data: object;
    event_time: string;
    is_error: boolean;
}

let eventDatas: eventData[] = [];

function subscribe(connectionId: any) {
    connectionId = parseInt(connectionId);
    client[connectionId.toString()].subscribe(
    connections[connectionId-1],
        (data, opId, eventId, eventTime) => {
            eventDatas.push(
                {
                    label: label,
                    connection_id: connectionId,
                    operation_id: opId,
                    event_number:  eventId,
                    event_data: data,
                    event_time: eventTime,
                    is_error: false,
                } as eventData
            )
        },
        (err, opId, eventId, eventTime) => {
            eventDatas.push(
                {
                    label: label,
                    connection_id: connectionId,
                    operation_id: opId,
                    event_number:  eventId,
                    event_data: err,
                    event_time: eventTime,
                    is_error: true,
                } as eventData
            )
        }
    )
}

function createClients(endpoint: string, operations: OperationOptions[], startValue: number) {
    for (var _i=1; _i <= operations.length; _i++) {
        const id = (_i + startValue).toString();
        const subOperationLength = operations[_i-1].length;
        client[id] = new Client(endpoint, {
        connectionId: id,
        connectionCallback: (err, connectionId) => {
            if (!err) {
                console.log(`Subscribing Connection ${connectionId} with ${subOperationLength} operations`);
                subscribe(connectionId);
            } else {
                console.log(`Received error message for connection ${connectionId}`)
                console.error(err);
                exit();
            }
        },
        connectionParams: {
            headers: operations[_i-1][0]["headers"]
        }
    });
    }
}

function distributeClients(endpoint: string, operations: OperationOptions[], limit: number) {
    timeoutAttempt = timeoutAttempt + 1;
    let tmpOperations = operations.slice((limit * timeoutAttempt) - limit, (limit * timeoutAttempt));
    if (tmpOperations.length !== 0) {
        console.log(`SetInterval attempt at ${timeoutAttempt}`);
        createClients(endpoint, tmpOperations, (limit * timeoutAttempt) - limit)
    }
}

function closeClients() {
    for (let id in client) {
        if (client[id].status === 1) {
            client[id].close();
        }
    }
}

async function assertDatabaseConnection() {
    return knexConnection.raw('select 1+1 as result')
        .catch((err: any) => {
            console.log('Failed to establish connection to database! Exiting...');
            console.log(err);
            process.exit(1);
        });
}

async function init() {
    if (typeof(process.env.PG_CONNECTION_STRING) === 'undefined') {
        console.error('ENV PG_CONNECTION_STRING is not set');
        return;
    }
    endpoint = process.env.ENDPOINT;
    if (typeof(endpoint) === 'undefined' || endpoint === '') {
        console.error('ENV ENDPOINT is not set');
        return;
    }
    label = process.env.LABEL;
    if (typeof(label) === 'undefined' || label === '') {
        console.log('Creating random label');
        // create own label
        label = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
    configFilePath = process.env.CONFIG_FILE_PATH;
    if (typeof(configFilePath) === 'undefined' || configFilePath === '') {
        console.error('ENV CONFIG_FILE_PATH is not set');
        return;
    }
    console.log(`Endpoint is ${endpoint}`);
    console.log(`Label is ${label}`);
    await assertDatabaseConnection();
    const config = new Config(configFilePath);
    config.readFile().then(
        () => {
            connections = config.getOperations();
            const connectionLimit = config.getNumberOfConnectionPerSecond(connections);
            if (connectionLimit) {
                timeoutObject = setInterval(distributeClients, 1000, endpoint, connections, connectionLimit);
            } else {
                createClients(endpoint, connections, 0);
            }
        },
        (err: Error) =>  {
            console.log(err);
        }
    );
}

;



const insertData = (): Promise<any> => {
    return new Promise(function (resolve, reject) {
        Events.query()
                    .allowInsert('[connection_id, event_number, event_data, event_time]')
                    .insertGraph(eventDatas).then((result: any)=> {
                        console.log(`Inserted total of ${result.length} events for label ${label}`);
                        resolve(result);
                    }).catch((err: Error) => reject(err));
    });
};

function exit() {
    clearInterval(timeoutObject);
    closeClients();
    insertData().then(
        () => {
            knexConnection.destroy();
        },
        (err: Error) => {
            console.log(err);
            knexConnection.destroy();
            process.exit(1);
        }
    );
}

process.on('SIGINT', function() {
    exit();
});

init();