import mongoose from "mongoose";
import mongooseSequence from "mongoose-sequence";
const AutoIncrement = mongooseSequence(mongoose);

const enemyNames = {
    normal: [
        "ChargeEnemy",
        "MeleeEnemy",
        "HealEnemy",
        "RangedEnemy",
    ],
    boss: [
        "MrXBoss",
        "SamuraiBoss",
    ]
};

const stageSchema = new mongoose.Schema(
    {
        id: {
            type: Number,
            unique: true,
            index: true
        },
        type: {
            type: String,
            default: "Stage"
        },
        stageName: {
            type: String,
            required: true
        },
        reward: {
            type: mongoose.Types.ObjectId,
            ref: "Reward",
            default: undefined
        },
        worldId: {
            type: Number,
            required: true
        }
    },
    {
        discriminatorKey: "type",
    }
);

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

const codeStageSchema = new mongoose.Schema({
    description: {
        type: [valueSchema],
        default: []
    },
    exampleOutput: {
        type: String,
        default: ""
    },
    realAnswer: {
        type: String,
        default: null
    },
    npc: {
        type: npcSchema,
        default: null
    },
    haveApprove: {
        type: Boolean,
        default: false
    },
});

const enemySpawnData = new mongoose.Schema(
    {
        enemyPrefabName: {
            type: String,
            required: true,
        },
        count: {
            type: Number,
            default: 1,
        },
    },
    { _id: false }
);

const waveSchema = new mongoose.Schema(
    {
        enemySpawnDatas: {
            type: [enemySpawnData],
            default: []
        },
        bossPrefabName: {
            type: String,
            default: null,
        },
        bossPosition: {
            type: new mongoose.Schema(
                {
                    x: { type: Number, required: true },
                    y: { type: Number, required: true },
                },
                { _id: false }
            ),
            default: null,
        },
    },
    { _id: false }
);

const combatStageSchema = new mongoose.Schema({
    dungeon: {
        waves: {
            type: [waveSchema],
            required: true,
        },
    },
});

stageSchema.plugin(AutoIncrement, { id: 'stage_id', inc_field: 'id', start_seq: 1000000 });

stageSchema.pre("save", function (next) {
    if (this.type === "Stage") {
        return next(new Error("Cannot save base Stage model directly."));
    }
    next();
});

stageSchema.pre("insertMany", function (next, docs) {
    const hasBaseStage = docs.some(doc => doc.type === "Stage");
    if (hasBaseStage) {
        return next(new Error("Cannot insert base Stage model directly."));
    }
    next();
});

const stageModel = mongoose.model("Stage", stageSchema, "Stage");
const codeStageModel = stageModel.discriminator("CodeStage", codeStageSchema, "CodeStage");
const combatStageModel = stageModel.discriminator("CombatStage", combatStageSchema, "CombatStage");

export { stageModel, codeStageModel, combatStageModel, stageSchema, enemyNames };
