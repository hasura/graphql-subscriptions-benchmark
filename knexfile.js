var process = require('process');

let listening = false;

module.exports = {
    client: 'pg',
    connection: process.env.PG_CONNECTION_STRING,
    migrations: {
        directory: __dirname + '/migrations'
    },
    useNullAsDefault: true,
    pool: {
        min: 1,
        max: 1,
        afterCreate: function (conn, done) {
            if (listening) {
                done(null, connection);
                return;
            }

            listening = true;
            conn.query('LISTEN benchmark', function(err) {
                if (err) {
                    listening = false;
                } else {
                    conn.on('notification', (msg) => {
                        console.log("Got " + msg.channel + " payload " + msg.payload);
                        if (process.pid) {
                            console.log('This process is your pid ' + process.pid);
                            process.kill(process.pid, "SIGINT");
                        }
                    });

                    conn.on('end', () => {
                        listening = false;
                    });

                    conn.on('error', (err) => {
                        console.log("PostGres Connection Error: " + err);
                    });
                }
                done(err, conn);
            });
        },
    }
}