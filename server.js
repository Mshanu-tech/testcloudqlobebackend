const express = require('express');
const dotenv = require('dotenv');
const userRoutes = require('./modules/customer/routes/userRoutes');
const cors = require('cors');
const session = require("express-session");

const corsOptions = {
  origin: "http://localhost:5173",
  credentials: true,
};


dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors(corsOptions))

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 24 hours
  })
);


app.use('/api', userRoutes);

app.get('/', (req, res) => {
  res.send('Welcome to the Admin and Customer Management API');
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
