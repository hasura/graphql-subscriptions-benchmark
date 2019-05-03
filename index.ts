import { Client } from './subscriptions';
import { Config } from './config';
import { OperationOptions } from './subscriptions';
import { Events, knexConnection } from './schema';

import * as readline from 'readline';
import { raw } from 'objection';

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

function main() {
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
        console.error('ENV ENDPOINT is not set');
        return;
    }
    console.log(`Endpoint is ${endpoint}`);
    console.log(`Label is ${label}`);
    const config = new Config(configFilePath);
    config.readFile().then(
        (success) => {
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

async function getEvents() {
    const rows = await Events.query()
        .columns('event_number')
        .where('label', label)
        .orderBy('event_number')
        .groupBy('event_number')
    return rows;
};


async function setLatency(datetime: string, event_number: number ) {
    await Events.query()
        .patch({
            latency: raw(`EXTRACT(epoch FROM(event_time - '${datetime}')) * 1000`),
        })
        .where('label', label)
        .where('event_number', event_number);
    return 'test';
}

const insertData = (): Promise<any> => {
    return new Promise(function (resolve, reject) {
        Events.query()
                    .allowInsert('[connection_id, event_number, event_data, event_time]')
                    .insertGraph(eventDatas).then((result: any)=> {
                        console.log(`Inserted total of ${result.length} events for label ${label}`);
                        getEvents().then(
                            (rows: any) => {
                                const filteredEvents = rows.filter((event: { event_number: number; }) => event.event_number !== 1);
                                if (filteredEvents.length === 0) {
                                    resolve(result);
                                }
                                let totalAnswers = 0;
                                filteredEvents.forEach((event: { event_number: number; }) => {
                                    let rl = readline.createInterface({
                                        input: process.stdin,
                                        output: process.stdout
                                    });
                                    rl.question(`Time at which event number ${event.event_number} is executed: `, async (answer) => {
                                        const date = new Date(answer);
                                        ++totalAnswers;
                                        rl.close();
                                        await setLatency(date.toISOString(), event.event_number);
                                        if (totalAnswers === filteredEvents.length) {
                                            resolve(result);
                                        }
                                    });
                                });
                            },
                            (err: Error) => {
                                reject(err);
                            }
                        )
                    }).catch((err: Error) => reject(err));
    });
};

function exit() {
    clearInterval(timeoutObject);
    closeClients();
    insertData().then(
        (data: any) => {
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

main();