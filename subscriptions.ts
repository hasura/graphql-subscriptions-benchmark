const ws = require('ws');
import { ExecutionResult } from 'graphql/execution/execute';

export interface Observer<T> {
    next?: (value: T) => void;
    error?: (error: Error) => void;
    complete?: () => void;
}

export interface OperationOptions {
    query?: string;
    variables?: Object;
    operationName?: string;
    [key: string]: any;
}

export type FormatedError = Error & {
    originalError?: any;
};

export interface Operation {
    options: OperationOptions;
    handler: (error: Error[], result?: any) => void;
}

export interface Operations {
    [id: string]: Operation;
}

export interface Events {
    [id: string]: number;
}

export type ConnectionParams = {
    [paramName: string]: any,
};

export type ConnectionParamsOptions = ConnectionParams | Function | Promise<ConnectionParams>;

export interface ClientOptions {
    connectionId?: string;
    connectionCallback?: (error: Error[], connectionId?: any) => void;
    connectionParams?: ConnectionParamsOptions;
};

export class Client {
    public client: any;
    public operations: Operations;
    public events: Events;
    private connectionParams: Function;
    private wsImpl: any;
    private url: string;
    private connectionCallback: any;
    private nextOperationId: number;
    private connectionId: string;

    constructor(url: string, options?: ClientOptions) {
        const {
            connectionCallback = undefined,
            connectionParams = {},
            connectionId = ""
        } = (options || {});

        this.wsImpl = ws;
        this.url = url;
        this.connectionParams = this.getConnectionParams(connectionParams);
        this.operations = {};
        this.events = {};
        this.connectionCallback = connectionCallback;
        this.connectionId = connectionId;
        this.nextOperationId = 0;

        this.connect();
    }

    public get status() {
        if (this.client === null) {
          return this.wsImpl.CLOSED;
        }
    
        return this.client.readyState;
    }

    public unsubscribeAll() {
       
    }

    public close() {
        this.unsubscribeAll();
        this.sendMessage(undefined, 'connection_terminate', null);

        this.client.close();
        this.client = null;
    }

    public subscribe(
        request: OperationOptions[],
        observerOrNext: (v: ExecutionResult, opID?: string, eventId?: number) => void,
        onError?: (error: Error) => void,
        onComplete?: () => void
    ) {
        for (let operation of request) {
            let opId: string;
            opId = this.executeOperation(operation, (error: Error[], result: any) => {
                if ( error === null && result === null ) {
                    if ( onComplete ) {
                        onComplete();
                    }
                } else if (error) {
                    if (onError) {
                        onError(error[0]);
                    }
                } else {
                    if (observerOrNext) {
                        observerOrNext(result, opId, this.events[opId]);
                    }
                }
            });
        }
    }

    private getConnectionParams(connectionParams: ConnectionParamsOptions): Function {
        return (): Promise<ConnectionParams> => new Promise((resolve, reject) => {
            if (typeof connectionParams === 'function') {
                try {
                    return resolve(connectionParams.call(null));
                } catch (error) {
                    return reject(error);
                }
            }

            resolve(connectionParams);
        });
    }

    private executeOperation(options: OperationOptions, handler: (error: Error[], result?: any) => void): string {
        const opId = this.generateOperationId();
        this.operations[opId] = { options: options, handler };
        this.events[opId] = 0;

        if (!options.query) {
            throw new Error('Must provide a query.');
        }

        if (!handler) {
            throw new Error('Must provide an handler.');
        }

        if (this.operations[opId]) {
            this.sendMessage(opId, 'start', options);
        }

        return opId;
    }

    private generateOperationId(): string {
        return String(++this.nextOperationId);
    }

    private sendMessage(id: string, type: string, payload: any) {
        let serializedMessage: string = JSON.stringify({
            id: id,
            type: type,
            payload: payload,
        });
        try {
            JSON.parse(serializedMessage);
        } catch (e) {
            throw new Error(`Message must be JSON-parseable.`);
        }
        this.client.send(serializedMessage);
    }

    private connect() {
        this.client = new this.wsImpl(this.url, 'graphql-ws');

        this.client.onopen = async () => {
            if (this.status === this.wsImpl.OPEN) {
                // send connection_init message
                try {
                    const connectionParams: ConnectionParams = await this.connectionParams();

                    this.sendMessage(undefined, 'connection_init', connectionParams);
                } catch (error) {
                    this.connectionCallback(error);
                }
            }
        }

        this.client.onclose = () => {
            console.log('closed');
        };

        this.client.onerror = (err: Error) => {
            console.log(err);
        }

        this.client.onmessage = ({ data }: {data: any}) => {
            this.processReceivedData(data);
        }
    }

    private formatErrors(errors: any): FormatedError[] {
        if (Array.isArray(errors)) {
            return errors;
        }

        if (errors && errors.errors) {
            return this.formatErrors(errors.errors);
        }

        if (errors && errors.message) {
            return [errors];
        }

        return [{
            name: 'FormatedError',
            message: 'Unknown error',
            originalError: errors
        }];
    }

    private processReceivedData(receivedData: any) {
        let parsedMessage: any;
        let opId: string;

        try {
            parsedMessage = JSON.parse(receivedData);
            opId = parsedMessage.id;
        } catch(e) {
            throw new Error(`Message must be JSON-parseable. Got: ${receivedData}`);
        }

        switch (parsedMessage.type) {
            case 'connection_error':
                if (this.connectionCallback) {
                    this.connectionCallback(parsedMessage.payload);
                }
                break;
            
            case 'connection_ack':
                if (this.connectionCallback) {
                    this.connectionCallback(null, this.connectionId);
                }
                break;
            
            case 'complete':
                delete this.operations[opId];
                delete this.events[opId];
                break;
            
            case 'error':
                this.operations[opId].handler(this.formatErrors(parsedMessage.payload), null);
                delete this.operations[opId];
                delete this.events[opId];
                break;
            
            case 'data':
                const parsedPayload = !parsedMessage.payload.errors ?
                    parsedMessage.payload : {...parsedMessage.payload, errors: this.formatErrors(parsedMessage.payload.errors)};
                ++this.events[opId];
                this.operations[opId].handler(null, parsedPayload);
                break;
            
            case 'ka':
                break;
            
            default:
                throw new Error('Invalid message type!');
        }
    }
}