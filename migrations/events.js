exports.up = function(knex, Promise) {
    return knex.schema.createTable('events', (table) => {

        table.string('label').notNullable();
        table.integer('connection_id').notNullable();
        table.integer('operation_id').notNullable();
        table.integer('event_number').notNullable();
        table.jsonb('event_data').notNullable();
        table.timestamp('event_time', { useTz: true }).notNullable();
        table.boolean('is_error').notNullable();
        table.integer('latency');

        table.unique(['label','connection_id', 'operation_id', 'event_number'])
    });
}

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('events');
}