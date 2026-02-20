import http from 'http';
import SocketService from './services/socket';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { connectDatabase } from './utils/prisma';

dotenv.config();

async function init() {
    await connectDatabase();

    const socketService = new SocketService();

    const app = express();
    const httpServer = http.createServer(app);
    const PORT = process.env.PORT || 3000;

    socketService.io.attach(httpServer);

    httpServer.listen(PORT, () => {
        console.log(`Server running on PORT: ${PORT}`)
    });

    app.use(express.json());
    app.use(cors({origin:true}));
    app.use(express.urlencoded({ extended: false }));

    app.get('/', (req, res) => {
        res.send('Server is running at PORT: ' + PORT);
    });

    socketService.initListeners();
}

init().catch((err) => {
    console.error("Server failed to start:", err.message);
    process.exit(1);
});