class RaidBoss {
  constructor() {
    this.reset();
  }

  activate(
    bossPrefabName,
    maxHealth,
    health,
    damage,
    rewardId,
    topScoreReward,
    playerJoins
  ) {
    this.active = true;
    this.bossPrefabName = bossPrefabName;
    this.maxHealth = maxHealth;
    this.health = health;
    this.damage = damage;
    this.rewardId = rewardId;
    this.topScoreReward = topScoreReward;
    this.updateHealthChange = Math.floor((this.health / this.maxHealth) * 100) /
      100;
    this.playerJoins =  new Map(
      playerJoins.map(({ discordId, username, damage }) => [
        discordId,
        { username, damage, ws: null }
      ])
    );
  }

  takeDamage(ws, discordId, username, damage) {
    this.health = Math.min(Math.max(0, this.health - damage), this.maxHealth);
    const existing = this.playerJoins.get(discordId);
    this.playerJoins.set(discordId, {
      username,
      ws,
      damage: existing ? existing.damage + damage : damage,
    });

    const currentPercent = Math.floor((this.health / this.maxHealth) * 100) /
      100;
    const healthChanged = currentPercent < this.updateHealthChange;

    if (healthChanged) {
      this.updateHealthChange = currentPercent;
    }

    return healthChanged;
  }

  deactivate() {
    this.active = false;
  }

  reset() {
    this.active = false;
    this.bossPrefabName = null;
    this.maxHealth = 0;
    this.health = 0;
    this.damage = 0;
    this.rewardId = null;
    this.topScoreReward = new Map();
    this.updateHealthChange = 0;
    this.playerJoins = new Map();
  }
}

export default RaidBoss;
