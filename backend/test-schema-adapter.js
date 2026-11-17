
import mysql from 'mysql2/promise';
import { env } from './src/config/env.js';

import {
  discoverSchemaObjects,
  discoverTableColumns,
  discoverPrimaryKeys,
  discoverForeignKeys,
  discoverTableIndexes,
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

      console.log(`\n========== ${object.objectName} ==========`);

      const columns = await discoverTableColumns(
        connection,
        env.mysql.database,
        object.objectName
      );

      console.log('\nColumns:');
      console.table(columns);

      const primaryKeys = await discoverPrimaryKeys(
        connection,
        env.mysql.database,
        object.objectName
      );

      console.log('\nPrimary keys:');
      console.table(primaryKeys);

      const foreignKeys = await discoverForeignKeys(
        connection,
        env.mysql.database,
        object.objectName
      );

      const indexes = await discoverTableIndexes(
        connection,
        env.mysql.database,
        object.objectName
      );

      console.log('\nIndexes:');
      console.table(indexes);

      for (const index of indexes) {
        console.log(`\nIndex: ${index.indexName}`);
        console.table(index.columns);
      }

      console.log('\nForeign keys:');
      console.table(foreignKeys);
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
