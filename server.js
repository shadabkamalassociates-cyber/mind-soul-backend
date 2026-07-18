const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const authRouter = require('./routers/auth.routers');
const { client } = require('./cleint/client');
const app = express();
dotenv.config();
const PORT = process.env.PORT || 3000;


app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const data = async () => {
    const res = await client.connect();
    console.log('Connected to the database');
}
data();

app.get('/', (req, res) => {
    res.send('Mind Soul API is running');
});

app.use('/api', authRouter);
    


app.listen(PORT, () => {console.log(`Server is running on port ${PORT}`)});