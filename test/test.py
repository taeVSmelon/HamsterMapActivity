import requests
import json

with open("./test/localStage.json", "r", encoding="utf-8") as f:
    stageDatas = [{
        "stageType": "CodeStage",
        "stageName": stageData["_stage"],
        "description": stageData["description"],
        "exampleOutput": stageData["exampleOutput"],
        "npc": stageData["npc"],
        "haveApprove": False,
        "rewardId": None
    } if stageData["type"] == "CodeStage" else {
        "stageType": "CombatStage",
        "stageName": stageData["_stage"],
        "dungeon": stageData["dungeon"],
        "rewardId": None
    } for stageData in json.load(f)]

print(json.dumps(stageDatas, indent=4, ensure_ascii=False), end="\n\n\n")

requestJson = {
    "worldName": "Test",
    "stages": stageDatas
}

response = requests.post(
    "http://localhost:8000/admin/world/create",
    json=requestJson
)

if response.ok:
    print(response.json())
else:
    print(response.text)