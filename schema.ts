const Knex = require('knex');
const connection = require('../knexfile');
export const { Model } = require('objection');

export const knexConnection = Knex(connection);
Model.knex(knexConnection);

export class Events extends Model {
    static get tableName () {
        return 'events';
    }

    static get idColumn() {
        return 'id';
    }

    static get jsonSchema () {
        return {
            type: 'object',
            required: ['connection_id', 'event_number', 'event_data', 'event_time'],
            properties: {
                id: {type: 'integer'},
                connection_id: {type: 'integer'},
                event_number: {type: 'integer'},
                event_data: {type: 'string', minLength: 1, maxLength: 255},
                is_valid: {type: 'boolean'},
                event_time: {type: 'decimal'}
            }
        }
    }
}