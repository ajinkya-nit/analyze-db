import {
  testPostgresConnection,
  closePostgresConnection,
} from './postgres.connection.js';

async function main() {
  try {
    const result = await testPostgresConnection();

    console.log('Supabase PostgreSQL connection successful!');
    console.log(result);
  } catch (error) {
    console.error(
      'Supabase PostgreSQL connection failed:',
      error.message
    );

    process.exitCode = 1;
  } finally {
    await closePostgresConnection();
  }
}

main();