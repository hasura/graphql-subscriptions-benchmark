exports.up = function(knex, Promise) {
    return knex.schema.createTable('events', (table) => {
        table.increments();
        table.integer('connection_id').notNullable();
        table.integer('operation_id').notNullable();
        table.integer('event_number').notNullable();
        table.string('event_data').notNullable();
        table.decimal('event_time').notNullable();

        table.unique(['connection_id', 'operation_id', 'event_number']) 
    });
}

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('events');
}