import { Client, ConnectionParams } from './subscriptions';
import { Config } from './config';
import { OperationOptions } from './subscriptions';
import { Events, knexConnection } from './schema';

let client : { [key:string]:Client; } = {};

let connectionParams: OperationOptions[];

let connections: any[] = [];

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

function createClients(endpoint: string, operations: OperationOptions[]) {
    for (var _i=1; _i <= operations.length; _i++) {
        const id = _i.toString();
        client[id] = new Client(endpoint, {
        connectionId: id,
        connectionCallback: (err, connectionId) => {
            if (!err) {
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
            createClients(endpoint, connections);
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