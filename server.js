const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const authRouter = require('./routers/auth.routers');
const { client } = require('./cleint/client');
const userRouter = require('./routers/user.router');
const expertRouter = require('./routers/expert.routers');
const categoryRouter = require('./routers/category.routers');
const ratingRouter = require('./routers/rating.routers');
const sessionRouter = require('./routers/session.routers');
const paymentRouter = require('./routers/payment.routers');
const blogRouter = require('./routers/blog.routers');
const communityRouter = require('./routers/community.routers');
const sessionBookingRouter = require('./routers/bookingSession.router');
const app = express();
dotenv.config();
const PORT = process.env.PORT || 3000;


app.use(
  cors({
    origin: ['http://localhost:3003', 'http://localhost:5174', 'http://localhost:3000','https://crm.cultcoder.com','https://cosmicguruji.com'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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
app.use('/api/payment', paymentRouter);
app.use('/api/community', communityRouter);
app.use('/api/session-purchase', sessionBookingRouter);
app.use('/api/blogs', blogRouter);

app.listen(PORT, () => {console.log(`Server is running on port ${PORT}`)});









