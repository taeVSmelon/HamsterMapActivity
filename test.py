from pathlib import Path
import pathspec

folder = Path(__file__).parent

# อ่าน pattern จาก .gitignore
gitignore_file = folder / ".gitignore"
if gitignore_file.exists():
    patterns = gitignore_file.read_text().splitlines()
    spec = pathspec.PathSpec.from_lines('gitwildmatch', patterns)
else:
    spec = None

def search(folder):
    for item in folder.iterdir():
        # ถ้ามี pathspec และไฟล์ตรงกับ .gitignore, ข้ามไป
        if spec and spec.match_file(item.relative_to(folder.parent).as_posix()):
            continue
        if item.is_dir():
            search(item)
        else:
            print(item)

search(folder)
