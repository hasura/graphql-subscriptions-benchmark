import { Client, ConnectionParams } from './subscriptions';
import { Config } from './config';
import { OperationOptions } from './subscriptions';
import { Events, knexConnection } from './schema';
import { create } from 'domain';

let client : { [key:string]:Client; } = {};

let connectionParams: OperationOptions[];

let connections: any[] = [];

let timeoutObject: any;

let timeoutAttempt: number = 0;

interface eventData {
    connection_id: number;
    event_number: number;
    event_data: string;
    event_time: any;
}

let eventDatas: eventData[] = [];

function subscribe(connectionId: any) {
    connectionId = parseInt(connectionId);
    client[connectionId.toString()].subscribe(
    connections[connectionId-1],
        (data, opId, eventId) => {
            const date: Date = new Date();
            eventDatas.push(
                {
                    connection_id: connectionId,
                    operation_id: opId,
                    event_number:  eventId,
                    event_data: JSON.stringify(data),
                    event_time: (new Date().getTime() / 1000),
                } as eventData
            )
        },
        (err) => {
            console.log(err);
        }
    )
}

function createClients(endpoint: string, operations: OperationOptions[], startValue: number) {
    for (var _i=1; _i <= operations.length; _i++) {
        const id = (_i + startValue).toString();
        client[id] = new Client(endpoint, {
        connectionId: id,
        connectionCallback: (err, connectionId) => {
            if (!err) {
                console.log(`Creating Connection ${id}`);
                subscribe(connectionId);
            } else {
                console.log(err);
            }
        },
        connectionParams: {
            headers: operations[_i-1]["headers"]
        }
    });
    }
}

function distributeClients(endpoint: string, operations: OperationOptions[]) {
    timeoutAttempt = timeoutAttempt + 1;
    console.log(`Timeout Attempt at ${timeoutAttempt}`);
    let tmpOperations = operations.slice((timeoutAttempt * 100) - 99, (timeoutAttempt * 100));
    if (tmpOperations.length !== 0) {
        createClients(endpoint, tmpOperations, (timeoutAttempt * 100) - 100)
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
    if (process.argv.length != 4) {
        console.error("configFile argument not set");
    }
    const endpoint = process.argv[2];
    const configFile = process.argv[3];
    const config = new Config(configFile);
    config.readFile().then(
        (success) => {
            connections = config.getOperations();
            const connectionLimit = config.getNumberOfConnectionEvery10thSecond(connections);
            if (connectionLimit) {
                timeoutObject = setInterval(distributeClients, 10000, endpoint, connections);
            } else {
                createClients(endpoint, connections, 0);
            }
        },
        (err: Error) =>  {
            console.log(err);
        }
    );
}

const insertData = (): Promise<any> => {
    return new Promise(function (resolve, reject) {
        Events.query()
                    .allowInsert('[connection_id, event_number, event_data, event_time]')
                    .insertGraph(eventDatas).then((result: any)=> {
                        return resolve(true);
                    }).catch((err: Error) => reject(err));
    });
};

const close = () => {
    knexConnection.destroy();
    closeClients();
}

process.on('SIGINT', function() {
    clearInterval(timeoutObject);
    insertData().then(
        (data: any) => {
            close();
        },
        (err: Error) => {
            console.log(err);
            close();
        }
    );
});

main()