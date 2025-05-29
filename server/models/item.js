import mongoose from "mongoose";
import mongooseSequence from "mongoose-sequence";
const AutoIncrement = mongooseSequence(mongoose);

const skillTypes = [
  "Breakable",
  "Bomb",
  "Cannon",
  "Fire",
  "Heal",
  "Needle",
  "Slow Down",
  "Titan Size"
];

const itemSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    type: {
      type: String,
      default: "NormalItem",
    },
    iconPath: {
      type: String,
      default: null
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: null,
    },
    canStack: {
      type: Boolean,
      default: false,
    },
    canBuy: {
      type: Boolean,
      default: false,
    },
    buyPrice: {
      type: Number,
      default: 0,
    },
    canSell: {
      type: Boolean,
      default: false,
    },
    sellPrice: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true, discriminatorKey: "type" },
);

const fixedItemSchema = new mongoose.Schema({
  fixedItemId: {
    type: String,
    required: true,
  }
});

const coreItemSchema = new mongoose.Schema({
  health: {
    type: Number,
    required: true,
  },
  armor: {
    type: Number,
    required: true,
  },
});

const voidItemSchema = new mongoose.Schema({
  voidPrefabName: {
    type: String,
    required: true,
  },
  minDamage: {
    type: Number,
    required: true,
  },
  maxDamage: {
    type: Number,
    required: true,
  },
  minSpeed: {
    type: Number,
    required: true,
  },
  maxSpeed: {
    type: Number,
    required: true,
  },
  chargeTime: {
    type: Number,
    required: true,
  },
  forcePower: {
    type: Number,
    required: true,
  },
  lifeTime: {
    type: Number,
    required: true,
  },
  skills: [
    {
      _id: false,
      skillName: {
        type: String,
        enum: skillTypes,
        required: true,
      },
      level: {
        type: Number,
        default: 1,

      },
    },
  ],
});

itemSchema.plugin(AutoIncrement, { id: 'item_id', inc_field: 'id', start_seq: 1000000 });

const itemModel = mongoose.model("Item", itemSchema, "Item");
const fixedItemModel = itemModel.discriminator("FixedItem", fixedItemSchema, "FixedItem");
const coreItemModel = itemModel.discriminator("CoreItem", coreItemSchema, "CoreItem");
const voidItemModel = itemModel.discriminator("VoidItem", voidItemSchema, "VoidItem");

export { itemModel, fixedItemModel, coreItemModel, voidItemModel, skillTypes };
