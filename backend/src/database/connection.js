import mysql from "mysql2/promise";
import { env } from "../config/env.js";

export const pool = mysql.createPool({
    host: env.mysql.host,
    port: env.mysql.port,
    user: env.mysql.user,
    password: env.mysql.password,
    database: env.mysql.database,

    waitForConnections: true, // to queue excess connections
    connectionLimit: env.mysql.connectionLimit, // maximum connections live at a time
    queueLimit: 0,  // no. of requests in queue , here unlimited
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
});


export async function testDatabaseConnection() {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.ping();
        return {
            connected: true,
            database: env.mysql.database,
            host: env.mysql.host,
        };
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

// Close all pooled connections
export async function closeDatabaseConnection() {
    await pool.end();
}
