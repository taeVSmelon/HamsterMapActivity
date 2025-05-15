import mongoose from "mongoose";
import mongooseSequence from "mongoose-sequence";
const AutoIncrement = mongooseSequence(mongoose);

const worldSchema = new mongoose.Schema(
    {
        id: {
            type: Number,
            unique: true,
            index: true
        },
        worldName: {
            type: String,
            required: true
        },
        stages: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Stage"
            }
        ],
        whitelists: {
            type: [Number],
            default: []
        }
    }
);

worldSchema.plugin(AutoIncrement, { id: 'world_id', inc_field: 'id', start_seq: 1000000 });

const worldModel = mongoose.model("World", worldSchema, "World");

export default worldModel;
