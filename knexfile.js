module.exports = {
    client: 'sqlite3',
    connection: {
        filename: __dirname + '/data.sqlite'
    },
    migrations: {
        directory: __dirname + '/migrations'
    },
    useNullAsDefault: true,
    pool: {
        afterCreate: function (conn, done) {
            conn.exec('DELETE FROM events;', function (err) {
                if (err) {
                    if (err.message == 'SQLITE_ERROR: no such table: events') {
                        done(null, conn);
                    } else {
                        done(err, conn);
                    }
                }
                done(null, conn);
            });
        }
    }
}