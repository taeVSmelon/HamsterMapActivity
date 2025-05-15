import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

// MongoDB connection URL
const mongoURL = process.env.MONGODB_URI;

// Connect to MongoDB
async function connectDB() {
    try {
        const mongoDB = await mongoose.connect(mongoURL);
        console.log('Connected to MongoDB successfully');

        return mongoDB;
    } catch {
        console.error('Error connecting to MongoDB:', error);
    }
}

// Export mongoose for use in other files
export default connectDB;