import 'dotenv/config';
import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await connection.execute('SELECT id, name, email, forwardingEmail FROM users');
console.log(JSON.stringify(rows, null, 2));
await connection.end();
