import * as express from 'express';
import * as path from 'path';

const EXPRESS_PORT = 3000;
const PUBLIC_DIR = path.resolve(__dirname, '../client/public');
const server = express();

server.use(express.static(PUBLIC_DIR));
server.listen(EXPRESS_PORT, () => {
  console.log(`Server listening. http://localhost:${EXPRESS_PORT}`);
});