import { fixedItemModel } from "../models/item.js";

class FixedReward {
  static groups = new Map();

  constructor(id, iconName, name, percent) {
    this.id = id;
    this.iconName = iconName;
    this.name = name;
    this.percent = percent;
  }

  async createItemObject() {
    const item = await fixedItemModel.findOne({ fixedItemId: this.id }).lean();

    if (item) {
      await fixedItemModel.updateOne(
        { fixedItemId: this.id },
        {
          iconPath: `/images/${this.iconName}`,
          name: this.name,
          canStack: true
        }
      );
    } else {
      await fixedItemModel.create({
        fixedItemId: this.id,
        iconPath: `/images/${this.iconName}`,
        name: this.name,
        canStack: true
      });
    }
  }

  static async addNewItem(id, iconName, name) {
    const fixedReward = new FixedReward(id, iconName, name, undefined);

    await fixedReward.createItemObject();
  }

  static async addNewRandomItem(id, iconName, name, percent, group) {
    const fixedReward = new FixedReward(id, iconName, name, percent);

    await fixedReward.createItemObject();

    if (group != null) {
      if (FixedReward.groups.has(group))
        FixedReward.groups.get(group).push(fixedReward);
      else
        FixedReward.groups.set(group, [fixedReward])
    }
  }

  static async getItemObject(id) {
    const item = await fixedItemModel.findOne({ fixedItemId: id }).lean();

    return item;
  }

  static async getItemImages(groupName) {
    if (!groupName) return [];
  
    const fixedRewards = this.groups.get(groupName);
    if (!fixedRewards) return [];
  
    const ids = fixedRewards.map(reward => reward.id);
  
    const items = await fixedItemModel.find({ fixedItemId: { $in: ids } }, 'iconPath').lean();
  
    return [...new Set(items.map(item => item.iconPath))];
  }

  static roll(groupName) {
    if (groupName == null) return null;

    const fixedRewards = this.groups.get(groupName);

    if (!fixedRewards) return null;

    const allPercent = fixedRewards.map(i => i.percent).reduce(
      (sum, rate) => sum + rate,
      0,
    );

    if (allPercent <= 0) {
      return null;
    }

    let percentRandom = Math.floor(Math.random() * allPercent) + 1;

    for (const fixedReward of fixedRewards) {
      percentRandom -= fixedReward.percent;
      if (percentRandom <= 0) {
        return fixedReward;
      }
    }

    return null;
  }
}

export default FixedReward;