import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

// MongoDB connection URL
const mongoURL = process.env.MONGODB_URI;

// Connect to MongoDB
async function connectDB() {
    mongoose.connect(mongoURL)
    .then(() => {
        console.log('Connected to MongoDB successfully');
    })
    .catch((error) => {
        console.error('Error connecting to MongoDB:', error);
    });
}

// Export mongoose for use in other files
export default connectDB;