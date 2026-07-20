const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const authRouter = require('./routers/auth.routers');
const { client } = require('./cleint/client');
const userRouter = require('./routers/user.router');
const expertRouter = require('./routers/expert.routers');
const categoryRouter = require('./routers/category.routers');
const ratingRouter = require('./routers/rating.routers');
const sessionRouter = require('./routers/session.routers');
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
app.use('/api/users', userRouter);
app.use('/api/experts', expertRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/ratings', ratingRouter);
app.use('/api/sessions', sessionRouter);


app.listen(PORT, () => {console.log(`Server is running on port ${PORT}`)});