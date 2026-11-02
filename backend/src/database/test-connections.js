
import {
    testDatabaseConnection,
    closeDatabaseConnection,
} from "./connection.js";

try {
    const result = await testDatabaseConnection();
    console.log("Database connection successful!");
    console.log(result);
} catch (error) {
    console.error("Database connection failed:", error.message);
    process.exitCode = 1;
} finally {
    await closeDatabaseConnection();
}
