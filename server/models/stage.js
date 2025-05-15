import mongoose from "mongoose";
import mongooseSequence from "mongoose-sequence";
const AutoIncrement = mongooseSequence(mongoose);

const valueSchema = new mongoose.Schema(
    {
        valueType: {
            type: String,
            enum: ["text", "image"],
            required: true,
        },
        value: {
            type: String,
            required: true,
        },
    },
    { _id: false, timestamps: false },
);

const npcSchema = new mongoose.Schema(
    {
        npcName: {
            type: String,
            required: true,
        },
        dialog: {
            type: [valueSchema],
            required: true,
        },
    },
    { _id: false, timestamps: false },
);

const stageSchema = new mongoose.Schema(
    {
        id: {
            type: Number,
            unique: true,
            index: true
        },
        stageName: {
            type: String,
            require: true
        },
        description: {
          type: [valueSchema],
          required: true,
        },
        exampleOutput: {
            type: String,
            default: ""
        },
        npc: {
            type: npcSchema,
            default: null
        },
        haveApprove: {
            type: Boolean,
            default: false
        },
        reward: {
            type: mongoose.Types.ObjectId,
            ref: "Reward",
            default: undefined
        }
    }
);

stageSchema.plugin(AutoIncrement, { id: 'stage_id', inc_field: 'id', start_seq: 1000000 });

const stageModel = mongoose.model("Stage", stageSchema, "Stage");

export { stageModel, stageSchema };
