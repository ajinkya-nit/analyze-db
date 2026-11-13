
import mysql from 'mysql2/promise';
import { env } from './src/config/env.js';

import {
  discoverSchemaObjects,
  discoverTableColumns,
} from './src/database/adapters/mysql-schema.adapter.js';

async function main() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: env.mysql.host,
      port: env.mysql.port,
      user: env.mysql.user,
      password: env.mysql.password,
      database: env.mysql.database,
      connectTimeout: 5000,
    });

    const objects = await discoverSchemaObjects(
      connection,
      env.mysql.database
    );

    console.log('\nDiscovered database objects:');
    console.table(objects);

    for (const object of objects) {
      if (object.objectType !== 'table') {
        continue;
      }

      const columns = await discoverTableColumns(
        connection,
        env.mysql.database,
        object.objectName
      );

      console.log(`\nColumns in table: ${object.objectName}`);
      console.table(columns);
    }

  } catch (error) {
    console.error('Schema discovery test failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

main();
