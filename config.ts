import { OperationOptions } from './subscriptions';
import { resolve } from 'url';

interface range {
    start: number;
    end: number;
}

interface template {
    range:  range;
    headers?: string[];
    variables?: string[];
}

interface configData {
    query: string;
    variables?: Object;
    headers?: Object;
    template?: template;
};

export class Config {
    private fs = require('fs');
    private filePath: string;
    private data: any;

    constructor(filePath: string) {
        this.filePath = filePath;
    }

    public async readFile(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.read().then((data: any) => {
                this.data = JSON.parse(data);
                resolve(true); 
            },
            (err: Error) => {
                reject(err);
            });
        });
    }

    private async read() {
        return await this.fs.readFileSync(this.filePath);
    }

    public getOperations(): OperationOptions[] {
        const finalConnections: any[] = [];
        if (Array.isArray(this.data)) {
            const data = <configData[]>this.data;
            for ( let operation of data ) {
                finalConnections.push(this.generate(operation));
            }
        } else {
            const data = <configData>this.data;
            const generatedOperations = this.generate(data);
            // split each operation into single connection
            for ( let operation of generatedOperations ) {
                finalConnections.push([operation]);
            }
        }

        return finalConnections;
    }

    private generate(operation: configData): OperationOptions[] {
        let operations: OperationOptions[] = [];
        const options: OperationOptions = {};
        options.query = operation.query;
        if (operation.headers) {
            options["headers"] = operation.headers;
        }
        if (operation.variables) {
            options.variables = operation.variables;
        }
        if ((operation.template) && (operation.template.range)) {
            for(var _i = operation.template.range.start; _i <= operation.template.range.end; _i++) {
                const iOpt = JSON.parse(JSON.stringify(options));
                if (operation.template.headers.length !== 0) {
                    for (let header of operation.template.headers) {
                        iOpt.headers[header] = _i.toString();
                    }
                }

                const variables = <any>iOpt.variables;
                if (operation.template.variables.length !== 0) {
                    for (let variable of operation.template.variables) {
                        variables[variable] = _i.toString();
                        iOpt.variables = variables;
                    }
                }

                operations.push({
                    ...iOpt,
                });
            }
        } else {
            operations.push(options);
        }
        return operations;
    }
}